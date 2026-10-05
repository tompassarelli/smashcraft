// Fighter motion in Melee units. Positions and vertical velocity accumulate in
// original units and publish rounded world values; air drift, launch decay and
// platform landings use the same arithmetic as the retail engine.
import { max, min } from "../../runtime/wurst";
import { addFloat32, divideFloat32, fusedMultiplyAddFloat32, roundToFloat32, subtractFloat32 } from "../../sim/binary32";
import { f32 } from "../../sim/f32";
import { meleeAtan2, meleeCos, meleeSin } from "../../sim/meleeScalarMath";
import { Character } from "./codes";
import type { Fighter, MeleeMotionValue } from "./fighter";
import { surfaceCount, surfaceLeft, surfacePass, surfaceRight, surfaceZ } from "./stage";
import { WORLD_UNITS_PER_MELEE_UNIT } from "./tuning";

function setOriginal(value: MeleeMotionValue, original: number): void {
  value.original = original;
  value.published = f32(original * WORLD_UNITS_PER_MELEE_UNIT);
}

/** Restarts accumulation from a world value written outside Melee-unit motion. */
export function setWorldMotionValue(value: MeleeMotionValue, world: number): void {
  value.original = divideFloat32(world, WORLD_UNITS_PER_MELEE_UNIT);
  value.published = world;
}

export function clearMotionValue(value: MeleeMotionValue): void {
  value.original = 0.0;
  value.published = 0.0;
}

function retainedOriginal(value: MeleeMotionValue, world: number): number {
  return value.published === world ? value.original : divideFloat32(world, WORLD_UNITS_PER_MELEE_UNIT);
}

export function setMeleePosition(f: Fighter, originalX: number, originalZ: number): void {
  const { motion } = f;
  setOriginal(motion.meleeX, roundToFloat32(originalX));
  setOriginal(motion.meleeZ, roundToFloat32(originalZ));
  motion.x = motion.meleeX.published;
  motion.z = motion.meleeZ.published;
}

export function setMeleeVerticalVelocity(f: Fighter, originalVelocity: number): void {
  const { motion } = f;
  setOriginal(motion.meleeVelocityZ, roundToFloat32(originalVelocity));
  motion.vz = motion.meleeVelocityZ.published;
}

export function moveMeleeX(f: Fighter, worldDisplacement: number): void {
  if (worldDisplacement === 0) return;
  const { motion } = f;
  const position = retainedOriginal(motion.meleeX, motion.x);
  setOriginal(motion.meleeX, addFloat32(position, divideFloat32(worldDisplacement, WORLD_UNITS_PER_MELEE_UNIT)));
  motion.x = motion.meleeX.published;
}

export function moveMeleeZ(f: Fighter, originalDisplacement: number): void {
  if (originalDisplacement === 0) return;
  const { motion } = f;
  const position = retainedOriginal(motion.meleeZ, motion.z);
  setOriginal(motion.meleeZ, addFloat32(position, originalDisplacement));
  motion.z = motion.meleeZ.published;
}

export function applyMeleeGravity(f: Fighter): void {
  const velocity = retainedOriginal(f.motion.meleeVelocityZ, f.motion.vz);
  const gravity = divideFloat32(f.tuning.physics.gravity, WORLD_UNITS_PER_MELEE_UNIT);
  const terminal = divideFloat32(f.tuning.physics.terminalSpeed, WORLD_UNITS_PER_MELEE_UNIT);
  setMeleeVerticalVelocity(f, max(-terminal, subtractFloat32(velocity, gravity)));
}

export function moveMeleeVerticalVelocity(f: Fighter): void {
  const { motion } = f;
  if (motion.meleeVelocityZ.published !== motion.vz) setWorldMotionValue(motion.meleeVelocityZ, motion.vz);
  moveMeleeZ(f, motion.meleeVelocityZ.original);
}

export function roundMeleeWorldValue(value: number): number {
  return f32(divideFloat32(value, WORLD_UNITS_PER_MELEE_UNIT) * WORLD_UNITS_PER_MELEE_UNIT);
}

export function addMeleeWorldValues(value: number, displacement: number): number {
  // Authored stationary surfaces need exact zero-displacement identity.
  if (displacement === 0) return value;
  const left = divideFloat32(value, WORLD_UNITS_PER_MELEE_UNIT);
  const right = divideFloat32(displacement, WORLD_UNITS_PER_MELEE_UNIT);
  return f32(addFloat32(left, right) * WORLD_UNITS_PER_MELEE_UNIT);
}

export function totalVelocityX(f: Fighter): number {
  return f32(f32(f32(f.motion.vx + f.launch.knockbackX) + f.shield.pushbackX) + f.shield.recoilX);
}

