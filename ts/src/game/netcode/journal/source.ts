// Local input recorded by the companion helper as a journal: a sequence of
// immutable canonical I4 packets of one or two rows, each tagged with the
// frame its row belongs to. A helper behind its clock joins consecutive
// packets with "|" into one record (at most RECORD_PACKETS), so its backlog
// costs fewer characters to type. The file names and the control
// acknowledgment text are written by the helper, so their spellings are a
// protocol.
import { PARTICIPANT_CAPACITY } from "../../input/participants";
import type { InputRow } from "../../input/inputRow";
import { type InputPacket, decodePacket } from "../../input/wire";
import { FUTURE_LIMIT } from "../ledger";
import { parseDecimal } from "./decimal";

export type JournalRead =
  /** Nothing to admit yet: no packet, or its rows reach past the admissible frame. */
  | { kind: "wait" }
  /** Not the next canonical packet of this epoch; the journal cannot continue. */
  | { kind: "invalid" }
  | { kind: "ready"; packet: InputPacket };

/** Control states the helper acknowledges. */
export type ControlState = "PREPARE" | "PAUSE" | "RESUME";

/** Packets one record may join. */
export const RECORD_PACKETS = 16;

const WAIT: JournalRead = { kind: "wait" };
const INVALID: JournalRead = { kind: "invalid" };

/**
 * One local player's journal for one epoch. The cursor moves only after the
 * caller has admitted every row of a ready packet and queued those rows for
 * the synchronized channel.
 */
export class JournalInputSource {
  private sequence = 1;
  private controlSequence = 1;
  private ready: InputPacket | undefined;
  private buffered: string | undefined;
  /** Rows of the buffered record already admitted: a joined record may take several callbacks. */
  private taken = 0;

  private constructor(
    readonly build: string,
    readonly epoch: number,
    readonly slot: number,
    readonly delay: number,
  ) {}

  static open(build: string, epoch: number, slot: number, delay: number): JournalInputSource | undefined {
    const valid = build !== "" && epoch >= 0 && slot >= 0 && slot < PARTICIPANT_CAPACITY && delay >= 0 && delay <= FUTURE_LIMIT;
    return valid ? new JournalInputSource(build, epoch, slot, delay) : undefined;
  }

  /** The frame the next packet must start at: frames 1..D are neutral seed rows. */
  expectedFrame(): number {
    return this.delay + this.sequence;
  }

  /** Rows sent so far, plus one. */
  sequenceNumber(): number {
    return this.sequence;
  }

  /** The base name of the helper's file for the next packet. */
  packetBase(): string {
    return `smashcraft-journal-${this.build}-e${this.epoch}-s${this.slot}-n${this.expectedFrame()}`;
  }

  /** The last packet read and not yet sent in full, so a waiting packet needs no second read. */
  bufferedPacket(): string | undefined {
    return this.buffered;
  }

  /**
   * Reads the next packet, or packets joined with "|", as one packet of their
   * rows not yet sent. A packet whose rows reach past latestAdmissibleFrame
   * waits, buffered.
   */
  read(wire: string, latestAdmissibleFrame: number): JournalRead {
    this.ready = undefined;
    if (wire !== this.buffered) this.taken = 0;
    this.buffered = undefined;
    if (wire === "") return WAIT;
    const packet = wire.includes("|") ? decodePackets(wire) : decodePacket(wire);
    const rest = packet === undefined || this.taken === 0 ? packet : { epoch: packet.epoch, firstFrame: packet.firstFrame + this.taken, rows: packet.rows.slice(this.taken) };
    const read = rest === undefined ? INVALID : this.offer(rest, latestAdmissibleFrame);
    if (read !== INVALID) this.buffered = wire;
    return read;
  }

  /** As read, for a packet the map made itself, such as a keyboard row. */
  offer(packet: InputPacket, latestAdmissibleFrame: number): JournalRead {
    this.ready = undefined;
    if (packet.epoch !== this.epoch || packet.firstFrame !== this.expectedFrame()) return INVALID;
    if (packet.firstFrame + packet.rows.length - 1 > latestAdmissibleFrame) return WAIT;
    this.ready = packet;
    return { kind: "ready", packet };
  }

  /**
   * Advances past the first `rows` of the ready packet, all of them by
   * default, once they are admitted and queued to send. The rest of a record
   * is read again from its next row.
   */
  sent(rows = this.ready?.rows.length ?? 0): boolean {
    const ready = this.ready;
    if (ready === undefined || rows < 1 || rows > ready.rows.length) return false;
    this.sequence += rows;
    this.ready = undefined;
    if (rows < ready.rows.length) this.taken += rows;
    else {
      this.taken = 0;
      this.buffered = undefined;
    }
    return true;
  }

  controlSequenceNumber(): number {
    return this.controlSequence;
  }

  /** The base name of the helper's acknowledgment for the next control request. */
  controlAckBase(): string {
    return `smashcraft-journal-ack-${this.build}-e${this.epoch}-s${this.slot}-n${this.controlSequence}`;
  }

  /**
   * Accepts "ACK1|<sequence>|<state>|<frame>" for the current control
   * sequence and expected state, and returns the acknowledged frame.
   */
  acceptControlAck(wire: string, expected: ControlState): number | undefined {
    const prefix = `ACK1|${this.controlSequence}|${expected}|`;
    if (!wire.startsWith(prefix)) return undefined;
    const frame = parseDecimal(wire.substring(prefix.length));
    if (frame === undefined || frame <= 0) return undefined;
    this.controlSequence++;
    return frame;
  }
}

/** Consecutive packets of one epoch joined with "|", as one packet of their rows; undefined unless canonical. */
function decodePackets(wire: string): InputPacket | undefined {
  const parts = wire.split("|");
  if (parts.length > RECORD_PACKETS) return undefined;
  let joined: { epoch: number; firstFrame: number; rows: InputRow[] } | undefined;
  for (const part of parts) {
    const packet = decodePacket(part);
    if (packet === undefined) return undefined;
    if (joined === undefined) joined = { epoch: packet.epoch, firstFrame: packet.firstFrame, rows: [...packet.rows] };
    else if (packet.epoch !== joined.epoch || packet.firstFrame !== joined.firstFrame + joined.rows.length) return undefined;
    else joined.rows.push(...packet.rows);
  }
  return joined;
}
