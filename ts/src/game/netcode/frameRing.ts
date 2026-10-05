import { floorMod } from "waygate/src/sim/intMath";
import { type InputRow, copyInput, emptyInput } from "../input/inputRow";
import { at } from "waygate/src/runtime/lookup";

interface Slot {
  frame: number | undefined;
  readonly row: InputRow;
}

/**
 * Rows keyed by frame in a fixed ring: frame f lives in slot f mod capacity.
 * Owners bound the frames they store so that a slot never holds two live frames.
 */
export class FrameRing {
  // Preallocated: rollback corrections read these rows for every replayed frame.
  private readonly slots: readonly Slot[];

  constructor(readonly capacity: number) {
    this.slots = Array.from({ length: capacity }, (): Slot => ({ frame: undefined, row: emptyInput() }));
  }

  private slot(frame: number): Slot {
    return at(this.slots, floorMod(frame, this.capacity));
  }

  /** The row stored for exactly this frame. Valid until the frame is released. */
  row(frame: number): Readonly<InputRow> | undefined {
    const slot = this.slot(frame);
    return slot.frame === frame ? slot.row : undefined;
  }

  /** Whether frame's slot is empty, rather than holding this or another frame. */
  vacant(frame: number): boolean {
    return this.slot(frame).frame === undefined;
  }

  store(frame: number, row: Readonly<InputRow>): void {
    const slot = this.slot(frame);
    copyInput(slot.row, row);
    slot.frame = frame;
  }

  /** Empties frame's slot, whichever frame it holds. */
  release(frame: number): void {
    this.slot(frame).frame = undefined;
  }

  clear(): void {
    for (const slot of this.slots) slot.frame = undefined;
  }
}
