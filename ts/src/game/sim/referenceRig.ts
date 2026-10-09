
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character } from "./codes";
import { createFighter, type Fighter } from "./fighter";
import type { FighterMoves } from "./heroMoves";
import { hurtPart, hurtPose } from "./hurtboxes";
import { attackActiveFrames, attackStartupFrames, SMASH_MAX_CHARGE_FRAMES, SMASH_MAX_DAMAGE_MULTIPLIER } from "./moves";
import { AUTHORED_PHYSICS } from "./tuning";

// The shared contact specs use a 132-unit body with radius 24 (docs/hurtboxes.md).
const REFERENCE_STAND = [hurtPart(0.0, 4.0, 0.0, 88.0, 24.0)];
const referencePose = (style: AttackStyle, parts: ReturnType<typeof hurtPart>[]) => [
  hurtPose(attackStartupFrames(style) - 2, attackStartupFrames(style) + attackActiveFrames(style) + 2, parts),
];
const REFERENCE_CONTACT_MOVES: FighterMoves = {
  normals: {},
  throws: {},
  dashAttack: AttackStyle.dashAttack,
  smashMaxChargeFrames: SMASH_MAX_CHARGE_FRAMES,
  smashMaxDamageMultiplier: SMASH_MAX_DAMAGE_MULTIPLIER,
  hurtboxes: {
    stand: REFERENCE_STAND,
    attacks: {
      [AttackStyle.jab]: referencePose(AttackStyle.jab, [hurtPart(0.0, 4.0, 4.0, 88.0, 24.0), hurtPart(8.0, f32(88.0 * f32(0.68)), 40.0, f32(88.0 * f32(0.6)), 9.0)]),
      [AttackStyle.downAir]: referencePose(AttackStyle.downAir, [hurtPart(0.0, f32(88.0 * f32(0.35)), 0.0, 88.0, 24.0), hurtPart(0.0, f32(88.0 * f32(0.35)), 4.0, -18.0, 12.0)]),
    },
  },
};

export function createReferenceContactFighter(x: number, facing: number): Fighter {
  const fighter = createReferenceFighter(Character.sylvanas, x, facing);
  fighter.tuning.moves = REFERENCE_CONTACT_MOVES;
  return fighter;
}

export function createReferenceFighter(character: Character, x: number, facing: number): Fighter {
  const fighter = createFighter(character, x, facing);
  if (character === Character.sylvanas) {
    fighter.tuning.physics = AUTHORED_PHYSICS.reference;
    fighter.tuning.moves = undefined;
  }
  return fighter;
}
