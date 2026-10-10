




import { at } from "wisp/src/runtime/lookup";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, ProjectileKind } from "./codes";
import { mutableProjectile } from "./fighterProjectiles";
import { inGrabContext } from "./conditions";
import { staggerCompanion } from "./companions";
import { type Fighter, type PlacedObject, placedObject } from "./fighter";
import { HERO_PROJECTILE_CAP, runningHeroSpecial, runningTableSpecial, spawnHeroProjectileAt } from "./heroSpecialRules";
import { HitField, MoveField, hitField, moveField } from "./moveTable";
import { CompanionMode, type SpecialPlacement } from "./heroSpecials";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "./hitRegions";
import { projectileDamage } from "./projectiles";
import { type Roster, fighterAt, isActive } from "./roster";
import { attackCapsule, capsulesIntersect, emptyCapsule, placeCapsule } from "../physics/contactGeometry";
import { PARTICIPANT_CAPACITY } from "../input/participants";


const ORIGINAL_PROJECTILE_RADIUS = 12.0;


const body = emptyCapsule();
const strike = emptyCapsule();
const region = emptyHitRegion();

function placeBody(placed: Readonly<PlacedObject>, spec: Readonly<SpecialPlacement>): void {
  body.x1 = placed.x;
  body.x2 = placed.x;
  body.z1 = f32(placed.z + spec.radius);
  body.z2 = f32(f32(placed.z + spec.height) - spec.radius);
  body.radius = spec.radius;
}


function normalStrike(placed: PlacedObject, sourceSlot: number, source: Readonly<Fighter>): number {
  const { attack } = source;
  const style = attack.style;
  if (style === undefined || style === AttackStyle.grab || attack.dashGrab || placed.struck[sourceSlot] === attack.serial) return 0.0;
  const moves = source.tuning.moves;
  for (let index = 0; index < authoredHitRegionCount(style, moves); index++) {
    authoredHitRegion(region, source.character, style, attack.frame, attack.smashChargeFrames, index, moves);
    if (region.window <= 0) continue;
    attackCapsule(strike, style, region);
    placeCapsule(strike, strike, source.motion.x, source.motion.z, source.facing);
    if (!capsulesIntersect(strike, body)) continue;
    placed.struck[sourceSlot] = attack.serial;
    return region.effect.damage;
  }
  return 0.0;
}


function specialStrike(placed: PlacedObject, sourceSlot: number, source: Readonly<Fighter>): number {
  const bit = 1 << sourceSlot;
  const id = runningTableSpecial(source);
  const table = source.tuning.specials?.table;
  const move = id >= 0 ? undefined : runningHeroSpecial(source);
  const running = id >= 0 || move !== undefined;
  if (!running || source.special.frame <= 1) placed.specialStruck &= ~bit;
  if (!running || (placed.specialStruck & bit) !== 0) return 0.0;
  const frame = source.special.frame - 1;
  if (id >= 0 && table !== undefined) {
    const first = moveField(table, id, MoveField.hitFirst);
    for (let row = first; row < first + moveField(table, id, MoveField.hitCount); row++) {
      const region = at(table.regions, row);
      if (frame < hitField(table, row, HitField.first) || frame > hitField(table, row, HitField.last) || region.strike === undefined) continue;
      placeCapsule(strike, region.strike, source.motion.x, source.motion.z, source.facing);
      if (!capsulesIntersect(strike, body)) continue;
      placed.specialStruck |= bit;
      return region.effect.damage;
    }
    return 0.0;
  }
  if (move === undefined) return 0.0;
  for (const path of move.regions ?? []) {
    if (frame < path.firstFrame || frame > path.lastFrame || path.hit.strike === undefined) continue;
    placeCapsule(strike, path.hit.strike, source.motion.x, source.motion.z, source.facing);
    if (!capsulesIntersect(strike, body)) continue;
    placed.specialStruck |= bit;
    return path.hit.effect.damage;
  }
  return 0.0;
}


function projectileStrikes(source: Fighter): number {
  let damage = 0.0;
  let index = -1;
  for (const projectile of source.projectiles) {
    index++;
    if (projectile.life <= 0) continue;
    strike.x1 = f32(projectile.x - projectile.velocityX);
    strike.z1 = f32(projectile.z - projectile.velocityZ);
    strike.x2 = projectile.x;
    strike.z2 = projectile.z;
    strike.radius = projectile.kind === ProjectileKind.hero && projectile.spec !== undefined ? projectile.spec.radius : ORIGINAL_PROJECTILE_RADIUS;
    if (!capsulesIntersect(strike, body)) continue;
    damage = f32(damage + projectileDamage(projectile));
    mutableProjectile(source, index).life = 0;
  }
  return damage;
}

function ownedProjectiles(f: Readonly<Fighter>): number {
  let count = 0;
  for (const projectile of f.projectiles) if (projectile.life > 0 && projectile.kind === ProjectileKind.hero) count++;
  return count;
}


export function advancePlacedObjects(world: Roster): void {
  for (let ownerSlot = 0; ownerSlot < PARTICIPANT_CAPACITY; ownerSlot++) {
    if (!isActive(world, ownerSlot)) continue;
    const owner = fighterAt(world, ownerSlot);
    for (let animal = 0; animal <= owner.pack.length; animal++) {
      const placed = placedObject(owner, animal);
      const spec = placed.spec;
      if (placed.life <= 0 || spec === undefined) continue;
      placeBody(placed, spec);
      for (let sourceSlot = 0; sourceSlot < PARTICIPANT_CAPACITY; sourceSlot++) {
        if (sourceSlot === ownerSlot || !isActive(world, sourceSlot)) continue;
        const source = fighterAt(world, sourceSlot);
        if (source.status.out) continue;
        const damage = f32(f32(normalStrike(placed, sourceSlot, source) + specialStrike(placed, sourceSlot, source)) + projectileStrikes(source));
        placed.durability = f32(placed.durability - damage);
        if (damage > 0.0) staggerCompanion(placed);
      }
      placed.age++;
      placed.life--;
      if (placed.durability <= 0.0) placed.life = 0;
      if (placed.life <= 0) continue;
      let scheduled = false;
      for (const age of spec.fireAges) if (age === placed.age) scheduled = true;
      const fires = scheduled && placed.mode === CompanionMode.follow && !inGrabContext(owner) && owner.launch.hitstun <= 0 && !owner.status.out;
      const { shot } = spec;
      if (fires && shot !== undefined && ownedProjectiles(owner) < HERO_PROJECTILE_CAP) {
        const x = f32(placed.x + f32(placed.direction * shot.offsetX));
        spawnHeroProjectileAt(owner, shot, x, f32(placed.z + shot.offsetZ), placed.direction, false, owner.attack.serial + 1);
      }
    }
  }
}
