import { f32 } from "../../sim/f32";
import { Character } from "../sim/codes";

/** The scale each fighter model is drawn at; effects attached to it scale with it. */
export function characterModelScale(character: Character): number {
  return character === Character.demonHunter ? f32(0.8) : 1.0;
}
