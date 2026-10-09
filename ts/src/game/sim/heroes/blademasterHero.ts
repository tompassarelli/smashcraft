

import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { BLADEMASTER_GAMEPLAN } from "./blademasterGameplan";
import { BLADEMASTER_CLIPS, BLADEMASTER_FALLBACK_CLIP } from "./blademasterClips";
import { BLADEMASTER_MOVES } from "./blademasterMoves";
import { BLADEMASTER_SPECIALS } from "./blademasterSpecials";

export const BLADEMASTER_HERO: HeroDefinition = {
  character: Character.blademaster,
  name: "Blademaster",
  purpose: "Grounded sword spacing and whiff punishment",
  weakness: "Exposed recoveries and weak ranged pressure",
  complete: true,
  moves: BLADEMASTER_MOVES,
  specials: BLADEMASTER_SPECIALS,
  jab: { name: "Swift Cuts", description: "Two quick cuts close to his body on repeated jabs." },
  gameplan: BLADEMASTER_GAMEPLAN,
  presentation: {
    model: "units\\orc\\HeroBladeMaster\\HeroBladeMaster.mdl",
    objectId: 0x6d66626d,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroBlademaster.blp",

    placedModel: { path: "units\\orc\\HeroBladeMaster\\HeroBladeMaster.mdl", height: 140.0, alpha: 120 },
    clips: BLADEMASTER_CLIPS,
    fallback: BLADEMASTER_FALLBACK_CLIP,
  },
};
