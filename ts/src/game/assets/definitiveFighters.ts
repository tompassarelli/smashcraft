import { Character } from "../sim/codes";

/**
 * Fighters whose Definitive body ships: each passed #366's criteria 2–4 with no hand edits
 * (smashcraft:docs/design/hd-fighters.md). Every other fighter draws its Classic body in both looks.
 */
export const DEFINITIVE_FIGHTERS: ReadonlySet<Character> = new Set([
  Character.rifleman, Character.demonHunter, Character.blademaster, Character.warden,
  Character.forsakenPaladin, Character.dreadlord, Character.shadowHunter, Character.pitLord, Character.thrall,
  Character.sylvanas, Character.cairne, Character.chen, Character.peon, Character.tinker, Character.kaelthas,
  Character.murloc, Character.grom, Character.anubarak, Character.medivh, Character.kobold,
]);
