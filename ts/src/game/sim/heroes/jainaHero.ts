import { JAINA_CLIPS, JAINA_DAMAGE_CLIPS, JAINA_FALLBACK, JAINA_MODEL_FILE } from "../../presentation/heroes/jainaClips";
import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { JAINA_GAMEPLAN } from "./jainaGameplan";
import { JAINA_MOVES } from "./jainaMoves";
import { JAINA_SPECIALS } from "./jainaSpecials";

export const JAINA_HERO: HeroDefinition = {
  character: Character.jaina, name: "Jaina Proudmoore", purpose: "Frost spells and a Water Elemental control the approach",
  weakness: "Slow on foot and exposed while setting up spells", complete: true,
  moves: JAINA_MOVES, specials: JAINA_SPECIALS, gameplan: JAINA_GAMEPLAN,
  passive: { name: "Brilliance Aura", description: "Recover mana faster while moving or resting between spells." },
  jab: { name: "Staff Check", description: "Two short staff strikes to create space." },
  ultimate: { name: "Mass Teleport", description: "Bring nearby allies to her Water Elemental." },
  presentation: {
    model: JAINA_MODEL_FILE, objectId: 0x6d666a61,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNJaina.blp",
    placedModel: { path: "units\\human\\WaterElemental\\WaterElemental.mdl", height: 110.0, alpha: 255 },
    fallback: JAINA_FALLBACK,
    clips: JAINA_CLIPS,
    damageClips: JAINA_DAMAGE_CLIPS,
  },
};
