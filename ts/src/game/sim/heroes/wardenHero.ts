// Warden's registration: identity, kit and presentation. Owned by this hero's
// lane; set `complete` only when the whole base kit works (hero.ts).
import { Character } from "../codes";
import { WARDEN_CLIP_TABLE } from "../../presentation/heroes/wardenClipTable";
import { WARDEN_CLIPS, WARDEN_MODEL_FILE } from "../../presentation/heroes/wardenClips";
import type { HeroDefinition } from "./hero";
import { WARDEN_MOVES } from "./wardenMoves";
import { WARDEN_SPECIALS } from "./wardenSpecials";

export const WARDEN_HERO: HeroDefinition = {
  character: Character.warden,
  name: "Warden",
  purpose: "Precision mobility and edge pressure",
  weakness: "Light body and punishable teleport endpoints",
  complete: false,
  moves: WARDEN_MOVES,
  specials: WARDEN_SPECIALS,
  presentation: {
    model: WARDEN_MODEL_FILE,
    scale: 1.0,
    baseUnit: "Ewar",
    objectId: 0x6d667764,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroWarden.blp",
    projectileModel: "Abilities\\Spells\\NightElf\\shadowstrike\\ShadowStrikeMissile.mdl",
    clips: WARDEN_CLIP_TABLE,
    fallback: WARDEN_CLIPS.idle,
  },
};
