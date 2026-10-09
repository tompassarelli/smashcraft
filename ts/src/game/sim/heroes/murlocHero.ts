
import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { MURLOC_CLIPS, MURLOC_DAMAGE_CLIPS, MURLOC_FALLBACK, MURLOC_MODEL_FILE } from "./murlocClips";
import { MURLOC_GAMEPLAN } from "./murlocGameplan";
import { MURLOC_MOVES } from "./murlocMoves";
import { MURLOC_SPECIALS } from "./murlocSpecials";

export const MURLOC_HERO: HeroDefinition = {
  character: Character.murloc,
  name: "Murloc",
  purpose: "Small, light rushdown",
  weakness: "Short reach, early knockouts and a short recovery",
  jab: { name: "Claw Flurry", description: "A quick claw poke, then a second swipe on another tap." },
  ultimate: { name: "Mrgllgll Swarm", description: "A tide of murlocs rushes across the stage." },
  complete: true,
  moves: MURLOC_MOVES,
  specials: MURLOC_SPECIALS,
  gameplan: MURLOC_GAMEPLAN,
  presentation: {
    model: MURLOC_MODEL_FILE,
    objectId: 0x6d666d72,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNMurloc.blp",
    clips: MURLOC_CLIPS, damageClips: MURLOC_DAMAGE_CLIPS, fallback: MURLOC_FALLBACK,
  },
};
