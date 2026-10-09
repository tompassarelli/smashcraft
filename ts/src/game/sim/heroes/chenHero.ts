import { Character } from "../codes";
import type { HeroDefinition } from "./hero";
import { CHEN_MOVES } from "./chenMoves";
import { CHEN_SPECIALS } from "./chenSpecials";
import { CHEN_GAMEPLAN } from "./chenGameplan";
import { CHEN_CLIPS, CHEN_DAMAGE_CLIPS, CHEN_FALLBACK_CLIP, CHEN_MODEL_FILE } from "./chenClips";

export const CHEN_HERO: HeroDefinition = {
  character: Character.chen, name: "Chen Stormstout", purpose: "Drunken footwork and close staff pressure",
  weakness: "Broad body, slow run and committed finishes", complete: true,
  moves: CHEN_MOVES, specials: CHEN_SPECIALS, gameplan: CHEN_GAMEPLAN,
  jab: { name: "Staggering Three", description: "A palm, a staff butt and a belly check on repeated jabs." },
  presentation: { model: CHEN_MODEL_FILE, objectId: 0x6d666368,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNPandarenBrewmaster.blp", clips: CHEN_CLIPS, damageClips: CHEN_DAMAGE_CLIPS, fallback: CHEN_FALLBACK_CLIP },
};
