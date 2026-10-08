// The Tomb of Sargeras sea (smashcraft:docs/design/water-stage.md): each
// fighter's visit to the water, kept in its state so rollback and replays
// restore it. Everything here is a fixed function of the fighters' own
// positions and the match frame.
import { f32 } from "wisp/src/sim/f32";
import { max, min } from "../../runtime/numbers";
import { PARTICIPANT_SLOTS } from "../input/participants";
import type { Fighter } from "./fighter";
import { type Roster, fighterAt, isActive } from "./roster";
import { SEA_SURFACE_Z, hasTide, inSea } from "./stageHazards";
import { setWorldMotionValue } from "./motion";
import { melee } from "./tuning";
import { SurfaceContact } from "./codes";
import { aerialJumps, jumpBuffed } from "./itemBuffs";
import { JUMP_BIT, lockedOut } from "./jumpsAndDodges";
import { observeActionDecision, observeActionStart } from "./observations";
import { clearDownState } from "./transitions";

/** Ultimate's buoyancy, 0.1 Melee units a frame upward each frame, in place of gravity, up to 3 a frame. */
export const WATER_BUOYANCY = melee(0.10000000149011612);
export const WATER_RISE_CAP = melee(3.0);
/** Brawl's swim: at most 0.6 Melee units a frame, gaining 0.05 a frame. */
export const SWIM_SPEED = melee(0.6000000238418579);
export const SWIM_ACCELERATION = melee(0.05000000074505806);
/** Ultimate's water jump: each re-entry before landing scales the next one by 0.91, at most four times. */
export const WATER_JUMP_FACTOR = 0.9100000262260437;
export const WATER_JUMP_REENTRIES = 4;

/** The scale on a water jump after `entries` entries since landing. */
export function waterJumpScale(entries: number): number {
  let scale = 1.0;
  for (let reentry = 1; reentry < min(entries, WATER_JUMP_REENTRIES + 1); reentry++) scale = f32(scale * WATER_JUMP_FACTOR);
  return scale;
}

/** A frame afloat out of hitstun: buoyancy replaces gravity, and a helpless fighter recovers its actions, as at a ledge. */
export function applyBuoyancy(f: Fighter): void {
  f.motion.vz = min(WATER_RISE_CAP, f32(f.motion.vz + WATER_BUOYANCY));
  f.motion.fastFalling = false;
  f.special.fall = false;
}

/** Buoyancy stops at the surface: the fighter floats there. */
export function floatAtSurface(f: Fighter): void {
  const { motion } = f;
  if (motion.z <= SEA_SURFACE_Z) return;
  motion.z = SEA_SURFACE_Z;
  motion.vz = 0.0;
  setWorldMotionValue(motion.meleeZ, motion.z);
  setWorldMotionValue(motion.meleeVelocityZ, 0.0);
}

/**
 * A jump out of the sea: the full ground jump with no squat, scaled by 0.91
 * for each re-entry since landing, at most four; the fighter keeps its
 * double jump and air dodge for after it.
 */
export function beginWaterJump(f: Fighter, horizontal: number): boolean {
  const { motion, jump } = f;
  if (lockedOut(f) || f.dodge.airDodging || jump.squat > 0) return false;
  observeActionDecision(JUMP_BIT);
  const physics = f.tuning.physics;
  f.surfaceRecovery.state = SurfaceContact.none;
  f.surfaceRecovery.frame = 0;
  motion.fastFalling = false;
  const jumpX = f32(f32(motion.vx * physics.jumpMomentum) + f32(horizontal * physics.jumpHorizontalSpeed));
  motion.vx = max(-physics.jumpHorizontalCap, min(physics.jumpHorizontalCap, jumpX));
  motion.vz = f32(jumpBuffed(f, physics.fullJumpSpeed) * waterJumpScale(f.water.entries));
  jump.serial++;
  jump.isDouble = false;
  jump.remaining = max(jump.remaining, aerialJumps(f));
  f.dodge.airUsed = false;
  clearDownState(f);
  observeActionStart(JUMP_BIT);
  return true;
}

/** Whether `f`, off the ground, starts its frame in the sea. */
export const wet = (f: Readonly<Fighter>, stage: number): boolean => !f.motion.grounded && inSea(stage, f.motion.x, f.motion.z);

/** Swimming toward `direction` at up to SWIM_SPEED, in place of air drift. */
export function swimVelocity(vx: number, direction: number): number {
  const target = direction > 0 ? SWIM_SPEED : -SWIM_SPEED;
  return direction > 0 ? min(target, max(vx, f32(vx + SWIM_ACCELERATION))) : max(target, min(vx, f32(vx - SWIM_ACCELERATION)));
}

export function clearWater(f: Fighter): void {
  const { water } = f;
  water.inWater = false;
  water.frames = 0;
  water.entries = 0;
  water.hydraFrame = 0;
  water.hydraX = 0.0;
}

/** After the fighters move: who is in the sea, for how long, and how often they went back in since landing. */
export function advanceWater(world: Roster, stage: number): void {
  if (!hasTide(stage)) return;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const f = fighterAt(world, slot);
    if (f.status.out) continue;
    const { motion, water } = f;
    const now = inSea(stage, motion.x, motion.z);
    if (motion.grounded) {
      water.frames = 0;
      water.entries = 0;
    }
    if (now && !water.inWater) water.entries++;
    if (now) water.frames++;
    water.inWater = now;
  }
}
