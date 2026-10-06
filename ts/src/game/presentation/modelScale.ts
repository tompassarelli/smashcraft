import { f32 } from "wisp/src/sim/f32";
import { Character } from "../sim/codes";
import { heroDefinition } from "../sim/heroes/registry";

/** The scale each fighter model is drawn at; effects attached to it scale with it. */
export function characterModelScale(character: Character): number {
  const hero = heroDefinition(character);
  if (hero !== undefined) return hero.presentation.scale;
  return character === Character.demonHunter ? f32(0.8) : 1.0;
}
