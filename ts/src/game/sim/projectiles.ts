// Projectiles: spawning, flight, hits, shield blocks and reflections. Timing
// and trajectories are first-pass character-special tuning.
import { max, min } from "../../runtime/numbers";
import { roundToFloat32 } from "wisp/src/sim/binary32";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, ContactKind, ProjectileKind } from "./codes";
import { isIntangible } from "./conditions";
import { collectDamageContact, finishDamageContacts, openDamageContacts } from "./contacts";
import { type Fighter, PROJECTILE_CAPACITY, type Projectile } from "./fighter";
import { HitElement, copyHitEffect, emptyHitEffect } from "./hitRegions";
import { hurtCapsule } from "../physics/contactGeometry";
import { demonHunterParryIsActive, resolveDemonHunterParry } from "./hits";
import { attackDamage } from "./moves";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { type Roster, fighterAt, isActive } from "./roster";
import { SHIELD_PROJECTILE_DAMAGE_MULTIPLIER, SHIELD_PROJECTILE_SPEED_MULTIPLIER, SHIELD_REFLECTOR_RADIUS_FACTOR, shieldCircleIntersects } from "./shield";
import { at } from "wisp/src/runtime/lookup";
import { solidSurfaceAt, solidSurfaceCount, surfaceCount, surfaceLeft, surfacePass, surfaceRight, surfaceZ } from "./stage";

export const BLASTER_PROJECTILE_SPEED = 36.0;
export const BLASTER_PROJECTILE_LIFETIME = 60;
const BLASTER_PROJECTILE_HEIGHT = 75.0;
const BLASTER_PROJECTILE_HALF_HEIGHT = 36.0;
const BLASTER_PROJECTILE_RADIUS = 24.0;
const BLASTER_PROJECTILE_SPAWN_OFFSET = 35.0;
/** Height of a target's body center above its position. */
const TARGET_CENTER_HEIGHT = 45;

export function projectileCount(f: Fighter): number {
  let count = 0;
  for (const projectile of f.projectiles) if (projectile.life > 0) count++;
  return count;
}

export function projectileActive(f: Fighter, index: number): boolean {
  return index >= 0 && index < PROJECTILE_CAPACITY && at(f.projectiles, index).life > 0;
}

/** Launches from the owner's hand in the first free slot; a full owner fires nothing. */
export function spawnProjectileMotion(owner: Fighter, kind: ProjectileKind, velocityX: number, velocityZ: number, lifetime: number, serial: number): void {
  for (const projectile of owner.projectiles) {
    if (projectile.life > 0) continue;
    const direction = velocityX < 0 ? -1 : 1;
    projectile.direction = direction;
    projectile.kind = kind;
    projectile.visualFamily = owner.character;
    projectile.velocityX = velocityX;
    projectile.velocityZ = velocityZ;
    projectile.serial = serial;
    projectile.damageMultiplier = 1.0;
    projectile.newlyReflected = false;
    projectile.x = f32(owner.motion.x + f32(direction * BLASTER_PROJECTILE_SPAWN_OFFSET));
    projectile.z = f32(owner.motion.z + BLASTER_PROJECTILE_HEIGHT);
    projectile.life = lifetime;
    return;
  }
}

/** The Rifleman's attack shot. */
export function spawnProjectile(owner: Fighter): void {
  spawnProjectileMotion(owner, ProjectileKind.blaster, f32(owner.facing * BLASTER_PROJECTILE_SPEED), 0.0, BLASTER_PROJECTILE_LIFETIME, owner.attack.serial);
}

/** An arrow toward direction, or the owner's facing for zero. */
export function spawnArcherArrow(owner: Fighter, direction: number, verticalSpeed: number, kind: ProjectileKind, serial: number): void {
  const facing = direction === 0 ? owner.facing : direction > 0 ? 1 : -1;
  spawnProjectileMotion(owner, kind, f32(facing * BLASTER_PROJECTILE_SPEED), verticalSpeed, kind === ProjectileKind.arrow ? 75 : 65, serial);
}

