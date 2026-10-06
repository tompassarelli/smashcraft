// Character specials: choosing and starting them, their per-frame timelines,
// and Demon Hunter's Immolation contact. First-pass timing and trajectories;
// gameplay tuning remains provisional.
import { max, min } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, HippogryphKind, ProjectileKind, SPECIAL_ACTION_CAPACITY, SpecialAction, SurfaceContact } from "./codes";
import { canAttack, isIntangible } from "./conditions";
import { finishDamageContacts, openDamageContacts } from "./contacts";
import type { Fighter } from "./fighter";
import {
  RIFLEMAN_BLASTER_AIR_FRAMES, RIFLEMAN_BLASTER_AIR_SHOT_FRAME, RIFLEMAN_BLASTER_GROUND_FRAMES,
  RIFLEMAN_BLASTER_GROUND_SHOT_FRAME,
} from "./moves";
import { HitElement, type HitEffect, type HitRegion, NO_HIT_REGION } from "./hitRegions";
import { heroSpecialMove } from "./heroSpecials";
import { advanceHeroCommandGrab } from "./heroCommandGrab";
import { applyAttackHit } from "./hits";
import { meleeHitIntersectsShield } from "./attacks";
import { observeActionDecision } from "./observations";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { spawnArcherArrow, spawnBlasterShot, spawnHomingArrow, spawnProjectileMotion } from "./projectiles";
import { type Controls, type Roster, fighterAt, isActive } from "./roster";
import { surfaceZ } from "./stage";
import { HIPPOGRYPH_DIVE_ARRIVAL, HIPPOGRYPH_DIVE_OVERSHOOT, RIFLEMAN_BEAR_LIFETIME, advanceBear, advanceHippogryph, recordSpecialHit, specialAlreadyHit, startFreezeTrap } from "./summons";
import { at } from "wisp/src/runtime/lookup";
import { advanceHeroSpecial, chooseHeroSpecial, enterHeroSpecial, followUpHeroSpecial, heroSpecialContact, heroStrikeMeetsShield, isHeroSpecialAction, resolveHeroGuards, steerHeroSpecial, stopHeroMotionAtBodies } from "./heroSpecialRules";

export const DEMONHUNTER_MANA_BURN_STARTUP = 8;
const DEMONHUNTER_MANA_BURN_RECOVERY = 25;
const DEMONHUNTER_PARRY_DURATION = 22;
export const DEMONHUNTER_WING_STARTUP = 3;
export const DEMONHUNTER_WING_DURATION = 28;
export const DEMONHUNTER_IMMOLATE_STARTUP = 4;
export const DEMONHUNTER_IMMOLATE_ACTIVE = 4;
export const DEMONHUNTER_IMMOLATE_DURATION = 27;
const ARCHER_HOMING_WINDUP_FRAMES = 12;
// Archer's hippogryph ride (up special): a hover, then a steerable ride
// ending in helpless fall, or a leap off that leaves her actionable.
export const ARCHER_RIDE_HOVER_FRAMES = 5;
export const ARCHER_RIDE_FRAMES = 40;
const ARCHER_RIDE_LEAP_FIRST = 12;
const ARCHER_RIDE_HOVER_RISE = 2.0;
export const ARCHER_RIDE_RISE = 12.0;
export const ARCHER_RIDE_LOW_RISE = 4.0;
const ARCHER_RIDE_ANGLED_X = 8.0;
const ARCHER_RIDE_STEER = 1.0;
export const ARCHER_RIDE_MAX_X = 12.0;
export const ARCHER_LEAP_RISE = 14.0;
const ARCHER_RELEASED_FRAMES = 18;
const ARCHER_RELEASED_RISE = 18.0;
/** The ride's bit in airtimeUses: once per airtime, refreshed by landing, a ledge catch or a hit. */
const ARCHER_RIDE_AIRTIME = 1;
// Archer's call and dive (down special): one hippogryph swoops to a perch,
// then dives from it at her on the next press.
export const ARCHER_CALL_FRAMES = 24;
export const ARCHER_SWOOP_FRAMES = 18;
const ARCHER_SWOOP_SPEED = 28.0;
const ARCHER_DIVE_FRAMES = 16;
export const ARCHER_DIVE_LAUNCH_FRAME = 6;
const ARCHER_CALL_FORM = 0;
const ARCHER_DIVE_FORM = 1;
const RIFLEMAN_RECOVERY_STARTUP_FRAMES = 4;
const RIFLEMAN_RECOVERY_PROTECTION_END = 24;
const ARCHER_HOMING_FRAMES = 34;
const RIFLEMAN_RECOVERY_FRAMES = 34;
/** The bear appears this many frames into the cast, past the reaction floor in docs/gameplay-design.md (#69). */
export const RIFLEMAN_BEAR_CAST_FRAMES = 24;
/** The cast, then 18 frames after the bear appears. */
export const RIFLEMAN_BEAR_SUMMON_FRAMES = RIFLEMAN_BEAR_CAST_FRAMES + 18;
const TRAP_SET_FRAMES = 20;
const ARCHER_ARROW_FRAMES = 3;
/** The special input bit in action observations. */
const SPECIAL_ACTION_BIT = 64;

