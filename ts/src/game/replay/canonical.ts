import { imod } from "../../sim/intMath";
import { PARTICIPANT_CAPACITY, participantActive } from "../input/participants";
import { PROJECTILE_CAPACITY, type Fighter } from "../sim/fighter";
import { SPECIAL_ACTION_CAPACITY } from "../sim/codes";
import { attackBufferCanonicalState } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { fighterAt } from "../sim/roster";
import type { ReplaySnapshot } from "./snapshot";

function requiredAt<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) throw new Error(`replay state is missing slot ${index}`);
  return value;
}

const REPLAY_CHECKSUM_MODULUS = 1_000_003;

/** Exact finite binary representation used by Wurst ReplayState's canonical tape. */
export function canonicalReal(value: number): string {
  if (value !== value) return "nan";
  const negative = value < 0;
  if (!negative && !(value > 0)) return "0";
  let magnitude = negative ? -value : value;
  if (magnitude * 2 === magnitude) return negative ? "-inf" : "+inf";
  let exponent = 0;
  while (magnitude >= 2) {
    magnitude /= 2;
    exponent++;
  }
  while (magnitude < 1) {
    magnitude *= 2;
    exponent--;
  }
  let fraction = magnitude - 1;
  let high = 0;
  for (let i = 0; i < 26; i++) {
    fraction *= 2;
    high *= 2;
    if (fraction >= 1) {
      high++;
      fraction--;
    }
  }
  let low = 0;
  for (let i = 0; i < 26; i++) {
    fraction *= 2;
    low *= 2;
    if (fraction >= 1) {
      low++;
      fraction--;
    }
  }
  return `${negative ? "-" : "+"}${exponent}:${high}:${low}`;
}

/** Two polynomial lanes over canonical printable ASCII, matching Wurst and Lua32. */
export function canonicalChecksum(text: string): string {
  let first = 0;
  let second = 0;
  for (let index = 0; index < text.length; index++) {
    const byte = text.charCodeAt(index);
    if (byte < 32 || byte > 126) return "invalid-ascii";
    first = imod(first * 257 + byte + 1, REPLAY_CHECKSUM_MODULUS);
    second = imod(second * 263 + byte + 1, REPLAY_CHECKSUM_MODULUS);
  }
  return `${first}:${second}`;
}

export function canonicalInt(name: string, value: number): string {
  return `|${name}=${value}`;
}

export function canonicalBoolean(name: string, value: boolean): string {
  return `|${name}=${value ? 1 : 0}`;
}

export function canonicalRealField(name: string, value: number): string {
  return `|${name}=${canonicalReal(value)}`;
}