// Preallocated: collected contacts copy it, so one record serves every hit.
const projectileHit = emptyHitEffect();

function applyProjectileHit(world: Roster, ownerSlot: number, targetSlot: number, projectile: Readonly<Projectile>, shieldContact: boolean): void {
  const target = fighterAt(world, targetSlot);
  if (demonHunterParryIsActive(target)) {
    resolveDemonHunterParry(target, fighterAt(world, ownerSlot), -projectile.direction);
    return;
  }
  const { spec } = projectile;
  if (projectile.kind === ProjectileKind.hero && spec !== undefined) {
    copyHitEffect(projectileHit, spec.effect);
    projectileHit.damage = roundToFloat32(f32(spec.effect.damage * projectile.damageMultiplier));
    collectDamageContact(world, ownerSlot, targetSlot, projectileHit, projectile.direction, ContactKind.launch, false, undefined, shieldContact, spec.status);
    return;
  }
  const { kind } = projectile;
  projectileHit.element = kind === ProjectileKind.manaBurn ? HitElement.electric : HitElement.normal;
  if (kind === ProjectileKind.blaster) {
    projectileHit.damage = roundToFloat32(f32(attackDamage(AttackStyle.shot) * projectile.damageMultiplier));
    projectileHit.growth = 0.0;
    projectileHit.base = 0.0;
    projectileHit.launchX = 0.0;
    projectileHit.launchZ = 0.0;
    collectDamageContact(world, ownerSlot, targetSlot, projectileHit, projectile.direction, ContactKind.flinch, false, undefined, shieldContact);
    return;
  }
  const damage = kind === ProjectileKind.fanArrow ? 4.0 : kind === ProjectileKind.recoil || kind === ProjectileKind.manaBurn ? 5.0 : 7.0;
  const damageOnly = kind === ProjectileKind.arrow || kind === ProjectileKind.fanArrow;
  projectileHit.damage = roundToFloat32(f32(damage * projectile.damageMultiplier));
  projectileHit.growth = 85.0;
  projectileHit.base = 16.0;
  projectileHit.launchX = 0.800000011920929;
  projectileHit.launchZ = kind === ProjectileKind.recoil ? -0.6000000238418579 : 0.6000000238418579;
  collectDamageContact(world, ownerSlot, targetSlot, projectileHit, projectile.direction,
    damageOnly ? ContactKind.damageOnly : ContactKind.launch, false, undefined, shieldContact);
}

/** Sends the projectile back from a reflecting shield, slower and weaker; false when the reflector has no free slot. */
function reflectProjectile(target: Fighter, source: Projectile): boolean {
  for (const reflected of target.projectiles) {
    if (reflected.life > 0) continue;
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
    source.life = 0;
    target.visuals.shieldReflect++;
    target.visuals.shieldElectric = source.kind === ProjectileKind.manaBurn;
    return true;
  }
  return false;
}

// Preallocated: target positions before any projectile resolves, sampled every frame.
const targets = {
  x: [0.0, 0.0, 0.0, 0.0],
  z: [0.0, 0.0, 0.0, 0.0],
  out: [false, false, false, false],
  intangible: [false, false, false, false],
};

