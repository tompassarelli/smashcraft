import { placedObject } from "../sim/fighter";
// The first field that differs between two replay states, by Wurst
// ReplayState's diagnostic path and checked in its order, which is not the
// canonical tape's order.
import { attackBufferCanonicalState, sameAttackBuffer, type AttackBuffer } from "../input/attackBuffer";
import { PARTICIPANT_CAPACITY, PARTICIPANT_SLOTS } from "../input/participants";
import { firstFighterPoseDifference } from "../presentation/fighterPose";
import { firstImpactDifference } from "../presentation/impactState";
import { firstSpecialEffectDifference } from "../presentation/specialEffectState";
import { firstSummonDifference } from "../presentation/summonState";
import { SPECIAL_ACTION_CAPACITY } from "../sim/codes";
import { PROJECTILE_CAPACITY, type Fighter, type MeleeMotionValue, type Projectile } from "../sim/fighter";
import { fighterAt, isActive } from "../sim/roster";
import { HERO_STATUS_GROUPS } from "../sim/codes";
import type { DashGrabRules, FighterPhysics, GroundMovementRules, ShieldGeometry, SurfaceRecoveryPhysics } from "../sim/tuning";
import { at } from "wisp/src/runtime/lookup";
import { canonicalSlot, fighterMovesCanonical, fighterSpecialsCanonical } from "./canonical";
import { firstTrainingDifference } from "../match/trainingState";
import { firstRunDifference } from "../classic/runState";
import { firstItemsDifference } from "../match/items";
import { firstBotMemoryDifference, sameBotMemory } from "../match/botPerception";
import { botStrategyValues, sameBotStrategy } from "../match/botStrategy";
import type { MatchState } from "../match/rules";
import { sameControls } from "../sim/roster";
import { sameFighterState } from "./fighterState";
import type { ReplayState } from "./snapshot";

type Value = number | boolean | undefined;

// Wurst compares these tuples by value under one field name.
const PHYSICS_KEYS = [
  "weight", "gravity", "terminalSpeed", "fastFallSpeed", "airAcceleration", "airSpeed", "airFriction", "airCap", "traction",
  "dashSpeed", "runSpeed", "walkSpeed", "jumpSquatFrames", "fullJumpSpeed", "shortJumpSpeed", "aerialJumpSpeed", "jumpMomentum",
  "jumpHorizontalSpeed", "jumpHorizontalCap", "aerialJumpHorizontalSpeed", "shieldBreakSpeed", "walkAccelerationMultiplier",
  "walkAccelerationBase", "groundAccelerationMultiplier", "groundAccelerationBase", "groundSpeedCap",
] as const satisfies readonly (keyof FighterPhysics)[];
const SURFACE_PHYSICS_KEYS = [
  "passiveWallSpeed", "wallJumpHorizontalSpeed", "wallJumpVerticalSpeed", "passiveCeilingSpeed", "wallJumpMinimumApproach", "canWallJump",
] as const satisfies readonly (keyof SurfaceRecoveryPhysics)[];
const GROUND_RULE_KEYS = [
  "dashRunEnableFrame", "turnRunFacingCommandFrame", "turnRunAnimationEndFrame", "runBrakeTurnCommandEndFrame", "runBrakeAnimationEndFrame", "runBrakeMaximumFrames",
] as const satisfies readonly (keyof GroundMovementRules)[];
const DASH_GRAB_KEYS = ["startupFrames", "activeFrames", "totalFrames"] as const satisfies readonly (keyof DashGrabRules)[];
const SHIELD_GEOMETRY_KEYS = ["centerX", "centerZ", "radius"] as const satisfies readonly (keyof ShieldGeometry)[];
const MELEE_VALUE_KEYS = ["original", "published"] as const satisfies readonly (keyof MeleeMotionValue)[];
const PROJECTILE_FIELDS = [
  ["projectileLife", "life"], ["projectileX", "x"], ["projectileZ", "z"], ["projectileDirection", "direction"],
  ["projectileKind", "kind"], ["projectileDamageMultiplier", "damageMultiplier"], ["projectileVisualFamily", "visualFamily"],
  ["projectileNewlyReflected", "newlyReflected"], ["projectileVelocityX", "velocityX"], ["projectileVelocityZ", "velocityZ"],
  ["projectileSerial", "serial"], ["projectileExReach", "exReach"], ["projectilePoolHits", "poolHits"], ["projectilePoolWait", "poolWait"],
] as const satisfies readonly (readonly [string, keyof Projectile])[];

/**
 * Wurst's fighterDifference. A slot reference also differs when either side
 * refers to a fighter its roster doesn't seat, as an identity check would.
 */