/** Serialize every fighter field in the same order and with the same labels as Wurst ReplayState. */
export function canonicalFighterState(prefix: string, fighter: Readonly<Fighter>, participantMask: number): string {
  let text = "";
  const int = (name: string, value: number) => { text += canonicalInt(`${prefix}.${name}`, value); };
  const bool = (name: string, value: boolean) => { text += canonicalBoolean(`${prefix}.${name}`, value); };
  const real = (name: string, value: number) => { text += canonicalRealField(`${prefix}.${name}`, value); };
  const reference = (name: string, slot: number | undefined) => {
    int(name, slot === undefined ? -1 : participantActive(participantMask, slot) ? slot : -2);
  };
  const t = fighter.tuning;
  const m = fighter.motion;
  const g = fighter.ground;
  const j = fighter.jump;
  const l = fighter.launch;
  const s = fighter.shield;
  const a = fighter.attack;
  const sp = fighter.special;
  const v = fighter.visuals;
  const sr = fighter.surfaceRecovery;
  const gr = fighter.grab;
  const ledge = fighter.ledge;
  const st = fighter.status;

  int("ceilingTechImpulseFrame", t.tech.ceilingImpulseFrame);
  int("ceilingTechAnimationEndFrame", t.tech.ceilingAnimationEndFrame);
  int("wallTechAnimationEndFrame", t.tech.wallAnimationEndFrame);
  int("wallJumpTechAnimationEndFrame", t.tech.wallJumpAnimationEndFrame);
  int("dashGrabWindow", g.dashGrabWindow);
  int("groundAction", g.action);
  int("groundActionFrame", g.actionFrame);
  int("groundRunBrakeFramesRemaining", g.runBrakeFramesRemaining);
  int("groundTurnRunEntryFacing", g.turnRunEntryFacing);
  int("groundRules.dashRunEnableFrame", t.ground.dashRunEnableFrame);
  int("groundRules.turnRunFacingCommandFrame", t.ground.turnRunFacingCommandFrame);
  int("groundRules.turnRunAnimationEndFrame", t.ground.turnRunAnimationEndFrame);
  int("groundRules.runBrakeTurnCommandEndFrame", t.ground.runBrakeTurnCommandEndFrame);
  int("groundRules.runBrakeAnimationEndFrame", t.ground.runBrakeAnimationEndFrame);
  int("groundRules.runBrakeMaximumFrames", t.ground.runBrakeMaximumFrames);
  int("dashGrabTiming.startupFrames", t.dashGrab.startupFrames);
  int("dashGrabTiming.activeFrames", t.dashGrab.activeFrames);
  int("dashGrabTiming.totalFrames", t.dashGrab.totalFrames);
  bool("dashGrabAttack", a.dashGrab);
  bool("groundTurnRunFacingCommandLatched", g.turnRunFacingCommandLatched);
  bool("groundTurnRunPausePending", g.turnRunPausePending);
  int("character", fighter.character);

  real("physics.weight", t.physics.weight);
  real("physics.gravity", t.physics.gravity);
  real("physics.terminalSpeed", t.physics.terminalSpeed);
  real("physics.fastFallSpeed", t.physics.fastFallSpeed);
  real("physics.airAcceleration", t.physics.airAcceleration);
  real("physics.airSpeed", t.physics.airSpeed);
  real("physics.airFriction", t.physics.airFriction);
  real("physics.airCap", t.physics.airCap);
  real("physics.traction", t.physics.traction);
  real("physics.dashSpeed", t.physics.dashSpeed);
  real("physics.runSpeed", t.physics.runSpeed);
  real("physics.walkSpeed", t.physics.walkSpeed);
  int("physics.jumpSquatFrames", t.physics.jumpSquatFrames);
  real("physics.fullJumpSpeed", t.physics.fullJumpSpeed);
  real("physics.shortJumpSpeed", t.physics.shortJumpSpeed);
  real("physics.aerialJumpSpeed", t.physics.aerialJumpSpeed);
  real("physics.jumpMomentum", t.physics.jumpMomentum);
  real("physics.jumpHorizontalSpeed", t.physics.jumpHorizontalSpeed);
  real("physics.jumpHorizontalCap", t.physics.jumpHorizontalCap);
  real("physics.aerialJumpHorizontalSpeed", t.physics.aerialJumpHorizontalSpeed);
  real("physics.shieldBreakSpeed", t.physics.shieldBreakSpeed);
  int("facing", fighter.facing);
  int("lastAerialTapDirection", m.lastAerialTapDirection);
  int("dashFrame", g.dashFrame);
  int("dashDirection", g.dashDirection);
  real("x", m.x);
  real("z", m.z);
  real("vx", m.vx);
  real("vz", m.vz);
  real("motionX.original", m.meleeX.original);
  real("motionX.published", m.meleeX.published);
  real("motionZ.original", m.meleeZ.original);
  real("motionZ.published", m.meleeZ.published);
  real("motionVelocityZ.original", m.meleeVelocityZ.original);
  real("motionVelocityZ.published", m.meleeVelocityZ.published);
  real("knockbackX", l.knockbackX);
  real("knockbackZ", l.knockbackZ);
  real("damage", st.damage);
  int("stocks", st.stocks);
  int("hitstun", l.hitstun);
  int("hitlag", l.hitlag);
  bool("diPending", l.diPending);
  real("diLaunchSpeed", l.diLaunchSpeed);
  int("diSerial", l.diSerial);
  real("diAngleDegrees", l.diAngleDegrees);
  bool("sdiWasGrounded", l.sdiWasGrounded);
  bool("sdiLaunchesUpward", l.sdiLaunchesUpward);
  int("sdiSerial", l.sdiSerial);
  int("asdiSerial", l.asdiSerial);
  int("cooldown", a.cooldown);
  int("attackStyle", a.style ?? -1);
  int("attackFrame", a.frame);
  int("attackDuration", a.duration);
  int("attackSerial", a.serial);
  bool("attackHit", a.hit);
  for (let i = 0; i < PARTICIPANT_CAPACITY; i++) reference(`hitAttackers[${i}]`, requiredAt(fighter.hits.entries, i).attacker);
  for (let i = 0; i < PARTICIPANT_CAPACITY; i++) int(`hitSerials[${i}]`, requiredAt(fighter.hits.entries, i).attackSerial);
  for (let i = 0; i < PARTICIPANT_CAPACITY; i++) int(`hitWindows[${i}]`, requiredAt(fighter.hits.entries, i).window);
  for (let i = 0; i < PARTICIPANT_CAPACITY; i++) reference(`specialHitTargets[${i}]`, sp.hitTargets[i]);
  reference("lastHitAttacker", fighter.hits.lastAttacker);
  int("lastHitAttackSerial", fighter.hits.lastAttackSerial ?? -1);
  int("lastHitWindow", fighter.hits.lastWindow);
  bool("smashCharging", a.smashCharging);
  int("smashChargeFrames", a.smashChargeFrames);
  bool("smashChargeAllowed", a.smashChargeAllowed);
  for (let i = 0; i < PROJECTILE_CAPACITY; i++) int(`projectileLife[${i}]`, requiredAt(fighter.projectiles, i).life);
  for (let i = 0; i < PROJECTILE_CAPACITY; i++) real(`projectileX[${i}]`, requiredAt(fighter.projectiles, i).x);
  for (let i = 0; i < PROJECTILE_CAPACITY; i++) real(`projectileZ[${i}]`, requiredAt(fighter.projectiles, i).z);
  for (let i = 0; i < PROJECTILE_CAPACITY; i++) int(`projectileDirection[${i}]`, requiredAt(fighter.projectiles, i).direction);
  for (let i = 0; i < PROJECTILE_CAPACITY; i++) int(`projectileKind[${i}]`, requiredAt(fighter.projectiles, i).kind);
  for (let i = 0; i < PROJECTILE_CAPACITY; i++) real(`projectileDamageMultiplier[${i}]`, requiredAt(fighter.projectiles, i).damageMultiplier);
  for (let i = 0; i < PROJECTILE_CAPACITY; i++) int(`projectileVisualFamily[${i}]`, requiredAt(fighter.projectiles, i).visualFamily);
  for (let i = 0; i < PROJECTILE_CAPACITY; i++) bool(`projectileNewlyReflected[${i}]`, requiredAt(fighter.projectiles, i).newlyReflected);
  for (let i = 0; i < PROJECTILE_CAPACITY; i++) real(`projectileVelocityX[${i}]`, requiredAt(fighter.projectiles, i).velocityX);
  for (let i = 0; i < PROJECTILE_CAPACITY; i++) real(`projectileVelocityZ[${i}]`, requiredAt(fighter.projectiles, i).velocityZ);
  for (let i = 0; i < PROJECTILE_CAPACITY; i++) int(`projectileSerial[${i}]`, requiredAt(fighter.projectiles, i).serial);
  int("parrySerial", v.parry);
  int("specialAction", sp.action);
  int("specialFrame", sp.frame);
  int("specialDuration", sp.duration);
  int("specialLockFrames", sp.lockFrames);
  bool("specialFall", sp.fall);
  for (let i = 0; i < SPECIAL_ACTION_CAPACITY; i++) int(`specialCooldowns[${i}]`, requiredAt(sp.cooldowns, i));
  int("specialDirection", sp.direction);
  bool("specialHit", sp.hit);
  int("bearLife", fighter.bear.life);
  real("bearX", fighter.bear.x);
  real("bearZ", fighter.bear.z);
  real("bearVelocityX", fighter.bear.velocityX);
  real("bearVelocityZ", fighter.bear.velocityZ);
  int("bearSwipeCooldown", fighter.bear.swipeCooldown);
  int("bearHitSerial", fighter.bear.hitSerial);
  int("bearSurface", fighter.bear.surface ?? -1);
  int("hippogryphLife", fighter.hippogryph.life);
  real("hippogryphX", fighter.hippogryph.x);
  real("hippogryphZ", fighter.hippogryph.z);
  real("hippogryphVelocityX", fighter.hippogryph.velocityX);
  real("hippogryphVelocityZ", fighter.hippogryph.velocityZ);
  int("hippogryphKind", fighter.hippogryph.kind);
  int("freezeTrapLife", fighter.freezeTrap.life);
  int("freezeTrapArming", fighter.freezeTrap.arming);
  real("freezeTrapX", fighter.freezeTrap.x);
  real("freezeTrapZ", fighter.freezeTrap.z);
  int("freezeTrapSurface", fighter.freezeTrap.surface ?? -1);
  int("freezeTrapSerial", fighter.freezeTrap.serial);
  int("frozenFrames", st.frozenFrames);
  int("freezeTrapCooldown", fighter.freezeTrap.cooldown);
  bool("out", st.out);
  int("respawn", st.respawn);
  bool("shield", s.raised);
  real("shieldEnergy", s.energy);
  int("shieldStun", s.stun);
  int("shieldHeldFrames", s.heldFrames);
  int("shieldReleaseLag", s.releaseLag);
  int("shieldBreakState", s.breakState);
  int("shieldBreakFrame", s.breakFrame);
  int("shieldBreakSerial", s.breakSerial);
  real("shieldBreakRemaining", s.breakRemaining);
  bool("grounded", m.grounded);
  bool("crouching", m.crouching);
  bool("fastFalling", m.fastFalling);
  int("jumps", j.remaining);
  int("jumpSerial", j.serial);
  bool("jumpIsDouble", j.isDouble);
  int("jumpSquat", j.squat);
  bool("jumpDodgeQueued", j.dodgeQueued);
  int("jumpDodgeX", j.dodgeX);
  int("jumpDodgeZ", j.dodgeZ);
  bool("jumpHeld", j.held);
  int("dropTime", m.dropTime);
  int("invincible", st.invincible);
  int("surface", m.surface ?? -1);
  int("airDodgeTime", fighter.dodge.airMotionFrames);
  int("landingLag", fighter.landing.lag);
  int("lCancelWindow", fighter.landing.lCancelWindow);
  int("lCancelSerial", fighter.landing.lCancelSerial);
  bool("airDodging", fighter.dodge.airDodging);
  int("airDodgeFrame", fighter.dodge.airFrame);
  int("groundDodgeFrame", fighter.dodge.groundFrame);
  int("groundDodgeDirection", fighter.dodge.groundDirection);
  int("groundDodgeEntryFacing", fighter.dodge.groundEntryFacing);
  int("downState", fighter.down.state);
  int("downFrame", fighter.down.frame);
  int("downDirection", fighter.down.direction);
  int("downWaitRemaining", fighter.down.waitRemaining);
  bool("downFaceUp", fighter.down.faceUp);
  int("techWindow", fighter.tech.window);
  int("techPressAge", fighter.tech.pressAge);
  int("techPreviousPressAge", fighter.tech.previousPressAge);
  bool("techAccumulatedPress", fighter.tech.accumulatedPress);
  int("grabbedFrames", gr.grabbedFrames);
  int("grabAction", gr.action);
  int("grabFrame", gr.frame);
  int("grabSerial", gr.serial);
  int("grabMashX", gr.mashX);
  int("grabMashZ", gr.mashZ);
  reference("grabOwner", gr.owner);
  reference("grabTarget", gr.target);
  int("ledgeState", ledge.state);
  int("ledgeSide", ledge.side);
  int("ledgeFrame", ledge.frame);
  int("ledgeSerial", ledge.serial);
  int("ledgeIntangible", ledge.intangible);
  int("ledgeRegrab", ledge.regrab);

  real("physics.walkAccelerationMultiplier", t.physics.walkAccelerationMultiplier);
  real("physics.walkAccelerationBase", t.physics.walkAccelerationBase);
  real("physics.groundAccelerationMultiplier", t.physics.groundAccelerationMultiplier);
  real("physics.groundAccelerationBase", t.physics.groundAccelerationBase);
  real("physics.groundSpeedCap", t.physics.groundSpeedCap);
  real("positionDeltaX", m.deltaX);
  real("positionDeltaZ", m.deltaZ);
  real("groundKnockbackX", l.groundKnockbackX);
  int("knockbackAgeFrames", l.knockbackAge ?? -1);
  int("damageLevel", l.damageLevel);
  real("shieldPushbackX", s.pushbackX);
  real("shieldRecoilX", s.recoilX);
  real("shieldRecoilZ", s.recoilZ);
  bool("shieldDrainResumePending", s.drainResumePending);
  int("grabVisualSerial", v.grab);
  int("throwVisualSerial", v.throw);
  int("hitVisualSerial", v.hit);
  bool("hitVisualElectric", v.hitElectric);
  int("shieldVisualSerial", v.shield);
  bool("fastFallDownHeld", m.fastFallDownHeld);
  int("fastFallInputAge", m.fastFallInputAge);
  int("surfaceRecoveryState", sr.state);
  int("surfaceRecoveryFrame", sr.frame);
  bool("surfaceRecoveryVelocityApplied", sr.velocityApplied);
  int("surfaceReflectCooldown", sr.reflectCooldown);
  int("lastReflectedSurface", sr.lastReflectedSurface ?? -1);
  int("surfaceContactSerial", sr.contactSerial);
  int("surfaceContactKind", sr.contactKind);
  real("surfaceContactApproachSpeed", sr.contactApproachSpeed);
  real("surfaceContactX", sr.contactX);
  real("surfaceContactZ", sr.contactZ);
  real("surfaceContactNormalX", sr.contactNormalX);
  real("surfaceContactNormalZ", sr.contactNormalZ);
  real("surfacePhysics.passiveWallSpeed", t.surface.passiveWallSpeed);
  real("surfacePhysics.wallJumpHorizontalSpeed", t.surface.wallJumpHorizontalSpeed);
  real("surfacePhysics.wallJumpVerticalSpeed", t.surface.wallJumpVerticalSpeed);
  real("surfacePhysics.passiveCeilingSpeed", t.surface.passiveCeilingSpeed);
  real("surfacePhysics.wallJumpMinimumApproach", t.surface.wallJumpMinimumApproach);
  bool("surfacePhysics.canWallJump", t.surface.canWallJump);
  return text;
}

