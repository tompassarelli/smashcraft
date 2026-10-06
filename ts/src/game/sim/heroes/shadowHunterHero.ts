// Shadow Hunter's registration: identity, kit and presentation. Owned by this hero's
// lane; set `complete` only when the whole base kit works (hero.ts).
import { Character } from "../codes";
import { type HeroDefinition, STOCK_FALLBACK_CLIP } from "./hero";
import { SHADOW_HUNTER_MOVES } from "./shadowHunterMoves";

export const SHADOW_HUNTER_HERO: HeroDefinition = {
  character: Character.shadowHunter,
  name: "Shadow Hunter",
  purpose: "Totem placement and angles",
  weakness: "Setup can be destroyed or bypassed",
  complete: false,
  moves: SHADOW_HUNTER_MOVES,
  specials: undefined,
  presentation: {
    model: "units\\orc\\HeroShadowHunter\\HeroShadowHunter.mdl",
    scale: 1.0,
    objectId: 0x6d667368,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNShadowHunter.blp",
    projectileModel: "Abilities\\Weapons\\SpiritOfVengeanceMissile\\SpiritOfVengeanceMissile.mdl",
    clips: {},
    fallback: STOCK_FALLBACK_CLIP,
  },
};