function startSpecialAction(owner: Fighter, action: SpecialAction, duration: number, direction: number): void {
  const { special, attack } = owner;
  if (action === SpecialAction.archerDisengage || action === SpecialAction.demonHunterImmolate || isHeroSpecialAction(action)) {
    for (let entry = 0; entry < PARTICIPANT_CAPACITY; entry++) special.hitTargets[entry] = undefined;
  }
  owner.surfaceRecovery.state = SurfaceContact.none;
  owner.surfaceRecovery.frame = 0;
  owner.motion.fastFalling = false;
  owner.motion.crouching = false;
  special.action = action;
  special.frame = 0;
  special.duration = duration;
  special.lockFrames = duration;
  special.direction = direction < 0 ? -1 : direction > 0 ? 1 : 0;
  attack.style = undefined;
  attack.frame = 0;
  attack.duration = 0;
  attack.hit = false;
  attack.smashCharging = false;
  attack.smashChargeFrames = 0;
  attack.smashChargeAllowed = false;
  owner.shield.raised = false;
  owner.shield.heldFrames = 0;
  attack.cooldown = max(attack.cooldown, duration);
}

/** The special's horizontal direction: the pressed side, the facing for neutral, zero for vertical. */
function specialDirection(input: Readonly<Controls>, facing: number): number {
  if (input.specialX !== 0) return input.specialX;
  return input.specialZ === 0 ? facing : 0;
}

function requestedSpecial(owner: Fighter, input: Readonly<Controls>): SpecialAction {
  const up = input.specialZ > 0;
  const down = input.specialZ < 0;
  const side = input.specialX !== 0;
  switch (owner.character) {
    default:
      return up ? SpecialAction.heroUp : down ? SpecialAction.heroDown : side ? SpecialAction.heroSide : SpecialAction.heroNeutral;
    case Character.archer:
      return up ? SpecialAction.archerRecovery : down ? SpecialAction.archerDisengage : side ? SpecialAction.archerHomingArrow : SpecialAction.archerArrow;
    case Character.rifleman:
      return down ? SpecialAction.riflemanTrap : up ? SpecialAction.riflemanRecovery : side ? SpecialAction.riflemanBear : SpecialAction.riflemanBlaster;
    case Character.demonHunter:
      return up ? SpecialAction.demonHunterWingAscent : down ? SpecialAction.demonHunterImmolate
        : side ? SpecialAction.demonHunterParryStep : SpecialAction.demonHunterManaBurn;
  }
}

