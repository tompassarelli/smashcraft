// Projectiles: spawning, flight, hits, shield blocks and reflections. Timing
// and trajectories are first-pass character-special tuning.
import { max, min } from "../../runtime/numbers";
import { roundToFloat32 } from "wisp/src/sim/binary32";
import { meleeCos, meleeSin } from "../../sim/meleeScalarMath";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, ContactKind, HeroStatusGroup, HeroStatusKind, ProjectileKind } from "./codes";
import type { AppliedStatus } from "./heroStatus";
import { isIntangible } from "./conditions";
import { collectDamageContact, finishDamageContacts, openDamageContacts } from "./contacts";
import { type Fighter, PROJECTILE_CAPACITY, type Projectile } from "./fighter";
import { type HitEffect, HitElement, copyHitEffect, emptyHitEffect } from "./hitRegions";
import type { SpecialProjectile } from "./heroSpecials";
import { hurtCapsule, segmentBoxesOverlap } from "../physics/contactGeometry";
import { RIFLEMAN_BLASTER_GROUND_DAMAGE_MULTIPLIER, attackDamage } from "./moves";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { type Roster, fighterAt, isActive } from "./roster";
import { SHIELD_PROJECTILE_DAMAGE_MULTIPLIER, SHIELD_PROJECTILE_SPEED_MULTIPLIER, grantParry, shieldCircleIntersects } from "./shield";
import { at } from "wisp/src/runtime/lookup";
import { solidSurfaceAt, solidSurfaceCount, surfaceCount, surfaceLeft, surfaceLine, surfacePass, surfaceRight, surfaceZ } from "./stage";
import { LONG_RIFLE_LIFE, longRifleShot, projectileOrigin } from "./passives";

export const BLASTER_PROJECTILE_SPEED = 36.0;
export const BLASTER_PROJECTILE_LIFETIME = 60;
export const BLASTER_PROJECTILE_HEIGHT = 75.0;
export const BLASTER_AIR_SHOT_HEIGHT = 30.0;
const BLASTER_PROJECTILE_HALF_HEIGHT = 36.0;
export const BLASTER_PROJECTILE_RADIUS = 24.0;
export const BLASTER_PROJECTILE_SPAWN_OFFSET = 35.0;
export const ARCHER_ARROW_DAMAGE = 5.0;
export const ARCHER_ARROW_SPEED = 28.0;
export const ARCHER_ARROW_LIFETIME = 45;
/** A centered arrow meets a held shield instead of slipping above its shrinking edge. */
export const ARCHER_ARROW_HEIGHT = 45.0;
/** Height of a target's body center above its position. */
const TARGET_CENTER_HEIGHT = 45;
/** Archer's homing arrow (side special): slower than his arrow, so a jump timed as it closes in leaves it behind. */
export const HOMING_ARROW_SPEED = 22.0;
export const HOMING_ARROW_LIFETIME = 75;
/** The most it turns toward its target in one frame. */
export const HOMING_ARROW_TURN_DEGREES = 2.5;
/** It never climbs or dives steeper than this, so it can't turn back or drop onto a target from above. */
export const HOMING_ARROW_MAX_PITCH_DEGREES = 50.0;
const DEGREES_TO_RADIANS = 0.01745329238474369;
const HOMING_TURN_COS = meleeCos(f32(HOMING_ARROW_TURN_DEGREES * DEGREES_TO_RADIANS));
const HOMING_TURN_SIN = meleeSin(f32(HOMING_ARROW_TURN_DEGREES * DEGREES_TO_RADIANS));
const HOMING_MAX_PITCH_TAN = f32(meleeSin(f32(HOMING_ARROW_MAX_PITCH_DEGREES * DEGREES_TO_RADIANS)) / meleeCos(f32(HOMING_ARROW_MAX_PITCH_DEGREES * DEGREES_TO_RADIANS)));

export function projectileCount(f: Fighter): number {
  let count = 0;
  for (const projectile of f.projectiles) if (projectile.life > 0) count++;
  return count;
}

