// Archer's and Rifleman's own jab, tilts and dash attack
// (smashcraft:docs/design/tilts.md). Their smashes, aerials, grabs and throws
// keep the shared tables in moves.ts and hitRegions.ts; their bodies keep the
// shipped poses, timed to these moves.
import { SMASH_MAX_CHARGE_FRAMES, SMASH_MAX_DAMAGE_MULTIPLIER } from "./moves";
import { AttackStyle, Character } from "./codes";
import type { FighterMoves } from "./heroMoves";
import { ARCHER_GROUND, RIFLEMAN_GROUND, type GroundKit } from "./heroes/groundNormals";
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

export const ARCHER_MOVES: FighterMoves = originalMoves(Character.archer, ARCHER_GROUND);
export const RIFLEMAN_MOVES: FighterMoves = originalMoves(Character.rifleman, RIFLEMAN_GROUND);

/** An original fighter's kit; Illidan's normals stay in the shared tables. */
export function originalFighterMoves(character: Character): FighterMoves | undefined {
  return character === Character.archer ? ARCHER_MOVES : character === Character.rifleman ? RIFLEMAN_MOVES : undefined;
}