export function firstFighterDifference(expected: Readonly<Fighter>, actual: Readonly<Fighter>, expectedMask: number, actualMask: number): string | undefined {
  let found: string | undefined;
  const add = (name: string, left: Value, right: Value) => {
    if (found === undefined && left !== right) found = name;
  };
  const record = <T>(name: string, left: T, right: T, keys: readonly (keyof T)[]) => {
    if (found !== undefined || left === right) return;
    for (const key of keys) {
      if (left[key] !== right[key]) {
        found = name;
        return;
      }
    }
  };
  const reference = (name: string, left: number | undefined, right: number | undefined) => {
    const leftSlot = canonicalSlot(left, expectedMask);
    const rightSlot = canonicalSlot(right, actualMask);
    if (found === undefined && (leftSlot !== rightSlot || leftSlot === -2 || rightSlot === -2)) found = name;
  };
  const e = expected;
  const a = actual;
  const expectedTuning = e.tuning;
  const actualTuning = a.tuning;
  if (expectedTuning.moves !== actualTuning.moves && fighterMovesCanonical(expectedTuning.moves) !== fighterMovesCanonical(actualTuning.moves)) found = "moves";
  if (found === undefined && expectedTuning.specials !== actualTuning.specials
    && fighterSpecialsCanonical(expectedTuning.specials) !== fighterSpecialsCanonical(actualTuning.specials)) found = "specials";
  add("character", e.character, a.character);
  record("physics", expectedTuning.physics, actualTuning.physics, PHYSICS_KEYS);
  record("surfacePhysics", expectedTuning.surface, actualTuning.surface, SURFACE_PHYSICS_KEYS);
  add("ceilingTechImpulseFrame", expectedTuning.tech.ceilingImpulseFrame, actualTuning.tech.ceilingImpulseFrame);
  add("ceilingTechAnimationEndFrame", expectedTuning.tech.ceilingAnimationEndFrame, actualTuning.tech.ceilingAnimationEndFrame);
  add("wallTechAnimationEndFrame", expectedTuning.tech.wallAnimationEndFrame, actualTuning.tech.wallAnimationEndFrame);
  add("wallJumpTechAnimationEndFrame", expectedTuning.tech.wallJumpAnimationEndFrame, actualTuning.tech.wallJumpAnimationEndFrame);
  add("facing", e.facing, a.facing);
  add("turnaroundSide", e.motion.turnaroundSide, a.motion.turnaroundSide);
  add("turnaroundAge", e.motion.turnaroundAge, a.motion.turnaroundAge);
  add("dashFrame", e.ground.dashFrame, a.ground.dashFrame);
  add("dashDirection", e.ground.dashDirection, a.ground.dashDirection);
  record("groundRules", expectedTuning.ground, actualTuning.ground, GROUND_RULE_KEYS);
  record("dashGrabTiming", expectedTuning.dashGrab, actualTuning.dashGrab, DASH_GRAB_KEYS);
  add("dashGrabWindow", e.ground.dashGrabWindow, a.ground.dashGrabWindow);
  add("dashGrabAttack", e.attack.dashGrab, a.attack.dashGrab);
  add("pivotGrabAttack", e.attack.pivotGrab, a.attack.pivotGrab);
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
  record("motionX", e.motion.meleeX, a.motion.meleeX, MELEE_VALUE_KEYS);
  record("motionZ", e.motion.meleeZ, a.motion.meleeZ, MELEE_VALUE_KEYS);
  record("motionVelocityZ", e.motion.meleeVelocityZ, a.motion.meleeVelocityZ, MELEE_VALUE_KEYS);
  add("knockbackX", e.launch.knockbackX, a.launch.knockbackX);
  add("knockbackZ", e.launch.knockbackZ, a.launch.knockbackZ);
  record("motionKnockbackX", e.launch.meleeKnockbackX, a.launch.meleeKnockbackX, MELEE_VALUE_KEYS);
  record("motionKnockbackZ", e.launch.meleeKnockbackZ, a.launch.meleeKnockbackZ, MELEE_VALUE_KEYS);
  add("groundKnockbackX", e.launch.groundKnockbackX, a.launch.groundKnockbackX);
  add("knockbackAgeFrames", e.launch.knockbackAge ?? -1, a.launch.knockbackAge ?? -1);
  add("damageLevel", e.launch.damageLevel, a.launch.damageLevel);
  add("shieldPushbackX", e.shield.pushbackX, a.shield.pushbackX);
  add("shieldRecoilX", e.shield.recoilX, a.shield.recoilX);
  add("shieldRecoilZ", e.shield.recoilZ, a.shield.recoilZ);
  record("motionRecoilX", e.shield.meleeRecoilX, a.shield.meleeRecoilX, MELEE_VALUE_KEYS);
  record("motionRecoilZ", e.shield.meleeRecoilZ, a.shield.meleeRecoilZ, MELEE_VALUE_KEYS);
  add("shieldDrainResumePending", e.shield.drainResumePending, a.shield.drainResumePending);
  add("damage", e.status.damage, a.status.damage);
  add("grabVisualSerial", e.visuals.grab, a.visuals.grab);
  add("throwVisualSerial", e.visuals.throw, a.visuals.throw);
  add("hitVisualSerial", e.visuals.hit, a.visuals.hit);
  add("hitVisualElectric", e.visuals.hitElectric, a.visuals.hitElectric);
  add("hitVisualElement", e.visuals.hitElement, a.visuals.hitElement);
  add("hitVisualStrength", e.visuals.hitStrength, a.visuals.hitStrength);
  add("hitVisualHeight", e.visuals.hitHeight, a.visuals.hitHeight);
  add("hitVisualPummel", e.visuals.hitPummel, a.visuals.hitPummel);
  add("shieldVisualElectric", e.visuals.shieldElectric, a.visuals.shieldElectric);
  add("shieldVisualSerial", e.visuals.shield, a.visuals.shield);
  add("shieldReflectVisualSerial", e.visuals.shieldReflect, a.visuals.shieldReflect);
  add("stocks", e.status.stocks, a.status.stocks);
  add("hitstun", e.launch.hitstun, a.launch.hitstun);
  add("throwHitstun", e.launch.throwHitstun, a.launch.throwHitstun);
  add("hitlag", e.launch.hitlag, a.launch.hitlag);
  add("diPending", e.launch.diPending, a.launch.diPending);
  add("diLaunchSpeed", e.launch.diLaunchSpeed, a.launch.diLaunchSpeed);
  add("diSerial", e.launch.diSerial, a.launch.diSerial);
  add("diAngleDegrees", e.launch.diAngleDegrees, a.launch.diAngleDegrees);
  add("sdiWasGrounded", e.launch.sdiWasGrounded, a.launch.sdiWasGrounded);
  add("sdiLaunchesUpward", e.launch.sdiLaunchesUpward, a.launch.sdiLaunchesUpward);
  add("sdiSerial", e.launch.sdiSerial, a.launch.sdiSerial);
  add("asdiSerial", e.launch.asdiSerial, a.launch.asdiSerial);
  add("sdiHitTravel", e.launch.sdiHitTravel, a.launch.sdiHitTravel);
  add("sdiStringTravel", e.launch.sdiStringTravel, a.launch.sdiStringTravel);
  add("sdiStepX", e.launch.sdiStepX, a.launch.sdiStepX);
  add("sdiStepZ", e.launch.sdiStepZ, a.launch.sdiStepZ);
  add("sdiStepTravel", e.launch.sdiStepTravel, a.launch.sdiStepTravel);
  add("sdiNextX", e.launch.sdiNextX, a.launch.sdiNextX);
  add("sdiNextZ", e.launch.sdiNextZ, a.launch.sdiNextZ);
  add("sdiNextTravel", e.launch.sdiNextTravel, a.launch.sdiNextTravel);
  add("cooldown", e.attack.cooldown, a.attack.cooldown);
  add("attackStyle", e.attack.style, a.attack.style);
  add("attackFrame", e.attack.frame, a.attack.frame);
  add("attackDuration", e.attack.duration, a.attack.duration);
  add("attackSerial", e.attack.serial, a.attack.serial);
  add("attackHit", e.attack.hit, a.attack.hit);
  for (let i = 0; i < PARTICIPANT_CAPACITY; i++) reference(`hitAttackers[${i}]`, at(e.hits.entries, i).attacker, at(a.hits.entries, i).attacker);
  for (let i = 0; i < PARTICIPANT_CAPACITY; i++) add(`hitSerials[${i}]`, at(e.hits.entries, i).attackSerial, at(a.hits.entries, i).attackSerial);
  for (let i = 0; i < PARTICIPANT_CAPACITY; i++) add(`hitWindows[${i}]`, at(e.hits.entries, i).window, at(a.hits.entries, i).window);
  for (let i = 0; i < PARTICIPANT_CAPACITY; i++) reference(`specialHitTargets[${i}]`, e.special.hitTargets[i], a.special.hitTargets[i]);
  reference("lastHitAttacker", e.hits.lastAttacker, a.hits.lastAttacker);
  add("lastHitAttackSerial", e.hits.lastAttackSerial, a.hits.lastAttackSerial);
  add("lastHitWindow", e.hits.lastWindow, a.hits.lastWindow);
  add("smashCharging", e.attack.smashCharging, a.attack.smashCharging);
  add("smashChargeFrames", e.attack.smashChargeFrames, a.attack.smashChargeFrames);
  add("smashChargeAllowed", e.attack.smashChargeAllowed, a.attack.smashChargeAllowed);
  for (const [label, key] of PROJECTILE_FIELDS) {
    for (let i = 0; i < PROJECTILE_CAPACITY; i++) add(`${label}[${i}]`, at(e.projectiles, i)[key], at(a.projectiles, i)[key]);
  }
  add("manaDrainedSerial", e.visuals.manaDrained, a.visuals.manaDrained);
  add("specialAction", e.special.action, a.special.action);
  add("specialFrame", e.special.frame, a.special.frame);
  add("specialDuration", e.special.duration, a.special.duration);
  add("specialLockFrames", e.special.lockFrames, a.special.lockFrames);
  add("specialFall", e.special.fall, a.special.fall);
  for (let i = 0; i < SPECIAL_ACTION_CAPACITY; i++) add(`specialCooldowns[${i}]`, at(e.special.cooldowns, i), at(a.special.cooldowns, i));
  add("specialDirection", e.special.direction, a.special.direction);
  add("specialEx", e.special.ex, a.special.ex);
  add("specialExArmorUsed", e.special.exArmorUsed, a.special.exArmorUsed);
  add("specialHit", e.special.hit, a.special.hit);
  add("bearLife", e.bear.life, a.bear.life);
  add("bearExDamage", e.bear.exDamage, a.bear.exDamage);
  add("bearX", e.bear.x, a.bear.x);
  add("bearZ", e.bear.z, a.bear.z);
  add("bearVelocityX", e.bear.velocityX, a.bear.velocityX);
  add("bearVelocityZ", e.bear.velocityZ, a.bear.velocityZ);
  add("bearSwipeCooldown", e.bear.swipeCooldown, a.bear.swipeCooldown);
  add("bearHitSerial", e.bear.hitSerial, a.bear.hitSerial);
  add("bearSurface", e.bear.surface, a.bear.surface);
  add("freezeTrapLife", e.freezeTrap.life, a.freezeTrap.life);
  add("freezeTrapExReach", e.freezeTrap.exReach, a.freezeTrap.exReach);
  add("freezeTrapArming", e.freezeTrap.arming, a.freezeTrap.arming);
  add("freezeTrapX", e.freezeTrap.x, a.freezeTrap.x);
  add("freezeTrapZ", e.freezeTrap.z, a.freezeTrap.z);
  add("freezeTrapSurface", e.freezeTrap.surface, a.freezeTrap.surface);
  add("freezeTrapSerial", e.freezeTrap.serial, a.freezeTrap.serial);
  add("frozenFrames", e.status.frozenFrames, a.status.frozenFrames);
  add("offscreenFrames", e.status.offscreenFrames, a.status.offscreenFrames);
  add("freezeImmunityFrames", e.status.freezeImmunityFrames, a.status.freezeImmunityFrames);
  add("armorFrames", e.status.armorFrames, a.status.armorFrames);
  add("armorMaxDamage", e.status.armorMaxDamage, a.status.armorMaxDamage);
  add("armorChills", e.status.armorChills, a.status.armorChills);
  add("condition", e.status.condition, a.status.condition);
  add("conditionFrames", e.status.conditionFrames, a.status.conditionFrames);
  add("conditionGroup", e.status.conditionGroup, a.status.conditionGroup);
  add("conditionImmunityFrames", e.status.conditionImmunityFrames, a.status.conditionImmunityFrames);
  for (let i = 0; i < HERO_STATUS_GROUPS; i++) add(`conditionImmunity[${i}]`, e.status.conditionImmunity[i] ?? 0, a.status.conditionImmunity[i] ?? 0);
  add("poisonFrames", e.status.poisonFrames, a.status.poisonFrames);
  add("poisonEvery", e.status.poisonEvery, a.status.poisonEvery);
  add("poisonDamage", e.status.poisonDamage, a.status.poisonDamage);
  add("manaPoints", e.mana.points, a.mana.points);
  add("manaDeniedSerial", e.visuals.manaDenied, a.visuals.manaDenied);
  add("specialForm", e.special.form, a.special.form);
  add("specialAimX", e.special.aimX, a.special.aimX);
  add("specialAimZ", e.special.aimZ, a.special.aimZ);
  add("specialAirtimeUses", e.special.airtimeUses, a.special.airtimeUses);
  add("specialGrabFrame", e.special.grabFrame, a.special.grabFrame);
  add("specialGuarded", e.special.guarded, a.special.guarded);
  add("divineFrames", e.status.divineFrames, a.status.divineFrames);
  add("buff", e.status.buff, a.status.buff);
  add("buffFrames", e.status.buffFrames, a.status.buffFrames);
  for (let i = 0; i < PROJECTILE_CAPACITY; i++) add(`projectileSpec[${i}]`, at(e.projectiles, i).spec === at(a.projectiles, i).spec, true);
  add("packLength", e.pack.length, a.pack.length);
  for (let animal = 0; animal <= Math.min(e.pack.length, a.pack.length); animal++) {
    const ep = placedObject(e, animal);
    const ap = placedObject(a, animal);
    const animalName = animal === 0 ? "placed" : `pack[${animal - 1}]`;
    add(`${animalName}Life`, ep.life, ap.life);
    add(`${animalName}Age`, ep.age, ap.age);
    add(`${animalName}X`, ep.x, ap.x);
    add(`${animalName}Z`, ep.z, ap.z);
    add(`${animalName}Direction`, ep.direction, ap.direction);
    add(`${animalName}Durability`, ep.durability, ap.durability);
    add(`${animalName}Serial`, ep.serial, ap.serial);
    add(`${animalName}Spec`, ep.spec === ap.spec, true);
    for (let i = 0; i < PARTICIPANT_CAPACITY; i++) add(`${animalName}Struck[${i}]`, ep.struck[i], ap.struck[i]);
    add(`${animalName}SpecialStruck`, ep.specialStruck, ap.specialStruck);
    add(`${animalName}Mode`, ep.mode, ap.mode);
    add(`${animalName}ModeFrame`, ep.modeFrame, ap.modeFrame);
    add(`${animalName}Apart`, ep.apart, ap.apart);
    add(`${animalName}Bitten`, ep.bitten, ap.bitten);
    add(`${animalName}Surface`, ep.surface ?? -1, ap.surface ?? -1);
  }
  add("freezeTrapCooldown", e.freezeTrap.cooldown, a.freezeTrap.cooldown);
  add("out", e.status.out, a.status.out);
  add("respawn", e.status.respawn, a.status.respawn);
  add("shield", e.shield.raised, a.shield.raised);
  add("shieldTiltX", e.shield.tiltX, a.shield.tiltX);
  add("shieldTiltZ", e.shield.tiltZ, a.shield.tiltZ);
  add("shieldTriggerWasActive", e.shield.triggerWasActive, a.shield.triggerWasActive);
  add("shieldTriggerAge", e.shield.triggerAge, a.shield.triggerAge);
  add("shieldReflectFrames", e.shield.reflectFrames, a.shield.reflectFrames);
  add("shieldPerfectFrames", e.shield.perfectFrames, a.shield.perfectFrames);
  add("shieldPerfectActionFrames", e.shield.perfectActionFrames, a.shield.perfectActionFrames);
  add("shieldRedParryTried", e.shield.redParryTried, a.shield.redParryTried);
  add("shieldParryBuffer", e.shield.parryBuffer, a.shield.parryBuffer);
  add("shieldParryBufferDirection", e.shield.parryBufferDirection, a.shield.parryBufferDirection);
  record("shieldGeometry", expectedTuning.shield, actualTuning.shield, SHIELD_GEOMETRY_KEYS);
  add("shieldStrength", e.shield.strength, a.shield.strength);
  add("shieldEnergy", e.shield.energy, a.shield.energy);
  add("shieldStun", e.shield.stun, a.shield.stun);
  add("shieldHeldFrames", e.shield.heldFrames, a.shield.heldFrames);
  add("shieldReleaseLag", e.shield.releaseLag, a.shield.releaseLag);
  add("shieldBreakState", e.shield.breakState, a.shield.breakState);
  add("shieldBreakFrame", e.shield.breakFrame, a.shield.breakFrame);
  add("shieldBreakSerial", e.shield.breakSerial, a.shield.breakSerial);
  add("shieldBreakDownFrames", expectedTuning.shieldBreak.landFrames, actualTuning.shieldBreak.landFrames);
  add("shieldBreakStandFrames", expectedTuning.shieldBreak.standFrames, actualTuning.shieldBreak.standFrames);
  add("shieldBreakRemaining", e.shield.breakRemaining, a.shield.breakRemaining);
  add("crouching", e.motion.crouching, a.motion.crouching);
  add("fastFallDownHeld", e.motion.fastFallDownHeld, a.motion.fastFallDownHeld);
  add("fastFallInputAge", e.motion.fastFallInputAge, a.motion.fastFallInputAge);
  add("previousStickSide", e.motion.previousStickSide, a.motion.previousStickSide);
  add("stickSideAge", e.motion.stickSideAge, a.motion.stickSideAge);
  add("jumpInputAge", e.jump.inputAge, a.jump.inputAge);
  add("fastFalling", e.motion.fastFalling, a.motion.fastFalling);
  add("grounded", e.motion.grounded, a.motion.grounded);
  add("fastFalling", e.motion.fastFalling, a.motion.fastFalling);
  add("crouching", e.motion.crouching, a.motion.crouching);
  add("jumps", e.jump.remaining, a.jump.remaining);
  add("jumpSerial", e.jump.serial, a.jump.serial);
  add("jumpIsDouble", e.jump.isDouble, a.jump.isDouble);
  add("jumpSquat", e.jump.squat, a.jump.squat);
  add("jumpAscent", e.jump.ascent, a.jump.ascent);
  add("jumpDodgeQueued", e.jump.dodgeQueued, a.jump.dodgeQueued);
  add("jumpDodgeX", e.jump.dodgeX, a.jump.dodgeX);
  add("jumpDodgeZ", e.jump.dodgeZ, a.jump.dodgeZ);
  add("jumpHeld", e.jump.held, a.jump.held);
  add("invincible", e.status.invincible, a.status.invincible);
  add("surface", e.motion.surface, a.motion.surface);
  add("surfaceRecoveryState", e.surfaceRecovery.state, a.surfaceRecovery.state);
  add("surfaceRecoveryFrame", e.surfaceRecovery.frame, a.surfaceRecovery.frame);
  add("surfaceRecoveryVelocityApplied", e.surfaceRecovery.velocityApplied, a.surfaceRecovery.velocityApplied);
  add("surfaceWallJumpQueued", e.surfaceRecovery.wallJumpQueued, a.surfaceRecovery.wallJumpQueued);
  add("surfaceWallJumpRepeat", e.surfaceRecovery.wallJumpRepeat, a.surfaceRecovery.wallJumpRepeat);
  add("surfaceWallJumpAge", e.surfaceRecovery.wallJumpAge, a.surfaceRecovery.wallJumpAge);
  add("surfaceWallJumpSide", e.surfaceRecovery.wallJumpSide, a.surfaceRecovery.wallJumpSide);
  add("surfaceWallJumpsUsed", e.surfaceRecovery.wallJumpsUsed, a.surfaceRecovery.wallJumpsUsed);
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
  add("airDodging", e.dodge.airDodging, a.dodge.airDodging);
  add("airDodgeFrame", e.dodge.airFrame, a.dodge.airFrame);
  add("airDodgeUsed", e.dodge.airUsed, a.dodge.airUsed);
  add("groundDodgeFrame", e.dodge.groundFrame, a.dodge.groundFrame);
  add("groundDodgeDirection", e.dodge.groundDirection, a.dodge.groundDirection);
  add("groundDodgeEntryFacing", e.dodge.groundEntryFacing, a.dodge.groundEntryFacing);
  add("downState", e.down.state, a.down.state);
  add("downFrame", e.down.frame, a.down.frame);
  add("downDirection", e.down.direction, a.down.direction);
  add("downWaitRemaining", e.down.waitRemaining, a.down.waitRemaining);
  add("downFaceUp", e.down.faceUp, a.down.faceUp);
  add("downAttackQueued", e.down.attackQueued, a.down.attackQueued);
  add("techWindow", e.tech.window, a.tech.window);
  add("techPressAge", e.tech.pressAge, a.tech.pressAge);
  add("techPreviousPressAge", e.tech.previousPressAge, a.tech.previousPressAge);
  add("techAccumulatedPress", e.tech.accumulatedPress, a.tech.accumulatedPress);
  add("grabbedFrames", e.grab.grabbedFrames, a.grab.grabbedFrames);
  add("grabAction", e.grab.action, a.grab.action);
  add("grabFrame", e.grab.frame, a.grab.frame);
  add("grabPummels", e.grab.pummels, a.grab.pummels);
  add("grabHeldFrames", e.grab.heldFrames, a.grab.heldFrames);
  add("grabQueuedThrow", e.grab.queuedThrow, a.grab.queuedThrow);
  add("grabSerial", e.grab.serial, a.grab.serial);
  add("grabMashX", e.grab.mashX, a.grab.mashX);
  add("grabMashZ", e.grab.mashZ, a.grab.mashZ);
  reference("grabOwner", e.grab.owner, a.grab.owner);
  reference("grabTarget", e.grab.target, a.grab.target);
  add("ledgeState", e.ledge.state, a.ledge.state);
  add("ledgeSide", e.ledge.side, a.ledge.side);
  add("ledgeFrame", e.ledge.frame, a.ledge.frame);
  add("ledgeSerial", e.ledge.serial, a.ledge.serial);
  add("ledgeIntangible", e.ledge.intangible, a.ledge.intangible);
  add("ledgeRegrab", e.ledge.regrab, a.ledge.regrab);
  add("platformMove", e.platform.move, a.platform.move);
  add("platformFrame", e.platform.frame, a.platform.frame);
  add("platformDuration", e.platform.duration, a.platform.duration);
  add("platformDeck", e.platform.deck, a.platform.deck);
  add("platformFromX", e.platform.fromX, a.platform.fromX);
  add("platformToX", e.platform.toX, a.platform.toX);
  add("platformFromZ", e.platform.fromZ, a.platform.fromZ);
  add("platformToZ", e.platform.toZ, a.platform.toZ);
  add("platformRise", e.platform.rise, a.platform.rise);
  add("platformStand", e.platform.stand, a.platform.stand);
  add("platformShield", e.platform.shield, a.platform.shield);
  add("platformWrapLeft", e.platform.wrapLeft, a.platform.wrapLeft);
  add("platformWrapLeftAge", e.platform.wrapLeftAge, a.platform.wrapLeftAge);
  add("platformWrapRight", e.platform.wrapRight, a.platform.wrapRight);
  add("platformWrapRightAge", e.platform.wrapRightAge, a.platform.wrapRightAge);
  add("platformDodgeQueued", e.platform.dodgeQueued, a.platform.dodgeQueued);
  add("platformDodgeX", e.platform.dodgeX, a.platform.dodgeX);
  add("platformDodgeZ", e.platform.dodgeZ, a.platform.dodgeZ);
  add("platformSpecialQueued", e.platform.specialQueued, a.platform.specialQueued);
  add("platformSpecialX", e.platform.specialX, a.platform.specialX);
  add("platformSpecialZ", e.platform.specialZ, a.platform.specialZ);
  add("cannonHeld", e.cannon.held ?? -1, a.cannon.held ?? -1);
  add("cannonFiring", e.cannon.firing ?? -1, a.cannon.firing ?? -1);
  add("cannonCooldown", e.cannon.cooldown, a.cannon.cooldown);
  add("cannonPassing", e.cannon.passing ? 1 : 0, a.cannon.passing ? 1 : 0);
  add("waterIn", e.water.inWater, a.water.inWater);
  add("waterFrames", e.water.frames, a.water.frames);
  add("waterEntries", e.water.entries, a.water.entries);
  add("waterHydraFrame", e.water.hydraFrame, a.water.hydraFrame);
  add("waterHydraX", e.water.hydraX, a.water.hydraX);
  return found;
}

