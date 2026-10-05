import { imod } from "../../sim/intMath";

const REPLAY_CHECKSUM_MODULUS = 1_000_003;

/** Exact finite binary representation used by Wurst ReplayState's canonical tape. */
export function canonicalReal(value: number): string {
  if (value !== value) return "nan";
  const negative = value < 0;
  if (!negative && !(value > 0)) return "0";
  let magnitude = negative ? -value : value;
  if (magnitude * 2 === magnitude) return negative ? "-inf" : "+inf";
  let exponent = 0;
  while (magnitude >= 2) {
    magnitude /= 2;
    exponent++;
  }
  while (magnitude < 1) {
    magnitude *= 2;
    exponent--;
  }
  let fraction = magnitude - 1;
  let high = 0;
  for (let i = 0; i < 26; i++) {
    fraction *= 2;
    high *= 2;
    if (fraction >= 1) {
      high++;
      fraction--;
    }
  }
  let low = 0;
  for (let i = 0; i < 26; i++) {
    fraction *= 2;
    low *= 2;
    if (fraction >= 1) {
      low++;
      fraction--;
    }
  }
  return `${negative ? "-" : "+"}${exponent}:${high}:${low}`;
}

/** Two polynomial lanes over canonical printable ASCII, matching Wurst and Lua32. */
export function canonicalChecksum(text: string): string {
  let first = 0;
  let second = 0;
  for (let index = 0; index < text.length; index++) {
    const byte = text.charCodeAt(index);
    if (byte < 32 || byte > 126) return "invalid-ascii";
    first = imod(first * 257 + byte + 1, REPLAY_CHECKSUM_MODULUS);
    second = imod(second * 263 + byte + 1, REPLAY_CHECKSUM_MODULUS);
  }
  return `${first}:${second}`;
}

export function canonicalInt(name: string, value: number): string {
  return `|${name}=${value}`;
}

export function canonicalBoolean(name: string, value: boolean): string {
  return `|${name}=${value ? 1 : 0}`;
}

export function canonicalRealField(name: string, value: number): string {
  return `|${name}=${canonicalReal(value)}`;
}
