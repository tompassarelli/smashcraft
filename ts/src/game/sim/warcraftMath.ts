// Math operations used by the simulation, with the Warcraft native domains
// and binary32 results expected by the authored physics contracts.
import { squareRootFloat32 } from "waygate/src/sim/binary32";
import { f32 } from "waygate/src/sim/f32";

/** SquareRoot: zero outside its domain, as measured on the 3.0.0 client. */
export function squareRoot(value: number): number {
  return value < 0 ? 0.0 : squareRootFloat32(value);
}

export function atan2(y: number, x: number): number {
  return f32(Math.atan2(y, x));
}
