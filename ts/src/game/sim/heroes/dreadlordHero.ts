// Dreadlord's registration: identity, kit and presentation. Owned by this hero's
// lane; set `complete` only when the whole base kit works (hero.ts).
import { Character } from "../codes";
import { type HeroDefinition, STOCK_FALLBACK_CLIP } from "./hero";
import { DREADLORD_MOVES } from "./dreadlordMoves";

export const DREADLORD_HERO: HeroDefinition = {
  character: Character.dreadlord,
  name: "Dreadlord",
  purpose: "Air movement, grabs, and close pressure",
  weakness: "Large hurtbox and no safe long-range approach",
  complete: false,
  moves: DREADLORD_MOVES,
  specials: undefined,
  presentation: {
    model: "units\\undead\\HeroDreadLord\\HeroDreadLord.mdl",
    scale: 1.0,
    objectId: 0x6d66646c,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroDreadLord.blp",
    projectileModel: "Abilities\\Weapons\\SpiritOfVengeanceMissile\\SpiritOfVengeanceMissile.mdl",
    clips: {},
    fallback: STOCK_FALLBACK_CLIP,
  },
};
