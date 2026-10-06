// Uther's registration: identity, kit and presentation. Owned by this hero's
// lane; set `complete` only when the whole base kit works (hero.ts).
import { Character } from "../codes";
import { type HeroDefinition, STOCK_FALLBACK_CLIP } from "./hero";
import { UTHER_MOVES } from "./utherMoves";

export const UTHER_HERO: HeroDefinition = {
  character: Character.uther,
  name: "Uther",
  purpose: "Defensive hammer fighter",
  weakness: "Weak chase and punishable defensive reads",
  complete: false,
  moves: UTHER_MOVES,
  specials: undefined,
  presentation: {
    model: "units\\human\\HeroPaladin\\HeroPaladin.mdl",
    scale: 1.0,
    baseUnit: "Hpal",
    objectId: 0x6d667574,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroPaladin.blp",
    projectileModel: "Abilities\\Weapons\\SpiritOfVengeanceMissile\\SpiritOfVengeanceMissile.mdl",
    clips: {},
    fallback: STOCK_FALLBACK_CLIP,
  },
};