export function projectileActive(f: Fighter, index: number): boolean {
  return index >= 0 && index < PROJECTILE_CAPACITY && at(f.projectiles, index).life > 0;
}

/** Launches from the owner's hand in the first free slot, `height` above its feet; a full owner fires nothing. */
export function spawnProjectileMotion(owner: Fighter, kind: ProjectileKind, velocityX: number, velocityZ: number, lifetime: number, serial: number,
  damageMultiplier = 1.0, height = BLASTER_PROJECTILE_HEIGHT): Projectile | undefined {
  for (const projectile of owner.projectiles) {
    if (projectile.life > 0) continue;
    const direction = velocityX < 0 ? -1 : 1;
    projectile.direction = direction;
    projectile.kind = kind;
    projectile.visualFamily = owner.character;
    projectile.velocityX = velocityX;
    projectile.velocityZ = velocityZ;
    projectile.serial = serial;
    projectile.damageMultiplier = damageMultiplier;
    projectile.newlyReflected = false;
    projectile.longRifle = false;
    projectile.x = f32(owner.motion.x + f32(direction * BLASTER_PROJECTILE_SPAWN_OFFSET));
    projectile.z = f32(owner.motion.z + height);
    projectile.life = lifetime;
    return projectile;
  }
  return undefined;
}

/**
 * Rifleman's blaster shot. A grounded shot leaves from the shoulder and hits
 * harder; an aerial one leaves from the hip, so a short-hop shot meets a
 * standing body and a full shield (#117).
 */
export function spawnBlasterShot(owner: Fighter, serial: number, grounded: boolean): void {
  const shot = spawnProjectileMotion(owner, ProjectileKind.blaster, f32(owner.facing * BLASTER_PROJECTILE_SPEED), 0.0, BLASTER_PROJECTILE_LIFETIME, serial,
    grounded ? RIFLEMAN_BLASTER_GROUND_DAMAGE_MULTIPLIER : 1.0, grounded ? BLASTER_PROJECTILE_HEIGHT : BLASTER_AIR_SHOT_HEIGHT);
  // Long Rifles counts the shots that leave the barrel; every fourth flies farther and launches.
  if (shot !== undefined && longRifleShot(owner)) {
    shot.longRifle = true;
    shot.life = LONG_RIFLE_LIFE;
  }
}

/** The Rifleman's attack shot. */
export function spawnProjectile(owner: Fighter): void {
  spawnProjectileMotion(owner, ProjectileKind.blaster, f32(owner.facing * BLASTER_PROJECTILE_SPEED), 0.0, BLASTER_PROJECTILE_LIFETIME, owner.attack.serial);
}

const facingOf = (owner: Fighter, direction: number): number => (direction === 0 ? owner.facing : direction > 0 ? 1 : -1);

/** Archer's arrow, level toward direction, or the owner's facing for zero. */
export function spawnArcherArrow(owner: Fighter, direction: number, serial: number): void {
  spawnProjectileMotion(owner, ProjectileKind.arrow, f32(facingOf(owner, direction) * ARCHER_ARROW_SPEED), 0.0, ARCHER_ARROW_LIFETIME, serial, 1.0, ARCHER_ARROW_HEIGHT);
}

/** Archer's homing arrow, launched level toward direction, or the owner's facing for zero. */
export function spawnHomingArrow(owner: Fighter, direction: number, serial: number): void {
  spawnProjectileMotion(owner, ProjectileKind.homingArrow, f32(facingOf(owner, direction) * HOMING_ARROW_SPEED), 0.0, HOMING_ARROW_LIFETIME, serial);
}

/**
 * Mana Burn (#116, smashcraft:docs/design/mana.md): a body hit burns 25 of
 * the target's mana, then stuns it 15 frames plus up to 45 more the emptier
 * that leaves it (26 on a full bar, 60 on an empty one); the next damaging
 * hit ends it, and 300 frames of sleep-group immunity follow so stuns and
 * sleeps never chain.
 */
