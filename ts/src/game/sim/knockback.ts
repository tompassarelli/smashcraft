// Launch strength, hitlag, hitstun and directional influence. The scalar
// formulas reproduce NTSC 1.02 binary32 arithmetic; see
// smashcraft:docs/melee-hitlag-scalars.md and melee-hitstun-boundaries.md.
import { max, min, toInt, toReal } from "../../runtime/wurst";
import { addFloat32, divideFloat32, fusedMultiplyAddFloat32, multiplyFloat32, roundToFloat32, subtractFloat32 } from "waygate/src/sim/binary32";
import { f32 } from "waygate/src/sim/f32";
import { meleeAtan2, meleeCos, meleeSin } from "../../sim/meleeScalarMath";
import { DamageLanding } from "./codes";
import type { Fighter } from "./fighter";
import { AIR_KNOCKBACK_DECAY, AIR_KNOCKBACK_SQUARED_CUTOFF, decayedAirMotion, retainedOriginal, roundMeleeWorldValue, setMeleeKnockback } from "./motion";
import type { Controls } from "./roster";
import { melee } from "./tuning";
import { atan2, squareRoot } from "./warcraftMath";

const KNOCKBACK_LAUNCH_SCALE = melee(0.029999999329447746);
const HITSTUN_FRAMES_PER_KNOCKBACK = 0.4000000059604645;
const KNOCKBACK_STACKING_FRAMES = 10;
const GROUND_KNOCKBACK_FRICTION_MULTIPLIER = 1.0;
const GROUND_LAUNCH_BOUNCE_ANGLE = 0.1745329201221466;
const GROUND_LAUNCH_REBOUND = 0.800000011920929;
const RADIANS_TO_DEGREES = 57.295780181884766;
export const ORDINARY_HIT_GROWTH_PERCENT = 100.0;
export const ORDINARY_HIT_BASE_KNOCKBACK = 20.0;
export const ORDINARY_HIT_CONTEXT_SCALE = 1.0;
export const DIAGONAL_UNIT = 0.7071067690849304;
/** NTSC 1.02 common +0x4F0; upward knockback, not ordinary jump velocity. */
export const TOP_KO_MINIMUM_UPWARD_KNOCKBACK = melee(2.4000000953674316);
/** PlCo.dat +0x164 max_grounded_kb_on_landing. */
export const MAX_GROUNDED_KNOCKBACK_ON_LANDING = melee(8.300000190734863);

/** Attack power: integer even without staling, at least one for any positive damage. */
export function integerHitPower(hitDamage: number): number {
  const damage = roundToFloat32(hitDamage);
  return damage > 0 ? max(1, toInt(damage)) : 0;
}

function launchWeightFactor(victimWeight: number): number {
  const weight = multiplyFloat32(roundToFloat32(victimWeight), 0.009999999776482582);
  const fraction = divideFloat32(multiplyFloat32(weight, 2.0), addFloat32(weight, 1.0));
  return subtractFloat32(2.0, fraction);
}

function scaledLaunchGrowth(contribution: number, victimWeight: number, growthPercent: number, baseKnockback: number): number {
  const weighted = multiplyFloat32(contribution, launchWeightFactor(victimWeight));
  const growth = fusedMultiplyAddFloat32(1.399999976158142, weighted, 18.0);
  const multiplier = multiplyFloat32(roundToFloat32(growthPercent), 0.009999999776482582);
  return min(2500.0, fusedMultiplyAddFloat32(multiplier, growth, roundToFloat32(baseKnockback)));
}

/** Knockback from the victim's percent after the hit's damage is added. */
export function contactKnockback(postHitPercent: number, hitDamage: number, victimWeight: number, growthPercent: number, baseKnockback: number, contextScale: number): number {
  const percent = roundToFloat32(postHitPercent);
  const powered = multiplyFloat32(percent, toReal(integerHitPower(hitDamage)));
  const damageGrowth = multiplyFloat32(powered, 0.05000000074505806);
  const contribution = fusedMultiplyAddFloat32(0.10000000149011612, percent, damageGrowth);
  return multiplyFloat32(scaledLaunchGrowth(contribution, victimWeight, growthPercent, baseKnockback), roundToFloat32(contextScale));
}

export function fixedHitKnockback(fixedPower: number, victimWeight: number, growthPercent: number, baseKnockback: number, contextScale: number): number {
  const power = multiplyFloat32(toReal(fixedPower), 10.0);
  const damageGrowth = multiplyFloat32(power, 0.05000000074505806);
  const contribution = fusedMultiplyAddFloat32(10.0, 0.10000000149011612, damageGrowth);
  return multiplyFloat32(scaledLaunchGrowth(contribution, victimWeight, growthPercent, baseKnockback), roundToFloat32(contextScale));
}

