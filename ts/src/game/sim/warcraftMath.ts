// The Warcraft math natives the simulation uses, with the binary32 results the
// Wurst interpreter defines for them. Written with the language's math library
// so the same code runs on the host, in test Lua and in the map.
import { f32 } from "../../sim/f32";

/** SquareRoot: zero outside its domain, as measured on the 3.0.0 client. */
export function squareRoot(value: number): number {
  return value < 0 ? 0.0 : f32(Math.sqrt(value));
}

export function atan2(y: number, x: number): number {
  return f32(Math.atan2(y, x));
}
