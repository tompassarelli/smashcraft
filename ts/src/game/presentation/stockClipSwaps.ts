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
  // "Attack - 2": the sword rises into the upper region, then cuts down into the
  // lower one; its strike moment is measured (heroStrikeMomentInfo.ts).
  [Character.lichKing]: { forwardSmash: { index: 9, seconds: f32(1.125) } },
  // "Attack": the pick swings out at chest height into the region.
  [Character.peon]: { forwardTilt: { index: 2, seconds: 1.0 } },
};
