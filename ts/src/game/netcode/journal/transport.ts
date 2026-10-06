// A journal's admitted rows cross the synchronized channel in rate-capped I5
// messages (wire.ts): at most one per `batch` callbacks, each carrying every
// admitted frame not yet sent that fits. One message per callback or two
// saturated Battle.net's synchronized channel (#26 r8). Keyboard rollback
// still sends one I4 packet per message.
import type { InputRow } from "../../input/inputRow";
import { type InputMessage, type InputPacket, decodeInputMessage, decodePacket, encodeInputMessage } from "../../input/wire";
import { FrameRing } from "../frameRing";
import { FUTURE_LIMIT } from "../ledger";

/** Callbacks per input message by default: 10 messages a second at 60 callbacks a second. */
export const DEFAULT_BATCH = 6;
/** The most callbacks a developer may batch into one message. */
export const MAX_BATCH = 12;

/** The packets of one synchronized input message, or undefined unless it is canonical. */
export function decodeTransport(wire: string): readonly InputPacket[] | undefined {
  if (wire.startsWith("I5")) return decodeInputMessage(wire);
  const packet = decodePacket(wire);
  return packet === undefined ? undefined : [packet];
}

/**
 * Local frames admitted in order and not yet sent. A message is due once
 * `batch` callbacks have passed since the last one. Holds cost no bytes, and
 * even rows whose every group changes fit 8 to a message, so at the default
 * batch a backlog drains faster than 60 frames a second arrive.
 */
export class OutgoingInput {
  // Preallocated: holds the unsent frames, which the future limit bounds.
  private readonly rows = new FrameRing(FUTURE_LIMIT);
  private epoch = 0;
  private nextUnsent = 1;
  private admitted = 0;
  private idle = MAX_BATCH;

  /** Starts an epoch whose first row is firstFrame; its first message may go at once. */
  begin(epoch: number, firstFrame: number): void {
    this.rows.clear();
    this.epoch = epoch;
    this.nextUnsent = firstFrame;
    this.admitted = firstFrame - 1;
    this.idle = MAX_BATCH;
  }

  /** Queues the next frame's row; false unless it follows the last admitted frame and fits. */
  admit(frame: number, row: Readonly<InputRow>): boolean {
    if (frame !== this.admitted + 1 || !this.rows.vacant(frame)) return false;
    this.rows.store(frame, row);
    this.admitted = frame;
    return true;
  }

  /** Call once per input callback. */
  tick(): void {
    if (this.idle < MAX_BATCH) this.idle++;
  }

  /** Admitted frames not yet sent. */
  pending(): number {
    return this.admitted - this.nextUnsent + 1;
  }

  /** The message to send now: due after `batch` callbacks, from the first unsent frame. */
  ready(batch: number): InputMessage | undefined {
    if (this.idle < batch || this.nextUnsent > this.admitted) return undefined;
    return encodeInputMessage(this.epoch, this.nextUnsent, this.admitted, frame => this.row(frame));
  }

  /** Forgets the frames of a message that was sent. */
  sent(message: InputMessage): void {
    for (let frame = message.firstFrame; frame <= message.lastFrame; frame++) this.rows.release(frame);
    this.nextUnsent = message.lastFrame + 1;
    this.idle = 0;
  }

  /** admit stored every frame from nextUnsent through admitted. */
  private row(frame: number): Readonly<InputRow> {
    const row = this.rows.row(frame);
    if (row === undefined) throw new Error(`admitted input for frame ${frame} is missing`);
    return row;
  }
}
