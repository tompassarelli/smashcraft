import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, LedgeState } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { attackStartupFrames, characterAttackActiveFrames } from "../sim/moves";
import type { Controls } from "../sim/roster";
import { mainDeckLeft, mainDeckRight } from "../sim/stage";
import { steerOnGround } from "./botFooting";

export const LEDGE_TRAP_GAP = 60.0;
const ARRIVED = 30.0;
const LEDGE_ATTACK_REACH = 210.0;

/** Whether a ledge attack from `target` is still to swing, observed this many frames ago. */
function getupAttackAhead(target: Readonly<Fighter>, age: number): boolean {
  const { ledge } = target;
  if (ledge.state === LedgeState.hang) return true;
  if (ledge.state !== LedgeState.attack) return false;
  return ledge.frame + age < attackStartupFrames(AttackStyle.ledgeAttack, target.tuning.moves) + characterAttackActiveFrames(target.character, AttackStyle.ledgeAttack, target.tuning.moves);
}

/**
 * Holds the spot just inside a hanging opponent's ledge, shielding while its
 * ledge attack is still to come; it throws nothing into ledge intangibility,
 * and botPunish.ts's ledge window answers the get-up once it can be hit.
 */
export function chooseLedgeTrap(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, observationAge: number, input: Controls): boolean {
  const state = target.ledge.state;
  if (state === LedgeState.none || state === LedgeState.roll || !f.motion.grounded || f.motion.surface !== 0) return false;
  const side = target.ledge.side;
  const edge = side < 0 ? mainDeckLeft(stage) : mainDeckRight(stage);
  const spot = f32(edge - side * LEDGE_TRAP_GAP);
  const arrived = Math.abs(f32(f.motion.x - spot)) <= ARRIVED;
  const ahead = getupAttackAhead(target, observationAge);
  const inward = f32(f32(edge - f.motion.x) * side);
  if (!arrived && !(ahead && inward > LEDGE_TRAP_GAP && inward <= LEDGE_ATTACK_REACH)) {
    steerOnGround(f, stage, spot, input);
    return true;
  }
  input.direction = arrived && f.facing !== side ? side : 0;
  input.walking = arrived;
  input.shield = ahead;
  return true;
}
