


export function toInt(value: number): number {
  return value < 0 ? Math.ceil(value) : Math.floor(value);
}

// Adding 0.0 converts a Lua integer to a float, matching native I2R.
export function toReal(value: number): number {
  return value + 0.0;
}

export function max(a: number, b: number): number {
  return a > b ? a : b;
}

export function min(a: number, b: number): number {
  return a < b ? a : b;
}
