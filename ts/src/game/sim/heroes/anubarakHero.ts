import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { ANUBARAK_CLIPS, ANUBARAK_DAMAGE_CLIPS, ANUBARAK_FALLBACK, ANUBARAK_MODEL_FILE } from "./anubarakClips";
import { ANUBARAK_GAMEPLAN } from "./anubarakGameplan";
import { ANUBARAK_MOVES } from "./anubarakMoves";
import { ANUBARAK_SPECIALS } from "./anubarakSpecials";

export const ANUBARAK_HERO: HeroDefinition = {
  character: Character.anubarak, name: "Anub'arak", purpose: "Menacing insect king; heavy ground control",
  weakness: "Broad shell, slow aerials and exposed emergence", complete: true,
  jab: { name: "Royal Rebuke", description: "The king dismisses prey with one tusk, then the other." },
  moves: ANUBARAK_MOVES, specials: ANUBARAK_SPECIALS, gameplan: ANUBARAK_GAMEPLAN,
  presentation: { model: ANUBARAK_MODEL_FILE, objectId: 0x6d660000 | 0x616e,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroCryptLord.blp",
    placedModel: { path: "Units\\Undead\\Scarab\\Scarab.mdl", height: 35.0, alpha: 255 },
    clips: ANUBARAK_CLIPS, damageClips: ANUBARAK_DAMAGE_CLIPS, fallback: ANUBARAK_FALLBACK },
};
