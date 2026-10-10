// Companion journal filenames and acknowledgment text are an external protocol.






import { PARTICIPANT_CAPACITY } from "../../input/participants";
import type { InputRow } from "../../input/inputRow";
import { type InputPacket, decodeInputMessage, decodePacket } from "../../input/wire";
import { FUTURE_LIMIT } from "../ledger";
import { parseDecimal } from "./decimal";

export type JournalRead =

  | { kind: "wait" }

  | { kind: "invalid" }
  | { kind: "ready"; packet: InputPacket };


export type ControlState = "PREPARE" | "PAUSE" | "RESUME";


const RECORD_PACKETS = 16;

const WAIT: JournalRead = { kind: "wait" };
const INVALID: JournalRead = { kind: "invalid" };






export class JournalInputSource {
  private sequence = 1;
  private controlSequence = 1;
  private ready: InputPacket | undefined;
  private buffered: string | undefined;

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


  expectedFrame(): number {
    return this.delay + this.sequence;
  }


  sequenceNumber(): number {
    return this.sequence;
  }


  packetBase(): string {
    return `smashcraft-journal-${this.build}-e${this.epoch}-s${this.slot}-n${this.expectedFrame()}`;
  }


  bufferedPacket(): string | undefined {
    return this.buffered;
  }






  read(wire: string, latestAdmissibleFrame: number): JournalRead {
    this.ready = undefined;
    if (wire !== this.buffered) this.taken = 0;
    this.buffered = undefined;
    if (wire === "") return WAIT;
    const packet = wire.startsWith("I5") ? joinPackets(decodeInputMessage(wire))
      : wire.includes("|") ? decodePackets(wire) : decodePacket(wire);
    const rest = packet === undefined || this.taken === 0 ? packet : { epoch: packet.epoch, firstFrame: packet.firstFrame + this.taken, rows: packet.rows.slice(this.taken) };
    const read = rest === undefined ? INVALID : this.offer(rest, latestAdmissibleFrame);
    if (read !== INVALID) this.buffered = wire;
    return read;
  }


  offer(packet: InputPacket, latestAdmissibleFrame: number): JournalRead {
    this.ready = undefined;
    if (packet.epoch !== this.epoch || packet.firstFrame !== this.expectedFrame()) return INVALID;
    if (packet.firstFrame + packet.rows.length - 1 > latestAdmissibleFrame) return WAIT;
    this.ready = packet;
    return { kind: "ready", packet };
  }






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


  controlAckBase(): string {
    return `smashcraft-journal-ack-${this.build}-e${this.epoch}-s${this.slot}-n${this.controlSequence}`;
  }





  acceptControlAck(wire: string, expected: ControlState): number | undefined {
    const prefix = `ACK1|${this.controlSequence}|${expected}|`;
    if (!wire.startsWith(prefix)) return undefined;
    const frame = parseDecimal(wire.substring(prefix.length));
    if (frame === undefined || frame <= 0) return undefined;
    this.controlSequence++;
    return frame;
  }
}


function decodePackets(wire: string): InputPacket | undefined {
  const parts = wire.split("|");
  if (parts.length > RECORD_PACKETS) return undefined;
  const packets: InputPacket[] = [];
  for (const part of parts) {
    const packet = decodePacket(part);
    if (packet === undefined) return undefined;
    packets.push(packet);
  }
  return joinPackets(packets);
}

function joinPackets(packets: readonly InputPacket[] | undefined): InputPacket | undefined {
  if (packets === undefined) return undefined;
  let joined: { epoch: number; firstFrame: number; rows: InputRow[] } | undefined;
  for (const packet of packets) {
    if (joined === undefined) joined = { epoch: packet.epoch, firstFrame: packet.firstFrame, rows: [...packet.rows] };
    else if (packet.epoch !== joined.epoch || packet.firstFrame !== joined.firstFrame + joined.rows.length) return undefined;
    else joined.rows.push(...packet.rows);
  }
  return joined;
}
