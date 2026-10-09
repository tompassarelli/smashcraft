


import { f32 } from "wisp/src/sim/f32";
import { AttackPhase, AttackStyle, Character, DASH_GRAB_REQUEST, GroundAction } from "./codes";
import { attackPhase, attackStartup, attackActive, canBeGrabbed, canStartAttackStyle, inEarlyAscent, inGrabContext, isIntangible, jabChainStep } from "./conditions";
import { finishDamageContacts, openDamageContacts } from "./contacts";
import type { Fighter } from "./fighter";
import { type HitRegion, NO_HIT_REGION, authoredHitRegion, authoredHitRegionCount, copyHitEffect, copyHitRegion, emptyHitRegion, SHARED_GRAB_REGION } from "./hitRegions";
import { applyAttackHit } from "./hits";
import { hangsOnLedge } from "./ledge";
import { isAerialAttack, isJab } from "./moves";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { spawnProjectile } from "./projectiles";
import { type Roster, fighterAt, isActive } from "./roster";
import { capsuleCircleIntersects, shieldSizeMultiplier } from "./shield";
import { shieldCenterX, shieldCenterZ } from "./shieldTilt";
import { attackCapsule, emptyCapsule, placeCapsule } from "../physics/contactGeometry";
import { HurtContact, grabTouchesBody, strikeHurtContact } from "./hurtboxes";
import { beginAttack } from "./transitions";
import { at } from "wisp/src/runtime/lookup";

const DASH_GRAB_REGION: Readonly<HitRegion> = { ...SHARED_GRAB_REGION, maxX: 120.0 };
const PIVOT_GRAB_REGION: Readonly<HitRegion> = { ...SHARED_GRAB_REGION, maxX: 144.0 };


const strikeCapsule = emptyCapsule();

function placeStrikeCapsule(attacker: Fighter, region: Readonly<HitRegion>): void {
  attackCapsule(strikeCapsule, attacker.attack.style, region);
  placeCapsule(strikeCapsule, strikeCapsule, attacker.motion.x, attacker.motion.z, attacker.facing);
}


export function meleeHitIntersectsShield(attacker: Fighter, target: Fighter, region: Readonly<HitRegion>): boolean {
  if (!target.shield.raised || region.window <= 0) return false;
  placeStrikeCapsule(attacker, region);
  const geometry = target.tuning.shield;
  const centerX = shieldCenterX(target);
  const centerZ = shieldCenterZ(target);
  return capsuleCircleIntersects(strikeCapsule.x1, strikeCapsule.z1, strikeCapsule.x2, strikeCapsule.z2, strikeCapsule.radius,
    centerX, centerZ, geometry.radius, shieldSizeMultiplier(target.shield.energy, target.shield.strength));
}


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


function facingOffsetX(attacker: Readonly<Fighter>, target: Readonly<Fighter>): number {
  return f32(f32(target.motion.x - attacker.motion.x) * attacker.facing);
}


function grabTargetZ(attacker: Readonly<Fighter>, target: Readonly<Fighter>): number {
  return inEarlyAscent(target) && target.motion.z > attacker.motion.z ? attacker.motion.z : target.motion.z;
}






function selectHitRegion(world: Roster, attackerSlot: number, targetSlot: number, out: HitRegion): boolean {
  const attacker = fighterAt(world, attackerSlot);
  const target = fighterAt(world, targetSlot);
  copyHitRegion(out, NO_HIT_REGION);
  const { attack } = attacker;

  if (attack.style === undefined) return false;

  const grabsDivine = attack.style === AttackStyle.grab && target.status.divineFrames > 0;
  if (attacker.status.out || attacker.launch.hitlag > 0 || target.status.out || (isIntangible(target) && !grabsDivine)) return false;
  if (attack.style === AttackStyle.grab && !canBeGrabbed(target)) return false;
  if (attack.style === AttackStyle.grab) {
    const startup = attackStartup(attacker, attack.style);
    const active = attackActive(attacker, attack.style);
    const region = attack.pivotGrab ? PIVOT_GRAB_REGION : attack.dashGrab ? DASH_GRAB_REGION : SHARED_GRAB_REGION;
    const hits = target.hits;
    if (attack.frame < startup || attack.frame >= startup + active || (hits.lastAttacker === attackerSlot && hits.lastAttackSerial === attack.serial && hits.lastWindow >= region.window)) return false;
    const localX = facingOffsetX(attacker, target);
    if (localX < 0 || localX > region.maxX) return false;
    placeStrikeCapsule(attacker, region);
    if (grabTouchesBody(strikeCapsule, target, grabTargetZ(attacker, target))) copyHitRegion(out, region);
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





export function beginFighterAttack(world: Roster, slot: number, style: AttackStyle | undefined, mayCharge: boolean): void {
  if (style === undefined) return;
  const fighter = fighterAt(world, slot);
  const { grounded } = fighter.motion;
  const chained = style === AttackStyle.jab ? jabChainStep(fighter) : undefined;
  if (chained !== undefined) {
    beginAttack(fighter, chained, false);
    return;
  }
  const action = fighter.tuning.moves !== undefined && style === AttackStyle.jab && grounded && fighter.ground.dashFrame > 0
    ? fighter.tuning.moves.dashAttack
    : fighter.character === Character.demonHunter && style === AttackStyle.jab && grounded && fighter.ground.dashFrame > 0
    ? AttackStyle.demonHunterDashAttack
    : style;
  const groundAttack = (action <= DASH_GRAB_REQUEST && action !== AttackStyle.shot) || action === AttackStyle.demonHunterDashAttack || action === AttackStyle.dashAttack || isJab(action);
  const aerial = isAerialAttack(action);
  if (((groundAttack && grounded) || action === AttackStyle.shot || (aerial && !grounded)) && canStartAttackStyle(fighter, action)) {
    const pivot = action === AttackStyle.grab && fighter.ground.action === GroundAction.turnRun;
    beginAttack(fighter, pivot ? DASH_GRAB_REQUEST : action, mayCharge);
    fighter.attack.pivotGrab = pivot;
  }
}


const scratch: {
  contacts: HitRegion[];
  styles: (AttackStyle | undefined)[];
  shots: boolean[];
  facings: number[];
  clashed: boolean[];
  choices: (number | undefined)[];
  grabbed: boolean[];

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
      attackCapsule(strikeCapsule, style, contact);
      const contactZ = f32(f.motion.z + f32(f32(strikeCapsule.z1 + strikeCapsule.z2) * 0.5));
      applyAttackHit(world, source, target, style, at(facings, source), contact.effect, true, meleeHitIntersectsShield(f, victim, contact), undefined, contactZ);
    }
  }
  if (ownsBatch) finishDamageContacts(world);
}
