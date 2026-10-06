// Warden's registration: identity, kit and presentation. Owned by this hero's
// lane; set `complete` only when the whole base kit works (hero.ts).
import { Character } from "../codes";
import { type HeroDefinition, STOCK_FALLBACK_CLIP } from "./hero";
import { WARDEN_MOVES } from "./wardenMoves";

export const WARDEN_HERO: HeroDefinition = {
  character: Character.warden,
  name: "Warden",
  purpose: "Precision mobility and edge pressure",
  weakness: "Light body and punishable teleport endpoints",
  complete: false,
  moves: WARDEN_MOVES,
  specials: undefined,
  presentation: {
    model: "units\\nightelf\\HeroWarden\\HeroWarden.mdl",
    scale: 1.0,
    baseUnit: "Ewar",
    objectId: 0x6d667764,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroWarden.blp",
    projectileModel: "Abilities\\Weapons\\SpiritOfVengeanceMissile\\SpiritOfVengeanceMissile.mdl",
    clips: {},
    fallback: STOCK_FALLBACK_CLIP,
  },
};
