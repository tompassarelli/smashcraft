










import { at } from "wisp/src/runtime/lookup";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { type Fighter } from "../sim/fighter";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import {
  type Lanes, MODULUS, type NumberTerm, TWO_24, booleanKey, exponentKey, firstCoefficient, foldInteger, highResidue, isFields,
  keyHash, lowResidue, numberTerm, secondCoefficient,
} from "./replayFold";


const DIGEST_FIELDS: readonly (readonly [string, string])[] = [
  ["", "facing"],
  ["motion", "x"], ["motion", "z"], ["motion", "vx"], ["motion", "vz"], ["motion", "grounded"],
  ["ground", "action"], ["ground", "actionFrame"],
  ["jump", "remaining"],
  ["launch", "knockbackX"], ["launch", "knockbackZ"], ["launch", "hitstun"], ["launch", "hitlag"],
  ["shield", "raised"], ["shield", "energy"],
  ["attack", "frame"], ["attack", "serial"],
  ["special", "action"], ["special", "frame"],
  ["grab", "action"], ["ledge", "state"], ["down", "state"],
  ["status", "damage"], ["status", "stocks"],
];

const FRAME_KEY = 5;

const slotBase = (slot: number) => floorMod(slot * 977 + 13, MODULUS);
const fieldKey = (slot: number, record: string, field: string) => floorMod(slotBase(slot) * 31 + keyHash(`${record}.${field}`), MODULUS);

function digestValue(fighter: Readonly<Fighter>, record: string, field: string): unknown {
  const holder: unknown = fighter;
  const owner = record === "" ? holder : isFields(holder) ? holder[record] : undefined;
  return isFields(owner) ? owner[field] : undefined;
}

const scratchTerm: NumberTerm = { key: 0, integer: 0 };

function foldDigestValue(lanes: Lanes, key: number, value: unknown): void {
  if (typeof value === "boolean") foldInteger(lanes, booleanKey(key), value ? 1 : 0);
  else if (typeof value === "number") {
    const term = numberTerm(scratchTerm, key, value);
    foldInteger(lanes, term.key, term.integer);
  }
}

function digestLanes(world: Readonly<Roster>, frame: number): Lanes {
  const lanes: Lanes = { first: 0, second: 0 };
  foldInteger(lanes, 1, world.mask);
  foldInteger(lanes, FRAME_KEY, frame);
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const fighter = fighterAt(world, slot);
    for (const [record, field] of DIGEST_FIELDS) foldDigestValue(lanes, fieldKey(slot, record, field), digestValue(fighter, record, field));
  }
  return lanes;
}

const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";


function laneText(lane: number): string {
  const high = floorDiv(lane, 1296);
  const middle = floorDiv(floorMod(lane, 1296), 36);
  const low = floorMod(lane, 36);
  return `${DIGITS.charAt(high)}${DIGITS.charAt(middle)}${DIGITS.charAt(low)}`;
}

function laneValue(text: string): number | undefined {
  let value = 0;
  for (let index = 0; index < text.length; index++) {
    const digit = DIGITS.indexOf(text.charAt(index));
    if (digit < 0) return undefined;
    value = value * 36 + digit;
  }
  return value < MODULUS ? value : undefined;
}


export function frameDigest(world: Readonly<Roster>, frame: number): string {
  const lanes = digestLanes(world, frame);
  return `${laneText(lanes.first)}${laneText(lanes.second)}`;
}


function digestLanesOf(token: string): Lanes | undefined {
  if (token.length !== 6) return undefined;
  const first = laneValue(token.substring(0, 3));
  const second = laneValue(token.substring(3, 6));
  return first === undefined || second === undefined ? undefined : { first, second };
}




interface FieldDifference {

  readonly field: string;
  readonly replayed: number | boolean;
  readonly native: number | boolean;

  readonly steps: number;
}


interface DigestDifference {

  readonly fields: readonly FieldDifference[];
}

interface DigestTerm {
  readonly field: string;
  readonly slot: number;
  readonly key: number;
  readonly value: number | boolean;

  readonly termKey: number;
  readonly integer: number;
}

function powMod(base: number, exponent: number): number {
  let result = 1;
  let factor = floorMod(base, MODULUS);
  let rest = exponent;
  while (rest > 0) {
    if (floorMod(rest, 2) === 1) result = floorMod(result * factor, MODULUS);
    factor = floorMod(factor * factor, MODULUS);
    rest = floorDiv(rest, 2);
  }
  return result;
}

