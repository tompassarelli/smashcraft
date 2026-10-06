// Lich's registration: identity, kit and presentation. Owned by this hero's
// lane; set `complete` only when the whole base kit works (hero.ts).
import { Character } from "../codes";
import { type HeroDefinition, STOCK_FALLBACK_CLIP } from "./hero";
import { LICH_MOVES } from "./lichMoves";

export const LICH_HERO: HeroDefinition = {
  character: Character.lich,
  name: "Lich",
  purpose: "Deliberate projectile placement",
  weakness: "Frail body and slow attacks at close range",
  complete: false,
  moves: LICH_MOVES,
  specials: undefined,
  presentation: {
    model: "units\\undead\\HeroLich\\HeroLich.mdl",
    scale: 1.0,
    baseUnit: "Ulic",
    objectId: 0x6d666c63,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNLichVersion2.blp",
    projectileModel: "Abilities\\Weapons\\SpiritOfVengeanceMissile\\SpiritOfVengeanceMissile.mdl",
    clips: {},
    fallback: STOCK_FALLBACK_CLIP,
  },
};
