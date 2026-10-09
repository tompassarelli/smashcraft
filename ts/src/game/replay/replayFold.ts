




import { floorDiv, floorMod } from "wisp/src/sim/intMath";

// This prime's square fits Warcraft 32-bit integers.
export const MODULUS = 46337;
const TWO_23 = 8388608.0;
export const TWO_24 = 16777216.0;

export interface Lanes {
  first: number;
  second: number;
}

const KEY_HASHES: Record<string, number> = {};

export function keyHash(key: string): number {
  const known = KEY_HASHES[key];
  if (known !== undefined) return known;
  let hash = 0;
  for (let index = 0; index < key.length; index++) hash = floorMod(hash * 31 + key.charCodeAt(index) + 1, MODULUS);
  KEY_HASHES[key] = hash;
  return hash;
}

const isDigitCode = (code: number) => code >= 48 && code <= 57;

// Lua exposes integer keys as numbers while Bun exposes digit strings.
export function fieldName(key: unknown): key is string {
  return typeof key === "string" && key.length > 0 && !isDigitCode(key.charCodeAt(0));
}


export const firstCoefficient = (key: number) => key + 1;

export const secondCoefficient = (key: number) => floorMod(key * 7 + 3, MODULUS) + 1;


export const lowResidue = (value: number) => floorMod(value, MODULUS);
export const highResidue = (value: number) => floorMod(floorDiv(value, MODULUS) * 31 + floorMod(value, MODULUS), MODULUS);


export function foldInteger(lanes: Lanes, key: number, value: number): void {
  const low = lowResidue(value);
  const high = highResidue(value);
  lanes.first = floorMod(lanes.first + firstCoefficient(key) * (low + 1), MODULUS);
  lanes.second = floorMod(lanes.second + secondCoefficient(key) * (high + 1), MODULUS);
}


export interface NumberTerm {
  key: number;
  integer: number;
}


export function numberTerm(term: NumberTerm, key: number, value: number): NumberTerm {
  if (value !== value) {
    term.key = key;
    term.integer = -1;
    return term;
  }
  const whole = Math.floor(value);
  if (whole === value && whole < TWO_24 && whole > -TWO_24) {
    term.key = key;
    term.integer = whole;
    return term;
  }
  let magnitude = value < 0 ? -value : value;
  if (magnitude * 2.0 === magnitude) {
    term.key = floorMod(key + 1, MODULUS);
    term.integer = value < 0 ? -2 : 2;
    return term;
  }
  // Powers-of-two scaling is exact, preserving the significand across Bun and Lua.
  let exponent = 0;
  while (magnitude >= TWO_24 * 256.0) {
    magnitude *= 0.00390625;
    exponent += 8;
  }
  while (magnitude >= TWO_24) {
    magnitude *= 0.5;
    exponent++;
  }
  while (magnitude < TWO_23 * 0.00390625) {
    magnitude *= 256.0;
    exponent -= 8;
  }
  while (magnitude < TWO_23) {
    magnitude *= 2.0;
    exponent--;
  }
  const significand = Math.floor(magnitude);
  term.key = exponentKey(key, exponent);
  term.integer = value < 0 ? -significand : significand;
  return term;
}


export const exponentKey = (key: number, exponent: number) => floorMod(key + (exponent + 400) * 101, MODULUS);

export const booleanKey = (key: number) => floorMod(key + 17, MODULUS);

const scratchTerm: NumberTerm = { key: 0, integer: 0 };

export function foldNumber(lanes: Lanes, key: number, value: number): void {
  const term = numberTerm(scratchTerm, key, value);
  foldInteger(lanes, term.key, term.integer);
}

export const isFields = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === "object" && value !== null;

export function foldValue(lanes: Lanes, key: number, value: unknown, depth: number): void {
  if (typeof value === "number") foldNumber(lanes, key, value);
  else if (typeof value === "boolean") foldInteger(lanes, booleanKey(key), value ? 1 : 0);
  else if (typeof value === "object" && value !== null && depth < 2) foldFields(lanes, key, value, depth + 1);
}


export function foldFields(lanes: Lanes, parent: number, record: unknown, depth: number): void {
  if (!isFields(record)) return;
  const fields = record;
  for (const key in fields) {
    if (!fieldName(key) || (depth === 0 && key === "tuning")) continue;
    foldValue(lanes, floorMod(parent * 31 + keyHash(key), MODULUS), fields[key], depth);
  }
}
