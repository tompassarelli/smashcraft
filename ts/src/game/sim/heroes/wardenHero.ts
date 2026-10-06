// Warden's registration: identity, kit and presentation. Owned by this hero's
// lane; set `complete` only when the whole base kit works (hero.ts).
import { Character } from "../codes";
import { WARDEN_CLIP_TABLE } from "../../presentation/heroes/wardenClipTable";
import { WARDEN_CLIPS, WARDEN_MODEL_FILE } from "../../presentation/heroes/wardenClips";
import type { HeroDefinition } from "./hero";
import { WARDEN_GAMEPLAN } from "./wardenGameplan";
import { WARDEN_MOVES } from "./wardenMoves";
import { WARDEN_SPECIALS } from "./wardenSpecials";

export const WARDEN_HERO: HeroDefinition = {
  character: Character.warden,
  name: "Warden",
  purpose: "Precision mobility and edge pressure",
  weakness: "Light body and punishable teleport endpoints",
  complete: true,
  moves: WARDEN_MOVES,
  specials: WARDEN_SPECIALS,
  passive: { name: "Shadow Step", description: "Landing an aerial in the air gives back one air jump, once per jump." },
  ultimate: { name: "Spirit of Vengeance", description: "For a while, each of her normals repeats as a ghostly copy a moment later." },
  gameplan: WARDEN_GAMEPLAN,
  presentation: {
    model: WARDEN_MODEL_FILE,
    scale: 1.0,
    objectId: 0x6d667764,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroWarden.blp",
    clips: WARDEN_CLIP_TABLE,
    fallback: WARDEN_CLIPS.idle,
  },
};
