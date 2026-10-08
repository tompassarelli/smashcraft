// Retail movement captures use Fox parameters independently of the host's kit.
import { Character } from "./codes";
import { createFighter, type Fighter } from "./fighter";
import { AUTHORED_PHYSICS } from "./tuning";

export function createReferenceFighter(character: Character, x: number, facing: number): Fighter {
  const fighter = createFighter(character, x, facing);
  if (character === Character.sylvanas) {
    fighter.tuning.physics = AUTHORED_PHYSICS.reference;
    fighter.tuning.moves = undefined;
  }
  return fighter;
}