/** Crouch-cancel and smash-charge adjustments to a launch. */
export function hitContextKnockback(knockback: number, crouching: boolean, smashCharging: boolean): number {
  let result = roundToFloat32(knockback);
  if (crouching) result = multiplyFloat32(result, 0.6666666865348816);
  if (smashCharging) result = multiplyFloat32(result, 1.2000000476837158);
  return result;
}

/** Damage retains its fraction; the victim's percent before the hit is truncated. */
export function ordinaryHitKnockback(preHitPercent: number, hitDamage: number, victimWeight: number, growthPercent: number, baseKnockback: number, contextScale: number): number {
  const postHitPercent = addFloat32(toReal(toInt(max(0.0, roundToFloat32(preHitPercent)))), roundToFloat32(hitDamage));
  return contactKnockback(postHitPercent, hitDamage, victimWeight, growthPercent, baseKnockback, contextScale);
}

export function victimHitlagFrames(hitDamage: number, electric: boolean, crouching: boolean): number {
  if (hitDamage <= 0) return 0;
  const base = toInt(f32(f32(integerHitPower(hitDamage) / 3.0) + 3));
  const effectFrames = electric ? toInt(f32(base * 1.5)) : base;
  return min(20, crouching ? toInt(f32(f32(effectFrames * 2.0) / 3.0)) : effectFrames);
}

export function ordinaryHitlagFrames(hitDamage: number): number {
  return victimHitlagFrames(hitDamage, false, false);
}

export function ordinaryHitstunFrames(knockback: number): number {
  return max(1, toInt(f32(knockback * HITSTUN_FRAMES_PER_KNOCKBACK)));
}

export function damageLevelForKnockback(knockback: number): number {
  const scaled = f32(knockback * HITSTUN_FRAMES_PER_KNOCKBACK);
  if (scaled >= 32) return 3;
  if (scaled >= 21) return 2;
  return scaled >= 10 ? 1 : 0;
}

/** NTSC 1.02 common +0x1E4/+0x1E0, in Melee units per frame. */
export function airborneDamageLandingReaction(launchSpeed: number): DamageLanding {
  if (launchSpeed < 0.5) return DamageLanding.retainStun;
  if (launchSpeed < 5.0) return DamageLanding.normal;
  return DamageLanding.knockdown;
}

function mergeLaunchAxis(existing: number, incoming: number): number {
  if (existing === 0) return incoming;
  if (incoming === 0) return existing;
  if (existing < 0 !== incoming < 0) return f32(existing + incoming);
  return existing > 0 ? max(existing, incoming) : min(existing, incoming);
}

/** Replaces or, ten frames after the last launch, merges the launch velocity along each axis. */
export function installDamageLaunch(target: Fighter, knockback: number, directionX: number, directionZ: number, wasGrounded: boolean): void {
  const { launch, motion } = target;
  launch.damageLevel = damageLevelForKnockback(knockback);
  const speed = f32(knockback * KNOCKBACK_LAUNCH_SCALE);
  const launchX = f32(speed * directionX);
  let launchZ = f32(speed * directionZ);
  motion.grounded = wasGrounded && launch.damageLevel < 3 && directionZ <= 0;
  if (motion.grounded) {
    launchZ = 0.0;
  } else if (wasGrounded && launch.damageLevel === 3 && directionZ < 0) {
    // The floor normal is vertical on the current flat stage surfaces.
    if (atan2(-directionZ, Math.abs(directionX)) > GROUND_LAUNCH_BOUNCE_ANGLE) launchZ = -f32(launchZ * GROUND_LAUNCH_REBOUND);
  }
  launch.groundKnockbackX = motion.grounded ? launchX : 0.0;
  if (launch.knockbackAge !== undefined && launch.knockbackAge >= KNOCKBACK_STACKING_FRAMES) {
    launch.knockbackX = mergeLaunchAxis(launch.knockbackX, launchX);
    launch.knockbackZ = mergeLaunchAxis(launch.knockbackZ, launchZ);
  } else {
    launch.knockbackX = launchX;
    launch.knockbackZ = launchZ;
  }
  launch.knockbackAge = 0;
  launch.diLaunchSpeed = speed;
}

/** Advances the launch age through KNOCKBACK_STACKING_FRAMES, past which ages are equivalent. */
export function ageKnockback(f: Fighter): void {
  const age = f.launch.knockbackAge;
  if (age !== undefined) f.launch.knockbackAge = min(KNOCKBACK_STACKING_FRAMES, age + 1);
}