function specialCanStart(owner: Fighter, action: SpecialAction): boolean {
  const { special } = owner;
  return action > SpecialAction.none && action < SPECIAL_ACTION_CAPACITY && at(special.cooldowns, action) <= 0
    && special.lockFrames <= 0 && special.action === SpecialAction.none && canAttack(owner);
}

function launchUpward(owner: Fighter): void {
  owner.motion.grounded = false;
  owner.motion.surface = undefined;
  owner.jump.remaining = 0;
}

function startArcherSpecial(owner: Fighter, action: SpecialAction, moveX: number): boolean {
  const { motion, hippogryph, special } = owner;
  if (action === SpecialAction.archerRecovery) {
    if ((special.airtimeUses & ARCHER_RIDE_AIRTIME) !== 0) return false;
    startSpecialAction(owner, action, ARCHER_RIDE_FRAMES, moveX);
    special.airtimeUses |= ARCHER_RIDE_AIRTIME;
    // A perched or flying hippogryph comes to carry her.
    hippogryph.kind = HippogryphKind.mount;
    hippogryph.life = ARCHER_RIDE_FRAMES;
    hippogryph.x = motion.x;
    hippogryph.z = motion.z;
    hippogryph.velocityX = 0.0;
    hippogryph.velocityZ = ARCHER_RIDE_HOVER_RISE;
    motion.vx = 0.0;
    motion.vz = ARCHER_RIDE_HOVER_RISE;
    launchUpward(owner);
    special.cooldowns[action] = 90;
    return true;
  }
  if (action === SpecialAction.archerDisengage) {
    if (hippogryph.kind === HippogryphKind.perch) {
      startSpecialAction(owner, action, ARCHER_DIVE_FRAMES, moveX);
      special.form = ARCHER_DIVE_FORM;
      special.hit = false;
      special.cooldowns[action] = 60;
      return true;
    }
    // One hippogryph: no new call while it is still flying.
    if (hippogryph.life > 0) return false;
    // Down with a side faces it: the hippogryph swoops that way and she hops back from it.
    const disengage = moveX !== 0;
    if (disengage) owner.facing = moveX;
    startSpecialAction(owner, action, ARCHER_CALL_FRAMES, moveX);
    special.form = ARCHER_CALL_FORM;
    special.hit = false;
    hippogryph.kind = HippogryphKind.strike;
    hippogryph.life = ARCHER_SWOOP_FRAMES;
    hippogryph.x = f32(motion.x - f32(owner.facing * 150));
    hippogryph.z = f32(motion.z + 40);
    hippogryph.velocityX = f32(owner.facing * ARCHER_SWOOP_SPEED);
    hippogryph.velocityZ = 0.0;
    if (disengage) {
      motion.vx = f32(-owner.facing * 18.0);
      motion.vz = 16.0;
      motion.grounded = false;
      motion.surface = undefined;
    }
    special.cooldowns[action] = 24;
    return true;
  }
  if (action === SpecialAction.archerHomingArrow) {
    startSpecialAction(owner, action, ARCHER_HOMING_FRAMES, moveX);
    special.cooldowns[action] = 40;
    return true;
  }
  startSpecialAction(owner, action, ARCHER_ARROW_FRAMES, moveX);
  owner.attack.cooldown = 0;
  special.cooldowns[action] = 8;
  return true;
}