/** Flies one projectile and returns the slot of the target it reaches, or undefined. */
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
  const lowZ = f32(min(oldZ, projectile.z) - BLASTER_PROJECTILE_HALF_HEIGHT);
  const highZ = f32(max(oldZ, projectile.z) + BLASTER_PROJECTILE_HALF_HEIGHT);
  let nearest: number | undefined;
  let distance = 0.0;
  for (let targetSlot = 0; targetSlot < PARTICIPANT_CAPACITY; targetSlot++) {
    if (!isActive(world, targetSlot) || targetSlot === ownerSlot || targets.out[targetSlot] || targets.intangible[targetSlot]) continue;
    const target = fighterAt(world, targetSlot);
    const targetX = at(targets.x, targetSlot);
    const centerZ = f32(at(targets.z, targetSlot) + TARGET_CENTER_HEIGHT);
    const crossed = f32(f32(targetX - oldX) * direction) >= 0 && f32(f32(targetX - projectile.x) * direction) <= 0;
    const near = Math.abs(f32(targetX - projectile.x)) <= BLASTER_PROJECTILE_RADIUS;
    const height = centerZ >= lowZ && centerZ <= highZ;
    const reflector = target.shield.reflectFrames > 0
      && shieldCircleIntersects(target, oldX, oldZ, projectile.x, projectile.z, SHIELD_REFLECTOR_RADIUS_FACTOR);
    const shieldContact = target.shield.raised && shieldCircleIntersects(target, oldX, oldZ, projectile.x, projectile.z, 1.0);
    const candidate = Math.abs(f32(targetX - oldX));
    if ((reflector || shieldContact || ((crossed || near) && height)) && (nearest === undefined || candidate < distance)) {
      nearest = targetSlot;
      distance = candidate;
      hit.reflector = reflector;
      hit.shield = shieldContact;
    }
  }
  return nearest;
}

/**
 * Flies a hero projectile, swept from its old position against each target's
 * standing body widened by its radius. It reaches nothing before its age
 * reaches `activeFrom`; a non-reflectable one meets a reflector as a shield.
 */
function flyHeroProjectile(world: Roster, ownerSlot: number, projectile: Projectile, hit: { reflector: boolean; shield: boolean }): number | undefined {
  const spec = projectile.spec;
  const oldX = projectile.x;
  const oldZ = projectile.z;
  projectile.x = f32(oldX + projectile.velocityX);
  projectile.z = f32(oldZ + projectile.velocityZ);
  projectile.life--;
  if (spec === undefined || spec.life - projectile.life <= (spec.activeFrom ?? 0) - 1) return undefined;
  const direction = projectile.velocityX < 0 ? -1 : projectile.velocityX > 0 ? 1 : projectile.direction;
  let nearest: number | undefined;
  let distance = 0.0;
  for (let targetSlot = 0; targetSlot < PARTICIPANT_CAPACITY; targetSlot++) {
    if (!isActive(world, targetSlot) || targetSlot === ownerSlot || targets.out[targetSlot] || targets.intangible[targetSlot]) continue;
    const target = fighterAt(world, targetSlot);
    const body = hurtCapsule(target.character);
    const targetX = at(targets.x, targetSlot);
    const targetZ = at(targets.z, targetSlot);
    const reach = f32(spec.radius + body.radius);
    const crossed = f32(f32(targetX - oldX) * direction) >= 0 && f32(f32(targetX - projectile.x) * direction) <= 0;
    const near = Math.abs(f32(targetX - projectile.x)) <= reach;
    const height = f32(max(oldZ, projectile.z) + reach) >= f32(targetZ + body.z1) && f32(min(oldZ, projectile.z) - reach) <= f32(targetZ + body.z2);
    // The shield takes the projectile at the same widened reach as the body, so a broad one never passes a raised shield.
    const reflector = spec.reflectable && target.shield.reflectFrames > 0
      && shieldCircleIntersects(target, oldX, oldZ, projectile.x, projectile.z, SHIELD_REFLECTOR_RADIUS_FACTOR, spec.radius);
    const shieldContact = target.shield.raised && shieldCircleIntersects(target, oldX, oldZ, projectile.x, projectile.z, 1.0, spec.radius);
    const candidate = Math.abs(f32(targetX - oldX));
    if ((reflector || shieldContact || ((crossed || near) && height)) && (nearest === undefined || candidate < distance)) {
      nearest = targetSlot;
      distance = candidate;
      hit.reflector = reflector;
      hit.shield = shieldContact;
    }
  }
  return nearest;
}

