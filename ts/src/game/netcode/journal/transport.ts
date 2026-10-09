




import type { InputRow } from "../../input/inputRow";
import { type InputMessage, type InputPacket, decodeInputMessage, decodePacket, encodeInputMessage } from "../../input/wire";
import { FrameRing } from "../frameRing";
import { FUTURE_LIMIT } from "../ledger";


export const DEFAULT_BATCH = 6;

export const MAX_BATCH = 12;


export function decodeTransport(wire: string): readonly InputPacket[] | undefined {
  if (wire.startsWith("I5")) return decodeInputMessage(wire);
  const packet = decodePacket(wire);
  return packet === undefined ? undefined : [packet];
}







export class OutgoingInput {

  private readonly rows = new FrameRing(FUTURE_LIMIT);
  private epoch = 0;
  private nextUnsent = 1;
  private admitted = 0;
  private idle = MAX_BATCH;


  begin(epoch: number, firstFrame: number): void {
    this.rows.clear();
    this.epoch = epoch;
    this.nextUnsent = firstFrame;
    this.admitted = firstFrame - 1;
    this.idle = MAX_BATCH;
  }


  admit(frame: number, row: Readonly<InputRow>): boolean {
    if (frame !== this.admitted + 1 || !this.rows.vacant(frame)) return false;
    this.rows.store(frame, row);
    this.admitted = frame;
    return true;
  }


  tick(): void {
    if (this.idle < MAX_BATCH) this.idle++;
  }


  pending(): number {
    return this.admitted - this.nextUnsent + 1;
  }


  ready(batch: number): InputMessage | undefined {
    if (this.idle < batch || this.nextUnsent > this.admitted) return undefined;
    return encodeInputMessage(this.epoch, this.nextUnsent, this.admitted, frame => this.row(frame));
  }


  sent(message: InputMessage): void {
    for (let frame = message.firstFrame; frame <= message.lastFrame; frame++) this.rows.release(frame);
    this.nextUnsent = message.lastFrame + 1;
    this.idle = 0;
  }


  private row(frame: number): Readonly<InputRow> {
    const row = this.rows.row(frame);
    if (row === undefined) throw new Error(`admitted input for frame ${frame} is missing`);
    return row;
  }
}