export const MANA_BURN_STUN: Readonly<AppliedStatus> = {
  kind: HeroStatusKind.stun, frames: 15, group: HeroStatusGroup.sleep, immunityFrames: 300,
  drain: { mana: 25, emptyFrames: 45 },
};

// Preallocated: collected contacts copy it, so one record serves every hit.
const projectileHit = emptyHitEffect();

/**
 * Whether a returning hero projectile is on its way back to its owner. A
 * reflected one (its damage multiplied down) belongs to the reflector and flies straight on.
 */
export function heroProjectileReturning(projectile: Readonly<Projectile>): boolean {
  const spec = projectile.spec;
  return spec?.returns !== undefined && projectile.damageMultiplier === 1.0 && spec.life - projectile.life >= spec.returns.age;
}

/** A hero projectile's reach: its authored radius, widened by a pool's hits up to the pool's cap. */
export function heroProjectileRadius(projectile: Readonly<Projectile>, spec: Readonly<SpecialProjectile>): number {
  const pool = spec.pool;
  if (pool === undefined || projectile.poolHits === 0) return spec.radius;
  return min(pool.maxRadius, f32(spec.radius + f32(projectile.poolHits * pool.growth)));
}

/** The hit a hero projectile deals now: its return hit once it has turned back. */
function heroProjectileEffect(projectile: Readonly<Projectile>, spec: Readonly<SpecialProjectile>): Readonly<HitEffect> {
  return heroProjectileReturning(projectile) ? spec.returnEffect ?? spec.effect : spec.effect;
}

/** The damage a projectile deals a body, before shield or reflection changes. */
export function projectileDamage(projectile: Readonly<Projectile>): number {
  const { kind, spec } = projectile;
  const damage = kind === ProjectileKind.hero && spec !== undefined ? heroProjectileEffect(projectile, spec).damage
    : kind === ProjectileKind.blaster ? attackDamage(AttackStyle.shot)
      : kind === ProjectileKind.homingArrow ? 3.0 : kind === ProjectileKind.arrow ? ARCHER_ARROW_DAMAGE : kind === ProjectileKind.recoil || kind === ProjectileKind.manaBurn ? 5.0 : 7.0;
  return roundToFloat32(f32(damage * projectile.damageMultiplier));
}

