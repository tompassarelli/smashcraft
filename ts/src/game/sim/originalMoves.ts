



import { SMASH_MAX_CHARGE_FRAMES, SMASH_MAX_DAMAGE_MULTIPLIER } from "./moves";
import { AttackStyle, Character } from "./codes";
import type { FighterMoves } from "./heroMoves";
import { RIFLEMAN_GROUND, type GroundKit } from "./heroes/groundNormals";
import { shippedHurtboxes } from "./hurtboxes";

function originalMoves(character: Character, kit: GroundKit): FighterMoves {
  const moves: FighterMoves = {
    normals: kit.normals,
    throws: {},
    dashAttack: AttackStyle.dashAttack,
    smashMaxChargeFrames: SMASH_MAX_CHARGE_FRAMES,
    smashMaxDamageMultiplier: SMASH_MAX_DAMAGE_MULTIPLIER,
  };
  return { ...moves, hurtboxes: shippedHurtboxes(character, moves) };
}
export const RIFLEMAN_MOVES: FighterMoves = originalMoves(Character.rifleman, RIFLEMAN_GROUND);


export function originalFighterMoves(character: Character): FighterMoves | undefined {
  return character === Character.rifleman ? RIFLEMAN_MOVES : undefined;
}