const INVERSES: Record<number, number> = {};


function inverse(value: number): number | undefined {
  const residue = floorMod(value, MODULUS);
  if (residue === 0) return undefined;
  const known = INVERSES[residue];
  if (known !== undefined) return known;
  const found = powMod(residue, MODULUS - 2);
  INVERSES[residue] = found;
  return found;
}
const INVERSE_31 = powMod(31, MODULUS - 2);

const firstTerm = (key: number, integer: number) => floorMod(firstCoefficient(key) * (lowResidue(integer) + 1), MODULUS);
const secondTerm = (key: number, integer: number) => floorMod(secondCoefficient(key) * (highResidue(integer) + 1), MODULUS);


function solveInteger(key: number, first: number, second: number): number | undefined {
  const firstInverse = inverse(firstCoefficient(key));
  const secondInverse = inverse(secondCoefficient(key));
  if (firstInverse === undefined || secondInverse === undefined) return undefined;
  const low = floorMod(first * firstInverse - 1, MODULUS);
  const high = floorMod(second * secondInverse - 1, MODULUS);
  let quotient = floorMod((high - low) * INVERSE_31, MODULUS);
  if (quotient > floorDiv(MODULUS, 2)) quotient -= MODULUS;
  const value = quotient * MODULUS + low;
  return value < TWO_24 && value > -TWO_24 ? value : undefined;
}


function binaryExponent(value: number): number {
  let magnitude = value < 0 ? -value : value;
  let exponent = 0;
  while (magnitude >= TWO_24) {
    magnitude *= 0.5;
    exponent++;
  }
  while (magnitude < 8388608.0) {
    magnitude *= 2.0;
    exponent--;
  }
  return exponent;
}


const measurable = (value: number) => value === value && value !== 0 && value * 2.0 !== value;

function scaled(significand: number, exponent: number): number {
  let value = significand;
  for (let step = 0; step < exponent; step++) value *= 2.0;
  for (let step = 0; step > exponent; step--) value *= 0.5;
  return value;
}


const significandUnit = (value: number) => (measurable(value) ? scaled(1, binaryExponent(value)) : 0);


function stepsBetween(replayed: number | boolean, native: number | boolean): number {
  if (typeof replayed === "boolean" || typeof native === "boolean") return 1;
  const difference = native - replayed;
  if (Math.floor(replayed) === replayed && Math.floor(native) === native) return difference;
  const unit = significandUnit(replayed === 0 ? native : replayed);
  return unit === 0 ? difference : difference / unit;
}


function near(replayed: number, native: number, limit: number): boolean {
  if (native === replayed) return false;
  const steps = stepsBetween(replayed, native);
  return steps <= limit && steps >= -limit;
}


function nativeValues(term: DigestTerm, first: number, second: number, limit: number): (number | boolean)[] {
  const found: (number | boolean)[] = [];
  if (typeof term.value === "boolean") {
    const integer = solveInteger(booleanKey(term.key), first, second);
    if (integer === 0 || integer === 1) found.push(integer === 1);
    return found.filter((value) => value !== term.value);
  }
  const whole = solveInteger(term.key, first, second);
  if (whole !== undefined && near(term.value, whole, limit)) found.push(whole);
  if (measurable(term.value)) {
    const exponent = binaryExponent(term.value);
    for (let shift = -1; shift <= 1; shift++) {
      const significand = solveInteger(exponentKey(term.key, exponent + shift), first, second);
      const magnitude = significand === undefined ? 0 : significand < 0 ? -significand : significand;
      if (significand === undefined || magnitude < 8388608 || magnitude >= TWO_24) continue;
      const value = scaled(significand, exponent + shift);
      if (Math.floor(value) !== value && near(term.value, value, limit)) found.push(value);
    }
  }
  return found;
}

function digestTerms(world: Readonly<Roster>): DigestTerm[] {
  const terms: DigestTerm[] = [];
  const scratch: NumberTerm = { key: 0, integer: 0 };
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const fighter = fighterAt(world, slot);
    for (const [record, name] of DIGEST_FIELDS) {
      const key = fieldKey(slot, record, name);
      const value = digestValue(fighter, record, name);
      const field = `p${slot} ${record === "" ? name : `${record}.${name}`}`;
      if (typeof value === "boolean") terms.push({ field, slot, key, value, termKey: booleanKey(key), integer: value ? 1 : 0 });
      else if (typeof value === "number") {
        const term = numberTerm(scratch, key, value);
        terms.push({ field, slot, key, value, termKey: term.key, integer: term.integer });
      }
    }
  }
  return terms;
}


