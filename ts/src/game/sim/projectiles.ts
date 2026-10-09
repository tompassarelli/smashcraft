

import { max, min } from "../../runtime/numbers";
import { roundToFloat32 } from "wisp/src/sim/binary32";
import { meleeCos, meleeSin } from "../../sim/meleeScalarMath";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, ContactKind, HeroStatusGroup, HeroStatusKind, ProjectileKind } from "./codes";
import type { AppliedStatus } from "./heroStatus";
import { isIntangible } from "./conditions";
import { collectDamageContact, finishDamageContacts, openDamageContacts } from "./contacts";
import { type Fighter, PROJECTILE_CAPACITY, type Projectile } from "./fighter";
import { mutableProjectile } from "./fighterProjectiles";
import { type HitEffect, HitElement, copyHitEffect, emptyHitEffect } from "./hitRegions";
import type { SpecialProjectile } from "./heroSpecials";
import { capsulesIntersect, emptyCapsule, hurtCapsule, placeCapsule, segmentBoxesOverlap } from "../physics/contactGeometry";
import { RIFLEMAN_BLASTER_GROUND_DAMAGE_MULTIPLIER, attackDamage } from "./moves";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { type Roster, fighterAt, isActive } from "./roster";
import { SHIELD_PROJECTILE_DAMAGE_MULTIPLIER, SHIELD_PROJECTILE_SPEED_MULTIPLIER, grantParry, shieldCircleIntersects } from "./shield";
import { at } from "wisp/src/runtime/lookup";
import { solidSurfaceAt, solidSurfaceCount, surfaceCount, surfaceLeft, surfaceLine, surfacePass, surfaceRight, surfaceZ } from "./stage";

export const BLASTER_PROJECTILE_SPEED = 36.0;
export const BLASTER_PROJECTILE_LIFETIME = 60;
export const BLASTER_PROJECTILE_HEIGHT = 75.0;
export const BLASTER_AIR_SHOT_HEIGHT = 30.0;
const BLASTER_PROJECTILE_HALF_HEIGHT = 36.0;
export const BLASTER_PROJECTILE_RADIUS = 24.0;
export const BLASTER_PROJECTILE_SPAWN_OFFSET = 35.0;

const TARGET_CENTER_HEIGHT = 45;
const DEGREES_TO_RADIANS = 0.01745329238474369;

export function projectileCount(f: Fighter): number {
  let count = 0;
  for (const projectile of f.projectiles) if (projectile.life > 0) count++;
  return count;
}

export function projectileActive(f: Fighter, index: number): boolean {
  return index >= 0 && index < PROJECTILE_CAPACITY && at(f.projectiles, index).life > 0;
}


export function spawnProjectileMotion(owner: Fighter, kind: ProjectileKind, velocityX: number, velocityZ: number, lifetime: number, serial: number,
  damageMultiplier = 1.0, height = BLASTER_PROJECTILE_HEIGHT): Projectile | undefined {
  let index = -1;
  for (const before of owner.projectiles) {
    index++;
    if (before.life > 0) continue;
    const projectile = mutableProjectile(owner, index);
    const direction = velocityX < 0 ? -1 : 1;
    projectile.direction = direction;
    projectile.kind = kind;
    projectile.visualFamily = owner.character;
    projectile.velocityX = velocityX;
    projectile.velocityZ = velocityZ;
    projectile.serial = serial;
    projectile.damageMultiplier = damageMultiplier;
    projectile.newlyReflected = false;
    projectile.exReach = kind === ProjectileKind.manaBurn && owner.special.ex;
    projectile.x = f32(owner.motion.x + f32(direction * BLASTER_PROJECTILE_SPAWN_OFFSET));
    projectile.z = f32(owner.motion.z + height);
    projectile.life = lifetime;
    return projectile;
  }
  return undefined;
}






export function spawnBlasterShot(owner: Fighter, serial: number, grounded: boolean): void {
  spawnProjectileMotion(owner, ProjectileKind.blaster, f32(owner.facing * BLASTER_PROJECTILE_SPEED), 0.0, BLASTER_PROJECTILE_LIFETIME, serial,
    f32((grounded ? RIFLEMAN_BLASTER_GROUND_DAMAGE_MULTIPLIER : 1.0) * (owner.special.ex ? 1.25 : 1.0)), grounded ? BLASTER_PROJECTILE_HEIGHT : BLASTER_AIR_SHOT_HEIGHT);
}


