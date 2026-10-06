// Starting attacks and resolving their contacts. Every contact is selected
// against the same pre-hit state before grabs or parries can interrupt an
// attacker; mutual catches clash and competing catches take the nearest victim.
import { f32 } from "wisp/src/sim/f32";
import { AttackPhase, AttackStyle, Character, DASH_GRAB_REQUEST } from "./codes";
import { attackPhase, canBeGrabbed, canStartAttackStyle, inEarlyAscent, inGrabContext, isIntangible } from "./conditions";
import { finishDamageContacts, openDamageContacts } from "./contacts";
import type { Fighter } from "./fighter";
import { type HitRegion, NO_HIT_REGION, authoredHitRegion, authoredHitRegionCount, copyHitEffect, copyHitRegion, emptyHitRegion } from "./hitRegions";
import { applyAttackHit } from "./hits";
import { hangsOnLedge } from "./ledge";
import { attackReach, isAerialAttack } from "./moves";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { spawnProjectile } from "./projectiles";
import { type Roster, fighterAt, isActive } from "./roster";
import { capsuleCircleIntersects, shieldSizeMultiplier } from "./shield";
import { attackCapsule, emptyCapsule, placeCapsule } from "../physics/contactGeometry";
import { HurtContact, grabTouchesBody, strikeHurtContact } from "./hurtboxes";
import { beginAttack } from "./transitions";
import { at } from "wisp/src/runtime/lookup";

const GRAB_REACH = attackReach(AttackStyle.grab);
const DASH_GRAB_REGION: Readonly<HitRegion> = {
  minX: 0.0,
  maxX: GRAB_REACH,
  minZ: -130.0,
  maxZ: 130.0,
  effect: { damage: 0.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false },
  window: 1,
};

// Preallocated: hit selection builds these capsules for every pair every frame.
const strikeCapsule = emptyCapsule();

function placeStrikeCapsule(attacker: Fighter, region: Readonly<HitRegion>): void {
  attackCapsule(strikeCapsule, attacker.attack.style, region);
  placeCapsule(strikeCapsule, strikeCapsule, attacker.motion.x, attacker.motion.z, attacker.facing);
}

/** Whether the region's strike path touches the target's raised shield. */
export function meleeHitIntersectsShield(attacker: Fighter, target: Fighter, region: Readonly<HitRegion>): boolean {
  if (!target.shield.raised || region.window <= 0) return false;
  placeStrikeCapsule(attacker, region);
  const geometry = target.tuning.shield;
  const centerX = f32(target.motion.x + f32(target.facing * geometry.centerX));
  const centerZ = f32(target.motion.z + geometry.centerZ);
  return capsuleCircleIntersects(strikeCapsule.x1, strikeCapsule.z1, strikeCapsule.x2, strikeCapsule.z2, strikeCapsule.radius,
    centerX, centerZ, geometry.radius, shieldSizeMultiplier(target.shield.energy, target.shield.strength));
}

/** Whether this attack already hit the target in this window or a later one. */
function alreadyHitRegion(attackerSlot: number, attacker: Fighter, target: Fighter, window: number): boolean {
  for (const entry of target.hits.entries) {
    if (entry.attacker === attackerSlot && entry.attackSerial === attacker.attack.serial && entry.window >= window) return true;
  }
  return false;
}

function recordHitRegion(attackerSlot: number, attacker: Fighter, target: Fighter, region: Readonly<HitRegion>): void {
  attacker.attack.hit = true;
  const { hits } = target;
  hits.lastAttacker = attackerSlot;
  hits.lastAttackSerial = attacker.attack.serial;
  hits.lastWindow = region.window;
  for (const entry of hits.entries) {
    if (entry.attacker === undefined || entry.attacker === attackerSlot) {
      entry.attacker = attackerSlot;
      entry.attackSerial = attacker.attack.serial;
      entry.window = region.window;
      return;
    }
  }
}

/** How far ahead of the attacker, along its facing, the target stands. */
function facingOffsetX(attacker: Readonly<Fighter>, target: Readonly<Fighter>): number {
  return f32(f32(target.motion.x - attacker.motion.x) * attacker.facing);
}

/** Where a grab meets the target's feet: early in a ground jump's ascent, still at the grabber's height (#107). */
function grabTargetZ(attacker: Readonly<Fighter>, target: Readonly<Fighter>): number {
  return inEarlyAscent(target) && target.motion.z > attacker.motion.z ? attacker.motion.z : target.motion.z;
}

function selectAuthoredGrabRegion(attacker: Fighter, target: Fighter, frame: number, out: HitRegion): void {
  const moves = attacker.tuning.moves;
  const localX = facingOffsetX(attacker, target);
  for (let index = 0; index < authoredHitRegionCount(AttackStyle.grab, moves); index++) {
    authoredHitRegion(out, attacker.character, AttackStyle.grab, frame, 0, index, moves);
    if (out.window <= 0 || localX < 0 || localX > out.maxX) continue;
    placeStrikeCapsule(attacker, out);
    if (grabTouchesBody(strikeCapsule, target, grabTargetZ(attacker, target))) return;
  }
  copyHitRegion(out, NO_HIT_REGION);
}