function startRiflemanSpecial(owner: Fighter, stage: number, matchFrame: number, action: SpecialAction, moveX: number): boolean {
  const { motion, bear, special } = owner;
  if (action === SpecialAction.riflemanTrap) {
    if (!startFreezeTrap(owner, stage, matchFrame)) return false;
    startSpecialAction(owner, action, TRAP_SET_FRAMES, moveX);
    special.cooldowns[action] = 90;
    return true;
  }
  if (action === SpecialAction.riflemanRecovery) {
    if (!motion.grounded) owner.jump.remaining = 0;
    startSpecialAction(owner, action, RIFLEMAN_RECOVERY_FRAMES, moveX);
    special.cooldowns[action] = 90;
    return true;
  }
  if (action === SpecialAction.riflemanBear) {
    if (bear.life > 0) return false;
    startSpecialAction(owner, action, RIFLEMAN_BEAR_SUMMON_FRAMES, moveX);
    owner.facing = moveX;
    special.cooldowns[action] = 90;
    return true;
  }
  startSpecialAction(owner, action, motion.grounded ? RIFLEMAN_BLASTER_GROUND_FRAMES : RIFLEMAN_BLASTER_AIR_FRAMES, moveX);
  special.cooldowns[action] = 8;
  return true;
}

/** The cast completes: the bear appears ahead of the Rifleman and runs the way he cast it. */
function summonBear(owner: Fighter, stage: number, matchFrame: number): void {
  const { motion, bear, special } = owner;
  const moveX = special.direction;
  bear.life = RIFLEMAN_BEAR_LIFETIME;
  bear.x = f32(motion.x + f32(moveX * 45));
  bear.z = motion.grounded && motion.surface !== undefined ? surfaceZ(stage, motion.surface, matchFrame) : motion.z;
  bear.velocityX = f32(moveX * 14.0);
  bear.velocityZ = motion.grounded ? 0.0 : motion.vz;
  bear.surface = motion.grounded ? motion.surface : undefined;
  bear.swipeCooldown = 5;
}

function startDemonHunterSpecial(owner: Fighter, action: SpecialAction, moveX: number): boolean {
  const { motion, special } = owner;
  if (action === SpecialAction.demonHunterWingAscent) {
    startSpecialAction(owner, action, DEMONHUNTER_WING_DURATION, moveX);
    special.cooldowns[action] = 90;
    motion.vx = f32(moveX * 5.0);
    motion.vz = 30.0;
    launchUpward(owner);
    owner.jump.squat = 0;
    return true;
  }
  if (action === SpecialAction.demonHunterImmolate) {
    startSpecialAction(owner, action, DEMONHUNTER_IMMOLATE_DURATION, moveX);
    special.cooldowns[action] = 24;
    special.hit = false;
    return true;
  }
  if (action === SpecialAction.demonHunterParryStep) {
    startSpecialAction(owner, action, DEMONHUNTER_PARRY_DURATION, moveX);
    special.cooldowns[action] = 45;
    motion.vx = f32(moveX * 9.0);
    return true;
  }
  startSpecialAction(owner, action, DEMONHUNTER_MANA_BURN_STARTUP + DEMONHUNTER_MANA_BURN_RECOVERY, moveX);
  special.cooldowns[action] = 24;
  return true;
}

// Preallocated: a refused hero press reports why.
const heroRefusal = { manaShort: false };

/**
 * Starts an expansion hero's special through its authored kit. A press it
 * cannot afford starts nothing and counts one refusal for presentation.
 */
function startHeroFighterSpecial(owner: Fighter, input: Readonly<Controls>): boolean {
  const specials = owner.tuning.specials;
  const { special } = owner;
  if (isHeroSpecialAction(special.action)) return followUpHeroSpecial(owner, input);
  if (specials === undefined || special.lockFrames > 0 || special.action !== SpecialAction.none || !canAttack(owner)) return false;
  const chosen = chooseHeroSpecial(owner, specials, input, heroRefusal);
  if (chosen === undefined) {
    if (heroRefusal.manaShort) owner.visuals.manaDenied++;
    return false;
  }
  observeActionDecision(SPECIAL_ACTION_BIT);
  const lastTap = owner.motion.lastAerialTapDirection;
  if (!owner.motion.grounded && input.specialX === 0 && input.specialZ === 0 && lastTap !== 0) owner.facing = lastTap;
  const move = heroSpecialMove(specials, chosen);
  // A placement with a near form keeps the facing when pressed backward.
  const keepsFacing = (move.projectiles ?? []).some(spec => spec.backOffsetX !== undefined) && input.specialX * owner.facing < 0;
  if (input.specialX !== 0 && (input.specialZ === 0 || move.facesStick === true) && !keepsFacing) owner.facing = input.specialX < 0 ? -1 : 1;
  const action = SpecialAction.heroNeutral + chosen.slot;
  startSpecialAction(owner, heroAction(action), move.endFrame, specialDirection(input, owner.facing));
  enterHeroSpecial(owner, chosen, input);
  return true;
}

