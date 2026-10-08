import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { GROM_CLIPS, GROM_DAMAGE_CLIPS, GROM_FALLBACK, GROM_MODEL_FILE } from "./gromClips";
import { GROM_MOVES } from "./gromMoves";
import { GROM_SPECIALS } from "./gromSpecials";
import { GROM_GAMEPLAN } from "./gromGameplan";
export const GROM_HERO: HeroDefinition = {
  character: Character.grom, name: "Grom Hellscream", purpose: "Reckless rush-down bruiser", weakness: "Committed axe swings and a predictable leap", complete: true,
  moves: GROM_MOVES, specials: GROM_SPECIALS, gameplan: GROM_GAMEPLAN,
  jab: { name: "Warsong Greeting", description: "Check them with the hilt, then chop on a second tap." },
  presentation: { model: GROM_MODEL_FILE, objectId: 0x6d666772, portrait: "ReplaceableTextures\\CommandButtons\\BTNHellScream.blp", clips: GROM_CLIPS, damageClips: GROM_DAMAGE_CLIPS, fallback: GROM_FALLBACK },
};
