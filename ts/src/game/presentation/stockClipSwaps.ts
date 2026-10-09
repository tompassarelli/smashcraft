


import { f32 } from "wisp/src/sim/f32";
import { Character } from "../sim/codes";
import type { HeroClipTable } from "../sim/heroes/hero";

export const STOCK_CLIP_SWAPS: { readonly [character: number]: HeroClipTable | undefined } = {


  [Character.demonHunter]: { jab3: { index: 6, seconds: f32(1.865), aligned: true } },


  [Character.lichKing]: { forwardSmash: { index: 9, seconds: f32(1.125) } },

  [Character.peon]: { forwardTilt: { index: 2, seconds: 1.0 } },
};
