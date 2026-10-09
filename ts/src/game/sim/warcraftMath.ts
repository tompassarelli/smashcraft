

import { squareRootFloat32 } from "wisp/src/sim/binary32";

/** SquareRoot: zero outside its domain, as measured on the 3.0.0 client. */
export function squareRoot(value: number): number {
  return value < 0 ? 0.0 : squareRootFloat32(value);
}
