import { floorDiv } from "wisp/src/sim/intMath";
import { f32 } from "wisp/src/sim/f32";
import type { InputRow } from "./inputRow";
import { type KeyboardCapture, sampleKeys } from "./keyboardCapture";

export const PAD_AXIS_LEVELS = [-127, -114, -101, -88, -75, -62, -49, -36, 0, 36, 49, 62, 75, 88, 101, 114, 127];
export const PAD_TRIGGER_LEVELS = [0, 77, 166, 255];
export const PAD_KEYS = [0x7c, 0x7d, 0x7e, 0x7f, 0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x2d, 0x2e];
export const PAD_ACTIVE_KEY = 0x23;
export const PAD_PRESENT_KEY = 0x24;

export interface PadValues {
  readonly axisX: number;
  readonly axisZ: number;
  readonly triggerLeft: number;
  readonly triggerRight: number;
}

export function decodePad(packed: number): PadValues | undefined {
  if (packed < 0 || packed >= 16384 || packed !== Math.floor(packed)) return undefined;
  const axisX = PAD_AXIS_LEVELS[packed & 31];
  const axisZ = PAD_AXIS_LEVELS[floorDiv(packed, 32) & 31];
  const triggerLeft = PAD_TRIGGER_LEVELS[floorDiv(packed, 1024) & 3];
  const triggerRight = PAD_TRIGGER_LEVELS[floorDiv(packed, 4096) & 3];
  if (axisX === undefined || axisZ === undefined || triggerLeft === undefined || triggerRight === undefined) return undefined;
  return { axisX, axisZ, triggerLeft, triggerRight };
}

export function padKeyPacket(pressed: (key: number) => boolean): number | undefined {
  if (!pressed(PAD_ACTIVE_KEY)) return undefined;
  let packed = 0;
  for (let index = 0; index < PAD_KEYS.length; index++) {
    const key = PAD_KEYS[index];
    if (key !== undefined && pressed(key)) packed |= 1 << index;
  }
  return packed;
}

export function padCursorPacket(x: number, y: number): number | undefined {
  if (x < 0 || x > 127 || y < 0 || y > 127 || x !== Math.floor(x) || y !== Math.floor(y)) return undefined;
  return x | y << 7;
}

export function copyPad(row: InputRow, pad: PadValues): void {
  row.axisX = pad.axisX;
  row.axisZ = pad.axisZ;
  row.triggerLeft = pad.triggerLeft;
  row.triggerRight = pad.triggerRight;
}

/** Undefined packet uses the unchanged keyboard sampler. */
export function samplePad(capture: KeyboardCapture, held: number, packed: number | undefined): boolean {
  if (!sampleKeys(capture, held)) return false;
  const pad = packed === undefined ? undefined : decodePad(packed);
  if (pad !== undefined) copyPad(capture.row, pad);
  return true;
}

export interface CursorCalibration {
  first: { readonly x: number; readonly y: number } | undefined;
  last: { readonly x: number; readonly y: number } | undefined;
}

/** A fixed top-down view over flat terrain maps each screen axis linearly. */
export function cursorWorldPacket(calibration: Readonly<CursorCalibration>, worldX: number, worldY: number): number | undefined {
  const { first, last } = calibration;
  if (first === undefined || last === undefined) return undefined;
  const dx = f32(last.x - first.x);
  const dy = f32(last.y - first.y);
  if (dx === 0 || dy === 0) return undefined;
  const x = f32(f32(f32(worldX - first.x) / dx) * 127.0);
  const y = f32(f32(f32(worldY - first.y) / dy) * 127.0);
  const cellX = Math.floor(f32(x + 0.5));
  const cellY = Math.floor(f32(y + 0.5));
  if (Math.abs(f32(x - cellX)) > 0.3499999940395355 || Math.abs(f32(y - cellY)) > 0.3499999940395355) return undefined;
  return padCursorPacket(cellX, cellY);
}