function applyProjectileHit(world: Roster, ownerSlot: number, targetSlot: number, projectile: Readonly<Projectile>, shieldContact: boolean): void {
  const target = fighterAt(world, targetSlot);
  const { spec } = projectile;
  const origin = projectileOrigin(fighterAt(world, ownerSlot), projectile);
  if (projectile.kind === ProjectileKind.hero && spec !== undefined) {
    copyHitEffect(projectileHit, heroProjectileEffect(projectile, spec));
    projectileHit.damage = projectileDamage(projectile);
    collectDamageContact(world, ownerSlot, targetSlot, projectileHit, projectile.direction, ContactKind.launch, false, undefined, shieldContact, spec.status, origin, projectile.z);
    return;
  }
  const { kind } = projectile;
  projectileHit.element = kind === ProjectileKind.manaBurn ? HitElement.electric : HitElement.normal;
  projectileHit.carry = undefined;
  if ((kind === ProjectileKind.blaster && !projectile.longRifle) || kind === ProjectileKind.manaBurn) {
    projectileHit.damage = projectileDamage(projectile);
    projectileHit.growth = 0.0;
    projectileHit.base = 0.0;
    projectileHit.launchX = 0.0;
    projectileHit.launchZ = 0.0;
    collectDamageContact(world, ownerSlot, targetSlot, projectileHit, projectile.direction, ContactKind.flinch, false, undefined, shieldContact,
      kind === ProjectileKind.manaBurn ? MANA_BURN_STUN : undefined, origin, projectile.z);
    return;
  }
  const damageOnly = kind === ProjectileKind.arrow || kind === ProjectileKind.homingArrow;
  projectileHit.damage = projectileDamage(projectile);
  projectileHit.growth = 85.0;
  projectileHit.base = 16.0;
  projectileHit.launchX = 0.800000011920929;
  projectileHit.launchZ = kind === ProjectileKind.recoil ? -0.6000000238418579 : 0.6000000238418579;
  collectDamageContact(world, ownerSlot, targetSlot, projectileHit, projectile.direction,
    damageOnly ? ContactKind.damageOnly : ContactKind.launch, false, undefined, shieldContact, undefined, origin, projectile.z);
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
    reflected.longRifle = false;
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

// Preallocated: target positions before any projectile resolves, sampled every frame.
const targets = {
  x: [0.0, 0.0, 0.0, 0.0],
  z: [0.0, 0.0, 0.0, 0.0],
  out: [false, false, false, false],
  intangible: [false, false, false, false],
  // Sampled before any projectile resolves: a reflection spends the window, but every projectile meeting the shield that frame reflects.
  reflecting: [false, false, false, false],
};

/**
 * Turns a homing arrow one step toward the body center of the nearest
 * opponent still ahead of it. It keeps its speed, turns at most
 * HOMING_ARROW_TURN_DEGREES, keeps its heading when a turn would not bring it
 * closer to the target's line, and stays within HOMING_ARROW_MAX_PITCH_DEGREES
 * of level; once every opponent is behind it, it flies straight.
 */
function steerHomingArrow(world: Roster, ownerSlot: number, projectile: Projectile): void {
  const velocityX = projectile.velocityX;
  const velocityZ = projectile.velocityZ;
  let found = false;
  let towardX = 0.0;
  let towardZ = 0.0;
  let distance = 0.0;
  for (let targetSlot = 0; targetSlot < PARTICIPANT_CAPACITY; targetSlot++) {
    if (!isActive(world, targetSlot) || targetSlot === ownerSlot || targets.out[targetSlot]) continue;
    const dx = f32(at(targets.x, targetSlot) - projectile.x);
    const dz = f32(f32(at(targets.z, targetSlot) + TARGET_CENTER_HEIGHT) - projectile.z);
    if (f32(f32(dx * velocityX) + f32(dz * velocityZ)) <= 0) continue;
    const candidate = f32(Math.abs(dx) + Math.abs(dz));
    if (found && candidate >= distance) continue;
    found = true;
    towardX = dx;
    towardZ = dz;
    distance = candidate;
  }
  if (!found) return;
  const turn = f32(f32(velocityX * towardZ) - f32(velocityZ * towardX)) >= 0 ? HOMING_TURN_SIN : -HOMING_TURN_SIN;
  const turnedX = f32(f32(velocityX * HOMING_TURN_COS) - f32(velocityZ * turn));
  const turnedZ = f32(f32(velocityX * turn) + f32(velocityZ * HOMING_TURN_COS));
  if (Math.abs(turnedZ) > f32(Math.abs(turnedX) * HOMING_MAX_PITCH_TAN)) return;
  if (f32(f32(turnedX * towardX) + f32(turnedZ * towardZ)) <= f32(f32(velocityX * towardX) + f32(velocityZ * towardZ))) return;
  projectile.velocityX = turnedX;
  projectile.velocityZ = turnedZ;
}

/** Flies one projectile and returns the slot of the target it reaches, or undefined. */
function flyProjectile(world: Roster, ownerSlot: number, projectile: Projectile, hit: { reflector: boolean; shield: boolean }): number | undefined {
  if (projectile.kind === ProjectileKind.homingArrow) steerHomingArrow(world, ownerSlot, projectile);
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
    // The blaster meets the whole hurt capsule, so a short-hop shot reaches a standing body, and a shield at the shot's radius.
    const blaster = projectile.kind === ProjectileKind.blaster;
    const body = hurtCapsule(target.character);
    const targetZ = at(targets.z, targetSlot);
    const reach = f32(BLASTER_PROJECTILE_RADIUS + body.radius);
    const height = blaster
      ? f32(max(oldZ, projectile.z) + reach) >= f32(targetZ + body.z1) && f32(min(oldZ, projectile.z) - reach) <= f32(targetZ + body.z2)
      : centerZ >= lowZ && centerZ <= highZ;
    const shieldContact = target.shield.raised
      && shieldCircleIntersects(target, oldX, oldZ, projectile.x, projectile.z, 1.0, blaster ? BLASTER_PROJECTILE_RADIUS : 0.0);
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

/** Restores the owner's damage by a caught projectile's heal, within the per-stock heal cap. */
function catchHeal(owner: Fighter, spec: Readonly<SpecialProjectile> | undefined): void {
  const heal = spec?.catchHeal;
  if (heal === undefined) return;
  const { status } = owner;
  const restored = min(min(heal.heal, max(0.0, f32(heal.capPerStock - status.guardHealed))), max(0.0, status.damage));
  status.damage = f32(status.damage - restored);
  status.guardHealed = f32(status.guardHealed + restored);
}

/**
 * Heads a returning projectile at its owner's body: level speed toward it,
 * climbing or sinking at most that speed. False when it arrives, which ends it.
 */
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

/**
 * Flies a hero projectile, swept from its old position against each target's
 * standing body widened by its radius. It reaches nothing before its age
 * reaches `activeFrom`; a non-reflectable one meets a reflector as a shield.
 */
function flyHeroProjectile(world: Roster, ownerSlot: number, projectile: Projectile, hit: { reflector: boolean; shield: boolean }): number | undefined {
  const spec = projectile.spec;
  // A reflected one (its damage multiplied down) belongs to the reflector and flies straight on.
  if (spec?.returns !== undefined && projectile.damageMultiplier === 1.0 && spec.life - projectile.life >= spec.returns.age && !returnToOwner(fighterAt(world, ownerSlot), projectile, spec.returns.speed)) return undefined;
  const oldX = projectile.x;
  const oldZ = projectile.z;
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
  const direction = projectile.velocityX < 0 ? -1 : projectile.velocityX > 0 ? 1 : projectile.direction;
  let nearest: number | undefined;
  let distance = 0.0;
  for (let targetSlot = 0; targetSlot < PARTICIPANT_CAPACITY; targetSlot++) {
    if (!isActive(world, targetSlot) || targetSlot === ownerSlot || targets.out[targetSlot] || targets.intangible[targetSlot]) continue;
    const target = fighterAt(world, targetSlot);
    const body = hurtCapsule(target.character);
    const targetX = at(targets.x, targetSlot);
    const targetZ = at(targets.z, targetSlot);
    // Ground pools deny the deck, so jumping leaves their danger even while above the pool.
    if (spec.pool !== undefined && !target.motion.grounded) continue;
    const reach = f32(radius + body.radius);
    const crossed = f32(f32(targetX - oldX) * direction) >= 0 && f32(f32(targetX - projectile.x) * direction) <= 0;
    const near = Math.abs(f32(targetX - projectile.x)) <= reach;
    const height = f32(max(oldZ, projectile.z) + reach) >= f32(targetZ + body.z1) && f32(min(oldZ, projectile.z) - reach) <= f32(targetZ + body.z2);
    // The shield takes the projectile at the same widened reach as the body, so a broad one never passes a raised shield.
    const shieldContact = target.shield.raised && shieldCircleIntersects(target, oldX, oldZ, projectile.x, projectile.z, 1.0, radius);
    const reflector = spec.reflectable && shieldContact && at(targets.reflecting, targetSlot);
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

/** Which side of the line a-b point c lies on: the sign of their cross product. */
function side(ax: number, az: number, bx: number, bz: number, cx: number, cz: number): number {
  return f32(f32(f32(bx - ax) * f32(cz - az)) - f32(f32(bz - az) * f32(cx - ax)));
}

/** Whether segments p1-p2 and q1-q2 cross or touch. */
function segmentsMeet(p1x: number, p1z: number, p2x: number, p2z: number, q1x: number, q1z: number, q2x: number, q2z: number): boolean {
  if (!segmentBoxesOverlap(p1x, p1z, p2x, p2z, q1x, q1z, q2x, q2z)) return false;
  const d1 = side(q1x, q1z, q2x, q2z, p1x, p1z);
  const d2 = side(q1x, q1z, q2x, q2z, p2x, p2z);
  // Most steps lie wholly on one side of a surface's line; p's own line isn't needed then.
  if (!((d1 <= 0 && d2 >= 0) || (d1 >= 0 && d2 <= 0))) return false;
  const d3 = side(p1x, p1z, p2x, p2z, q1x, q1z);
  const d4 = side(p1x, p1z, p2x, p2z, q2x, q2z);
  return ((d3 <= 0 && d4 >= 0) || (d3 >= 0 && d4 <= 0)) && !(d1 === 0 && d2 === 0 && d3 === 0 && d4 === 0);
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

/** Whether a and b meet this frame: their centres cross or come within both reaches, horizontally and vertically. */
function projectilesMeet(a: Readonly<Projectile>, b: Readonly<Projectile>): boolean {
  const reachX = f32(BLASTER_PROJECTILE_RADIUS + (b.spec?.radius ?? BLASTER_PROJECTILE_RADIUS));
  const reachZ = f32(BLASTER_PROJECTILE_HALF_HEIGHT + (b.spec?.radius ?? BLASTER_PROJECTILE_HALF_HEIGHT));
  const before = f32(a.x - b.x);
  const after = f32(f32(a.x + a.velocityX) - f32(b.x + b.velocityX));
  const crossed = (before <= 0 && after >= 0) || (before >= 0 && after <= 0) || Math.abs(after) <= reachX;
  return crossed && Math.abs(f32(f32(a.z + a.velocityZ) - f32(b.z + b.velocityZ))) <= reachZ;
}

/**
 * A Mana Burn orb and an opposing traveling projectile that meet this frame
 * cancel each other before either flies (#116). Persistent, non-reflectable
 * hero objects are not traveling projectiles and are left alone.
 */
function clashManaBurns(world: Roster): void {
  for (let ownerSlot = 0; ownerSlot < PARTICIPANT_CAPACITY; ownerSlot++) {
    if (!isActive(world, ownerSlot)) continue;
    for (const orb of fighterAt(world, ownerSlot).projectiles) {
      if (orb.life <= 0 || orb.kind !== ProjectileKind.manaBurn) continue;
      for (let otherSlot = 0; otherSlot < PARTICIPANT_CAPACITY && orb.life > 0; otherSlot++) {
        if (otherSlot === ownerSlot || !isActive(world, otherSlot)) continue;
        for (const other of fighterAt(world, otherSlot).projectiles) {
          if (other.life <= 0 || (other.spec !== undefined && !other.spec.reflectable) || !projectilesMeet(orb, other)) continue;
          orb.life = 0;
          other.life = 0;
          break;
        }
      }
    }
  }
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
    targets.reflecting[slot] = target.shield.reflectFrames > 0;
  }
  clashManaBurns(world);
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
      if (nearest === undefined && stage !== undefined && (projectile.kind === ProjectileKind.hero || projectile.kind === ProjectileKind.homingArrow)
        && projectileMeetsStage(stage, matchFrame, fromX, fromZ, projectile.x, projectile.z)) {
        projectile.life = 0;
        continue;
      }
      const pool = projectile.kind === ProjectileKind.hero ? projectile.spec?.pool : undefined;
      if (nearest !== undefined && pool !== undefined) {
        // A pool stays: it waits before striking again and widens on a body.
        applyProjectileHit(world, ownerSlot, nearest, projectile, selected.shield);
        projectile.poolWait = pool.every - 1;
        if (!selected.shield) projectile.poolHits++;
      } else if (nearest !== undefined) {
        if (!(selected.reflector && reflectProjectile(fighterAt(world, nearest), projectile))) {
          applyProjectileHit(world, ownerSlot, nearest, projectile, selected.shield);
        }
        projectile.life = 0;
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
    for (const projectile of fighterAt(world, slot).projectiles) projectile.newlyReflected = false;
  }
  if (ownsBatch) finishDamageContacts(world);
}
