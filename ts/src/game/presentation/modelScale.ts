import { f32 } from "wisp/src/sim/f32";
import { Character } from "../sim/codes";
import { heroDefinition } from "../sim/heroes/registry";

/**
 * The dwarf stands 87 units at scale 1 against his 122-unit hurt capsule; at
 * 1.4 his drawn head meets its top, so no hit lands over his visible head (#144).
 */
const RIFLEMAN_MODEL_SCALE = f32(1.4);

/** The scale each fighter model is drawn at; effects attached to it scale with it. */
export function characterModelScale(character: Character): number {
  const hero = heroDefinition(character);
  if (hero !== undefined) return hero.presentation.scale;
  return character === Character.demonHunter ? f32(0.8) : character === Character.rifleman ? RIFLEMAN_MODEL_SCALE : 1.0;
}
