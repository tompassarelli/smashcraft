import { Character } from "../codes";
import { THRALL_MODEL_FILE, THRALL_CLIPS, THRALL_FALLBACK, THRALL_DAMAGE_CLIPS } from "../../presentation/heroes/thrallClips";
import type { HeroDefinition } from "./hero";
import { THRALL_MOVES } from "./thrallMoves";
import { THRALL_SPECIALS } from "./thrallSpecials";
import { THRALL_GAMEPLAN } from "./thrallGameplan";

export const THRALL_HERO: HeroDefinition = {
  character: Character.thrall, name: "Thrall", purpose: "Heavy hammer brawler with lightning and spirit wolves", weakness: "Slow air drift and an exposed recovery",
  complete: false, moves: THRALL_MOVES, specials: THRALL_SPECIALS, gameplan: THRALL_GAMEPLAN,
  jab: { name: "Doomhammer", description: "Check with the handle, then press again for a short hammer hook." },
  passive: { name: "Windfury", description: "Two hammer hits prepare a stronger third hit; a shield spends the bonus." },
  ultimate: { name: "Elemental Fury", description: "A great earthquake ends in a wave of lightning." },
  presentation: { model: THRALL_MODEL_FILE, objectId: 0x6d667468, portrait: "ReplaceableTextures\\CommandButtons\\BTNThrall.blp", clips: THRALL_CLIPS, damageClips: THRALL_DAMAGE_CLIPS, fallback: THRALL_FALLBACK },
};
