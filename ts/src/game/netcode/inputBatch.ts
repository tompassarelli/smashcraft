import type { InputRow } from "../input/inputRow";
import { INPUT_LAST_FRAME, type InputPacket, inputPacket } from "../input/wire";





export class InputBatch {
  private rows: InputRow[] = [];
  private firstFrame = 0;

  constructor(readonly epoch: number) {}

  append(epoch: number, frame: number, row: Readonly<InputRow>): boolean {
    if (epoch !== this.epoch || frame < 1 || frame > INPUT_LAST_FRAME || this.rows.length === 2) return false;
    if (this.rows.length === 1 && frame !== this.firstFrame + 1) return false;
    if (this.rows.length === 0) this.firstFrame = frame;
    this.rows.push({ ...row });
    return true;
  }

  size(): number {
    return this.rows.length;
  }

  packet(): InputPacket | undefined {
    return this.rows.length === 0 ? undefined : inputPacket(this.epoch, this.firstFrame, [...this.rows]);
  }


  sent(): void {
    this.rows = [];
  }
}