export function spawnProjectile(owner: Fighter): void {
  spawnProjectileMotion(owner, ProjectileKind.blaster, f32(owner.facing * BLASTER_PROJECTILE_SPEED), 0.0, BLASTER_PROJECTILE_LIFETIME, owner.attack.serial);
}

const facingOf = (owner: Fighter, direction: number): number => (direction === 0 ? owner.facing : direction > 0 ? 1 : -1);








export const MANA_BURN_STUN: Readonly<AppliedStatus> = {
  kind: HeroStatusKind.stun, frames: 15, group: HeroStatusGroup.sleep, immunityFrames: 300,
  drain: { mana: 25, emptyFrames: 45 },
};


const projectileHit = emptyHitEffect();





export function heroProjectileReturning(projectile: Readonly<Projectile>): boolean {
  const spec = projectile.spec;
  return spec?.returns !== undefined && projectile.damageMultiplier === 1.0 && spec.life - projectile.life >= spec.returns.age;
}


export function heroProjectileRadius(projectile: Readonly<Projectile>, spec: Readonly<SpecialProjectile>): number {
  const pool = spec.pool;
  if (pool === undefined || projectile.poolHits === 0) return spec.radius;
  return min(pool.maxRadius, f32(spec.radius + f32(projectile.poolHits * pool.growth)));
}


function heroProjectileEffect(projectile: Readonly<Projectile>, spec: Readonly<SpecialProjectile>): Readonly<HitEffect> {
  return heroProjectileReturning(projectile) ? spec.returnEffect ?? spec.effect : spec.effect;
}


export function projectileDamage(projectile: Readonly<Projectile>): number {
  const { kind, spec } = projectile;
  const damage = kind === ProjectileKind.hero && spec !== undefined ? heroProjectileEffect(projectile, spec).damage
    : kind === ProjectileKind.blaster ? attackDamage(AttackStyle.shot)
      : kind === ProjectileKind.recoil || kind === ProjectileKind.manaBurn ? 5.0 : 7.0;
  return roundToFloat32(f32(damage * projectile.damageMultiplier));
}


export function originalProjectileEffect(projectile: Readonly<Projectile>): Readonly<HitEffect> {
  const { kind } = projectile;
  projectileHit.element = kind === ProjectileKind.manaBurn ? HitElement.electric : HitElement.normal;
  projectileHit.electric = false;
  projectileHit.carry = undefined;
  projectileHit.manaDrain = undefined;
  projectileHit.manaSteal = undefined;
  projectileHit.damage = projectileDamage(projectile);
  if (kind === ProjectileKind.blaster || kind === ProjectileKind.manaBurn) {
    projectileHit.growth = 0.0;
    projectileHit.base = 0.0;
    projectileHit.launchX = 0.0;
    projectileHit.launchZ = 0.0;
  } else {
    projectileHit.growth = 85.0;
    projectileHit.base = 16.0;
    projectileHit.launchX = 0.800000011920929;
    projectileHit.launchZ = kind === ProjectileKind.recoil ? -0.6000000238418579 : 0.6000000238418579;
  }
  return projectileHit;
}

function applyProjectileHit(world: Roster, ownerSlot: number, targetSlot: number, projectile: Readonly<Projectile>, shieldContact: boolean): void {
  const target = fighterAt(world, targetSlot);
  const { spec } = projectile;
  if (projectile.kind === ProjectileKind.hero && spec !== undefined) {
    copyHitEffect(projectileHit, heroProjectileEffect(projectile, spec));
    projectileHit.damage = projectileDamage(projectile);
    collectDamageContact(world, ownerSlot, targetSlot, projectileHit, projectile.direction, ContactKind.launch, false, undefined, shieldContact, spec.status, projectile.z);
    return;
  }
  const { kind } = projectile;
  const effect = originalProjectileEffect(projectile);
  const flinch = kind === ProjectileKind.blaster || kind === ProjectileKind.manaBurn;
  collectDamageContact(world, ownerSlot, targetSlot, effect, projectile.direction,
    flinch ? ContactKind.flinch : ContactKind.launch, false, undefined, shieldContact,
    kind === ProjectileKind.manaBurn ? MANA_BURN_STUN : undefined, projectile.z);
}