function firstCommandDifference(expected: Readonly<AttackBuffer>, actual: Readonly<AttackBuffer>): string | undefined {
  const e = attackBufferCanonicalState(expected);
  const a = attackBufferCanonicalState(actual);
  if (e.graceFrames !== a.graceFrames) return "windowFrames";
  if (e.style !== a.style) return "style";
  if (e.facing !== a.facing) return "facing";
  if (e.targetFrame !== a.targetFrame) return "targetFrame";
  if (e.consumedFacing !== a.consumedFacing) return "consumedFacing";
  if (e.mayCharge !== a.mayCharge) return "mayCharge";
  if (e.consumedMayCharge !== a.consumedMayCharge) return "consumedMayCharge";
  return undefined;
}

/** Wurst ReplaySnapshot.firstDifference: gameplay state only; firstPoseDifference covers presentation. */
export function firstStateDifference(expected: Readonly<ReplayState>, actual: Readonly<ReplayState>): string | undefined {
  if (expected.world.mask !== actual.world.mask) return "participantMask";
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(expected.world, slot)) continue;
    const fighter = firstFighterDifference(fighterAt(expected.world, slot), fighterAt(actual.world, slot), expected.world.mask, actual.world.mask);
    if (fighter !== undefined) return `fighter[${slot}].${fighter}`;
    const command = firstCommandDifference(expected.controls.commands[slot], actual.controls.commands[slot]);
    if (command !== undefined) return `commands[${slot}].${command}`;
  }
  const match = firstMatchDifference(expected.match, actual.match);
  if (match !== undefined) return match;
  if (expected.runtime.simulationFrame !== actual.runtime.simulationFrame) return "runtime.simulationFrame";
  for (const slot of PARTICIPANT_SLOTS) {
    if (expected.runtime.botAttackDelays[slot] !== actual.runtime.botAttackDelays[slot]) return `runtime.botAttackDelays[${slot}]`;
  }
  const botMemory = firstBotMemoryDifference(expected.runtime.botMemory, actual.runtime.botMemory);
  if (botMemory !== undefined) return `runtime.botMemory.${botMemory}`;
  for (const slot of PARTICIPANT_SLOTS) {
    const e = botStrategyValues(expected.runtime.botStrategies[slot]);
    const a = botStrategyValues(actual.runtime.botStrategies[slot]);
    if (e.length !== a.length) return `runtime.botStrategies[${slot}].values.length`;
    for (let index = 0; index < e.length; index++) if (e[index] !== a[index]) return `runtime.botStrategies[${slot}].values[${index}]`;
  }
  return undefined;
}