/** Starts the special the input asks for if it may; a neutral aerial special turns to the last air steering. */
export function startFighterSpecial(owner: Fighter, stage: number, matchFrame: number, input: Readonly<Controls>): boolean {
  steerHeroSpecial(owner, input);
  if (!input.specialPressed) return false;
  if (owner.tuning.specials !== undefined) return startHeroFighterSpecial(owner, input);
  const requested = requestedSpecial(owner, input);
  if (!specialCanStart(owner, requested)) return false;
  observeActionDecision(SPECIAL_ACTION_BIT);
  const lastTap = owner.motion.lastAerialTapDirection;
  if (!owner.motion.grounded && input.specialX === 0 && input.specialZ === 0 && lastTap !== 0) owner.facing = lastTap;
  const moveX = specialDirection(input, owner.facing);
  switch (owner.character) {
    case Character.archer:
      return startArcherSpecial(owner, requested, moveX);
    case Character.rifleman:
      return startRiflemanSpecial(owner, stage, matchFrame, requested, moveX);
    case Character.demonHunter:
      return startDemonHunterSpecial(owner, requested, moveX);
    default:
      return false;
  }
}

/** Ends the action; up-specials that end airborne leave a helpless fall. */
function endSpecialAction(owner: Fighter, helpless: boolean): void {
  if (helpless && !owner.motion.grounded) {
    owner.special.fall = true;
    owner.jump.remaining = 0;
  }
  owner.special.action = SpecialAction.none;
  owner.special.frame = 0;
}

/**
 * The ride after its hover: the stick bends it sideways, down held flies the
 * low line, and jump from its 12th frame leaps off, leaving her actionable
 * while the hippogryph flies on as an upward strike.
 */
function rideHippogryph(owner: Fighter, input: Readonly<Controls> | undefined): void {
  const { special, motion, hippogryph } = owner;
  if (special.frame < ARCHER_RIDE_HOVER_FRAMES) return;
  if (special.frame >= ARCHER_RIDE_LEAP_FIRST && input?.jumpPressed === true) {
    leapOffHippogryph(owner);
    return;
  }
  if (special.frame === ARCHER_RIDE_HOVER_FRAMES) motion.vx = f32(special.direction * ARCHER_RIDE_ANGLED_X);
  const steer = input?.direction ?? 0;
  if (steer !== 0) {
    motion.vx = max(-ARCHER_RIDE_MAX_X, min(ARCHER_RIDE_MAX_X, f32(motion.vx + f32(steer * ARCHER_RIDE_STEER))));
    owner.facing = steer < 0 ? -1 : 1;
  }
  motion.vz = input?.down === true ? ARCHER_RIDE_LOW_RISE : ARCHER_RIDE_RISE;
  hippogryph.velocityX = motion.vx;
  hippogryph.velocityZ = motion.vz;
}

function leapOffHippogryph(owner: Fighter): void {
  const { special, motion, hippogryph } = owner;
  for (let entry = 0; entry < PARTICIPANT_CAPACITY; entry++) special.hitTargets[entry] = undefined;
  hippogryph.kind = HippogryphKind.released;
  hippogryph.life = ARCHER_RELEASED_FRAMES;
  hippogryph.x = motion.x;
  hippogryph.z = f32(motion.z + 30);
  hippogryph.velocityX = motion.vx;
  hippogryph.velocityZ = ARCHER_RELEASED_RISE;
  special.action = SpecialAction.none;
  special.frame = 0;
  special.lockFrames = 0;
  special.hit = false;
  owner.attack.cooldown = 0;
  owner.jump.remaining = 0;
  motion.vx = f32(motion.vx * 0.5);
  motion.vz = ARCHER_LEAP_RISE;
}