function reflectProjectile(target: Fighter, source: Projectile): boolean {
  let index = -1;
  for (const before of target.projectiles) {
    index++;
    if (before.life > 0) continue;
    const reflected = mutableProjectile(target, index);
    reflected.x = source.x;
    reflected.z = source.z;
    reflected.velocityX = roundToFloat32(-f32(source.velocityX * SHIELD_PROJECTILE_SPEED_MULTIPLIER));
    reflected.velocityZ = roundToFloat32(f32(source.velocityZ * SHIELD_PROJECTILE_SPEED_MULTIPLIER));
    reflected.direction = reflected.velocityX < 0 ? -1 : 1;
    reflected.kind = source.kind;
    reflected.spec = source.spec;
    reflected.visualFamily = source.visualFamily;
    reflected.serial = source.serial;
    reflected.damageMultiplier = roundToFloat32(f32(source.damageMultiplier * SHIELD_PROJECTILE_DAMAGE_MULTIPLIER));
    reflected.life = source.life;
    reflected.newlyReflected = true;
    reflected.exReach = source.exReach;
    reflected.poolHits = 0;
    reflected.poolWait = 0;
    source.life = 0;
    target.visuals.shieldReflect++;
    target.visuals.shieldElectric = source.kind === ProjectileKind.manaBurn;
    grantParry(target);
    return true;
  }
  return false;
}


const targets = {
  x: [0.0, 0.0, 0.0, 0.0],
  z: [0.0, 0.0, 0.0, 0.0],
  out: [false, false, false, false],
  intangible: [false, false, false, false],

  reflecting: [false, false, false, false],
};


function flyProjectile(world: Roster, ownerSlot: number, projectile: Projectile, hit: { reflector: boolean; shield: boolean }): number | undefined {
  const oldX = projectile.x;
  const oldZ = projectile.z;
  let velocityX = projectile.velocityX;
  const velocityZ = projectile.velocityZ;
  if (projectile.kind === ProjectileKind.blaster && velocityX === 0) {
    velocityX = f32(projectile.direction * BLASTER_PROJECTILE_SPEED);
    projectile.velocityX = velocityX;
  }
  projectile.x = f32(oldX + velocityX);
  projectile.z = f32(oldZ + velocityZ);
  projectile.life--;
  const direction = velocityX < 0 ? -1 : 1;
  const radius = f32(BLASTER_PROJECTILE_RADIUS * (projectile.exReach ? 1.25 : 1.0));
  const halfHeight = f32(BLASTER_PROJECTILE_HALF_HEIGHT * (projectile.exReach ? 1.25 : 1.0));
  const lowZ = f32(min(oldZ, projectile.z) - halfHeight);
  const highZ = f32(max(oldZ, projectile.z) + halfHeight);
  let nearest: number | undefined;
  let distance = 0.0;
  for (let targetSlot = 0; targetSlot < PARTICIPANT_CAPACITY; targetSlot++) {
    if (!isActive(world, targetSlot) || targetSlot === ownerSlot || targets.out[targetSlot] || targets.intangible[targetSlot]) continue;
    const target = fighterAt(world, targetSlot);
    const targetX = at(targets.x, targetSlot);
    const centerZ = f32(at(targets.z, targetSlot) + TARGET_CENTER_HEIGHT);
    const crossed = f32(f32(targetX - oldX) * direction) >= 0 && f32(f32(targetX - projectile.x) * direction) <= 0;
    const near = Math.abs(f32(targetX - projectile.x)) <= radius;

    const blaster = projectile.kind === ProjectileKind.blaster;
    const body = hurtCapsule(target.character);
    const targetZ = at(targets.z, targetSlot);
    const reach = f32(BLASTER_PROJECTILE_RADIUS + body.radius);
    const height = blaster
      ? f32(max(oldZ, projectile.z) + reach) >= f32(targetZ + body.z1) && f32(min(oldZ, projectile.z) - reach) <= f32(targetZ + body.z2)
      : centerZ >= lowZ && centerZ <= highZ;
    const shieldContact = target.shield.raised
      && shieldCircleIntersects(target, oldX, oldZ, projectile.x, projectile.z, 1.0, blaster ? BLASTER_PROJECTILE_RADIUS : projectile.exReach ? f32(BLASTER_PROJECTILE_RADIUS * 0.25) : 0.0);
    const reflector = shieldContact && at(targets.reflecting, targetSlot);
    const candidate = Math.abs(f32(targetX - oldX));
    if ((shieldContact || ((crossed || near) && height)) && (nearest === undefined || candidate < distance)) {
      nearest = targetSlot;
      distance = candidate;
      hit.reflector = reflector;
      hit.shield = shieldContact;
    }
  }
  return nearest;
}


