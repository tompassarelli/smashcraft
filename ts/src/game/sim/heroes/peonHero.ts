import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { PEON_CLIPS, PEON_FALLBACK_CLIP } from "../../presentation/heroes/peonClips";
import { PEON_MOVES } from "./peonMoves";
import { PEON_SPECIALS } from "./peonSpecials";
import { PEON_GAMEPLAN } from "./peonGameplan";

export const PEON_HERO: HeroDefinition = {
  character: Character.peon,
  name: "Peon",
  purpose: "A stubborn worker who fights around his burrow",
  weakness: "Slow feet, short tools and a fragile worksite",
  complete: false,
  moves: PEON_MOVES,
  specials: PEON_SPECIALS,
  passive: { name: "Pillage", description: "Every third tool hit restores a little mana." },
  jab: { name: "Work Work", description: "A quick haft tap followed by a short axe chop." },
  ultimate: { name: "Overtime", description: "A work frenzy with quicker building and harder tool hits." },
  gameplan: PEON_GAMEPLAN,
  presentation: {
    model: "units\\orc\\Peon\\Peon.mdl",
    objectId: 0x6d667065,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNPeon.blp",
    placedModel: { path: "buildings\\orc\\OrcBurrow\\OrcBurrow.mdl", height: 180.0, alpha: 255 },
    clips: PEON_CLIPS,
    fallback: PEON_FALLBACK_CLIP,
  },
};