const targets = (term: DigestTerm, first: number, second: number) => [
  floorMod(firstTerm(term.termKey, term.integer) + first, MODULUS),
  floorMod(secondTerm(term.termKey, term.integer) + second, MODULUS),
] as const;


function neighbours(term: DigestTerm, reach: number): { value: number | boolean; key: number; integer: number }[] {
  if (typeof term.value === "boolean") return [{ value: !term.value, key: term.termKey, integer: term.value ? 0 : 1 }];
  const found: { value: number | boolean; key: number; integer: number }[] = [];
  const whole = Math.floor(term.value) === term.value;
  const exponent = whole ? 0 : binaryExponent(term.value);
  for (let step = -reach; step <= reach; step++) {
    if (step === 0) continue;
    const integer = term.integer + step;
    if (whole) found.push({ value: integer, key: term.termKey, integer });
    else {
      const magnitude = integer < 0 ? -integer : integer;
      if (magnitude >= 8388608 && magnitude < TWO_24) found.push({ value: scaled(integer, exponent), key: term.termKey, integer });
    }
  }
  return found;
}






export function digestDifference(world: Readonly<Roster>, frame: number, recorded: string): DigestDifference {
  const native = digestLanesOf(recorded);
  if (native === undefined) return { fields: [] };
  const replayed = digestLanes(world, frame);
  const first = floorMod(native.first - replayed.first, MODULUS);
  const second = floorMod(native.second - replayed.second, MODULUS);
  if (first === 0 && second === 0) return { fields: [] };
  const terms = digestTerms(world);
  const singles: FieldDifference[] = [];
  for (const term of terms) {
    const [wantFirst, wantSecond] = targets(term, first, second);
    for (const value of nativeValues(term, wantFirst, wantSecond, 4096)) {
      singles.push({ field: term.field, replayed: term.value, native: value, steps: stepsBetween(term.value, value) });
    }
  }
  if (singles.length > 0) return { fields: [closest(singles)] };
  for (let one = 0; one < terms.length; one++) {
    const a = at(terms, one);
    for (let two = 0; two < terms.length; two++) {
      const b = at(terms, two);
      if (one === two || a.slot !== b.slot) continue;
      for (const moved of neighbours(a, 16)) {
        const restFirst = floorMod(first - firstTerm(moved.key, moved.integer) + firstTerm(a.termKey, a.integer), MODULUS);
        const restSecond = floorMod(second - secondTerm(moved.key, moved.integer) + secondTerm(a.termKey, a.integer), MODULUS);
        const [wantFirst, wantSecond] = targets(b, restFirst, restSecond);
        for (const value of nativeValues(b, wantFirst, wantSecond, 64)) {
          return {
            fields: [
              { field: a.field, replayed: a.value, native: moved.value, steps: stepsBetween(a.value, moved.value) },
              { field: b.field, replayed: b.value, native: value, steps: stepsBetween(b.value, value) },
            ],
          };
        }
      }
    }
  }
  return { fields: [] };
}

function closest(found: readonly FieldDifference[]): FieldDifference {
  let best = at(found, 0);
  for (const candidate of found) {
    const size = candidate.steps < 0 ? -candidate.steps : candidate.steps;
    const bestSize = best.steps < 0 ? -best.steps : best.steps;
    if (size < bestSize) best = candidate;
  }
  return best;
}

// Integer decimal digits avoid Lua integral-float .0 suffixes.
function wholeText(value: number): string {
  let rest = value < 0 ? -value : value;
  let text = "";
  do {
    text = `${DIGITS.charAt(floorMod(rest, 10))}${text}`;
    rest = floorDiv(rest, 10);
  } while (rest > 0);
  return value < 0 ? `-${text}` : text;
}


export function describeDigestDifference(difference: DigestDifference): string {
  if (difference.fields.length === 0) return "more than one digest field differs";
  return difference.fields.map(({ field, replayed, native, steps }) => typeof replayed === "boolean"
    ? `${field} is ${String(native)} natively, ${String(replayed)} replayed`
    : `${field} ${steps > 0 ? "+" : ""}${Math.floor(steps) === steps ? wholeText(steps) : steps}${Math.floor(replayed) === replayed && Math.floor(Number(native)) === native ? "" : " ulp"} natively (replayed ${replayed}, native ${String(native)})`).join("; ");
}