function catchHeal(owner: Fighter, spec: Readonly<SpecialProjectile> | undefined): void {
  const heal = spec?.catchHeal;
  if (heal === undefined) return;
  const { status } = owner;
  const restored = min(heal.heal, max(0.0, status.damage));
  status.damage = f32(status.damage - restored);
}





function returnToOwner(owner: Fighter, projectile: Projectile, speed: number): boolean {
  const dx = f32(owner.motion.x - projectile.x);
  const dz = f32(f32(owner.motion.z + TARGET_CENTER_HEIGHT) - projectile.z);
  if (owner.status.out || (Math.abs(dx) <= speed && Math.abs(dz) <= speed)) {
    if (!owner.status.out) catchHeal(owner, projectile.spec);
    projectile.life = 0;
    return false;
  }
  projectile.velocityX = dx < 0 ? -speed : speed;
  projectile.velocityZ = min(speed, max(-speed, dz));
  projectile.direction = dx < 0 ? -1 : 1;
  return true;
}






/** Turns a projectile's vertical speed toward the nearest opponent ahead of it, by at most `turn` a frame. */
function homeProjectile(world: Roster, ownerSlot: number, projectile: Projectile, turn: number, maxRise: number): void {
  const direction = projectile.velocityX < 0 ? -1 : projectile.velocityX > 0 ? 1 : projectile.direction;
  let aim: number | undefined;
  let distance = 0.0;
  for (let targetSlot = 0; targetSlot < PARTICIPANT_CAPACITY; targetSlot++) {
    if (!isActive(world, targetSlot) || targetSlot === ownerSlot || targets.out[targetSlot]) continue;
    const ahead = f32(f32(at(targets.x, targetSlot) - projectile.x) * direction);
    if (ahead < 0.0 || (aim !== undefined && ahead >= distance)) continue;
    aim = f32(at(targets.z, targetSlot) + TARGET_CENTER_HEIGHT);
    distance = ahead;
  }
  if (aim === undefined) return;
  const desired = min(maxRise, max(-maxRise, f32(f32(aim - projectile.z) * 0.125)));
  projectile.velocityZ = f32(projectile.velocityZ + min(turn, max(-turn, f32(desired - projectile.velocityZ))));
}

const heroFlight = emptyCapsule();
const heroTarget = emptyCapsule();
function flyHeroProjectile(world: Roster, ownerSlot: number, projectile: Projectile, hit: { reflector: boolean; shield: boolean }): number | undefined {
  const spec = projectile.spec;

  if (spec?.returns !== undefined && projectile.damageMultiplier === 1.0 && spec.life - projectile.life >= spec.returns.age && !returnToOwner(fighterAt(world, ownerSlot), projectile, spec.returns.speed)) return undefined;
  const oldX = projectile.x;
  const oldZ = projectile.z;
  if (spec?.homing !== undefined) homeProjectile(world, ownerSlot, projectile, spec.homing.turn, spec.homing.maxRise);
  if (spec?.gravity !== undefined) projectile.velocityZ = f32(projectile.velocityZ - spec.gravity);
  projectile.x = f32(oldX + projectile.velocityX);
  projectile.z = f32(oldZ + projectile.velocityZ);
  projectile.life--;
  if (projectile.poolWait > 0) {
    projectile.poolWait--;
    return undefined;
  }
  if (spec === undefined || spec.life - projectile.life <= (spec.activeFrom ?? 0) - 1) return undefined;
  const radius = heroProjectileRadius(projectile, spec);
  heroFlight.x1 = oldX;
  heroFlight.z1 = oldZ;
  heroFlight.x2 = projectile.x;
  heroFlight.z2 = projectile.z;
  heroFlight.radius = radius;
  const direction = projectile.velocityX < 0 ? -1 : projectile.velocityX > 0 ? 1 : projectile.direction;
  let nearest: number | undefined;
  let distance = 0.0;
  for (let targetSlot = 0; targetSlot < PARTICIPANT_CAPACITY; targetSlot++) {
    if (!isActive(world, targetSlot) || targetSlot === ownerSlot || targets.out[targetSlot] || targets.intangible[targetSlot]) continue;
    const target = fighterAt(world, targetSlot);
    const body = hurtCapsule(target.character);
    const targetX = at(targets.x, targetSlot);
    const targetZ = at(targets.z, targetSlot);

    if (spec.pool !== undefined && !target.motion.grounded) continue;
    const reach = f32(radius + body.radius);
    const crossed = f32(f32(targetX - oldX) * direction) >= 0 && f32(f32(targetX - projectile.x) * direction) <= 0;
    const near = Math.abs(f32(targetX - projectile.x)) <= reach;
    const height = f32(max(oldZ, projectile.z) + reach) >= f32(targetZ + body.z1) && f32(min(oldZ, projectile.z) - reach) <= f32(targetZ + body.z2);

    const shieldContact = target.shield.raised && shieldCircleIntersects(target, oldX, oldZ, projectile.x, projectile.z, 1.0, radius);
    const reflector = spec.reflectable && shieldContact && at(targets.reflecting, targetSlot);
    const candidate = Math.abs(f32(targetX - oldX));
    const bodyContact = (crossed || near) && height
      && capsulesIntersect(heroFlight, placeCapsule(heroTarget, body, targetX, targetZ, target.facing));
    if ((shieldContact || bodyContact) && (nearest === undefined || candidate < distance)) {
      nearest = targetSlot;
      distance = candidate;
      hit.reflector = reflector;
      hit.shield = shieldContact;
    }
  }
  return nearest;
}


