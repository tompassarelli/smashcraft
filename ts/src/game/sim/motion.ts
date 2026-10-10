


import { max, min } from "../../runtime/numbers";
import { addFloat32, divideFloat32, fusedMultiplyAddFloat32, multiplyFloat32, roundToFloat32, subtractFloat32 } from "wisp/src/sim/binary32";
import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { meleeAtan2, meleeCos, meleeSin } from "../../sim/meleeScalarMath";
import { heavyFall, speedBuffed } from "./itemBuffs";
import { chillScaled } from "./chill";
import type { Fighter, MeleeMotionValue } from "./fighter";
import { type GroundLine, groundLineZ, surfaceCount, surfaceLeft, surfaceLine, surfaceMoves, surfaceRight, surfaceShiftX, surfaceShiftZ, surfaceZ } from "./stage";
import { type FighterPhysics, WORLD_UNITS_PER_MELEE_UNIT } from "./tuning";



const WORLD_VALUE_MEMO_LIMIT = 512;
const worldValueInput: Record<number, number> = {};
const worldValueResult: Record<number, number> = {};
const originalValueInput: Record<number, number> = {};
const originalValueResult: Record<number, number> = {};

function worldValue(original: number): number {


  const slot = floorMod(Math.floor(original * 4093), WORLD_VALUE_MEMO_LIMIT);
  if (original === 0 || slot !== slot) return multiplyFloat32(original, WORLD_UNITS_PER_MELEE_UNIT);
  if (worldValueInput[slot] === original) return worldValueResult[slot] ?? 0.0;
  const converted = multiplyFloat32(original, WORLD_UNITS_PER_MELEE_UNIT);
  worldValueInput[slot] = original;
  worldValueResult[slot] = converted;
  return converted;
}

function originalValue(world: number): number {
  if (world === 0) return world;
  const slot = floorMod(Math.floor(world * 4093), WORLD_VALUE_MEMO_LIMIT);
  if (slot !== slot) return divideFloat32(world, WORLD_UNITS_PER_MELEE_UNIT);
  if (originalValueInput[slot] === world) return originalValueResult[slot] ?? 0.0;
  const converted = divideFloat32(world, WORLD_UNITS_PER_MELEE_UNIT);
  originalValueInput[slot] = world;
  originalValueResult[slot] = converted;
  return converted;
}

function setOriginal(value: MeleeMotionValue, original: number): void {
  value.original = original;
  value.published = worldValue(original);
}


export function setWorldMotionValue(value: MeleeMotionValue, world: number): void {
  value.original = originalValue(world);
  value.published = world;
}

export function clearMotionValue(value: MeleeMotionValue): void {
  value.original = 0.0;
  value.published = 0.0;
}

