


import { max, min, toInt } from "../../runtime/numbers";
import { addFloat32, divideFloat32, fusedMultiplyAddFloat32, multiplyFloat32, roundToFloat32, subtractFloat32 } from "wisp/src/sim/binary32";
import { ParryBuffer, ShieldBreak } from "./codes";
import { type Fighter, SHIELD_MAX, SHIELD_POWERSHIELD_INPUT_WINDOW_FRAMES } from "./fighter";
import { integerHitPower } from "./knockback";
import { shieldCenterX, shieldCenterZ } from "./shieldTilt";
import { AIR_RECOIL_DECAY, AIR_RECOIL_SQUARED_CUTOFF, decayedAirMotion, retainedOriginal, setMeleeRecoil } from "./motion";
import type { Controls } from "./roster";
import { floorTraction } from "./stage";
import { WORLD_UNITS_PER_MELEE_UNIT } from "./tuning";
import { squareRoot } from "./warcraftMath";

export const SHIELD_REFLECTOR_ACTIVE_FRAMES = 2;
export const SHIELD_PERFECT_ACTIVE_FRAMES = 4;
export const SHIELD_PERFECT_POST_CONTACT_FRAMES = 4;

export const SHIELD_RED_PARRY_FRAMES = 2;
export const SHIELD_PROJECTILE_DAMAGE_MULTIPLIER = 0.5;
export const SHIELD_PROJECTILE_SPEED_MULTIPLIER = 0.699999988079071;
export const SHIELD_BREAK_RESTORED_ENERGY = 30.0;
export const SHIELD_MIN_HOLD_FRAMES = 8;
// Ultimate's 11 rather than Melee's 15 (owner decision, #100).
export const SHIELD_RELEASE_LAG_FRAMES = 11;
export const SHIELD_HIT_WEIGHT_MULTIPLIER = 0.25;
const SHIELD_BREAK_BASE_PERCENT = 400.0;
const SHIELD_BREAK_MIN_FRAMES = 90.0;
const SHIELD_DRAIN_BASE = 0.14000000059604645;
const SHIELD_TRIGGER_THRESHOLD = 0.30000001192092896;
const SHIELD_REGEN_PER_FRAME = 0.07000000029802322;
const SHIELD_DAMAGE_SCALE = 1.0;
const SHIELD_DAMAGE_BASE = 0.0;
const SHIELD_STUN_MULTIPLIER = 1.5;

export const AERIAL_SHIELD_STUN_MULTIPLIER = 2.0;
const SHIELD_STUN_BASE = 2.0;
const SHIELD_PUSHBACK_BASE = 0.20000000298023224;
const SHIELD_PUSHBACK_CAP = 2.0;
const SHIELD_PUSHBACK_MULTIPLIER = 0.6000000238418579;
const SHIELD_RECOIL_DAMAGE_FACTOR = 0.07000000029802322;
const SHIELD_RECOIL_BASE = 0.019999999552965164;
const SHIELD_RECOIL_GROUND_FRICTION_MULTIPLIER = 1.100000023841858;


export function analogShieldActive(pressure: number): boolean {
  return divideFloat32(pressure, 255.0) >= SHIELD_TRIGGER_THRESHOLD;
}


export function analogShieldStrength(pressure: number): number {


  if (!analogShieldActive(pressure)) return 0.0;
  const normalized = divideFloat32(pressure, 255.0);
  return max(0.0, divideFloat32(subtractFloat32(normalized, SHIELD_TRIGGER_THRESHOLD), subtractFloat32(1.0, SHIELD_TRIGGER_THRESHOLD)));
}

function shieldInterpolation(strength: number, light: number, digital: number): number {
  return fusedMultiplyAddFloat32(strength, subtractFloat32(digital, light), light);
}

export function shieldDrain(strength: number): number {
  return multiplyFloat32(SHIELD_DRAIN_BASE, shieldInterpolation(strength, 0.10000000149011612, 2.0));
}

export function shieldstunDuration(damage: number, strength: number, multiplier = SHIELD_STUN_MULTIPLIER): number {
  const factor = subtractFloat32(1.0, shieldInterpolation(strength, 0.05000000074505806, 0.699999988079071));
  const scaledPower = multiplyFloat32(integerHitPower(damage), factor);
  return fusedMultiplyAddFloat32(scaledPower, multiplier, SHIELD_STUN_BASE);
}

export function digitalShieldstunDuration(damage: number): number {
  return shieldstunDuration(damage, 1.0);
}


export function shieldstunFrames(hitDamage: number, strength: number, aerial = false): number {
  const duration = shieldstunDuration(hitDamage, strength, aerial ? AERIAL_SHIELD_STUN_MULTIPLIER : SHIELD_STUN_MULTIPLIER);
  return toInt(divideFloat32(multiplyFloat32(duration, 200.0), 201.0));
}

export function digitalShieldstunFrames(hitDamage: number, aerial = false): number {
  return shieldstunFrames(hitDamage, 1.0, aerial);
}