function side(ax: number, az: number, bx: number, bz: number, cx: number, cz: number): number {
  return f32(f32(f32(bx - ax) * f32(cz - az)) - f32(f32(bz - az) * f32(cx - ax)));
}


function segmentsMeet(p1x: number, p1z: number, p2x: number, p2z: number, q1x: number, q1z: number, q2x: number, q2z: number): boolean {
  if (!segmentBoxesOverlap(p1x, p1z, p2x, p2z, q1x, q1z, q2x, q2z)) return false;
  const d1 = side(q1x, q1z, q2x, q2z, p1x, p1z);
  const d2 = side(q1x, q1z, q2x, q2z, p2x, p2z);

  if (!((d1 <= 0 && d2 >= 0) || (d1 >= 0 && d2 <= 0))) return false;
  const d3 = side(p1x, p1z, p2x, p2z, q1x, q1z);
  const d4 = side(p1x, p1z, p2x, p2z, q2x, q2z);
  return ((d3 <= 0 && d4 >= 0) || (d3 >= 0 && d4 <= 0)) && !(d1 === 0 && d2 === 0 && d3 === 0 && d4 === 0);
}






function projectileMeetsStage(stage: number, matchFrame: number, oldX: number, oldZ: number, x: number, z: number): boolean {
  for (let i = 0; i < solidSurfaceCount(stage); i++) {
    const surface = solidSurfaceAt(stage, i);
    if (segmentsMeet(oldX, oldZ, x, z, surface.startX, surface.startZ, surface.endX, surface.endZ)) return true;
  }
  for (let i = 0; i < surfaceCount(stage); i++) {
    if (surfacePass(stage, i)) continue;
    const line = surfaceLine(stage, i);
    if (line !== undefined) {
      for (let k = 0; k < line.grades.length; k++) {
        const fromX = line.xs[k] ?? 0.0;
        const toX = line.xs[k + 1] ?? 0.0;
        if (segmentsMeet(oldX, oldZ, x, z, fromX, line.zs[k] ?? 0.0, toX, line.zs[k + 1] ?? 0.0)) return true;
      }
      continue;
    }
    const top = surfaceZ(stage, i, matchFrame);
    if (!(oldZ >= top && z < top)) continue;
    const fraction = f32(f32(oldZ - top) / f32(oldZ - z));
    const crossingX = f32(oldX + f32(f32(x - oldX) * fraction));
    if (crossingX >= surfaceLeft(stage, i, matchFrame) && crossingX <= surfaceRight(stage, i, matchFrame)) return true;
  }
  return false;
}


function projectilesMeet(a: Readonly<Projectile>, b: Readonly<Projectile>): boolean {
  const reachX = f32(BLASTER_PROJECTILE_RADIUS + (b.spec?.radius ?? BLASTER_PROJECTILE_RADIUS));
  const reachZ = f32(BLASTER_PROJECTILE_HALF_HEIGHT + (b.spec?.radius ?? BLASTER_PROJECTILE_HALF_HEIGHT));
  const before = f32(a.x - b.x);
  const after = f32(f32(a.x + a.velocityX) - f32(b.x + b.velocityX));
  const crossed = (before <= 0 && after >= 0) || (before >= 0 && after <= 0) || Math.abs(after) <= reachX;
  return crossed && Math.abs(f32(f32(a.z + a.velocityZ) - f32(b.z + b.velocityZ))) <= reachZ;
}






