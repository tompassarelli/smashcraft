import { floorMod } from "wisp/src/sim/intMath";
import { type InputRow, copyInput, emptyInput } from "../input/inputRow";
import { at } from "wisp/src/runtime/lookup";

interface Slot {
  frame: number | undefined;
  readonly row: InputRow;
}





export class FrameRing {

  private readonly slots: readonly Slot[];

  constructor(readonly capacity: number) {
    this.slots = Array.from({ length: capacity }, (): Slot => ({ frame: undefined, row: emptyInput() }));
  }

  private slot(frame: number): Slot {
    return at(this.slots, floorMod(frame, this.capacity));
  }


  row(frame: number): Readonly<InputRow> | undefined {
    const slot = this.slot(frame);
    return slot.frame === frame ? slot.row : undefined;
  }


  vacant(frame: number): boolean {
    return this.slot(frame).frame === undefined;
  }

  store(frame: number, row: Readonly<InputRow>): void {
    const slot = this.slot(frame);
    copyInput(slot.row, row);
    slot.frame = frame;
  }


  release(frame: number): void {
    this.slot(frame).frame = undefined;
  }

  clear(): void {
    for (const slot of this.slots) slot.frame = undefined;
  }
}
