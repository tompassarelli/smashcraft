import { f32 } from "wisp/src/sim/f32";
import { ARCTANGENT_DEGREES, SINE_QUARTER_TURN, TABLE_STEPS } from "./mathTableData";

const PERIOD_STEPS = TABLE_STEPS * 4;
const QUARTER_FRACTION = 1.0 / TABLE_STEPS;

function interpolate(low: number, high: number, fraction: number): number {
  return fraction === 0.0 ? low : f32(low + f32(f32(high - low) * fraction));
}

/** SineTurns: sin of a full turn per 1.0, linear between 1/1024-turn binary32 table entries. */
export function sineTurns(turns: number): number {
  if (turns < 0.0) return -sineTurns(-turns);
  const position = (turns - Math.floor(turns)) * PERIOD_STEPS;
  const quadrant = Math.floor(position * QUARTER_FRACTION);
  const offset = position - quadrant * TABLE_STEPS;
  const index = Math.floor(offset);
  const fraction = offset - index;
  const falling = quadrant === 1 || quadrant === 3;
  const low = SINE_QUARTER_TURN[falling ? TABLE_STEPS - index : index] ?? 0.0;
  const high = SINE_QUARTER_TURN[falling ? TABLE_STEPS - index - 1 : index + 1] ?? low;
  const value = interpolate(low, high, fraction);
  return quadrant >= 2 ? -value : value;
}

export function cosineTurns(turns: number): number {
  return sineTurns(f32(turns + 0.25));
}

/** ArctangentDegrees: atan in degrees, linear between 1/256 binary32 table entries on [0, 1], folded through the reciprocal above 1. */
export function arctangentDegrees(value: number): number {
  if (value < 0.0) return -arctangentDegrees(-value);
  if (value === Infinity) return 90.0;
  if (value > 1.0) return f32(90.0 - arctangentDegrees(f32(1.0 / value)));
  const position = value * TABLE_STEPS;
  const index = Math.floor(position);
  const low = ARCTANGENT_DEGREES[index] ?? 0.0;
  return interpolate(low, ARCTANGENT_DEGREES[index + 1] ?? low, position - index);
}
