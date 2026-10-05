// Summons that act on their own: the Rifleman's bear and freeze trap, and the
// Archer's hippogryph.
import { max } from "../../runtime/wurst";
import { f32 } from "waygate/src/sim/f32";
import { AttackStyle, Character, HippogryphKind, SpecialAction } from "./codes";
import { canAttack, isIntangible } from "./conditions";
import type { Fighter } from "./fighter";
import { applyAttackHit } from "./hits";
import { DIAGONAL_UNIT } from "./knockback";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { type Roster, fighterAt, isActive } from "./roster";
import { surfaceLeft, surfaceRight, surfaceZ } from "./stage";
import { cancelAttack, cancelSpecialState, clearDownState, clearGrabLinks, clearLedge, clearOwnedFreezeTrap } from "./transitions";

export const RIFLEMAN_BEAR_LIFETIME = 100;
export const RIFLEMAN_BEAR_SWIPE_INTERVAL = 18;
export const FREEZE_TRAP_ARMING_FRAMES = 20;
export const FREEZE_TRAP_LIFETIME_FRAMES = 1800;
export const FREEZE_TRAP_FREEZE_FRAMES = 300;
export const FREEZE_TRAP_COOLDOWN_FRAMES = 90;
export const FREEZE_TRAP_TRIGGER_RADIUS = 42.0;

const BEAR_SWIPE = { damage: 6.0, growth: 90.0, base: 18.0, launchX: DIAGONAL_UNIT, launchZ: 0.3499999940395355, electric: false } as const;
const HIPPOGRYPH_STRIKE = { damage: 8.0, growth: 100.0, base: 22.0, launchX: DIAGONAL_UNIT, launchZ: DIAGONAL_UNIT, electric: false } as const;

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

/** Places a trap at a grounded Rifleman's feet, one at a time and after its cooldown. */
export function startFreezeTrap(owner: Fighter, stage: number): boolean {
  const { motion } = owner;
  const trap = owner.freezeTrap;
  if (owner.character !== Character.rifleman || !motion.grounded || motion.surface === undefined || trap.life > 0 || trap.cooldown > 0 || !canAttack(owner)) {
    return false;
  }
  trap.x = motion.x;
  motion.crouching = false;
  trap.surface = motion.surface;
  trap.z = surfaceZ(stage, motion.surface);
  trap.life = FREEZE_TRAP_LIFETIME_FRAMES;
  trap.arming = FREEZE_TRAP_ARMING_FRAMES;
  trap.serial++;
  trap.cooldown = FREEZE_TRAP_COOLDOWN_FRAMES;
  owner.attack.cooldown = max(owner.attack.cooldown, FREEZE_TRAP_COOLDOWN_FRAMES);
  return true;
}

function trapCanContact(owner: Fighter, target: Fighter): boolean {
  const trap = owner.freezeTrap;
  return trap.life > 0 && trap.arming === 0 && !owner.status.out && !target.status.out && target.status.frozenFrames === 0
    && target.motion.grounded && target.motion.surface === trap.surface && !isIntangible(target)
    && Math.abs(f32(target.motion.x - trap.x)) <= FREEZE_TRAP_TRIGGER_RADIUS;
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
export function advanceBear(world: Roster, ownerSlot: number, stage: number): void {
  const owner = fighterAt(world, ownerSlot);
  const { bear } = owner;
  if (bear.life <= 0) return;
  bear.life--;
  bear.x = f32(bear.x + bear.velocityX);
  if (bear.swipeCooldown > 0) bear.swipeCooldown--;
  if (bear.surface !== undefined) {
    bear.z = surfaceZ(stage, bear.surface);
  } else {
    bear.velocityZ = max(-owner.tuning.physics.terminalSpeed, f32(bear.velocityZ - owner.tuning.physics.gravity));
    bear.z = f32(bear.z + bear.velocityZ);
    if (bear.z <= surfaceZ(stage, 0)) {
      bear.z = surfaceZ(stage, 0);
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
      applyAttackHit(world, ownerSlot, targetSlot, AttackStyle.jab, bear.velocityX < 0 ? -1 : 1, BEAR_SWIPE, false, target.shield.raised);
    }
    if (hit) {
      bear.swipeCooldown = RIFLEMAN_BEAR_SWIPE_INTERVAL;
      bear.hitSerial++;
    }
  }
  if (bear.life <= 0 || bear.x < f32(surfaceLeft(stage, 0) - 100) || bear.x > f32(surfaceRight(stage, 0) + 100)) bear.life = 0;
}

/** A mount rides above its archer; cover flies ahead and strikes each target it passes once. */
export function advanceHippogryph(world: Roster, ownerSlot: number): void {
  const owner = fighterAt(world, ownerSlot);
  const { hippogryph } = owner;
  if (hippogryph.life <= 0) return;
  hippogryph.life--;
  if (hippogryph.kind === HippogryphKind.mount) {
    hippogryph.x = owner.motion.x;
    hippogryph.z = f32(owner.motion.z + 30);
  } else {
    const oldX = hippogryph.x;
    hippogryph.x = f32(hippogryph.x + hippogryph.velocityX);
    hippogryph.z = f32(hippogryph.z + hippogryph.velocityZ);
    for (let targetSlot = 0; targetSlot < PARTICIPANT_CAPACITY; targetSlot++) {
      if (!isActive(world, targetSlot) || targetSlot === ownerSlot) continue;
      const target = fighterAt(world, targetSlot);
      if (hippogryph.kind !== HippogryphKind.strike || specialAlreadyHit(owner, targetSlot) || target.status.out || isIntangible(target)) continue;
      const crossedTarget = f32(f32(target.motion.x - oldX) * owner.facing) >= 0 && f32(f32(target.motion.x - hippogryph.x) * owner.facing) <= 0;
      if ((crossedTarget || Math.abs(f32(target.motion.x - hippogryph.x)) <= 60) && Math.abs(f32(target.motion.z - hippogryph.z)) <= 100) {
        recordSpecialHit(owner, targetSlot);
        applyAttackHit(world, ownerSlot, targetSlot, AttackStyle.jab, owner.facing, HIPPOGRYPH_STRIKE, false, target.shield.raised);
      }
    }
  }
  if (hippogryph.life <= 0) {
    hippogryph.kind = HippogryphKind.none;
    if (owner.special.action === SpecialAction.archerDisengage) owner.special.hit = false;
  }
}
