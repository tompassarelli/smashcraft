// Blademaster's registration: identity, kit and presentation. Owned by this hero's
// lane; set `complete` only when the whole base kit works (hero.ts).
import { Character } from "../codes";
import { type HeroDefinition, STOCK_FALLBACK_CLIP } from "./hero";
import { BLADEMASTER_MOVES } from "./blademasterMoves";

export const BLADEMASTER_HERO: HeroDefinition = {
  character: Character.blademaster,
  name: "Blademaster",
  purpose: "Grounded sword spacing and whiff punishment",
  weakness: "Exposed recoveries and weak ranged pressure",
  complete: false,
  moves: BLADEMASTER_MOVES,
  specials: undefined,
  presentation: {
    model: "units\\orc\\HeroBladeMaster\\HeroBladeMaster.mdl",
    scale: 1.0,
    baseUnit: "Obla",
    objectId: 0x6d66626d,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroBlademaster.blp",
    projectileModel: "Abilities\\Weapons\\SpiritOfVengeanceMissile\\SpiritOfVengeanceMissile.mdl",
    clips: {},
    fallback: STOCK_FALLBACK_CLIP,
  },
};
