import { floorDiv } from "wisp/src/sim/intMath";
import { TIMED_TEST_STAGE } from "../sim/stage";

type Rgb = readonly [red: number, green: number, blue: number];

const NEUTRAL: Rgb = [255, 255, 255];

/** Body-only colour multipliers; stage lights also affect scenery. */
export const STAGE_FIGHTER_TINTS: readonly { readonly stage: number; readonly tint: Rgb }[] = [
  { stage: TIMED_TEST_STAGE, tint: [255, 255, 255] },
];

export function stageFighterTint(stage: number, authored = true): Rgb {
  return authored ? STAGE_FIGHTER_TINTS.find(entry => entry.stage === stage)?.tint ?? NEUTRAL : NEUTRAL;
}

export function fighterTintChannel(channel: number, multiplier: number): number {
  return floorDiv(channel * multiplier, 255);
}
