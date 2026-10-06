// The common record of synchronized input. Every client accepts the same
// packets in the same order, so every ledger holds the same rows and the same
// frontier: the last frame K through which every participant's row is present.
import { type InputRow, emptyInput, sameInput } from "../input/inputRow";
import { PARTICIPANT_CAPACITY, isParticipantMask, participantActive } from "../input/participants";
import { INPUT_LAST_FRAME, type InputPacket, decodePacket } from "../input/wire";
import { FrameRing } from "./frameRing";
import { at } from "wisp/src/runtime/lookup";

export const LEDGER_CAPACITY = 256;
/**
 * How far past the last consumed frame a row may arrive, and so how many
 * frames a sender may admit before it confirms them. Catching up after a stall
 * keeps about 18 callbacks of rows between admission and confirmation: the
 * wait for the next message and the echo.
 */
export const FUTURE_LIMIT = 128;

/** What became of a synchronized packet. Only "accepted" changes the ledger. */
export type Receipt =
  | "accepted"
  | "malformed"
  | "wrongEpoch"
  | "wrongSender"
  | "outOfHistory"
  | "tooFarAhead"
  | "conflict"
  | "storageFull";

const NEUTRAL: Readonly<InputRow> = emptyInput();

/**
 * Accepted rows per sender slot. A row, once accepted, never changes: a
 * duplicate is accepted again and a different row for the same frame is a
 * conflict. A packet's rows are accepted together or not at all.
 */
export class InputLedger {
  private readonly senders = Array.from({ length: PARTICIPANT_CAPACITY }, () => new FrameRing(LEDGER_CAPACITY));
  private participants = 0;
  private current: number | undefined;
  private retainedFrom = 1;
  private consumed = 0;
  private known = 0;

  /**
   * Starts an epoch at firstFrame (1 for a match; later for an imported or
   * resumed range) and seeds its first `delay` frames with neutral rows, the
   * frames no sample can reach. Epochs only increase.
   */
  beginEpoch(epoch: number, firstFrame: number, delay: number, participants: number): boolean {
    if (!isParticipantMask(participants) || epoch < 0 || (this.current !== undefined && epoch <= this.current)) return false;
    if (firstFrame < 1 || firstFrame > INPUT_LAST_FRAME || delay < 0 || delay > FUTURE_LIMIT) return false;
    if (delay > 0 && firstFrame > INPUT_LAST_FRAME - (delay - 1)) return false;
    this.participants = participants;
    this.current = epoch;
    this.retainedFrom = firstFrame;
    this.consumed = firstFrame - 1;
    this.known = firstFrame - 1;
    for (const ring of this.senders) ring.clear();
    for (let i = 0; i < delay; i++) {
      const frame = firstFrame + i;
      for (let sender = 0; sender < PARTICIPANT_CAPACITY; sender++) {
        if (this.isActive(sender)) at(this.senders, sender).store(frame, NEUTRAL);
      }
      this.known = frame;
    }
    return true;
  }

  epoch(): number | undefined {
    return this.current;
  }

  participantMask(): number {
    return this.participants;
  }

  isActive(sender: number): boolean {
    return participantActive(this.participants, sender);
  }

  /** K: every participant's row is present through this frame. */
  knownThrough(): number {
    return this.known;
  }

  consumedThrough(): number {
    return this.consumed;
  }

  firstRetained(): number {
    return this.retainedFrom;
  }

  /** The accepted row, valid until its frame is discarded. */
  accepted(epoch: number, sender: number, frame: number): Readonly<InputRow> | undefined {
    if (epoch !== this.current || !this.isActive(sender) || frame < this.retainedFrom || frame > INPUT_LAST_FRAME) return undefined;
    if (frame - this.retainedFrom >= LEDGER_CAPACITY) return undefined;
    return at(this.senders, sender).row(frame);
  }

  /**
   * Acknowledges common execution of the next frame, in order. Only this moves
   * the future bound; remote rows advancing K never do.
   */
  markConsumed(epoch: number, frame: number): boolean {
    if (epoch !== this.current || frame > this.known || frame !== this.consumed + 1) return false;
    this.consumed = frame;
    return true;
  }

  /**
   * Forgets consumed frames through `frame`. Release replay consumers first:
   * consumption permits discarding but never discards by itself.
   */
  discardThrough(epoch: number, frame: number): boolean {
    if (epoch !== this.current || frame < this.retainedFrom - 1 || frame > this.consumed) return false;
    for (let old = this.retainedFrom; old <= frame; old++) {
      for (const ring of this.senders) ring.release(old);
    }
    this.retainedFrom = frame + 1;
    return true;
  }

  /**
   * Accepts a packet from the sender slot of its synchronized receive event,
   * the only authoritative source. Local samples never come through here.
   */
  acceptPacket(sender: number, packet: InputPacket): Receipt {
    if (!this.mayReceiveFrom(sender)) return "wrongSender";
    const { epoch, firstFrame, rows } = packet;
    if (rows.length < 1 || rows.length > 2) return "malformed";
    if (epoch !== this.current) return "wrongEpoch";
    for (let i = 0; i < rows.length; i++) {
      const receipt = this.check(sender, firstFrame + i, at(rows, i));
      if (receipt !== "accepted") return receipt;
    }
    rows.forEach((row, i) => at(this.senders, sender).store(firstFrame + i, row));
    while (this.known < INPUT_LAST_FRAME && this.allPresent(epoch, this.known + 1)) this.known++;
    return "accepted";
  }

  receive(sender: number, wire: string): Receipt {
    if (!this.mayReceiveFrom(sender)) return "wrongSender";
    const packet = decodePacket(wire);
    return packet === undefined ? "malformed" : this.acceptPacket(sender, packet);
  }

  private mayReceiveFrom(sender: number): boolean {
    return sender >= 0 && sender < PARTICIPANT_CAPACITY && (this.current === undefined || this.isActive(sender));
  }

  private check(sender: number, frame: number, row: Readonly<InputRow>): Receipt {
    if (frame < this.retainedFrom) return "outOfHistory";
    if (frame - this.consumed > FUTURE_LIMIT) return "tooFarAhead";
    if (frame - this.retainedFrom >= LEDGER_CAPACITY) return "storageFull";
    const ring = at(this.senders, sender);
    const stored = ring.row(frame);
    if (stored !== undefined) return sameInput(stored, row) ? "accepted" : "conflict";
    return ring.vacant(frame) ? "accepted" : "storageFull";
  }

  private allPresent(epoch: number, frame: number): boolean {
    for (let sender = 0; sender < PARTICIPANT_CAPACITY; sender++) {
      if (this.isActive(sender) && this.accepted(epoch, sender, frame) === undefined) return false;
    }
    return true;
  }
}
