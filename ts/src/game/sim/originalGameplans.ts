// The original fighters' gameplans (sim/gameplan.ts, #105), by Character
// code. A fighter missing here plays the general computer.
import { Character } from "./codes";
import type { FighterGameplan } from "./gameplan";
import { ILLIDAN_GAMEPLAN } from "./illidanGameplan";

export const ORIGINAL_GAMEPLANS: { readonly [character: number]: FighterGameplan | undefined } = {
  [Character.demonHunter]: ILLIDAN_GAMEPLAN,
};