/**
 * Writes the region of the attacker's current attack that reaches the target
 * into out, or NO_HIT_REGION's values. True when that region touched only
 * invincible body parts: the strike is spent on the target without effect.
 */
function selectHitRegion(world: Roster, attackerSlot: number, targetSlot: number, out: HitRegion): boolean {
  const attacker = fighterAt(world, attackerSlot);
  const target = fighterAt(world, targetSlot);
  copyHitRegion(out, NO_HIT_REGION);
  const { attack } = attacker;
  // Divine Shield stops strikes, not grabs.
  const grabsDivine = attack.style === AttackStyle.grab && target.status.divineFrames > 0;
  if (attacker.status.out || attacker.launch.hitlag > 0 || target.status.out || (isIntangible(target) && !grabsDivine)) return false;
  if (attack.style === AttackStyle.grab && !canBeGrabbed(target)) return false;
  // Only grabs read the target's offset, so ordinary hits skip its exact arithmetic.
  if (attack.dashGrab) {
    const moves = attacker.tuning.moves;
    if (moves?.normals[AttackStyle.grab] !== undefined) {
      selectAuthoredGrabRegion(attacker, target, attack.frame - 3, out);
      return false;
    }
    const { startupFrames, activeFrames } = attacker.tuning.dashGrab;
    if (attack.frame >= startupFrames && attack.frame < startupFrames + activeFrames) {
      const localX = facingOffsetX(attacker, target);
      const localZ = f32(grabTargetZ(attacker, target) - attacker.motion.z);
      if (localX >= 0 && localX <= GRAB_REACH && localZ >= -130 && localZ <= 130) copyHitRegion(out, DASH_GRAB_REGION);
    }
    return false;
  }
  if (attack.style === AttackStyle.grab) {
    authoredHitRegion(out, attacker.character, attack.style, attack.frame, attack.smashChargeFrames, 0, attacker.tuning.moves);
    const { hits } = target;
    const alreadyHit = hits.lastAttacker === attackerSlot && hits.lastAttackSerial === attack.serial && hits.lastWindow >= out.window;
    if (attacker.tuning.moves?.normals[AttackStyle.grab] !== undefined) {
      selectAuthoredGrabRegion(attacker, target, attack.frame, out);
      if (alreadyHit) copyHitRegion(out, NO_HIT_REGION);
      return false;
    }
    const localX = facingOffsetX(attacker, target);
    const localZ = f32(grabTargetZ(attacker, target) - attacker.motion.z);
    const inside = localX >= out.minX && localX <= out.maxX && localZ >= out.minZ && localZ <= out.maxZ;
    if (out.window <= 0 || alreadyHit || !inside) copyHitRegion(out, NO_HIT_REGION);
    return false;
  }
  for (let index = 0; index < authoredHitRegionCount(attack.style, attacker.tuning.moves); index++) {
    authoredHitRegion(out, attacker.character, attack.style, attack.frame, attack.smashChargeFrames, index, attacker.tuning.moves);
    if (out.window <= 0 || alreadyHitRegion(attackerSlot, attacker, target, out.window)) continue;
    placeStrikeCapsule(attacker, out);
    const body = strikeHurtContact(strikeCapsule, target);
    if (body === HurtContact.hit || meleeHitIntersectsShield(attacker, target, out)) {
      if (target.motion.grounded && out.groundedEffect !== undefined) copyHitEffect(out.effect, out.groundedEffect);
      return false;
    }
    if (body === HurtContact.invincible) return true;
  }
  copyHitRegion(out, NO_HIT_REGION);
  return false;
}

/** Starts a requested action if the fighter may; a dashing Demon Hunter's jab is his dash attack. */
export function beginFighterAttack(world: Roster, slot: number, style: AttackStyle | undefined, mayCharge: boolean): void {
  if (style === undefined) return;
  const fighter = fighterAt(world, slot);
  const { grounded } = fighter.motion;
  const action = fighter.tuning.moves !== undefined && style === AttackStyle.jab && grounded && fighter.ground.dashFrame > 0
    ? fighter.tuning.moves.dashAttack
    : fighter.character === Character.demonHunter && style === AttackStyle.jab && grounded && fighter.ground.dashFrame > 0
    ? AttackStyle.demonHunterDashAttack
    : style;
  const groundAttack = (action <= DASH_GRAB_REQUEST && action !== AttackStyle.shot) || action === AttackStyle.demonHunterDashAttack || action === AttackStyle.dashAttack;
  const aerial = isAerialAttack(action);
  if (((groundAttack && grounded) || action === AttackStyle.shot || (aerial && !grounded)) && canStartAttackStyle(fighter, action)) {
    beginAttack(fighter, action, mayCharge);
  }
}

