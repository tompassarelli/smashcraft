// Summons that act on their own: the Rifleman's bear and freeze trap, and the
// the reference body's hippogryph.
import { max } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, HitOrigin, SpecialAction } from "./codes";
import { canAttack, isIntangible } from "./conditions";
import type { Fighter } from "./fighter";
import { applyAttackHit } from "./hits";
import type { HitEffect } from "./hitRegions";
import { DIAGONAL_UNIT } from "./knockback";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { type Roster, fighterAt, isActive } from "./roster";
import { mainDeckLeft, mainDeckRight, mainDeckZAt, surfaceZAt } from "./stage";
import { cancelAttack, cancelSpecialState, clearDownState, clearGrabLinks, clearLedge, clearOwnedFreezeTrap } from "./transitions";

export const RIFLEMAN_BEAR_LIFETIME = 150;
const RIFLEMAN_BEAR_SWIPE_INTERVAL = 14;
const FREEZE_TRAP_ARMING_FRAMES = 20;
const FREEZE_TRAP_LIFETIME_FRAMES = 480;
/** A freeze no one mashes out of lasts this long. */
export const FREEZE_TRAP_FREEZE_FRAMES = 300;
const FREEZE_TRAP_COOLDOWN_FRAMES = 90;
const FREEZE_TRAP_TRIGGER_RADIUS = 42.0;

const BEAR_SWIPE = { damage: 9.300000190734863, growth: 83.70000457763672, base: 18.0, launchX: DIAGONAL_UNIT, launchZ: 0.3499999940395355, electric: false } as const;
const BEAR_SWIPE_EX = { ...BEAR_SWIPE, damage: f32(BEAR_SWIPE.damage * 1.25) } as const;

export function specialAlreadyHit(owner: Fighter, targetSlot: number): boolean {
  for (let entry = 0; entry < PARTICIPANT_CAPACITY; entry++) {
    if (owner.special.hitTargets[entry] === targetSlot) return true;
  }
  return false;
}

export function recordSpecialHit(owner: Fighter, targetSlot: number): void {
  owner.special.hit = true;
  const targets = owner.special.hitTargets;
  for (let entry = 0; entry < PARTICIPANT_CAPACITY; entry++) {
    const recorded = targets[entry];
    if (recorded === undefined || recorded === targetSlot) {
      targets[entry] = targetSlot;
      return;
    }
  }
}

export function canStartFreezeTrap(owner: Fighter): boolean {
  const { motion, freezeTrap } = owner;
  return owner.character === Character.rifleman && motion.grounded && motion.surface !== undefined
    && freezeTrap.life === 0 && freezeTrap.cooldown === 0 && canAttack(owner);
}

/** Places a trap at a grounded Rifleman's feet, one at a time and after its cooldown. */
export function startFreezeTrap(owner: Fighter, stage: number, matchFrame: number): boolean {
  const { motion } = owner;
  const trap = owner.freezeTrap;
  if (owner.character !== Character.rifleman || !motion.grounded || motion.surface === undefined || trap.life > 0 || trap.cooldown > 0) {
    return false;
  }
  trap.x = motion.x;
  trap.exReach = owner.special.ex;
  motion.crouching = false;
  trap.surface = motion.surface;
  trap.z = surfaceZAt(stage, motion.surface, matchFrame, trap.x);
  trap.life = FREEZE_TRAP_LIFETIME_FRAMES;
  trap.arming = FREEZE_TRAP_ARMING_FRAMES;
  trap.serial++;
  trap.cooldown = FREEZE_TRAP_COOLDOWN_FRAMES;
  return true;
}

function trapCanContact(owner: Fighter, target: Fighter): boolean {
  const trap = owner.freezeTrap;
  return trap.life > 0 && trap.arming === 0 && !owner.status.out && !target.status.out && target.status.frozenFrames === 0 && target.status.freezeImmunityFrames === 0
    && target.motion.grounded && target.motion.surface === trap.surface && !isIntangible(target)
    && Math.abs(f32(target.motion.x - trap.x)) <= f32(FREEZE_TRAP_TRIGGER_RADIUS * (trap.exReach ? 1.25 : 1.0));
}

