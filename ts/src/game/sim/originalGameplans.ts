// The original fighters' gameplans (sim/gameplan.ts, #105), by Character
// code. A fighter missing here plays the general computer.
import type { FighterGameplan } from "./gameplan";

export const ORIGINAL_GAMEPLANS: { readonly [character: number]: FighterGameplan | undefined } = {};
