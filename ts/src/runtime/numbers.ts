// Numeric conversions and scalar bounds shared by simulation and replay.

/** Native R2I semantics: truncate toward zero. */
export function toInt(value: number): number {
  return value < 0 ? Math.ceil(value) : Math.floor(value);
}

/** Adding 0.0 makes a Lua integer a float, matching native I2R. */
export function toReal(value: number): number {
  return value + 0.0;
}

export function max(a: number, b: number): number {
  return a > b ? a : b;
}

export function min(a: number, b: number): number {
  return a < b ? a : b;
}