function freezeFromTrap(world: Roster, slot: number): void {
  const target = fighterAt(world, slot);
  const { motion, launch, shield } = target;
  motion.fastFalling = false;
  motion.crouching = false;
  clearGrabLinks(world, slot);
  clearDownState(target);
  cancelAttack(target);
  clearLedge(target);
  target.ledge.regrab = 0;
  shield.raised = false;
  shield.stun = 0;
  shield.releaseLag = 0;
  launch.hitstun = 0;
  launch.throwHitstun = false;
  launch.hitlag = 0;
  target.grab.grabbedFrames = 0;
  motion.vx = 0.0;
  motion.vz = 0.0;
  launch.knockbackX = 0.0;
  launch.groundKnockbackX = 0.0;
  launch.knockbackZ = 0.0;
  target.status.frozenFrames = FREEZE_TRAP_FREEZE_FRAMES;
  cancelSpecialState(target);
}

// Preallocated per participant: rollback replays check traps every frame.
const trapScratch = { triggers: [false, false, false, false], freezes: [false, false, false, false] };

/**
 * Springs each armed trap on its nearest grounded victim on the trap's deck.
 * Every contact is decided against the same pre-mutation frame, then traps are
 * consumed and victims frozen, so simultaneous traps don't depend on slot
 * order. A shielding victim consumes the trap without freezing.
 */
export function advanceFreezeTraps(world: Roster): void {
  const { triggers, freezes } = trapScratch;
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    triggers[slot] = false;
    freezes[slot] = false;
  }
  for (let ownerSlot = 0; ownerSlot < PARTICIPANT_CAPACITY; ownerSlot++) {
    if (!isActive(world, ownerSlot)) continue;
    const owner = fighterAt(world, ownerSlot);
    let nearest: number | undefined;
    let distance = 0.0;
    for (let targetSlot = 0; targetSlot < PARTICIPANT_CAPACITY; targetSlot++) {
      if (!isActive(world, targetSlot) || targetSlot === ownerSlot) continue;
      const target = fighterAt(world, targetSlot);
      if (!trapCanContact(owner, target)) continue;
      const candidate = Math.abs(f32(target.motion.x - owner.freezeTrap.x));
      if (nearest === undefined || candidate < distance) {
        nearest = targetSlot;
        distance = candidate;
      }
    }
    if (nearest !== undefined) {
      triggers[ownerSlot] = true;
      freezes[nearest] = freezes[nearest] === true || !fighterAt(world, nearest).shield.raised;
    }
  }
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (isActive(world, slot) && triggers[slot]) clearOwnedFreezeTrap(fighterAt(world, slot));
  }
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (isActive(world, slot) && freezes[slot]) freezeFromTrap(world, slot);
  }
}

/** The bear walks, falls to the main deck, and swipes everyone within reach on an interval. */
export function advanceBear(world: Roster, ownerSlot: number, stage: number, matchFrame: number): void {
  const owner = fighterAt(world, ownerSlot);
  const { bear } = owner;
  if (bear.life <= 0) return;
  bear.life--;
  bear.x = f32(bear.x + bear.velocityX);
  if (bear.swipeCooldown > 0) bear.swipeCooldown--;
  if (bear.surface !== undefined) {
    bear.z = surfaceZAt(stage, bear.surface, matchFrame, bear.x);
  } else {
    bear.velocityZ = max(-owner.tuning.physics.terminalSpeed, f32(bear.velocityZ - owner.tuning.physics.gravity));
    bear.z = f32(bear.z + bear.velocityZ);
    const floor = mainDeckZAt(stage, bear.x);
    if (bear.z <= floor) {
      bear.z = floor;
      bear.velocityZ = 0.0;
      bear.surface = 0;
    }
  }
  if (bear.swipeCooldown <= 0) {
    let hit = false;
    for (let targetSlot = 0; targetSlot < PARTICIPANT_CAPACITY; targetSlot++) {
      if (!isActive(world, targetSlot) || targetSlot === ownerSlot) continue;
      const target = fighterAt(world, targetSlot);
      if (target.status.out || isIntangible(target) || Math.abs(f32(target.motion.x - bear.x)) > 70 || Math.abs(f32(target.motion.z - bear.z)) > 100) continue;
      hit = true;
      applyAttackHit(world, ownerSlot, targetSlot, AttackStyle.jab, bear.velocityX < 0 ? -1 : 1, bear.exDamage ? BEAR_SWIPE_EX : BEAR_SWIPE, false, target.shield.raised, undefined, HitOrigin.summon);
    }
    if (hit) {
      bear.swipeCooldown = RIFLEMAN_BEAR_SWIPE_INTERVAL;
      bear.hitSerial++;
    }
  }
  if (bear.life <= 0 || bear.x < f32(mainDeckLeft(stage) - 100) || bear.x > f32(mainDeckRight(stage) + 100)) bear.life = 0;
}