/** The perched hippogryph dives at where its archer is, arriving in a fixed time and flying on past her. */
function startHippogryphDive(owner: Fighter): void {
  const { special, motion, hippogryph } = owner;
  if (hippogryph.kind !== HippogryphKind.perch) return;
  for (let entry = 0; entry < PARTICIPANT_CAPACITY; entry++) special.hitTargets[entry] = undefined;
  hippogryph.kind = HippogryphKind.dive;
  hippogryph.life = HIPPOGRYPH_DIVE_ARRIVAL + HIPPOGRYPH_DIVE_OVERSHOOT;
  hippogryph.velocityX = f32(f32(motion.x - hippogryph.x) / HIPPOGRYPH_DIVE_ARRIVAL);
  hippogryph.velocityZ = f32(f32(f32(motion.z + 40) - hippogryph.z) / HIPPOGRYPH_DIVE_ARRIVAL);
}

function advanceSpecialAction(owner: Fighter, stage: number, matchFrame: number, input: Readonly<Controls> | undefined): void {
  const { special, motion } = owner;
  if (special.action === SpecialAction.none || owner.launch.hitlag > 0) return;
  special.frame++;
  if (isHeroSpecialAction(special.action)) {
    advanceHeroSpecial(owner, stage, input);
    return;
  }
  const shotSerial = owner.attack.serial + 1;
  if (special.action === SpecialAction.archerArrow && special.frame === 2) spawnArcherArrow(owner, owner.facing, shotSerial);
  if (special.action === SpecialAction.riflemanBlaster) {
    const grounded = special.duration === RIFLEMAN_BLASTER_GROUND_FRAMES;
    if (special.frame === (grounded ? RIFLEMAN_BLASTER_GROUND_SHOT_FRAME : RIFLEMAN_BLASTER_AIR_SHOT_FRAME)) spawnBlasterShot(owner, shotSerial, grounded);
  }
  if (special.action === SpecialAction.riflemanBear && special.frame === RIFLEMAN_BEAR_CAST_FRAMES) summonBear(owner, stage, matchFrame);
  if (special.action === SpecialAction.demonHunterManaBurn && special.frame === DEMONHUNTER_MANA_BURN_STARTUP) {
    spawnProjectileMotion(owner, ProjectileKind.manaBurn, f32(owner.facing * 30.0), 0.0, 48, shotSerial);
  }
  if (special.action === SpecialAction.archerHomingArrow && special.frame === ARCHER_HOMING_WINDUP_FRAMES) {
    spawnHomingArrow(owner, special.direction, shotSerial);
  }
  if (special.action === SpecialAction.riflemanRecovery) {
    if (special.frame === RIFLEMAN_RECOVERY_STARTUP_FRAMES) {
      spawnProjectileMotion(owner, ProjectileKind.recoil, f32(owner.facing * 2.0), -28.0, 8, shotSerial);
      motion.vx = f32(special.direction * 8.0);
      motion.vz = 30.0;
      launchUpward(owner);
    }
    if (special.frame >= RIFLEMAN_RECOVERY_STARTUP_FRAMES && special.frame <= RIFLEMAN_RECOVERY_PROTECTION_END) {
      owner.status.invincible = max(owner.status.invincible, 2);
    }
  }
  if (special.action === SpecialAction.demonHunterWingAscent && special.frame === DEMONHUNTER_WING_STARTUP) {
    motion.vz = 30.0;
    motion.vx = f32(special.direction * 5.0);
    launchUpward(owner);
    owner.status.invincible = max(owner.status.invincible, 4);
  }
  if (special.action === SpecialAction.archerRecovery) rideHippogryph(owner, input);
  if (special.action === SpecialAction.archerDisengage && special.form === ARCHER_DIVE_FORM && special.frame === ARCHER_DIVE_LAUNCH_FRAME) {
    startHippogryphDive(owner);
  }
  // Endings run in this order, each seeing the previous one's result.
  if (special.action === SpecialAction.archerDisengage && special.frame >= special.duration) {
    special.action = SpecialAction.none;
    special.frame = 0;
    special.hit = false;
  }
  if (special.action === SpecialAction.archerRecovery && special.frame >= ARCHER_RIDE_FRAMES) endSpecialAction(owner, true);
  if (special.action === SpecialAction.archerHomingArrow && special.frame >= ARCHER_HOMING_FRAMES) endSpecialAction(owner, false);
  if (special.action === SpecialAction.riflemanBear && special.frame >= RIFLEMAN_BEAR_SUMMON_FRAMES) endSpecialAction(owner, false);
  if (special.action === SpecialAction.riflemanRecovery && special.frame >= RIFLEMAN_RECOVERY_FRAMES) endSpecialAction(owner, true);
  if (special.action === SpecialAction.riflemanTrap && special.frame >= TRAP_SET_FRAMES) endSpecialAction(owner, false);
  if (special.action === SpecialAction.riflemanBlaster && special.frame >= special.duration) endSpecialAction(owner, false);
  if (special.action === SpecialAction.demonHunterManaBurn && special.frame >= special.duration) endSpecialAction(owner, false);
  if (special.action === SpecialAction.demonHunterParryStep && special.frame >= special.duration) endSpecialAction(owner, false);
  if (special.action === SpecialAction.demonHunterWingAscent && special.frame >= special.duration) endSpecialAction(owner, true);
  if (special.action === SpecialAction.demonHunterImmolate && special.frame >= special.duration) endSpecialAction(owner, false);
  if (special.action === SpecialAction.archerArrow && special.frame >= ARCHER_ARROW_FRAMES) endSpecialAction(owner, false);
}