type DifferenceValue = number | boolean | undefined;

function firstDifferentValue(fields: ReadonlyArray<readonly [string, DifferenceValue, DifferenceValue]>): string | undefined {
  for (const [name, expected, actual] of fields) if (expected !== actual) return name;
  return undefined;
}

function slotReference(value: number | undefined, mask: number): number {
  return value === undefined ? -1 : participantActive(mask, value) ? value : -2;
}

/** First differing field in Wurst ReplayState's diagnostic order. */
export function firstFighterDifference(expected: Readonly<Fighter>, actual: Readonly<Fighter>, expectedMask: number, actualMask: number): string | undefined {
  const fields: [string, DifferenceValue, DifferenceValue][] = [];
  const add = (name: string, left: DifferenceValue, right: DifferenceValue) => { fields.push([name, left, right]); };
  const e = expected;
  const a = actual;
  const et = e.tuning;
  const at = a.tuning;
  add("character", e.character, a.character);
  for (const key of ["weight", "gravity", "terminalSpeed", "fastFallSpeed", "airAcceleration", "airSpeed", "airFriction", "airCap", "traction", "dashSpeed", "runSpeed", "walkSpeed", "jumpSquatFrames", "fullJumpSpeed", "shortJumpSpeed", "aerialJumpSpeed", "jumpMomentum", "jumpHorizontalSpeed", "jumpHorizontalCap", "aerialJumpHorizontalSpeed", "shieldBreakSpeed", "walkAccelerationMultiplier", "walkAccelerationBase", "groundAccelerationMultiplier", "groundAccelerationBase", "groundSpeedCap"] as const) add("physics", et.physics[key], at.physics[key]);
  for (const key of ["passiveWallSpeed", "wallJumpHorizontalSpeed", "wallJumpVerticalSpeed", "passiveCeilingSpeed", "wallJumpMinimumApproach", "canWallJump"] as const) add("surfacePhysics", et.surface[key], at.surface[key]);
  add("ceilingTechImpulseFrame", et.tech.ceilingImpulseFrame, at.tech.ceilingImpulseFrame);
  add("ceilingTechAnimationEndFrame", et.tech.ceilingAnimationEndFrame, at.tech.ceilingAnimationEndFrame);
  add("wallTechAnimationEndFrame", et.tech.wallAnimationEndFrame, at.tech.wallAnimationEndFrame);
  add("wallJumpTechAnimationEndFrame", et.tech.wallJumpAnimationEndFrame, at.tech.wallJumpAnimationEndFrame);
  add("facing", e.facing, a.facing);
  add("lastAerialTapDirection", e.motion.lastAerialTapDirection, a.motion.lastAerialTapDirection);
  add("dashFrame", e.ground.dashFrame, a.ground.dashFrame);
  add("dashDirection", e.ground.dashDirection, a.ground.dashDirection);
  for (const key of ["dashRunEnableFrame", "turnRunFacingCommandFrame", "turnRunAnimationEndFrame", "runBrakeTurnCommandEndFrame", "runBrakeAnimationEndFrame", "runBrakeMaximumFrames"] as const) add("groundRules", et.ground[key], at.ground[key]);
  for (const key of ["startupFrames", "activeFrames", "totalFrames"] as const) add("dashGrabTiming", et.dashGrab[key], at.dashGrab[key]);
  add("dashGrabWindow", e.ground.dashGrabWindow, a.ground.dashGrabWindow);
  add("dashGrabAttack", e.attack.dashGrab, a.attack.dashGrab);
  add("groundAction", e.ground.action, a.ground.action);
  add("groundActionFrame", e.ground.actionFrame, a.ground.actionFrame);
  add("groundRunBrakeFramesRemaining", e.ground.runBrakeFramesRemaining, a.ground.runBrakeFramesRemaining);
  add("groundTurnRunEntryFacing", e.ground.turnRunEntryFacing, a.ground.turnRunEntryFacing);
  add("groundTurnRunFacingCommandLatched", e.ground.turnRunFacingCommandLatched, a.ground.turnRunFacingCommandLatched);
  add("groundTurnRunPausePending", e.ground.turnRunPausePending, a.ground.turnRunPausePending);
  add("x", e.motion.x, a.motion.x);
  add("z", e.motion.z, a.motion.z);
  add("positionDeltaX", e.motion.deltaX, a.motion.deltaX);
  add("positionDeltaZ", e.motion.deltaZ, a.motion.deltaZ);
  add("vx", e.motion.vx, a.motion.vx);
  add("vz", e.motion.vz, a.motion.vz);
  if (e.motion.meleeX.original !== a.motion.meleeX.original || e.motion.meleeX.published !== a.motion.meleeX.published) add("motionX", 1, 0);
  if (e.motion.meleeZ.original !== a.motion.meleeZ.original || e.motion.meleeZ.published !== a.motion.meleeZ.published) add("motionZ", 1, 0);
  if (e.motion.meleeVelocityZ.original !== a.motion.meleeVelocityZ.original || e.motion.meleeVelocityZ.published !== a.motion.meleeVelocityZ.published) add("motionVelocityZ", 1, 0);
  add("knockbackX", e.launch.knockbackX, a.launch.knockbackX);
  add("knockbackZ", e.launch.knockbackZ, a.launch.knockbackZ);
  add("groundKnockbackX", e.launch.groundKnockbackX, a.launch.groundKnockbackX);
  add("knockbackAgeFrames", e.launch.knockbackAge ?? -1, a.launch.knockbackAge ?? -1);
  add("damageLevel", e.launch.damageLevel, a.launch.damageLevel);
  add("shieldPushbackX", e.shield.pushbackX, a.shield.pushbackX);
  add("shieldRecoilX", e.shield.recoilX, a.shield.recoilX);
  add("shieldRecoilZ", e.shield.recoilZ, a.shield.recoilZ);
  add("shieldDrainResumePending", e.shield.drainResumePending, a.shield.drainResumePending);
  add("damage", e.status.damage, a.status.damage);
  add("grabVisualSerial", e.visuals.grab, a.visuals.grab);
  add("throwVisualSerial", e.visuals.throw, a.visuals.throw);
  add("hitVisualSerial", e.visuals.hit, a.visuals.hit);
  add("hitVisualElectric", e.visuals.hitElectric, a.visuals.hitElectric);
  add("shieldVisualSerial", e.visuals.shield, a.visuals.shield);
  add("shieldReflectVisualSerial", e.visuals.shieldReflect, a.visuals.shieldReflect);
  add("stocks", e.status.stocks, a.status.stocks);
  add("hitstun", e.launch.hitstun, a.launch.hitstun);
  add("hitlag", e.launch.hitlag, a.launch.hitlag);
  add("diPending", e.launch.diPending, a.launch.diPending);
  add("diLaunchSpeed", e.launch.diLaunchSpeed, a.launch.diLaunchSpeed);
  add("diSerial", e.launch.diSerial, a.launch.diSerial);
  add("diAngleDegrees", e.launch.diAngleDegrees, a.launch.diAngleDegrees);
  add("sdiWasGrounded", e.launch.sdiWasGrounded, a.launch.sdiWasGrounded);
  add("sdiLaunchesUpward", e.launch.sdiLaunchesUpward, a.launch.sdiLaunchesUpward);
  add("sdiSerial", e.launch.sdiSerial, a.launch.sdiSerial);
  add("asdiSerial", e.launch.asdiSerial, a.launch.asdiSerial);
  add("cooldown", e.attack.cooldown, a.attack.cooldown);
  add("attackStyle", e.attack.style, a.attack.style);
  add("attackFrame", e.attack.frame, a.attack.frame);
  add("attackDuration", e.attack.duration, a.attack.duration);
  add("attackSerial", e.attack.serial, a.attack.serial);
  add("attackHit", e.attack.hit, a.attack.hit);
  for (let i = 0; i < PARTICIPANT_CAPACITY; i++) add(`hitAttackers[${i}]`, slotReference(requiredAt(e.hits.entries, i).attacker, expectedMask), slotReference(requiredAt(a.hits.entries, i).attacker, actualMask));
  for (let i = 0; i < PARTICIPANT_CAPACITY; i++) add(`hitSerials[${i}]`, requiredAt(e.hits.entries, i).attackSerial, requiredAt(a.hits.entries, i).attackSerial);
  for (let i = 0; i < PARTICIPANT_CAPACITY; i++) add(`hitWindows[${i}]`, requiredAt(e.hits.entries, i).window, requiredAt(a.hits.entries, i).window);
  for (let i = 0; i < PARTICIPANT_CAPACITY; i++) add(`specialHitTargets[${i}]`, slotReference(e.special.hitTargets[i], expectedMask), slotReference(a.special.hitTargets[i], actualMask));
  add("lastHitAttacker", slotReference(e.hits.lastAttacker, expectedMask), slotReference(a.hits.lastAttacker, actualMask));
  add("lastHitAttackSerial", e.hits.lastAttackSerial, a.hits.lastAttackSerial);
  add("lastHitWindow", e.hits.lastWindow, a.hits.lastWindow);
  add("smashCharging", e.attack.smashCharging, a.attack.smashCharging);
  add("smashChargeFrames", e.attack.smashChargeFrames, a.attack.smashChargeFrames);
  add("smashChargeAllowed", e.attack.smashChargeAllowed, a.attack.smashChargeAllowed);
  for (const key of ["life", "x", "z", "direction", "kind", "damageMultiplier", "visualFamily", "newlyReflected", "velocityX", "velocityZ", "serial"] as const) {
    const label = `projectile${key.slice(0, 1).toUpperCase()}${key.slice(1)}`;
    for (let i = 0; i < PROJECTILE_CAPACITY; i++) add(`${label}[${i}]`, requiredAt(e.projectiles, i)[key], requiredAt(a.projectiles, i)[key]);
  }
  add("parrySerial", e.visuals.parry, a.visuals.parry);
  add("specialAction", e.special.action, a.special.action);
  add("specialFrame", e.special.frame, a.special.frame);
  add("specialDuration", e.special.duration, a.special.duration);
  add("specialLockFrames", e.special.lockFrames, a.special.lockFrames);
  add("specialFall", e.special.fall, a.special.fall);
  for (let i = 0; i < SPECIAL_ACTION_CAPACITY; i++) add(`specialCooldowns[${i}]`, requiredAt(e.special.cooldowns, i), requiredAt(a.special.cooldowns, i));
  add("specialDirection", e.special.direction, a.special.direction);
  add("specialHit", e.special.hit, a.special.hit);
  add("bearLife", e.bear.life, a.bear.life);
  add("bearX", e.bear.x, a.bear.x);
  add("bearZ", e.bear.z, a.bear.z);
  add("bearVelocityX", e.bear.velocityX, a.bear.velocityX);
  add("bearVelocityZ", e.bear.velocityZ, a.bear.velocityZ);
  add("bearSwipeCooldown", e.bear.swipeCooldown, a.bear.swipeCooldown);
  add("bearHitSerial", e.bear.hitSerial, a.bear.hitSerial);
  add("bearSurface", e.bear.surface, a.bear.surface);
  add("hippogryphLife", e.hippogryph.life, a.hippogryph.life);
  add("hippogryphX", e.hippogryph.x, a.hippogryph.x);
  add("hippogryphZ", e.hippogryph.z, a.hippogryph.z);
  add("hippogryphVelocityX", e.hippogryph.velocityX, a.hippogryph.velocityX);
  add("hippogryphVelocityZ", e.hippogryph.velocityZ, a.hippogryph.velocityZ);
  add("hippogryphKind", e.hippogryph.kind, a.hippogryph.kind);
  add("freezeTrapLife", e.freezeTrap.life, a.freezeTrap.life);
  add("freezeTrapArming", e.freezeTrap.arming, a.freezeTrap.arming);
  add("freezeTrapX", e.freezeTrap.x, a.freezeTrap.x);
  add("freezeTrapZ", e.freezeTrap.z, a.freezeTrap.z);
  add("freezeTrapSurface", e.freezeTrap.surface, a.freezeTrap.surface);
  add("freezeTrapSerial", e.freezeTrap.serial, a.freezeTrap.serial);
  add("frozenFrames", e.status.frozenFrames, a.status.frozenFrames);
  add("freezeTrapCooldown", e.freezeTrap.cooldown, a.freezeTrap.cooldown);
  add("out", e.status.out, a.status.out);
  add("respawn", e.status.respawn, a.status.respawn);
  add("shield", e.shield.raised, a.shield.raised);
  add("shieldTriggerWasActive", e.shield.triggerWasActive, a.shield.triggerWasActive);
  add("shieldTriggerAge", e.shield.triggerAge, a.shield.triggerAge);
  add("shieldReflectFrames", e.shield.reflectFrames, a.shield.reflectFrames);
  add("shieldPerfectFrames", e.shield.perfectFrames, a.shield.perfectFrames);
  add("shieldPerfectActionFrames", e.shield.perfectActionFrames, a.shield.perfectActionFrames);
  for (const key of ["centerX", "centerZ", "radius"] as const) add("shieldGeometry", et.shield[key], at.shield[key]);
  add("shieldStrength", e.shield.strength, a.shield.strength);
  add("shieldEnergy", e.shield.energy, a.shield.energy);
  add("shieldStun", e.shield.stun, a.shield.stun);
  add("shieldHeldFrames", e.shield.heldFrames, a.shield.heldFrames);
  add("shieldReleaseLag", e.shield.releaseLag, a.shield.releaseLag);
  add("shieldBreakState", e.shield.breakState, a.shield.breakState);
  add("shieldBreakFrame", e.shield.breakFrame, a.shield.breakFrame);
  add("shieldBreakSerial", e.shield.breakSerial, a.shield.breakSerial);
  add("shieldBreakDownFrames", et.shieldBreak.landFrames, at.shieldBreak.landFrames);
  add("shieldBreakStandFrames", et.shieldBreak.standFrames, at.shieldBreak.standFrames);
  add("shieldBreakRemaining", e.shield.breakRemaining, a.shield.breakRemaining);
  add("crouching", e.motion.crouching, a.motion.crouching);
  add("fastFallDownHeld", e.motion.fastFallDownHeld, a.motion.fastFallDownHeld);
  add("fastFallInputAge", e.motion.fastFallInputAge, a.motion.fastFallInputAge);
  add("previousHorizontalDirection", e.motion.previousHorizontalDirection, a.motion.previousHorizontalDirection);
  add("jumpInputAge", e.jump.inputAge, a.jump.inputAge);
  add("fastFalling", e.motion.fastFalling, a.motion.fastFalling);
  add("grounded", e.motion.grounded, a.motion.grounded);
  add("fastFalling", e.motion.fastFalling, a.motion.fastFalling);
  add("crouching", e.motion.crouching, a.motion.crouching);
  add("jumps", e.jump.remaining, a.jump.remaining);
  add("jumpSerial", e.jump.serial, a.jump.serial);
  add("jumpIsDouble", e.jump.isDouble, a.jump.isDouble);
  add("jumpSquat", e.jump.squat, a.jump.squat);
  add("jumpDodgeQueued", e.jump.dodgeQueued, a.jump.dodgeQueued);
  add("jumpDodgeX", e.jump.dodgeX, a.jump.dodgeX);
  add("jumpDodgeZ", e.jump.dodgeZ, a.jump.dodgeZ);
  add("jumpHeld", e.jump.held, a.jump.held);
  add("dropTime", e.motion.dropTime, a.motion.dropTime);
  add("invincible", e.status.invincible, a.status.invincible);
  add("surface", e.motion.surface, a.motion.surface);
  add("surfaceRecoveryState", e.surfaceRecovery.state, a.surfaceRecovery.state);
  add("surfaceRecoveryFrame", e.surfaceRecovery.frame, a.surfaceRecovery.frame);
  add("surfaceRecoveryVelocityApplied", e.surfaceRecovery.velocityApplied, a.surfaceRecovery.velocityApplied);
  add("surfaceWallJumpQueued", e.surfaceRecovery.wallJumpQueued, a.surfaceRecovery.wallJumpQueued);
  add("surfaceReflectCooldown", e.surfaceRecovery.reflectCooldown, a.surfaceRecovery.reflectCooldown);
  add("lastReflectedSurface", e.surfaceRecovery.lastReflectedSurface, a.surfaceRecovery.lastReflectedSurface);
  add("surfaceContactSerial", e.surfaceRecovery.contactSerial, a.surfaceRecovery.contactSerial);
  add("surfaceContactKind", e.surfaceRecovery.contactKind, a.surfaceRecovery.contactKind);
  add("surfaceContactApproachSpeed", e.surfaceRecovery.contactApproachSpeed, a.surfaceRecovery.contactApproachSpeed);
  add("surfaceContactX", e.surfaceRecovery.contactX, a.surfaceRecovery.contactX);
  add("surfaceContactZ", e.surfaceRecovery.contactZ, a.surfaceRecovery.contactZ);
  add("surfaceContactNormalX", e.surfaceRecovery.contactNormalX, a.surfaceRecovery.contactNormalX);
  add("surfaceContactNormalZ", e.surfaceRecovery.contactNormalZ, a.surfaceRecovery.contactNormalZ);
  add("airDodgeTime", e.dodge.airMotionFrames, a.dodge.airMotionFrames);
  add("landingLag", e.landing.lag, a.landing.lag);
  add("lCancelWindow", e.landing.lCancelWindow, a.landing.lCancelWindow);
  add("lCancelSerial", e.landing.lCancelSerial, a.landing.lCancelSerial);
  add("airDodging", e.dodge.airDodging, a.dodge.airDodging);
  add("airDodgeFrame", e.dodge.airFrame, a.dodge.airFrame);
  add("groundDodgeFrame", e.dodge.groundFrame, a.dodge.groundFrame);
  add("groundDodgeDirection", e.dodge.groundDirection, a.dodge.groundDirection);
  add("groundDodgeEntryFacing", e.dodge.groundEntryFacing, a.dodge.groundEntryFacing);
  add("downState", e.down.state, a.down.state);
  add("downFrame", e.down.frame, a.down.frame);
  add("downDirection", e.down.direction, a.down.direction);
  add("downWaitRemaining", e.down.waitRemaining, a.down.waitRemaining);
  add("downFaceUp", e.down.faceUp, a.down.faceUp);
  add("techWindow", e.tech.window, a.tech.window);
  add("techPressAge", e.tech.pressAge, a.tech.pressAge);
  add("techPreviousPressAge", e.tech.previousPressAge, a.tech.previousPressAge);
  add("techAccumulatedPress", e.tech.accumulatedPress, a.tech.accumulatedPress);
  add("grabbedFrames", e.grab.grabbedFrames, a.grab.grabbedFrames);
  add("grabAction", e.grab.action, a.grab.action);
  add("grabFrame", e.grab.frame, a.grab.frame);
  add("grabSerial", e.grab.serial, a.grab.serial);
  add("grabMashX", e.grab.mashX, a.grab.mashX);
  add("grabMashZ", e.grab.mashZ, a.grab.mashZ);
  add("grabOwner", slotReference(e.grab.owner, expectedMask), slotReference(a.grab.owner, actualMask));
  add("grabTarget", slotReference(e.grab.target, expectedMask), slotReference(a.grab.target, actualMask));
  add("ledgeState", e.ledge.state, a.ledge.state);
  add("ledgeSide", e.ledge.side, a.ledge.side);
  add("ledgeFrame", e.ledge.frame, a.ledge.frame);
  add("ledgeSerial", e.ledge.serial, a.ledge.serial);
  add("ledgeIntangible", e.ledge.intangible, a.ledge.intangible);
  add("ledgeRegrab", e.ledge.regrab, a.ledge.regrab);
  return firstDifferentValue(fields);
}