/** Whether segments p1-p2 and q1-q2 cross or touch. */
function segmentsMeet(p1x: number, p1z: number, p2x: number, p2z: number, q1x: number, q1z: number, q2x: number, q2z: number): boolean {
  const side = (ax: number, az: number, bx: number, bz: number, cx: number, cz: number) =>
    f32(f32(f32(bx - ax) * f32(cz - az)) - f32(f32(bz - az) * f32(cx - ax)));
  const d1 = side(q1x, q1z, q2x, q2z, p1x, p1z);
  const d2 = side(q1x, q1z, q2x, q2z, p2x, p2z);
  const d3 = side(p1x, p1z, p2x, p2z, q1x, q1z);
  const d4 = side(p1x, p1z, p2x, p2z, q2x, q2z);
  return ((d1 <= 0 && d2 >= 0) || (d1 >= 0 && d2 <= 0)) && ((d3 <= 0 && d4 >= 0) || (d3 >= 0 && d4 <= 0))
    && !(d1 === 0 && d2 === 0 && d3 === 0 && d4 === 0);
}

/**
 * Whether a hero projectile's step from (oldX, oldZ) to (x, z) meets solid
 * stage: a wall or underside line, or a solid deck's top from above. Pass
 * decks let projectiles through.
 */
function projectileMeetsStage(stage: number, matchFrame: number, oldX: number, oldZ: number, x: number, z: number): boolean {
  for (let i = 0; i < solidSurfaceCount(stage); i++) {
    const surface = solidSurfaceAt(stage, i);
    if (segmentsMeet(oldX, oldZ, x, z, surface.startX, surface.startZ, surface.endX, surface.endZ)) return true;
  }
  for (let i = 0; i < surfaceCount(stage); i++) {
    if (surfacePass(stage, i)) continue;
    const top = surfaceZ(stage, i, matchFrame);
    if (!(oldZ >= top && z < top)) continue;
    const fraction = f32(f32(oldZ - top) / f32(oldZ - z));
    const crossingX = f32(oldX + f32(f32(x - oldX) * fraction));
    if (crossingX >= surfaceLeft(stage, i, matchFrame) && crossingX <= surfaceRight(stage, i, matchFrame)) return true;
  }
  return false;
}

// Preallocated: rollback replays fly projectiles every frame.
const selected = { reflector: false, shield: false };

/**
 * Advances every projectile against target positions sampled before any
 * resolves. A projectile stops at the nearest target it reaches: a reflecting
 * shield sends it back, anything else takes the hit.
 */
export function updateProjectiles(world: Roster, stage?: number, matchFrame = 0): void {
  const ownsBatch = openDamageContacts();
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot)) continue;
    const target = fighterAt(world, slot);
    targets.x[slot] = target.motion.x;
    targets.z[slot] = target.motion.z;
    targets.out[slot] = target.status.out;
    targets.intangible[slot] = isIntangible(target);
  }
  for (let ownerSlot = 0; ownerSlot < PARTICIPANT_CAPACITY; ownerSlot++) {
    if (!isActive(world, ownerSlot)) continue;
    const owner = fighterAt(world, ownerSlot);
    for (const projectile of owner.projectiles) {
      if (projectile.life <= 0 || projectile.newlyReflected) continue;
      selected.reflector = false;
      selected.shield = false;
      const fromX = projectile.x;
      const fromZ = projectile.z;
      const nearest = projectile.kind === ProjectileKind.hero ? flyHeroProjectile(world, ownerSlot, projectile, selected) : flyProjectile(world, ownerSlot, projectile, selected);
      if (nearest === undefined && stage !== undefined && projectile.kind === ProjectileKind.hero
        && projectileMeetsStage(stage, matchFrame, fromX, fromZ, projectile.x, projectile.z)) {
        projectile.life = 0;
        continue;
      }
      if (nearest !== undefined) {
        if (!(selected.reflector && reflectProjectile(fighterAt(world, nearest), projectile))) {
          applyProjectileHit(world, ownerSlot, nearest, projectile, selected.shield);
        }
        projectile.life = 0;
      } else if (projectile.life <= 0) {
        projectile.life = 0;
      }
    }
  }
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot)) continue;
    for (const projectile of fighterAt(world, slot).projectiles) projectile.newlyReflected = false;
  }
  if (ownsBatch) finishDamageContacts(world);
}
