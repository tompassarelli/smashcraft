import { at } from "wisp/src/runtime/lookup";
import type { Fighter, Projectile } from "./fighter";

// Every fighter owns its PROJECTILE_CAPACITY projectile tables for life: a
// snapshot copies their fields, so neither it nor a later change allocates (#400).
export function copyFighterProjectiles(target: Fighter, source: Readonly<Fighter>): void {
  const targets = target.projectiles;
  let index = 0;
  // Every fighter holds PROJECTILE_CAPACITY projectiles; plain indexing keeps the per-snapshot copy cheap.
  for (const from of source.projectiles) {
    const to = targets[index++];
    if (to === undefined) throw new Error(`no projectile ${index - 1} to copy into`);
    to.life = from.life;
    to.x = from.x;
    to.z = from.z;
    to.direction = from.direction;
    to.kind = from.kind;
    to.visualFamily = from.visualFamily;
    to.velocityX = from.velocityX;
    to.velocityZ = from.velocityZ;
    to.serial = from.serial;
    to.damageMultiplier = from.damageMultiplier;
    to.newlyReflected = from.newlyReflected;
    to.exReach = from.exReach;
    to.poolHits = from.poolHits;
    to.poolWait = from.poolWait;
    to.spec = from.spec;
  }
}


/** Whether two fighters' projectiles hold the same values, signed zeros told apart as sameFighterState does. */
export function sameFighterProjectiles(target: Readonly<Fighter>, source: Readonly<Fighter>): boolean {
  const targets = target.projectiles;
  if (targets.length !== source.projectiles.length) return false;
  let index = 0;
  for (const b of source.projectiles) {
    const a = targets[index++];
    if (a === undefined) return false;
    if (a === b) continue;
    if (a.life !== b.life || a.serial !== b.serial || a.kind !== b.kind || a.direction !== b.direction || a.visualFamily !== b.visualFamily
      || a.newlyReflected !== b.newlyReflected || a.exReach !== b.exReach || a.poolHits !== b.poolHits || a.poolWait !== b.poolWait || a.spec !== b.spec) return false;
    if (!sameReal(a.x, b.x) || !sameReal(a.z, b.z) || !sameReal(a.velocityX, b.velocityX) || !sameReal(a.velocityZ, b.velocityZ) || !sameReal(a.damageMultiplier, b.damageMultiplier)) return false;
  }
  return true;
}

const sameReal = (a: number, b: number) => a === b && (a !== 0 || 1 / a === 1 / b);


export function mutableProjectile(fighter: Fighter, index: number): Projectile {
  return at(fighter.projectiles, index);
}