/** Replay2's full gameplay tape; labels, slot order, and fragments match Wurst ReplayState. */
export function canonicalReplayState(snapshot: Readonly<ReplaySnapshot>): string {
  const { world, match, controls, runtime } = snapshot;
  let text = "SmashcraftReplay2";
  const int = (name: string, value: number) => { text += canonicalInt(name, value); };
  const bool = (name: string, value: boolean) => { text += canonicalBoolean(name, value); };
  int("participantMask", world.mask);
  for (const slot of PARTICIPANT_SLOTS) {
    if (!participantActive(world.mask, slot)) continue;
    text += canonicalFighterState(`fighter[${slot}]`, fighterAt(world, slot), world.mask);
    const command = attackBufferCanonicalState(controls.commands[slot]);
    int(`commands[${slot}].windowFrames`, command.graceFrames);
    int(`commands[${slot}].style`, command.style);
    int(`commands[${slot}].facing`, command.facing);
    int(`commands[${slot}].targetFrame`, command.targetFrame);
    int(`commands[${slot}].consumedFacing`, command.consumedFacing);
    bool(`commands[${slot}].mayCharge`, command.mayCharge);
    bool(`commands[${slot}].consumedMayCharge`, command.consumedMayCharge);
  }
  int("match.phase", match.phase);
  int("match.stageChoice", match.stageChoice);
  int("match.winner", match.winner ?? -1);
  int("match.humanCount", match.humanCount);
  int("match.humanMask", match.humanMask);
  int("match.humanFighterMask", match.humanFighterMask);
  int("match.computerMask", match.computerMask);
  int("match.departedMask", match.departedMask);
  bool("match.interrupted", match.interrupted);
  for (const slot of PARTICIPANT_SLOTS) {
    const prefix = `match.slot${slot}`;
    int(`${prefix}.character`, match.characterChoices[slot]);
    bool(`${prefix}.ready`, match.characterReadiness[slot]);
    bool(`${prefix}.rematch`, match.rematchReadiness[slot]);
  }
  int("match.stockCount", match.stockCount);
  int("match.timeLimitMinutes", match.timeLimitMinutes);
  int("match.remainingFrames", match.remainingFrames);
  bool("match.timedOut", match.timedOut);
  bool("match.practice", match.practice);
  int("runtime.simulationFrame", runtime.simulationFrame);
  for (const slot of PARTICIPANT_SLOTS) text += canonicalRealField(`runtime.botAttackDelays[${slot}]`, runtime.botAttackDelays[slot]);
  return text;
}

export function canonicalState(snapshot: Readonly<ReplaySnapshot>): string {
  return canonicalReplayState(snapshot);
}

export function checksum(snapshot: Readonly<ReplaySnapshot>): string {
  return canonicalChecksum(canonicalReplayState(snapshot));
}
