// Mountain King's registration: identity, kit and presentation. Owned by this hero's
// lane; set `complete` only when the whole base kit works (hero.ts).
import { Character } from "../codes";
import { type HeroDefinition, STOCK_FALLBACK_CLIP } from "./hero";
import { MOUNTAIN_KING_MOVES } from "./mountainKingMoves";

export const MOUNTAIN_KING_HERO: HeroDefinition = {
  character: Character.mountainKing,
  name: "Mountain King",
  purpose: "Compact heavy with hammer and axe",
  weakness: "Slow approach and limited air drift",
  complete: false,
  moves: MOUNTAIN_KING_MOVES,
  specials: undefined,
  presentation: {
    model: "units\\human\\HeroMountainKing\\HeroMountainKing.mdl",
    scale: 1.0,
    baseUnit: "Hmkg",
    objectId: 0x6d666d6b,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroMountainKing.blp",
    projectileModel: "Abilities\\Weapons\\SpiritOfVengeanceMissile\\SpiritOfVengeanceMissile.mdl",
    clips: {},
    fallback: STOCK_FALLBACK_CLIP,
  },
};