export function shieldContactPushback(damage: number, strength: number, perfect: boolean): number {
  return multiplyFloat32(shieldContactPushbackMelee(damage, strength, perfect), WORLD_UNITS_PER_MELEE_UNIT);
}


export function shieldContactPushbackMelee(damage: number, strength: number, perfect: boolean): number {
  const speed = multiplyFloat32(shieldstunDuration(damage, strength), SHIELD_PUSHBACK_BASE);
  return min(SHIELD_PUSHBACK_CAP, perfect ? speed : multiplyFloat32(speed, SHIELD_PUSHBACK_MULTIPLIER));
}

export function shieldPushback(damage: number, strength: number): number {
  return shieldContactPushback(damage, strength, false);
}

export function digitalShieldPushback(damage: number): number {
  return shieldPushback(damage, 1.0);
}


export function digitalShieldRecoil(damage: number): number {
  return multiplyFloat32(addFloat32(multiplyFloat32(integerHitPower(damage), SHIELD_RECOIL_DAMAGE_FACTOR), SHIELD_RECOIL_BASE), WORLD_UNITS_PER_MELEE_UNIT);
}

export function shieldContactDamage(damage: number, strength: number): number {
  const factor = subtractFloat32(1.0, shieldInterpolation(strength, 0.10000000149011612, 0.30000001192092896));
  return fusedMultiplyAddFloat32(multiplyFloat32(damage, factor), SHIELD_DAMAGE_SCALE, SHIELD_DAMAGE_BASE);
}

export function digitalShieldDamage(damage: number): number {
  return shieldContactDamage(damage, 1.0);
}


export function shieldSizeMultiplier(health: number, strength: number): number {
  const healthRatio = divideFloat32(health, SHIELD_MAX);
  const pressureScale = shieldInterpolation(strength, 1.0, 0.5);
  return fusedMultiplyAddFloat32(subtractFloat32(1.0, 0.15000000596046448), multiplyFloat32(healthRatio, pressureScale), 0.15000000596046448);
}

export function shieldBreakDizzyFrames(percent: number): number {
  return addFloat32(max(0.0, subtractFloat32(SHIELD_BREAK_BASE_PERCENT, percent)), SHIELD_BREAK_MIN_FRAMES);
}


export function clearPowershield(f: Fighter): void {
  const { shield } = f;
  shield.reflectFrames = 0;
  shield.perfectFrames = 0;
  shield.perfectActionFrames = 0;
  shield.redParryTried = false;
  shield.parryBuffer = ParryBuffer.none;
  shield.parryBufferDirection = 0;
}






export function grantParry(f: Fighter): void {
  const { shield } = f;
  shield.reflectFrames = 0;
  shield.perfectFrames = 0;
  shield.stun = 0;
  shield.redParryTried = false;
  shield.perfectActionFrames = SHIELD_PERFECT_POST_CONTACT_FRAMES;
  shield.heldFrames = SHIELD_MIN_HOLD_FRAMES;
}


export function bufferParryOption(f: Fighter, input: Readonly<Controls>): void {
  const { shield } = f;
  if (input.jumpPressed) {
    shield.parryBuffer = ParryBuffer.jump;
    shield.parryBufferDirection = 0;
  } else if (input.groundDodgePressed) {
    shield.parryBuffer = ParryBuffer.groundDodge;
    shield.parryBufferDirection = input.groundDodgeDirection;
  }
}

export function clearShieldBreak(f: Fighter): void {
  f.shield.breakState = ShieldBreak.none;
  f.shield.breakFrame = 0;
  f.shield.breakRemaining = 0.0;
}


export function decayShieldMotion(f: Fighter, friction = 1.0): void {
  const { shield } = f;
  if (f.motion.grounded) {
    const defenderDecay = divideFloat32(floorTraction(f.tuning.physics.traction, friction), WORLD_UNITS_PER_MELEE_UNIT);
    const defenderSpeed = divideFloat32(shield.pushbackX, WORLD_UNITS_PER_MELEE_UNIT);
    const pushback = defenderSpeed > 0 ? max(0.0, subtractFloat32(defenderSpeed, defenderDecay)) : min(0.0, addFloat32(defenderSpeed, defenderDecay));
    shield.pushbackX = multiplyFloat32(pushback, WORLD_UNITS_PER_MELEE_UNIT);

    const attackerDecay = multiplyFloat32(defenderDecay, SHIELD_RECOIL_GROUND_FRICTION_MULTIPLIER);
    const attackerSpeed = retainedOriginal(shield.meleeRecoilX, shield.recoilX);
    const recoil = attackerSpeed > 0 ? max(0.0, subtractFloat32(attackerSpeed, attackerDecay)) : min(0.0, addFloat32(attackerSpeed, attackerDecay));
    setMeleeRecoil(f, recoil, 0.0);
    return;
  }
  shield.pushbackX = 0.0;
  if (shield.recoilX === 0 && shield.recoilZ === 0) return;
  const decayed = decayedAirMotion(
    retainedOriginal(shield.meleeRecoilX, shield.recoilX),
    retainedOriginal(shield.meleeRecoilZ, shield.recoilZ),
    AIR_RECOIL_DECAY, AIR_RECOIL_SQUARED_CUTOFF,
  );
  if (decayed.belowCutoff) {

    setMeleeRecoil(f, 0.0, retainedOriginal(shield.meleeRecoilZ, shield.recoilZ));
    f.launch.knockbackZ = 0.0;
  } else {
    setMeleeRecoil(f, decayed.x, decayed.z);
  }
}


