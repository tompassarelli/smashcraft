// Lockstep input with a fixed delay D: the sample taken while frame F is next
// belongs to frame F + D, and frame F runs only once every participant's row
// for F has arrived through the synchronized channel.
import { type InputRow, copyInput } from "../input/inputRow";
import { PARTICIPANT_CAPACITY, type ParticipantInputs } from "../input/participants";
import { INPUT_LAST_FRAME, type InputPacket } from "../input/wire";
import { REPLAY_HISTORY_CAPACITY } from "../replay/limits";
import { Capture } from "./capture";
import { FrameRing } from "./frameRing";
import { InputLedger, LEDGER_CAPACITY, type Receipt } from "./ledger";
import { at } from "wisp/src/runtime/lookup";

/** The input delays a schedule supports. */
export type FixedDelay = 0 | 1 | 2 | 3 | 5;

export function isFixedDelay(value: number): value is FixedDelay {
  return value === 0 || value === 1 || value === 2 || value === 3 || value === 5;
}

/** The frame a sample taken while `frame` is next belongs to, or undefined past the last frame. */
export function fixedCaptureTarget(frame: number, delay: FixedDelay): number | undefined {
  return frame >= 1 && frame <= INPUT_LAST_FRAME - delay ? frame + delay : undefined;
}

/**
 * Construct once at common initialization; capture and read copy into
 * existing storage. Local samples wait in a private pending ring and never
 * open the common gate: only synchronized receipt does.
 */
export class FixedInputSchedule {
  private readonly ledger = new InputLedger();
  private readonly pendingRows = new FrameRing(LEDGER_CAPACITY);
  private current: number | undefined;
  private fixedDelay: FixedDelay = 0;
  private next = 1;
  private prepared: number | undefined;

  beginEpoch(epoch: number, delay: FixedDelay, participants: number): boolean {
    if (!this.ledger.beginEpoch(epoch, 1, delay, participants)) return false;
    this.current = epoch;
    this.fixedDelay = delay;
    this.next = 1;
    this.prepared = undefined;
    this.pendingRows.clear();
    return true;
  }

  participantMask(): number {
    return this.ledger.participantMask();
  }

  isActive(slot: number): boolean {
    return this.ledger.isActive(slot);
  }

  epoch(): number | undefined {
    return this.current;
  }

  delay(): FixedDelay {
    return this.fixedDelay;
  }

  nextFrame(): number {
    return this.next;
  }

  knownThrough(): number {
    return this.ledger.knownThrough();
  }

  confirmedThrough(): number {
    return this.ledger.consumedThrough();
  }

  firstRetained(): number {
    return this.ledger.firstRetained();
  }

  captureTarget(): number | undefined {
    return this.current === undefined ? undefined : fixedCaptureTarget(this.next, this.fixedDelay);
  }

  /**
   * Offer the local sample at every service opportunity, even while readNext
   * waits. A repeat for the same target keeps the original row; new edges
   * belong to the sampler's next row, not to this already assigned one.
   */
  captureLocal(epoch: number, sample: Readonly<InputRow>): Capture {
    if (epoch !== this.current) return Capture.wrongEpoch;
    const target = this.captureTarget();
    if (target === undefined) return Capture.frameExhausted;
    if (this.pendingRows.row(target) !== undefined) return Capture.alreadyCaptured;
    if (!this.pendingRows.vacant(target)) return Capture.pendingFull;
    this.pendingRows.store(target, sample);
    return Capture.captured;
  }

  /** The local sample assigned to frame, valid while the frame is retained. */
  pending(epoch: number, frame: number): Readonly<InputRow> | undefined {
    if (epoch !== this.current || frame < this.ledger.firstRetained() || frame > INPUT_LAST_FRAME) return undefined;
    return this.pendingRows.row(frame);
  }

  /**
   * Synchronized receipt, with the sender slot from the receive event. A local
   * send or its self echo is not receipt.
   */
  acceptSynchronized(sender: number, packet: InputPacket): Receipt {
    return this.ledger.acceptPacket(sender, packet);
  }

  receiveSynchronized(sender: number, wire: string): Receipt {
    return this.ledger.receive(sender, wire);
  }

  mayAdvance(): boolean {
    return this.current !== undefined && this.next <= INPUT_LAST_FRAME && this.next <= this.ledger.knownThrough();
  }

  /**
   * Fills every active slot with the next frame's accepted row. K proves every
   * row is present before any target changes, so the read is all or nothing.
   */
  readNext(epoch: number, inputs: ParticipantInputs): boolean {
    if (epoch !== this.current || !this.mayAdvance()) return false;
    for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
      const row = this.ledger.accepted(epoch, slot, this.next);
      if (row !== undefined) copyInput(at(inputs, slot), row);
    }
    this.prepared = this.next;
    return true;
  }

  /**
   * Acknowledges common execution of the frame readNext prepared, in order.
   * The last REPLAY_HISTORY_CAPACITY completed frames stay, matching the
   * replay snapshot ring.
   */
  complete(epoch: number, frame: number): boolean {
    if (epoch !== this.current || frame !== this.next || frame !== this.prepared) return false;
    if (!this.ledger.markConsumed(epoch, frame)) return false;
    this.prepared = undefined;
    this.next++;
    const expired = frame - REPLAY_HISTORY_CAPACITY;
    if (expired >= this.ledger.firstRetained()) {
      this.pendingRows.release(expired);
      this.ledger.discardThrough(epoch, expired);
    }
    return true;
  }

  /** The accepted row, valid while the frame is retained. */
  accepted(epoch: number, slot: number, frame: number): Readonly<InputRow> | undefined {
    return this.ledger.accepted(epoch, slot, frame);
  }
}