const IMMOLATE_GROUND: Readonly<HitRegion> = {
  minX: 0.0, maxX: 140.0, minZ: -80.0, maxZ: 100.0,
  effect: { damage: 7.0, growth: 105.0, base: 21.0, launchX: 1.0, launchZ: 0.0, electric: false, element: HitElement.fire },
  window: 1,
};
const IMMOLATE_AIR: Readonly<HitRegion> = {
  minX: -70.0, maxX: 70.0, minZ: -170.0, maxZ: 30.0,
  effect: { damage: 9.0, growth: 110.0, base: 26.0, launchX: 0.11999999731779099, launchZ: -0.9929999709129333, electric: false, element: HitElement.fire },
  window: 1,
};

/** Where Immolation strikes a target's position, facing right, from the ground or the air. */
export const immolationRegion = (grounded: boolean): Readonly<HitRegion> => (grounded ? IMMOLATE_GROUND : IMMOLATE_AIR);

/** Immolation strikes each target inside its grounded or aerial region once during its active frames. */
function demonHunterSpecialContact(owner: Fighter, targetSlot: number, target: Fighter): Readonly<HitRegion> {
  const { special } = owner;
  if (owner.character !== Character.demonHunter || special.action !== SpecialAction.demonHunterImmolate) return NO_HIT_REGION;
  if (specialAlreadyHit(owner, targetSlot) || special.frame < DEMONHUNTER_IMMOLATE_STARTUP) return NO_HIT_REGION;
  if (special.frame >= DEMONHUNTER_IMMOLATE_STARTUP + DEMONHUNTER_IMMOLATE_ACTIVE || target.status.out || isIntangible(target)) return NO_HIT_REGION;
  const localX = f32(f32(target.motion.x - owner.motion.x) * owner.facing);
  const localZ = f32(target.motion.z - owner.motion.z);
  const contact = immolationRegion(owner.motion.grounded);
  const inside = localX >= contact.minX && localX <= contact.maxX && localZ >= contact.minZ && localZ <= contact.maxZ;
  return inside ? contact : NO_HIT_REGION;
}

