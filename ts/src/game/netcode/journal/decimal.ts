import { floorDiv } from "waygate/src/sim/intMath";

const MAX_INT = 2147483647;
const ZERO = 48;

/** Unsigned decimal digits, leading zeros allowed, at most 2147483647; undefined for anything else. */
export function parseDecimal(text: string): number | undefined {
  if (text.length === 0) return undefined;
  let value = 0;
  for (let i = 0; i < text.length; i++) {
    const digit = text.charCodeAt(i) - ZERO;
    if (digit < 0 || digit > 9 || value > floorDiv(MAX_INT - digit, 10)) return undefined;
    value = value * 10 + digit;
  }
  return value;
}

/** A non-negative integer in decimal, zero-padded on the left to width. */
export function padDecimal(value: number, width: number): string {
  return `${value}`.padStart(width, "0");
}