export function totalVelocityZ(f: Fighter): number {
  return f32(f32(f.motion.vz + f.launch.knockbackZ) + f.shield.recoilZ);
}

export function airDriftVelocity(f: Fighter, velocity: number, direction: number): number {
  const { airSpeed: target, airAcceleration: acceleration, airCap, airFriction } = f.tuning.physics;
  // Illidan retains his authored immediate drift cap.
  if (f.character === Character.demonHunter) return max(-airCap, min(airCap, f32(velocity + f32(direction * acceleration))));
  const alongInput = f32(velocity * direction);
  const next = alongInput > target ? max(target, f32(alongInput - airFriction)) : min(target, f32(alongInput + acceleration));
  return f32(max(-airCap, min(airCap, next)) * direction);
}

function retailAirDecaySquaredCutoff(decay: number): number {
  // Both fixed retail decays lie in [1/32, 1/16), with binary32 spacing 2^-28.
  // Their squared rounding midpoints round upward; see the exact boundary corpus.
  const spacing = 3.725290298461914e-9;
  const previous = roundToFloat32(f32(decay - spacing));
  return fusedMultiplyAddFloat32(decay, previous, f32(f32(spacing * spacing) * 0.25));
}

const KNOCKBACK_DECAY_PER_FRAME = 0.050999999046325684;
// Common-data value x3E8 from the cited NTSC 1.02 extraction; values are Melee units.
export const AIR_SHIELD_RECOIL_DECAY = f32(0.05000000074505806 * WORLD_UNITS_PER_MELEE_UNIT);
export const AIR_KNOCKBACK_DECAY = roundToFloat32(KNOCKBACK_DECAY_PER_FRAME);
export const AIR_RECOIL_DECAY = roundToFloat32(f32(AIR_SHIELD_RECOIL_DECAY / WORLD_UNITS_PER_MELEE_UNIT));
export const AIR_KNOCKBACK_SQUARED_CUTOFF = retailAirDecaySquaredCutoff(AIR_KNOCKBACK_DECAY);
export const AIR_RECOIL_SQUARED_CUTOFF = retailAirDecaySquaredCutoff(AIR_RECOIL_DECAY);

/** One frame of airborne decay; belowCutoff means the motion stopped instead. */
export interface AirMotion {
  x: number;
  z: number;
  belowCutoff: boolean;
}

// Preallocated: rollback replays decay launch and recoil every airborne frame.
const decayed: AirMotion = { x: 0.0, z: 0.0, belowCutoff: false };

/** Decays a world-unit vector by a fixed Melee-unit amount along its own angle. Valid until the next call. */
export function decayedAirMotion(worldX: number, worldZ: number, decay: number, squaredCutoff: number): Readonly<AirMotion> {
  const horizontal = roundToFloat32(f32(worldX / WORLD_UNITS_PER_MELEE_UNIT));
  const vertical = roundToFloat32(f32(worldZ / WORLD_UNITS_PER_MELEE_UNIT));
  const verticalSquare = roundToFloat32(f32(vertical * vertical));
  const speedSquare = fusedMultiplyAddFloat32(horizontal, horizontal, verticalSquare);
  if (speedSquare < squaredCutoff) {
    decayed.x = 0.0;
    decayed.z = 0.0;
    decayed.belowCutoff = true;
    return decayed;
  }
  const angle = meleeAtan2(vertical, horizontal);
  decayed.x = f32(fusedMultiplyAddFloat32(-decay, meleeCos(angle), horizontal) * WORLD_UNITS_PER_MELEE_UNIT);
  decayed.z = f32(fusedMultiplyAddFloat32(-decay, meleeSin(angle), vertical) * WORLD_UNITS_PER_MELEE_UNIT);
  decayed.belowCutoff = false;
  return decayed;
}

/** The highest deck whose top the step from old to new crosses downward, within its span at both crossing and end. */
export function landingAlongShift(f: Fighter, stage: number, oldX: number, oldZ: number, newX: number, newZ: number): number | undefined {
  if (newZ >= oldZ) return undefined;
  let landing: number | undefined;
  for (let i = 0; i < surfaceCount(stage); i++) {
    const platformZ = surfaceZ(stage, i);
    if (oldZ >= platformZ && newZ <= platformZ && !(surfacePass(stage, i) && f.motion.dropTime > 0)) {
      const fraction = f32(f32(oldZ - platformZ) / f32(oldZ - newZ));
      const crossingX = f32(oldX + f32(f32(newX - oldX) * fraction));
      if (crossingX >= surfaceLeft(stage, i) && crossingX <= surfaceRight(stage, i) && newX >= surfaceLeft(stage, i) && newX <= surfaceRight(stage, i)) {
        if (landing === undefined || platformZ > surfaceZ(stage, landing)) landing = i;
      }
    }
  }
  return landing;
}
