import { f32 } from "../../sim/f32";
import { LedgeState, SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { totalVelocityZ } from "../sim/motion";
import type { Controls } from "../sim/roster";
import { surfaceLeft, surfaceRight, surfaceZ } from "../sim/stage";

/** Produces ordinary frame inputs: recovery never moves a fighter directly. */
export function chooseRecoveryInput(fighter: Readonly<Fighter>, stage: number, input: Controls): boolean {
  input.specialPressed = false;
  input.specialX = 0;
  input.specialZ = 0;
  input.verticalDirection = 0;
  input.ledgeVerticalPressed = 0;
  if (fighter.status.out) return false;
  if (fighter.ledge.state !== LedgeState.none) {
    input.direction = -fighter.ledge.side;
    input.ledgeVerticalPressed = fighter.ledge.state === LedgeState.hang ? 1 : 0;
    return true;
  }
  const left = surfaceLeft(stage, 0);
  const right = surfaceRight(stage, 0);
  const floor = surfaceZ(stage, 0);
  const { x, z, grounded } = fighter.motion;
  if (grounded || (x >= left && x <= right && z >= floor)) return false;
  const landingX = x < 0 ? f32(left + 60) : f32(right - 60);
  input.direction = x < landingX ? 1 : -1;
  if (fighter.launch.hitstun > 0 || fighter.launch.hitlag > 0 || fighter.special.action !== SpecialAction.none) return true;
  if (totalVelocityZ(fighter) <= 0 && z < f32(floor + 100)) {
    if (fighter.jump.remaining > 0 && fighter.attack.cooldown === 0) {
      input.jumpPressed = true;
      input.jumpHeld = true;
    } else if (z < f32(floor + 50)) {
      input.specialPressed = true;
      input.specialX = input.direction;
      input.specialZ = 1;
      input.verticalDirection = 1;
    }
  }
  return true;
}