export function shieldDrainShouldResume(f: Fighter, forcedShield: boolean): boolean {
  if (forcedShield) return false;
  if (f.shield.drainResumePending) {
    f.shield.drainResumePending = false;
    return false;
  }
  return true;
}

export function advanceShieldInputClocks(f: Fighter, input: Readonly<Controls>): void {
  const { shield } = f;
  if (shield.reflectFrames > 0) shield.reflectFrames--;
  if (shield.perfectFrames > 0) shield.perfectFrames--;
  if (input.shieldTriggerActive) {
    shield.triggerAge = shield.triggerWasActive ? min(SHIELD_POWERSHIELD_INPUT_WINDOW_FRAMES, shield.triggerAge + 1) : 0;
  } else {
    shield.triggerAge = SHIELD_POWERSHIELD_INPUT_WINDOW_FRAMES;
  }
  shield.triggerWasActive = input.shieldTriggerActive;
}


export function regenerateShield(f: Fighter): void {
  const { shield } = f;
  if (!f.status.out && !shield.raised && shield.energy < SHIELD_MAX) {
    shield.energy = min(SHIELD_MAX, addFloat32(shield.energy, SHIELD_REGEN_PER_FRAME));
  }
}

// Native real operations truncate operands; binary32 helpers must receive operands before arithmetic.




export function capsuleCircleIntersects(
  oldX: number, oldZ: number, newX: number, newZ: number, capsuleRadius: number,
  centerX: number, centerZ: number, circleRadius: number, circleScale: number,
): boolean {
  const deltaX = subtractFloat32(oldX, newX);
  const deltaZ = subtractFloat32(oldZ, newZ);
  const lengthSquared = addFloat32(multiplyFloat32(deltaX, deltaX), multiplyFloat32(deltaZ, deltaZ));
  const endOffsetX = subtractFloat32(newX, centerX);
  const endOffsetZ = subtractFloat32(newZ, centerZ);
  const numerator = -fusedMultiplyAddFloat32(endOffsetX, deltaX, multiplyFloat32(endOffsetZ, deltaZ));
  const projection = lengthSquared < 0.000009999999747378752 ? 0.0 : max(0.0, min(1.0, divideFloat32(numerator, lengthSquared)));
  const closestX = fusedMultiplyAddFloat32(projection, deltaX, newX);
  const closestZ = fusedMultiplyAddFloat32(projection, deltaZ, newZ);
  const offsetX = subtractFloat32(centerX, closestX);
  const offsetZ = subtractFloat32(centerZ, closestZ);
  const distance = roundToFloat32(squareRoot(fusedMultiplyAddFloat32(offsetX, offsetX, multiplyFloat32(offsetZ, offsetZ))));
  if (distance < 0.000009999999747378752) return true;
  const inverseScale = divideFloat32(1.0, circleScale);
  const inverseTranslateX = multiplyFloat32(-centerX, inverseScale);
  const inverseTranslateZ = multiplyFloat32(-centerZ, inverseScale);
  const localCenterX = addFloat32(multiplyFloat32(centerX, inverseScale), inverseTranslateX);
  const localCenterZ = addFloat32(multiplyFloat32(centerZ, inverseScale), inverseTranslateZ);
  const localClosestX = addFloat32(multiplyFloat32(closestX, inverseScale), inverseTranslateX);
  const localClosestZ = addFloat32(multiplyFloat32(closestZ, inverseScale), inverseTranslateZ);
  const localOffsetX = subtractFloat32(localCenterX, localClosestX);
  const localOffsetZ = subtractFloat32(localCenterZ, localClosestZ);
  const localDistance = roundToFloat32(squareRoot(fusedMultiplyAddFloat32(localOffsetX, localOffsetX, multiplyFloat32(localOffsetZ, localOffsetZ))));
  // Radius conversion retains rounding even for an identity joint transform.
  const convertedRadius = divideFloat32(multiplyFloat32(circleRadius, distance), localDistance);
  return distance <= addFloat32(capsuleRadius, convertedRadius);
}



export function shieldCircleIntersects(target: Fighter, oldX: number, oldZ: number, newX: number, newZ: number, radiusFactor: number, projectileRadius = 0.0): boolean {
  const geometry = target.tuning.shield;
  const centerX = shieldCenterX(target);
  const centerZ = shieldCenterZ(target);
  const radius = multiplyFloat32(geometry.radius, radiusFactor);
  const scale = shieldSizeMultiplier(target.shield.energy, target.shield.strength);
  return capsuleCircleIntersects(oldX, oldZ, newX, newZ, projectileRadius, centerX, centerZ, radius, scale);
}
