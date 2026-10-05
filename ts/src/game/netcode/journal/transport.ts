// Journal packets cross the synchronized channel one or two per message. Two
// contiguous packets of one epoch travel as "B4" + first + "|" + second; a
// lone packet travels as itself. Either way every original row and its frame
// survive unchanged.
import { type InputPacket, decodePacket } from "../../input/wire";

const PAIR_PREFIX = "B4";

/** Whether `second` continues `first` directly within one epoch. */
function continues(first: InputPacket, second: InputPacket): boolean {
  return second.epoch === first.epoch && second.firstFrame === first.firstFrame + first.rows.length;
}

/** The packets of one synchronized message, or undefined unless all are canonical and contiguous. */
export function decodeTransport(wire: string): readonly InputPacket[] | undefined {
  if (!wire.startsWith(PAIR_PREFIX)) {
    const packet = decodePacket(wire);
    return packet === undefined ? undefined : [packet];
  }
  const split = wire.indexOf("|");
  if (split < 0) return undefined;
  const first = decodePacket(wire.substring(PAIR_PREFIX.length, split));
  const second = decodePacket(wire.substring(split + 1));
  return first !== undefined && second !== undefined && continues(first, second) ? [first, second] : undefined;
}

export interface TransportMessage {
  readonly wire: string;
  readonly firstFrame: number;
  /** Input rows across both packets. */
  readonly rows: number;
}

interface Queued {
  readonly wire: string;
  readonly packet: InputPacket;
}

/**
 * Outgoing journal packets awaiting one send. A lone packet waits two input
 * callbacks for a partner unless the caller flushes, as at a pause or the end.
 */
export class TransportBatch {
  private queued: Queued[] = [];
  private age = 0;

  append(wire: string): boolean {
    const [first] = this.queued;
    const packet = decodePacket(wire);
    if (this.queued.length === 2 || packet === undefined || (first !== undefined && !continues(first.packet, packet))) return false;
    if (first === undefined) this.age = 0;
    this.queued.push({ wire, packet });
    return true;
  }

  /** Call once per input callback. */
  tick(): void {
    if (this.queued.length > 0) this.age++;
  }

  /** The message to send now, if the batch is due. */
  ready(flush: boolean): TransportMessage | undefined {
    const [first, second] = this.queued;
    if (first === undefined || !(flush || second !== undefined || this.age >= 2)) return undefined;
    return {
      wire: second === undefined ? first.wire : `${PAIR_PREFIX}${first.wire}|${second.wire}`,
      firstFrame: first.packet.firstFrame,
      rows: first.packet.rows.length + (second?.packet.rows.length ?? 0),
    };
  }

  /** Clear only after a successful send. */
  clear(): void {
    this.queued = [];
    this.age = 0;
  }
}
