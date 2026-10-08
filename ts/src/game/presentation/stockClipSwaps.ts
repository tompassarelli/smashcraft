// Moves that play their model's own Warcraft sequence instead of an authored
// clip, applied over every generated table so regenerating those leaves these
// in place (#309, smashcraft:docs/design/animation-sources.md).
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../sim/codes";
import type { HeroClipTable } from "../sim/heroes/hero";

export const STOCK_CLIP_SWAPS: { readonly [character: number]: HeroClipTable | undefined } = {
  // "Attack": its glaive reaches the finisher's region at 0.333 s, retimed onto
  // the first active frame (5 of 28): 0.333 × 28 / 5.
  [Character.demonHunter]: { jab3: { index: 6, seconds: f32(1.865), aligned: true } },
};
