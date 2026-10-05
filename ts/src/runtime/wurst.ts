// Wurst standard-library conversions the ported game uses.

/** Wurst `real.toInt()` (R2I): truncation toward zero. */
export function toInt(value: number): number {
  return value < 0 ? Math.ceil(value) : Math.floor(value);
}

/** Wurst `int.toReal()`. Adding 0.0 makes a Lua integer a float. */
export function toReal(value: number): number {
  return value + 0.0;
}

export function max(a: number, b: number): number {
  return a > b ? a : b;
}

export function min(a: number, b: number): number {
  return a < b ? a : b;
}
