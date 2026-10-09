import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { KAELTHAS_MOVES } from "./kaelthasMoves";
import { KAELTHAS_SPECIALS } from "./kaelthasSpecials";
import { KAELTHAS_GAMEPLAN } from "./kaelthasGameplan";
import { KAELTHAS_CLIPS, KAELTHAS_DAMAGE_CLIPS, KAELTHAS_FALLBACK, KAELTHAS_MODEL_FILE } from "./kaelthasClips";

export const KAELTHAS_HERO: HeroDefinition = {
  character: Character.kaelthas, name: "Kael'thas Sunstrider", purpose: "Curse, drain and burn: a caster who takes your options away", weakness: "Light close normals, a hittable cast arm and the longest recovery charge", complete: true,
  moves: KAELTHAS_MOVES, specials: KAELTHAS_SPECIALS, gameplan: KAELTHAS_GAMEPLAN,
  jab: { name: "Verdant Touch", description: "A palm check, then a sphere shove on a second tap." },
  presentation: {
    model: KAELTHAS_MODEL_FILE, objectId: 0x6d666b74,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroBloodElfPrince.blp",
    clips: KAELTHAS_CLIPS, damageClips: KAELTHAS_DAMAGE_CLIPS, fallback: KAELTHAS_FALLBACK,
  },
};
