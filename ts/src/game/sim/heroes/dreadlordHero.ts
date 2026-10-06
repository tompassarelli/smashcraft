// Dreadlord's registration: identity, kit and presentation. Owned by this hero's
// lane; set `complete` only when the whole base kit works (hero.ts).
import { Character } from "../codes";
import { DREADLORD_CLIP_TABLE, DREADLORD_FALLBACK_CLIP, DREADLORD_MODEL_FILE } from "../../presentation/heroes/dreadlordClips";
import type { HeroDefinition } from "./hero";
import { DREADLORD_GAMEPLAN } from "./dreadlordGameplan";
import { DREADLORD_MOVES } from "./dreadlordMoves";
import { DREADLORD_SPECIALS } from "./dreadlordSpecials";

export const DREADLORD_HERO: HeroDefinition = {
  character: Character.dreadlord,
  name: "Dreadlord",
  purpose: "Air movement, grabs, and close pressure",
  weakness: "Large hurtbox and no safe long-range approach",
  complete: true,
  moves: DREADLORD_MOVES,
  specials: DREADLORD_SPECIALS,
  gameplan: DREADLORD_GAMEPLAN,
  presentation: {
    model: DREADLORD_MODEL_FILE,
    scale: 1.0,
    objectId: 0x6d66646c,
    portrait: "ReplaceableTextures\\CommandButtons\\BTNHeroDreadLord.blp",
    projectileModel: "Abilities\\Weapons\\SpiritOfVengeanceMissile\\SpiritOfVengeanceMissile.mdl",
    clips: DREADLORD_CLIP_TABLE,
    fallback: DREADLORD_FALLBACK_CLIP,
  },
};
