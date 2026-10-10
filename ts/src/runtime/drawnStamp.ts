





import { floorDiv, floorMod } from "wisp/src/sim/intMath";


export const STAMP_CELL = 0.0078125;
const STAMP_SCRIPT_BITS = 6;
const STAMP_FRAME_BITS = 15;

export const STAMP_CELLS = STAMP_SCRIPT_BITS + STAMP_FRAME_BITS + 3;
const STAMP_FRAMES = 32768;
const STAMP_SCRIPTS = 64;

export type StampCell = "guard" | "one" | "zero";


function pushBits(bits: boolean[], value: number, count: number): void {
  const low: boolean[] = [];
  let rest = value;
  for (let bit = 0; bit < count; bit++) {
    low.push(floorMod(rest, 2) === 1);
    rest = floorDiv(rest, 2);
  }
  for (let bit = count - 1; bit >= 0; bit--) bits.push(low[bit] === true);
}


export function stampCells(script: number, frame: number): StampCell[] {
  const bits: boolean[] = [];
  const s = floorMod(script, STAMP_SCRIPTS);
  const f = floorMod(frame, STAMP_FRAMES);
  pushBits(bits, s, STAMP_SCRIPT_BITS);
  pushBits(bits, f, STAMP_FRAME_BITS);
  let ones = 0;
  for (const value of bits) if (value) ones++;
  bits.push(floorMod(ones, 2) === 1);
  return ["guard", ...bits.map((value): StampCell => value ? "one" : "zero"), "guard"];
}


export function readStamp(cells: readonly (StampCell | "unclear")[]): { readonly script: number; readonly frame: number } | undefined {
  if (cells.length !== STAMP_CELLS || cells[0] !== "guard" || cells[STAMP_CELLS - 1] !== "guard") return undefined;
  let script = 0;
  let frame = 0;
  let ones = 0;
  for (let index = 1; index < STAMP_CELLS - 1; index++) {
    const cell = cells[index];
    if (cell !== "one" && cell !== "zero") return undefined;
    const bit = cell === "one" ? 1 : 0;
    ones += bit;
    if (index <= STAMP_SCRIPT_BITS) script = script * 2 + bit;
    else if (index <= STAMP_SCRIPT_BITS + STAMP_FRAME_BITS) frame = frame * 2 + bit;
  }
  return floorMod(ones, 2) === 0 ? { script, frame } : undefined;
}