// Preallocated per participant and per pair: rollback replays advance specials every frame.
const specialScratch = {
  contacts: Array.from({ length: PARTICIPANT_CAPACITY * PARTICIPANT_CAPACITY }, (): Readonly<HitRegion> => NO_HIT_REGION),
  facings: [0, 0, 0, 0],
};

/** Advances every special timeline, applies Immolation contacts selected against one state, then summons. */
export function advanceSpecials(world: Roster, stage: number, matchFrame: number, inputs?: readonly Readonly<Controls>[]): void {
  const ownsBatch = openDamageContacts();
  const { contacts, facings } = specialScratch;
  resolveHeroGuards(world);
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot)) continue;
    advanceSpecialAction(fighterAt(world, slot), stage, matchFrame, inputs?.[slot]);
    stopHeroMotionAtBodies(world, slot);
    advanceHeroCommandGrab(world, slot);
  }
  for (let ownerSlot = 0; ownerSlot < PARTICIPANT_CAPACITY; ownerSlot++) {
    if (!isActive(world, ownerSlot)) continue;
    const owner = fighterAt(world, ownerSlot);
    facings[ownerSlot] = owner.facing;
    for (let targetSlot = 0; targetSlot < PARTICIPANT_CAPACITY; targetSlot++) {
      if (!isActive(world, targetSlot) || targetSlot === ownerSlot) continue;
      contacts[ownerSlot * PARTICIPANT_CAPACITY + targetSlot] = isHeroSpecialAction(owner.special.action)
        ? heroSpecialContact(owner, fighterAt(world, targetSlot), specialAlreadyHit(owner, targetSlot))
        : demonHunterSpecialContact(owner, targetSlot, fighterAt(world, targetSlot));
    }
  }
  for (let ownerSlot = 0; ownerSlot < PARTICIPANT_CAPACITY; ownerSlot++) {
    if (!isActive(world, ownerSlot)) continue;
    const owner = fighterAt(world, ownerSlot);
    for (let targetSlot = 0; targetSlot < PARTICIPANT_CAPACITY; targetSlot++) {
      if (!isActive(world, targetSlot) || targetSlot === ownerSlot) continue;
      const contact = at(contacts, ownerSlot * PARTICIPANT_CAPACITY + targetSlot);
      if (contact.window <= 0) continue;
      const target = fighterAt(world, targetSlot);
      recordSpecialHit(owner, targetSlot);
      applyAttackHit(world, ownerSlot, targetSlot, AttackStyle.jab, at(facings, ownerSlot), heroContactEffect(contact, target), true,
        contact.strike === undefined ? meleeHitIntersectsShield(owner, target, contact) : heroStrikeMeetsShield(owner, target, contact));
    }
  }
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot)) continue;
    advanceBear(world, slot, stage, matchFrame);
    advanceHippogryph(world, slot);
  }
  if (ownsBatch) finishDamageContacts(world);
}

/** A strike path's grounded variant applies to a grounded target. */
function heroContactEffect(contact: Readonly<HitRegion>, target: Readonly<Fighter>): Readonly<HitEffect> {
  return target.motion.grounded && contact.groundedEffect !== undefined ? contact.groundedEffect : contact.effect;
}

function heroAction(action: number): SpecialAction {
  switch (action) {
    case SpecialAction.heroSide: return SpecialAction.heroSide;
    case SpecialAction.heroUp: return SpecialAction.heroUp;
    case SpecialAction.heroDown: return SpecialAction.heroDown;
    default: return SpecialAction.heroNeutral;
  }
}