function firstMatchDifference(e: Readonly<MatchState>, a: Readonly<MatchState>): string | undefined {
  if (e.phase !== a.phase) return "match.phase";
  for (const key of ["initialized", "x", "z", "distance", "tangent", "left", "right", "bottom", "top"] as const) if (e.camera[key] !== a.camera[key]) return `match.camera.${key}`;
  for (const slot of PARTICIPANT_SLOTS) for (const key of ["left", "right", "bottom", "top"] as const) if (e.camera.boxes[slot][key] !== a.camera.boxes[slot][key]) return `match.camera.box${slot}.${key}`;
  if (e.stageChoice !== a.stageChoice) return "match.stageChoice";
  if (e.stageResolved !== a.stageResolved) return "match.stageResolved";
  for (const key of ["only", "selectedMask", "remainingMask"] as const) if (e.stagePool[key] !== a.stagePool[key]) return `match.stagePool.${key}`;
  if (e.hazards !== a.hazards) return "match.hazards";

  if (e.winner !== a.winner) return "match.winner";
  if (e.departedMask !== a.departedMask) return "match.departedMask";
  if (e.interrupted !== a.interrupted) return "match.interrupted";
  if (e.humanFighterMask !== a.humanFighterMask) return "match.humanFighterMask";
  if (e.computerMask !== a.computerMask) return "match.computerMask";
  if (e.humanMask !== a.humanMask) return "match.humanMask";
  for (const slot of PARTICIPANT_SLOTS) {
    if (e.characterChoices[slot] !== a.characterChoices[slot]) return `match.slot${slot}.character`;
    if (e.characterReadiness[slot] !== a.characterReadiness[slot]) return `match.slot${slot}.ready`;
    if (e.rematchReadiness[slot] !== a.rematchReadiness[slot]) return `match.slot${slot}.rematch`;
    if (e.cpuOpponents[slot] !== a.cpuOpponents[slot]) return `match.slot${slot}.cpuOpponent`;
    if (e.cpuTiers[slot] !== a.cpuTiers[slot]) return `match.slot${slot}.cpuTier`;
    if (e.cpuResolvedOpponents[slot] !== a.cpuResolvedOpponents[slot]) return `match.slot${slot}.cpuResolvedOpponent`;
  }
  if (e.humanCount !== a.humanCount) return "match.humanCount";
  if (e.practice !== a.practice) return "match.practice";
  if (e.training !== a.training) return "match.training";
  const training = firstTrainingDifference(e.trainer, a.trainer);
  if (training !== undefined) return training;
  if (e.classic !== a.classic) return "match.classic";
  if (e.classicTier !== a.classicTier) return "match.classicTier";
  if (e.lore !== a.lore) return "match.lore";
  if (e.loreBattle !== a.loreBattle) return "match.loreBattle";
  const run = firstRunDifference(e.run, a.run);
  if (run !== undefined) return run;
  if (e.stockCount !== a.stockCount) return "match.stockCount";
  if (e.timeLimitMinutes !== a.timeLimitMinutes) return "match.timeLimitMinutes";
  if (e.endless !== a.endless) return "match.endless";
  if (e.automaticRematch !== a.automaticRematch) return "match.automaticRematch";
  if (e.rematchCountdown !== a.rematchCountdown) return "match.rematchCountdown";
  if (e.remainingFrames !== a.remainingFrames) return "match.remainingFrames";
  if (e.matchSeed !== a.matchSeed) return "match.matchSeed";
  if (e.matchFrame !== a.matchFrame) return "match.matchFrame";
  if (e.startHold !== a.startHold) return "match.startHold";
  const items = firstItemsDifference(e.items, a.items);
  if (items !== undefined) return items;
  if (e.timedOut !== a.timedOut) return "match.timedOut";
  return undefined;
}