// Preallocated per participant and per pair: rollback replays resolve attacks every frame.
const scratch: {
  contacts: HitRegion[];
  styles: (AttackStyle | undefined)[];
  shots: boolean[];
  facings: number[];
  clashed: boolean[];
  choices: (number | undefined)[];
  grabbed: boolean[];
  /** Per pair: the contact touched only invincible parts. */
  spent: boolean[];
} = {
  contacts: Array.from({ length: PARTICIPANT_CAPACITY * PARTICIPANT_CAPACITY }, () => emptyHitRegion()),
  styles: [],
  shots: [false, false, false, false],
  facings: [0, 0, 0, 0],
  clashed: [false, false, false, false],
  choices: [],
  grabbed: [false, false, false, false],
  spent: Array.from({ length: PARTICIPANT_CAPACITY * PARTICIPANT_CAPACITY }, () => false),
};

function contactBetween(source: number, target: number): HitRegion {
  return at(scratch.contacts, source * PARTICIPANT_CAPACITY + target);
}

/** Resolves every active attack's contacts for the frame. */
export function resolveAttacks(world: Roster): void {
  const ownsBatch = openDamageContacts();
  const { styles, shots, facings, clashed, choices, grabbed, spent } = scratch;
  for (let source = 0; source < PARTICIPANT_CAPACITY; source++) {
    if (!isActive(world, source)) continue;
    const f = fighterAt(world, source);
    styles[source] = f.attack.style;
    shots[source] = f.attack.style === AttackStyle.shot && attackPhase(f) === AttackPhase.active && !f.attack.hit;
    facings[source] = f.facing;
    clashed[source] = false;
    choices[source] = undefined;
    grabbed[source] = false;
    for (let target = 0; target < PARTICIPANT_CAPACITY; target++) {
      if (isActive(world, target) && target !== source) spent[source * PARTICIPANT_CAPACITY + target] = selectHitRegion(world, source, target, contactBetween(source, target));
    }
  }
  // Mutual catches clash; competing catches choose the nearest available victim,
  // then slot order. Every fighter can belong to at most one grab link.
  for (let source = 0; source < PARTICIPANT_CAPACITY; source++) {
    if (!isActive(world, source) || styles[source] !== AttackStyle.grab) continue;
    for (let target = 0; target < PARTICIPANT_CAPACITY; target++) {
      if (!isActive(world, target) || target === source || styles[target] !== AttackStyle.grab) continue;
      const forward = contactBetween(source, target);
      if (forward.window > 0 && contactBetween(target, source).window > 0) {
        clashed[source] = true;
        clashed[target] = true;
        recordHitRegion(source, fighterAt(world, source), fighterAt(world, target), forward);
      }
    }
  }
  for (let source = 0; source < PARTICIPANT_CAPACITY; source++) {
    if (!isActive(world, source) || styles[source] !== AttackStyle.grab || clashed[source] || grabbed[source]) continue;
    const sourceX = fighterAt(world, source).motion.x;
    let best: number | undefined;
    let distance = 0.0;
    for (let target = 0; target < PARTICIPANT_CAPACITY; target++) {
      if (!isActive(world, target) || target === source || grabbed[target] || choices[target] !== undefined) continue;
      const victim = fighterAt(world, target);
      const candidate = Math.abs(f32(victim.motion.x - sourceX));
      if (contactBetween(source, target).window > 0 && victim.status.frozenFrames === 0 && !inGrabContext(victim) && !hangsOnLedge(victim)
        && (best === undefined || candidate < distance)) {
        best = target;
        distance = candidate;
      }
    }
    if (best !== undefined) {
      choices[source] = best;
      grabbed[best] = true;
    }
  }
  for (let source = 0; source < PARTICIPANT_CAPACITY; source++) {
    const target = choices[source];
    if (!isActive(world, source) || target === undefined) continue;
    const contact = contactBetween(source, target);
    const attacker = fighterAt(world, source);
    const victim = fighterAt(world, target);
    recordHitRegion(source, attacker, victim, contact);
    applyAttackHit(world, source, target, AttackStyle.grab, at(facings, source), contact.effect, true, meleeHitIntersectsShield(attacker, victim, contact));
  }
  for (let source = 0; source < PARTICIPANT_CAPACITY; source++) {
    if (!isActive(world, source) || grabbed[source]) continue;
    const f = fighterAt(world, source);
    const style = styles[source];
    if (shots[source]) {
      f.attack.hit = true;
      spawnProjectile(f);
      continue;
    }
    if (style === undefined || style === AttackStyle.grab) continue;
    for (let target = 0; target < PARTICIPANT_CAPACITY; target++) {
      if (!isActive(world, target) || target === source) continue;
      const contact = contactBetween(source, target);
      if (contact.window <= 0) continue;
      const victim = fighterAt(world, target);
      recordHitRegion(source, f, victim, contact);
      if (at(spent, source * PARTICIPANT_CAPACITY + target)) continue;
      applyAttackHit(world, source, target, style, at(facings, source), contact.effect, true, meleeHitIntersectsShield(f, victim, contact));
    }
  }
  if (ownsBatch) finishDamageContacts(world);
}
