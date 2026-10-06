// Mountain King's registration: identity, kit and presentation. Owned by this hero's
// lane; set `complete` only when the whole base kit works (hero.ts).
import { Character } from "../codes";
import { MOUNTAIN_KING_CLIPS, MOUNTAIN_KING_FALLBACK } from "../../presentation/heroes/mountainKingClips";
import type { HeroDefinition } from "./hero";
import { MOUNTAIN_KING_MOVES } from "./mountainKingMoves";
import { MOUNTAIN_KING_SPECIALS } from "./mountainKingSpecials";

export const MOUNTAIN_KING_HERO: HeroDefinition = {
  character: Character.mountainKing,
  name: "Mountain King",
  purpose: "Compact heavy with hammer and axe",
  weakness: "Slow approach and limited air drift",
  complete: true,
  moves: MOUNTAIN_KING_MOVES,
  specials: MOUNTAIN_KING_SPECIALS,
  presentation: {
    model: "units\\human\\HeroMountainKing\\HeroMountainKing.mdl",
    scale: 1.0,
    baseUnit: "Hmkg",
    objectId: 0x6d666d6b,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroMountainKing.blp",
    projectileModel: "Abilities\\Spells\\Human\\StormBolt\\StormBoltMissile.mdl",
    clips: MOUNTAIN_KING_CLIPS,
    fallback: MOUNTAIN_KING_FALLBACK,
  },
};