/**
 * Whether two states hold everything copyReplayState copies equal, signed
 * zeros in fighters apart: a repair whose state reaches a stored snapshot
 * may keep every later one (ReplayHistory.repair). Fighters likeliest to
 * differ, `first`, compare first.
 */
export function sameReplayState(expected: Readonly<ReplayState>, actual: Readonly<ReplayState>, first = 0): boolean {
  const mask = expected.world.mask;
  if (mask !== actual.world.mask) return false;
  for (const slot of PARTICIPANT_SLOTS) {
    if ((first & (1 << slot)) === 0 || !isActive(expected.world, slot)) continue;
    if (!sameFighterState(fighterAt(expected.world, slot), fighterAt(actual.world, slot))) return false;
  }
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(expected.world, slot)) continue;
    if ((first & (1 << slot)) === 0 && !sameFighterState(fighterAt(expected.world, slot), fighterAt(actual.world, slot))) return false;
    if (!sameAttackBuffer(expected.controls.commands[slot], actual.controls.commands[slot])) return false;
  }
  if (firstMatchDifference(expected.match, actual.match) !== undefined) return false;
  const e = expected.runtime;
  const a = actual.runtime;
  if (e.simulationFrame !== a.simulationFrame) return false;
  for (const slot of PARTICIPANT_SLOTS) {
    if (e.botAttackDelays[slot] !== a.botAttackDelays[slot] || e.observedLegal[slot] !== a.observedLegal[slot] || e.observedStarted[slot] !== a.observedStarted[slot]) return false;
    if (!sameBotStrategy(e.botStrategies[slot], a.botStrategies[slot])) return false;
    const decision = e.botDecisions[slot];
    const other = a.botDecisions[slot];
    if (decision.decided !== other.decided) return false;
    if (decision.decided && (!sameControls(decision.input, other.input) || !sameAttackBuffer(decision.commands, other.commands))) return false;
  }
  if (!sameBotMemory(e.botMemory, a.botMemory)) return false;
  return firstPoseDifference(expected, actual) === undefined;
}

/** Wurst ReplaySnapshot.firstPoseDifference: presentation history, which the checksum leaves out. */
export function firstPoseDifference(expected: Readonly<ReplayState>, actual: Readonly<ReplayState>): string | undefined {
  if (expected.world.mask !== actual.world.mask) return "participantMask";
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(expected.world, slot)) continue;
    const pose = firstFighterPoseDifference(expected.runtime.poses[slot], actual.runtime.poses[slot], expected.world, actual.world);
    if (pose !== undefined) return `pose[${slot}].${pose}`;
  }
  const impact = firstImpactDifference(expected.runtime.impacts, actual.runtime.impacts);
  if (impact !== undefined) return `impacts.${impact}`;
  const special = firstSpecialEffectDifference(expected.runtime.specials, actual.runtime.specials);
  if (special !== undefined) return `specials.${special}`;
  const summon = firstSummonDifference(expected.runtime.summons, actual.runtime.summons);
  return summon === undefined ? undefined : `summons.${summon}`;
}
