import { at } from "wisp/src/runtime/lookup";
import type { Fighter, Projectile } from "./fighter";

const shared = new WeakSet<Readonly<Projectile>>();

/** Snapshot values stay fixed until their last reader releases them. */
export function shareFighterProjectiles(target: Fighter, source: Readonly<Fighter>): void {
  let index = -1;
  for (const projectile of source.projectiles) {
    index++;
    if (target.projectiles[index] === projectile) continue;
    shared.add(projectile);
    target.projectiles[index] = projectile;
  }
}

/** A writable projectile is held only during the current synchronous simulation step. */
export function mutableProjectile(fighter: Fighter, index: number): Projectile {
  const projectile = at(fighter.projectiles, index);
  if (!shared.has(projectile)) return projectile;
  const copy = { ...projectile };
  fighter.projectiles[index] = copy;
  return copy;
}