/** Ground launch slides against traction; air launch decays along its angle until the retail cutoff. */
export function decayKnockback(f: Fighter): void {
  const { launch } = f;
  if (f.motion.grounded) {
    if (launch.groundKnockbackX === 0) launch.groundKnockbackX = launch.knockbackX;
    const friction = roundMeleeWorldValue(f32(f.tuning.physics.traction * GROUND_KNOCKBACK_FRICTION_MULTIPLIER));
    const sliding = launch.groundKnockbackX;
    launch.groundKnockbackX = roundMeleeWorldValue(sliding > 0 ? max(0.0, f32(sliding - friction)) : min(0.0, f32(sliding + friction)));
    launch.knockbackX = launch.groundKnockbackX;
    launch.knockbackZ = 0.0;
    return;
  }
  launch.groundKnockbackX = 0.0;
  const decayed = decayedAirMotion(
    retainedOriginal(launch.meleeKnockbackX, launch.knockbackX),
    retainedOriginal(launch.meleeKnockbackZ, launch.knockbackZ),
    AIR_KNOCKBACK_DECAY, AIR_KNOCKBACK_SQUARED_CUTOFF,
  );
  setMeleeKnockback(f, decayed.x, decayed.z);
}

export interface DirectionalInfluence {
  velocityX: number;
  velocityZ: number;
  angleRadians: number;
}

// Preallocated: rollback replays apply DI when replayed hitlag ends.
const influence: DirectionalInfluence = { velocityX: 0.0, velocityZ: 0.0, angleRadians: 0.0 };

/**
 * A launch rotated by DI. Launch components are in Melee units; stick
 * components are normalized. The signed squared cross product gives the
 * rotation fraction; rounding and fused angle reconstruction are checked
 * against smashcraft:docs/smash-melee-reference/retail-di-vector.json.
 * The result is valid until the next call.
 */
export function directionalInfluenceVector(x: number, z: number, stickX: number, stickZ: number): Readonly<DirectionalInfluence> {
  const horizontal = roundToFloat32(x);
  const vertical = roundToFloat32(z);
  const inputX = roundToFloat32(stickX);
  const inputZ = roundToFloat32(stickZ);
  const square = fusedMultiplyAddFloat32(horizontal, horizontal, multiplyFloat32(vertical, vertical));
  if (square < 0.000009999999747378752 || (inputX === 0 && inputZ === 0)) {
    influence.velocityX = horizontal;
    influence.velocityZ = vertical;
    influence.angleRadians = 0.0;
    return influence;
  }
  const speed = roundToFloat32(squareRoot(square));
  const cross = -fusedMultiplyAddFloat32(vertical, inputX, -multiplyFloat32(horizontal, inputZ));
  const fraction = divideFloat32(multiplyFloat32(cross, cross), square);
  const degrees = f32(multiplyFloat32(fraction, 18.0) * (cross < 0 ? -1 : 1));
  const angle = fusedMultiplyAddFloat32(degrees, 0.01745329238474369, meleeAtan2(vertical, horizontal));
  influence.velocityX = multiplyFloat32(speed, meleeCos(angle));
  influence.velocityZ = multiplyFloat32(speed, meleeSin(angle));
  influence.angleRadians = multiplyFloat32(degrees, 0.01745329238474369);
  return influence;
}

const sign = (value: number) => (value === 0 ? 0 : value > 0 ? 1 : -1);

/** Rotates a pending airborne launch by the stick; ground knockback follows the floor tangent instead. */
export function applyDirectionalInfluence(target: Fighter, input: Readonly<Controls>): void {
  const { launch } = target;
  if (!launch.diPending) return;
  launch.diPending = false;
  launch.diLaunchSpeed = 0.0;
  if (target.motion.grounded) return;
  const dx = sign(input.direction);
  const dz = sign(input.verticalDirection);
  const inputScale = dx !== 0 && dz !== 0 ? DIAGONAL_UNIT : 1.0;
  const inputX = input.diStickValid ? input.diStickX : f32(dx * inputScale);
  const inputZ = input.diStickValid ? input.diStickZ : f32(dz * inputScale);
  const result = directionalInfluenceVector(
    retainedOriginal(launch.meleeKnockbackX, launch.knockbackX),
    retainedOriginal(launch.meleeKnockbackZ, launch.knockbackZ),
    inputX,
    inputZ,
  );
  setMeleeKnockback(target, result.velocityX, result.velocityZ);
  if (result.angleRadians !== 0) {
    launch.diAngleDegrees = f32(result.angleRadians * RADIANS_TO_DEGREES);
    launch.diSerial++;
  }
}
