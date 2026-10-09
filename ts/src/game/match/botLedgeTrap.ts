import { f32 } from "wisp/src/sim/f32";
import { type AttackBuffer, queueAttack } from "../input/attackBuffer";
import { AttackStyle, LedgeState } from "../sim/codes";
import { canAttack } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import type { Controls } from "../sim/roster";
import { mainDeckLeft, mainDeckRight } from "../sim/stage";
import { steerOnGround } from "./botFooting";

export const LEDGE_TRAP_GAP = 60.0;
const ARRIVED = 30.0;
export const TRAP_NONE = 0;
export const TRAP_HOLD = 1;
export const TRAP_ATTACK = 2;

export function chooseLedgeTrap(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, frame: number, input: Controls, commands: AttackBuffer, ready: boolean): number {
  const state = target.ledge.state;
  if (state === LedgeState.none || state === LedgeState.roll || !f.motion.grounded || f.motion.surface !== 0) return TRAP_NONE;
  const side = target.ledge.side;
  const edge = side < 0 ? mainDeckLeft(stage) : mainDeckRight(stage);
  const spot = f32(edge - side * LEDGE_TRAP_GAP);
  steerOnGround(f, stage, spot, input);
  const arrived = Math.abs(f32(f.motion.x - spot)) <= ARRIVED;
  if (arrived && f.facing !== side) {
    input.direction = side;
    input.walking = true;
  }
  if (state === LedgeState.hang || !arrived || !canAttack(f) || !ready) return TRAP_HOLD;
  queueAttack(commands, { style: AttackStyle.forwardTilt, facing: side < 0 ? -1 : 1, frame, mayCharge: false });
  return TRAP_ATTACK;
}
