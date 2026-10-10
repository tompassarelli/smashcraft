import { floorDiv, floorMod } from "wisp/src/sim/intMath";

/** A prime whose square stays inside a 32-bit integer, so squaring is exact in Bun and Warcraft's Lua. */
const HASH_PRIME = 46337;
/** Seeds step their salt by this prime: far apart against the small numbers choices already add. */
const SEED_STEP = 7919;

/** Squares and folds a value below HASH_PRIME into another: nonlinear, so choices drawn from related numbers don't follow each other. */
function scramble(value: number): number {
  const square = floorMod(value * value + 12345, HASH_PRIME);
  return floorMod(square ^ floorDiv(square, 32), HASH_PRIME);
}

// The match seed's salt, set for the length of one computer's decision
// (botPlay.ts produceComputerInput): botChoice reaches the gameplan's
// choices as a callback, so the salt can't travel as an argument. 0 outside
// a decision.
let seedSalt = 0;

/** Draws every following botChoice under the match seed; seed 0 draws as before seeds existed. */
export function useMatchSeed(seed: number): void {
  seedSalt = floorMod(floorMod(seed, HASH_PRIME) * SEED_STEP, HASH_PRIME);
}

/** A deterministic choice in [0, count) from two whole numbers and the match seed, alike in every runtime. */
export function botChoice(first: number, second: number, count: number): number {
  const mixed = scramble(floorMod(scramble(floorMod(first, HASH_PRIME)) + floorMod(second + seedSalt, HASH_PRIME), HASH_PRIME));
  return floorMod(floorDiv(scramble(mixed), 3), count);
}

/** Whether a draw of `numerator` in `denominator` comes up, by botChoice; always at or past the whole, never at 0. */
export const botChance = (first: number, second: number, numerator: number, denominator: number): boolean =>
  numerator >= denominator || (numerator > 0 && botChoice(first, second, denominator) < numerator);


/** Seeds remain exact whole numbers in every game runtime. */
const MATCH_SEED_RANGE = 1 << 20;
export const nextMatchSeed = (seed: number): number => floorMod(seed + 1, MATCH_SEED_RANGE);