export function retainedOriginal(value: MeleeMotionValue, world: number): number {
  return value.published === world ? value.original : originalValue(world);
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

export function setMeleeKnockback(f: Fighter, originalX: number, originalZ: number): void {
  const { launch } = f;
  setOriginal(launch.meleeKnockbackX, roundToFloat32(originalX));
  setOriginal(launch.meleeKnockbackZ, roundToFloat32(originalZ));
  launch.knockbackX = launch.meleeKnockbackX.published;
  launch.knockbackZ = launch.meleeKnockbackZ.published;
}

export function setMeleeRecoil(f: Fighter, originalX: number, originalZ: number): void {
  const { shield } = f;
  setOriginal(shield.meleeRecoilX, roundToFloat32(originalX));
  setOriginal(shield.meleeRecoilZ, roundToFloat32(originalZ));
  shield.recoilX = shield.meleeRecoilX.published;
  shield.recoilZ = shield.meleeRecoilZ.published;
}

export function moveMeleeX(f: Fighter, worldDisplacement: number): void {
  if (worldDisplacement === 0) return;
  const { motion } = f;
  const position = retainedOriginal(motion.meleeX, motion.x);
  setOriginal(motion.meleeX, addFloat32(position, originalValue(worldDisplacement)));
  motion.x = motion.meleeX.published;
}

export function moveMeleeZ(f: Fighter, originalDisplacement: number): void {
  if (originalDisplacement === 0) return;
  const { motion } = f;
  const position = retainedOriginal(motion.meleeZ, motion.z);
  setOriginal(motion.meleeZ, addFloat32(position, originalDisplacement));
  motion.z = motion.meleeZ.published;
}


interface PhysicsTerms {
  readonly gravity: number;
  readonly terminalSpeed: number;

  readonly knockbackFriction: number;
}




const physicsTerms = new WeakMap<Readonly<FighterPhysics>, PhysicsTerms>();

export function termsOfPhysics(physics: Readonly<FighterPhysics>): PhysicsTerms {
  const cached = physicsTerms.get(physics);
  if (cached !== undefined) return cached;
  const terms: PhysicsTerms = {
    gravity: divideFloat32(physics.gravity, WORLD_UNITS_PER_MELEE_UNIT),
    terminalSpeed: divideFloat32(physics.terminalSpeed, WORLD_UNITS_PER_MELEE_UNIT),
    knockbackFriction: roundMeleeWorldValue(f32(physics.traction * GROUND_KNOCKBACK_FRICTION_MULTIPLIER)),
  };
  physicsTerms.set(physics, terms);
  return terms;
}


const GROUND_KNOCKBACK_FRICTION_MULTIPLIER = 1.0;

export function applyMeleeGravity(f: Fighter): void {
  const velocity = retainedOriginal(f.motion.meleeVelocityZ, f.motion.vz);
  const { gravity, terminalSpeed: terminal } = termsOfPhysics(f.tuning.physics);
  setMeleeVerticalVelocity(f, max(-heavyFall(f, terminal), subtractFloat32(velocity, heavyFall(f, gravity))));
}

export function moveMeleeVerticalVelocity(f: Fighter): void {
  const { motion } = f;
  if (motion.meleeVelocityZ.published !== motion.vz) setWorldMotionValue(motion.meleeVelocityZ, motion.vz);
  moveMeleeZ(f, motion.meleeVelocityZ.original);
}

export function roundMeleeWorldValue(value: number): number {
  return multiplyFloat32(originalValue(value), WORLD_UNITS_PER_MELEE_UNIT);
}

export function addMeleeWorldValues(value: number, displacement: number): number {

  if (displacement === 0) return value;
  const left = originalValue(value);
  const right = originalValue(displacement);
  return multiplyFloat32(addFloat32(left, right), WORLD_UNITS_PER_MELEE_UNIT);
}

export function totalVelocityX(f: Fighter): number {
  return f32(f32(f32(f.motion.vx + f.launch.knockbackX) + f.shield.pushbackX) + f.shield.recoilX);
}

export function totalVelocityZ(f: Fighter): number {
  return f32(f32(f.motion.vz + f.launch.knockbackZ) + f.shield.recoilZ);
}








function retailAirDriftVelocity(f: Fighter, velocity: number, stick: number, cap: number): number {
  const { airAcceleration, airFriction } = f.tuning.physics;
  const direction = stick < 0 ? -1 : 1;
  const magnitude = Math.abs(stick);


  const base = f32(0.019999999552965164 * WORLD_UNITS_PER_MELEE_UNIT);
  const acceleration = magnitude === 1 ? airAcceleration : f32(base + f32(f32(airAcceleration - base) * magnitude));
  const target = f32(speedBuffed(f, chillScaled(f, f.tuning.physics.airSpeed)) * magnitude);
  const alongInput = f32(velocity * direction);
  const next = alongInput > target ? max(target, f32(alongInput - airFriction)) : min(target, f32(alongInput + acceleration));
  return f32(max(-cap, min(cap, next)) * direction);
}


export function airDriftVelocity(f: Fighter, velocity: number, stick: number): number {
  return retailAirDriftVelocity(f, velocity, stick, speedBuffed(f, f.tuning.physics.airCap));
}

function retailAirDecaySquaredCutoff(decay: number): number {
  // Both fixed retail decays lie in [1/32, 1/16), with binary32 spacing 2^-28.
  // Their squared rounding midpoints round upward; see the exact boundary corpus.
  const spacing = 3.725290298461914e-9;
  const previous = subtractFloat32(decay, spacing);
  return fusedMultiplyAddFloat32(decay, previous, f32(f32(spacing * spacing) * 0.25));
}

const KNOCKBACK_DECAY_PER_FRAME = 0.050999999046325684;
// Common-data value x3E8 from the cited NTSC 1.02 extraction; values are Melee units.
const AIR_SHIELD_RECOIL_DECAY = multiplyFloat32(0.05000000074505806, WORLD_UNITS_PER_MELEE_UNIT);
export const AIR_KNOCKBACK_DECAY = roundToFloat32(KNOCKBACK_DECAY_PER_FRAME);
export const AIR_RECOIL_DECAY = divideFloat32(AIR_SHIELD_RECOIL_DECAY, WORLD_UNITS_PER_MELEE_UNIT);
export const AIR_KNOCKBACK_SQUARED_CUTOFF = retailAirDecaySquaredCutoff(AIR_KNOCKBACK_DECAY);
export const AIR_RECOIL_SQUARED_CUTOFF = retailAirDecaySquaredCutoff(AIR_RECOIL_DECAY);


interface AirMotion {
  x: number;
  z: number;
  belowCutoff: boolean;
}


const decayed: AirMotion = { x: 0.0, z: 0.0, belowCutoff: false };





const DECAY_MEMO_LIMIT = 512;
let decayMemoSize = 0;
let decayMemoVertical: Record<number, number> = {};
let decayMemoDecay: Record<number, number> = {};
let decayMemoCutoff: Record<number, number> = {};
let decayMemoX: Record<number, number> = {};
let decayMemoZ: Record<number, number> = {};


export function decayedAirMotion(horizontal: number, vertical: number, decay: number, squaredCutoff: number): Readonly<AirMotion> {
  // Zeros would lose their sign as keys, and NaN can't be one.
  const memoized = horizontal !== 0 && vertical !== 0 && horizontal === horizontal;
  if (memoized && decayMemoVertical[horizontal] === vertical && decayMemoDecay[horizontal] === decay && decayMemoCutoff[horizontal] === squaredCutoff) {
    decayed.x = decayMemoX[horizontal] ?? 0.0;
    decayed.z = decayMemoZ[horizontal] ?? 0.0;
    decayed.belowCutoff = false;
    return decayed;
  }
  const verticalSquare = multiplyFloat32(vertical, vertical);
  const speedSquare = fusedMultiplyAddFloat32(horizontal, horizontal, verticalSquare);
  if (speedSquare < squaredCutoff) {
    decayed.x = 0.0;
    decayed.z = 0.0;
    decayed.belowCutoff = true;
    return decayed;
  }
  const angle = meleeAtan2(vertical, horizontal);
  decayed.x = fusedMultiplyAddFloat32(-decay, meleeCos(angle), horizontal);
  decayed.z = fusedMultiplyAddFloat32(-decay, meleeSin(angle), vertical);
  decayed.belowCutoff = false;
  if (memoized) {
    if (decayMemoSize === DECAY_MEMO_LIMIT) {
      decayMemoSize = 0;
      decayMemoVertical = {};
      decayMemoDecay = {};
      decayMemoCutoff = {};
      decayMemoX = {};
      decayMemoZ = {};
    }
    if (decayMemoVertical[horizontal] === undefined) decayMemoSize++;
    decayMemoVertical[horizontal] = vertical;
    decayMemoDecay[horizontal] = decay;
    decayMemoCutoff[horizontal] = squaredCutoff;
    decayMemoX[horizontal] = decayed.x;
    decayMemoZ[horizontal] = decayed.z;
  }
  return decayed;
}








export function slopedLandingZ(line: GroundLine, standing: boolean, fromX: number, fromZ: number, newX: number, newZ: number): number | undefined {
  const left = line.xs[0] ?? 0.0;
  const right = line.xs[line.xs.length - 1] ?? 0.0;
  if (newX < left || newX > right) return undefined;
  const groundZ = groundLineZ(line, newX);
  if (standing) return groundZ;
  const below = f32(newZ - groundZ);
  if (below > 0) return undefined;
  const above = f32(fromZ - groundLineZ(line, fromX));
  if (above < 0) return undefined;
  const fraction = above === below ? 1.0 : f32(above / f32(above - below));
  const crossingX = f32(fromX + f32(f32(newX - fromX) * fraction));
  return crossingX >= left && crossingX <= right ? groundZ : undefined;
}


export function keepToSlope(f: Fighter, stage: number): void {
  const { motion } = f;
  if (!motion.grounded || motion.surface === undefined) return;
  const line = surfaceLine(stage, motion.surface);
  if (line === undefined) return;
  const z = slopedLandingZ(line, true, motion.x, motion.z, motion.x, motion.z);
  if (z === undefined) return;
  motion.z = z;
  setWorldMotionValue(motion.meleeZ, z);
}








export function landingAlongShift(f: Fighter, stage: number, matchFrame: number, oldX: number, oldZ: number, newX: number, newZ: number, overFrame: boolean): number | undefined {
  let landing: number | undefined;
  let landingZ = 0.0;
  for (let i = 0; i < surfaceCount(stage); i++) {
    const follows = overFrame && surfaceMoves(stage, i);
    const fromX = follows ? f32(oldX + surfaceShiftX(stage, i, matchFrame)) : oldX;
    const fromZ = follows ? f32(oldZ + surfaceShiftZ(stage, i, matchFrame)) : oldZ;
    if (newZ >= fromZ) continue;
    const line = surfaceLine(stage, i);
    if (line !== undefined) {
      const lineZ = slopedLandingZ(line, f.motion.grounded && f.motion.surface === i, fromX, fromZ, newX, newZ);
      if (lineZ !== undefined && (landing === undefined || lineZ > landingZ)) {
        landing = i;
        landingZ = lineZ;
      }
      continue;
    }
    const platformZ = surfaceZ(stage, i, matchFrame);
    if (fromZ >= platformZ && newZ <= platformZ) {
      const fraction = f32(f32(fromZ - platformZ) / f32(fromZ - newZ));
      const crossingX = f32(fromX + f32(f32(newX - fromX) * fraction));
      const left = surfaceLeft(stage, i, matchFrame);
      const right = surfaceRight(stage, i, matchFrame);
      if (crossingX >= left && crossingX <= right && newX >= left && newX <= right) {
        if (landing === undefined || platformZ > landingZ) {
          landing = i;
          landingZ = platformZ;
        }
      }
    }
  }
  return landing;
}