function clashManaBurns(world: Roster): void {
  for (let ownerSlot = 0; ownerSlot < PARTICIPANT_CAPACITY; ownerSlot++) {
    if (!isActive(world, ownerSlot)) continue;
    const owner = fighterAt(world, ownerSlot);
    let index = -1;
    for (const orb of owner.projectiles) {
      index++;
      if (orb.life <= 0 || orb.kind !== ProjectileKind.manaBurn) continue;
      let clashed = false;
      for (let otherSlot = 0; otherSlot < PARTICIPANT_CAPACITY && !clashed; otherSlot++) {
        if (otherSlot === ownerSlot || !isActive(world, otherSlot)) continue;
        const opponent = fighterAt(world, otherSlot);
        let otherIndex = -1;
        for (const other of opponent.projectiles) {
          otherIndex++;
          if (other.life <= 0 || (other.spec !== undefined && !other.spec.reflectable) || !projectilesMeet(orb, other)) continue;
          mutableProjectile(owner, index).life = 0;
          mutableProjectile(opponent, otherIndex).life = 0;
          clashed = true;
          break;
        }
      }
    }
  }
}


const selected = { reflector: false, shield: false };






export function updateProjectiles(world: Roster, stage?: number, matchFrame = 0): void {
  const ownsBatch = openDamageContacts();
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot)) continue;
    const target = fighterAt(world, slot);
    targets.x[slot] = target.motion.x;
    targets.z[slot] = target.motion.z;
    targets.out[slot] = target.status.out;
    targets.intangible[slot] = isIntangible(target);
    targets.reflecting[slot] = target.shield.reflectFrames > 0;
  }
  clashManaBurns(world);
  for (let ownerSlot = 0; ownerSlot < PARTICIPANT_CAPACITY; ownerSlot++) {
    if (!isActive(world, ownerSlot)) continue;
    const owner = fighterAt(world, ownerSlot);
    let index = -1;
    for (const before of owner.projectiles) {
      index++;
      if (before.life <= 0 || before.newlyReflected) continue;
      const projectile = mutableProjectile(owner, index);
      selected.reflector = false;
      selected.shield = false;
      const fromX = projectile.x;
      const fromZ = projectile.z;
      const nearest = projectile.kind === ProjectileKind.hero ? flyHeroProjectile(world, ownerSlot, projectile, selected) : flyProjectile(world, ownerSlot, projectile, selected);
      if (nearest === undefined && stage !== undefined && (projectile.kind === ProjectileKind.hero)
        && projectileMeetsStage(stage, matchFrame, fromX, fromZ, projectile.x, projectile.z)) {
        projectile.life = 0;
        continue;
      }
      const pool = projectile.kind === ProjectileKind.hero ? projectile.spec?.pool : undefined;
      if (nearest !== undefined && pool !== undefined) {

        applyProjectileHit(world, ownerSlot, nearest, projectile, selected.shield);
        projectile.poolWait = pool.every - 1;
        if (!selected.shield) projectile.poolHits++;
      } else if (nearest !== undefined) {
        const burst = projectile.kind === ProjectileKind.hero ? projectile.spec?.burstInto : undefined;
        if (!(selected.reflector && reflectProjectile(fighterAt(world, nearest), projectile))) {
          if (burst !== undefined) projectile.spec = burst;
          applyProjectileHit(world, ownerSlot, nearest, projectile, selected.shield);
          if (burst !== undefined) {
            projectile.velocityX = 0.0;
            projectile.velocityZ = 0.0;
            projectile.life = burst.life + 1;
          }
        }
        projectile.life--;
        if (burst === undefined || projectile.spec !== burst) projectile.life = 0;
      }
      if (projectile.life <= 0) {
        projectile.life = 0;
        projectile.poolHits = 0;
        projectile.poolWait = 0;
      }
    }
  }
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot)) continue;
    const fighter = fighterAt(world, slot);
    let index = -1;
    for (const projectile of fighter.projectiles) {
      index++;
      if (projectile.newlyReflected) mutableProjectile(fighter, index).newlyReflected = false;
    }
  }
  if (ownsBatch) finishDamageContacts(world);
}
