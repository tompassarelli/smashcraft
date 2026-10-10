// Edge-guarding (#387, smashcraft:docs/gameplay-design.md, recovery and
// edge-guard rules): at Advanced and Expert, with the opponent off stage
// below the deck, the computer runs off the lip to the point the recovery
// will start from, falls onto it with its fighter's edge-guard tool as the
// recorded scenarios do (edgeGuardScenarios.ts), and comes back on its own
// jump. It never chases below GUARD_DEPTH or past GUARD_OUT.
import { f32 } from "wisp/src/sim/f32";
import { floorDiv } from "wisp/src/sim/intMath";
import { type AttackBuffer, queueAttack } from "../input/attackBuffer";
import { AttackStyle, Character, DownState, LedgeState, SpecialAction } from "../sim/codes";
import { canAttack } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { termsOfPhysics } from "../sim/motion";
import type { Controls } from "../sim/roster";
import { mainDeckZ } from "../sim/stage";
import { insideLip } from "./botCorner";
import { botChance } from "./botRandom";
import type { CpuSkill } from "./cpuSkill";

/** A recovering opponent this far past the lip is worth meeting. */
const GUARD_REACH = 320.0;
/** It runs out from no farther in than this. */
const GUARD_FROM = 260.0;
/** It guards no deeper below the deck and no farther past the lip than these, so its own jump still brings it back. */
const GUARD_DEPTH = 230.0;
const GUARD_OUT = 260.0;
/** The opponent must be at least this far below the deck to be recovering. */
const BELOW = 20.0;
/** Frames until an edge-guard aerial's hit comes out, about. */
const TOOL_STARTUP = 6;
/** Frames each guard choice holds before the computer weighs another. */
const GUARD_FRAMES = 240;
/** A down air is pressed with the recovery this close on either side, at its hit. */
const REACH_X = 40.0;
/** Horizontal slack before it drifts toward the recovery. */
const DRIFT_SLACK = 8.0;

const lipSide = (x: number): -1 | 1 => (x < 0.0 ? -1 : 1);

/** Forward air for the fighters whose tool reaches out (edgeGuardScenarios.ts); down air for the rest. */
export const forwardAirTool = (character: Character): boolean => character === Character.anubarak || character === Character.jaina;

/** Whether `target` is off stage below the deck, so it must recover past the lip. */
export function recoveringBelow(target: Readonly<Fighter>, stage: number): boolean {
  if (target.status.out || target.motion.grounded || target.ledge.state !== LedgeState.none || target.launch.hitstun > 0) return false;
  const inside = insideLip(stage, target.motion.x);
  return inside < 0.0 && inside >= -GUARD_REACH && target.motion.z <= f32(mainDeckZ(stage) - BELOW);
}


function guarding(f: Readonly<Fighter>, target: Readonly<Fighter>, slot: number, frame: number, skill: CpuSkill): boolean {
  return skill.edgeGuardTenths > 0 && botChance(floorDiv(frame, GUARD_FRAMES), slot * 37 + f.character * 29 + target.character, skill.edgeGuardTenths, 10);
}

/** Where `target`, seen `frames` ago, is `frames` later under its own gravity, unless a special or a launch carries it. */
function ahead(target: Readonly<Fighter>, frames: number): { readonly x: number; readonly z: number } {
  let x = target.motion.x;
  let z = target.motion.z;
  let vz = target.motion.vz;
  const carried = target.special.action !== SpecialAction.none;
  const { gravity, terminalSpeed } = termsOfPhysics(target.tuning.physics);
  for (let n = 0; n < frames; n++) {
    if (!carried) vz = Math.max(f32(-terminalSpeed), f32(vz - gravity));
    x = f32(x + target.motion.vx);
    z = f32(z + vz);
  }
  return { x, z };
}

/** On the deck: runs to the lip on the opponent's side and off it toward the recovery. */
export function waitAtLip(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, skill: CpuSkill, slot: number, frame: number, input: Controls): boolean {
  if (!f.motion.grounded || f.motion.surface !== 0 || !canAttack(f) || f.shield.raised) return false;
  if (!recoveringBelow(target, stage) || lipSide(target.motion.x) !== lipSide(f.motion.x) || !guarding(f, target, slot, frame, skill)) return false;
  const inside = insideLip(stage, f.motion.x);
  if (inside < 0.0 || inside > GUARD_FROM) return false;
  input.direction = lipSide(f.motion.x);
  input.walking = false;
  return true;
}

/** Off the lip: drifts over the recovery's path and drops the tool onto it, as the recorded gimps do. */
export function guardOffstage(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, skill: CpuSkill, slot: number, frame: number, observationAge: number, input: Controls, commands: AttackBuffer): boolean {
  if (skill.edgeGuardTenths <= 0 || f.motion.grounded || f.jump.remaining < 1 || f.launch.hitstun > 0 || f.special.fall || f.down.state !== DownState.none) return false;
  if (f.ledge.state !== LedgeState.none || f.grab.target !== undefined || !recoveringBelow(target, stage) || lipSide(target.motion.x) !== lipSide(f.motion.x)) return false;
  const side = lipSide(f.motion.x);
  const inside = insideLip(stage, f.motion.x);
  if (inside > GUARD_FROM || inside < -GUARD_OUT || f.motion.z < f32(mainDeckZ(stage) - GUARD_DEPTH)) return false;
  if (inside >= 0.0 && !guarding(f, target, slot, frame, skill)) return false;
  const seen = ahead(target, observationAge + TOOL_STARTUP);
  const own = ahead(f, TOOL_STARTUP);
  const dx = f32(f32(seen.x - own.x) * side);
  const dz = f32(seen.z - own.z);
  input.direction = dx > DRIFT_SLACK ? side : dx < -DRIFT_SLACK ? -side : 0;
  if (f.attack.style !== undefined || !canAttack(f)) return true;
  const forward = forwardAirTool(f.character);
  const inReach = forward ? dx >= -30.0 && dx <= 100.0 && dz >= -90.0 && dz <= 70.0 : dx >= -REACH_X && dx <= REACH_X && dz >= -70.0 && dz <= 10.0;
  if (inReach) queueAttack(commands, { style: forward ? AttackStyle.forwardTilt : AttackStyle.downTilt, facing: side, frame, mayCharge: false });
  return true;
}
