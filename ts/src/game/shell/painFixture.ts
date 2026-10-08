import { mutableProjectile } from "../sim/fighterProjectiles";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { at } from "wisp/src/runtime/lookup";
import { fighterHurtParts } from "../sim/hurtboxes";
import { ProjectileKind } from "../sim/codes";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import type { Scenario } from "./build";

export const PAIN_SCENARIOS: readonly Scenario[] = [
  "pain-low-small", "pain-low-medium", "pain-low-large", "pain-middle-small", "pain-middle-medium", "pain-middle-large", "pain-high-small", "pain-high-medium", "pain-high-large",
];

/** The ordinary projectile collision resolves both hits on frame 150, after the pad's jab starts. */
export function initializePainScenario(scenario: Scenario, world: Roster): boolean {
  const category = PAIN_SCENARIOS.indexOf(scenario);
  if (category < 0) return false;
  if (!isActive(world, 0) || !isActive(world, 1)) return true;
  const height = floorDiv(category, 3);
  const strength = floorMod(category, 3);
  for (const owner of [0, 1]) {
    const target = fighterAt(world, 1 - owner);
    let bottom = 0.0, top = 0.0;
    for (const part of fighterHurtParts(target)) {
      bottom = Math.min(bottom, f32(Math.min(part.z1, part.z2) - part.radius));
      top = Math.max(top, f32(Math.max(part.z1, part.z2) + part.radius));
    }
    const contact = f32(bottom + f32(f32(top - bottom) * at([0.1875, 0.5625, 0.875], height)));
    const projectile = mutableProjectile(fighterAt(world, owner), 0);
    projectile.kind = ProjectileKind.hero;
    projectile.visualFamily = fighterAt(world, owner).character;
    projectile.life = 180;
    projectile.x = target.motion.x;
    projectile.z = f32(target.motion.z + contact);
    projectile.direction = owner === 0 ? 1 : -1;
    projectile.serial = 1;
    projectile.damageMultiplier = 1.0;
    projectile.spec = {
      spawnFrame: 0, offsetX: 0.0, offsetZ: 0.0, velocityX: 0.0, velocityZ: 0.0,
      life: 180, radius: 1.0, activeFrom: 150, reflectable: false, limit: 1,
      effect: { damage: 8.0, growth: 0.0, base: at([20.0, 100.0, 240.0], strength), launchX: 0.0, launchZ: 1.0, electric: false },
    };
  }
  return true;
}
