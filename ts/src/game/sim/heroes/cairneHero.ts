import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { CAIRNE_GAMEPLAN } from "./cairneGameplan";
import { CAIRNE_MOVES } from "./cairneMoves";
import { CAIRNE_SPECIALS } from "./cairneSpecials";

import { CAIRNE_CLIPS, CAIRNE_DAMAGE_CLIPS, CAIRNE_FALLBACK } from "../../presentation/heroes/cairneClips";
import { f32 } from "wisp/src/sim/f32";

const shockwaveStartup = { index: 9, startSeconds: f32(0.1599999964237213), seconds: f32(0.23999999463558197) };

export const CAIRNE_HERO: HeroDefinition = {
  character: Character.cairne, name: "Cairne Bloodhoof", purpose: "Super-heavyweight with sweeping totem strikes",
  weakness: "A huge target with slow whiffs and exposed recovery", complete: true,
  jab: { name: "Haft and Totem", description: "Check with the haft, then press again for the totem's short finishing blow." },
  moves: CAIRNE_MOVES, specials: CAIRNE_SPECIALS, gameplan: CAIRNE_GAMEPLAN,
  presentation: {
    model: "units\\orc\\HeroTaurenChieftain\\HeroTaurenChieftain.mdl", objectId: 0x6d666361,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroTaurenChieftain.blp", fallback: CAIRNE_FALLBACK,
    clips: {
      ...CAIRNE_CLIPS,
      neutralSpecial: { ...CAIRNE_CLIPS.neutralSpecial, classicStartup: shockwaveStartup },
      neutralSpecialAir: { ...CAIRNE_CLIPS.neutralSpecialAir, classicStartup: shockwaveStartup },
    }, damageClips: CAIRNE_DAMAGE_CLIPS,
  },
};
