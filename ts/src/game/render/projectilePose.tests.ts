import { assertDefined, assertFalse, assertTrue, test } from "../../runtime/testing";
import { Character } from "../sim/codes";
import { PROJECTILE_CAPACITY, createFighter } from "../sim/fighter";
import { projectedProjectile } from "./projectilePose";

test("projection hides expired, out and non-playing projectiles", () => {
  const fighter = createFighter(Character.rifleman, 0.0, 1);
  assertFalse(projectedProjectile(fighter, 0, true).visible);
  const projectile = assertDefined(fighter.projectiles[0]);
  projectile.life = 20;
  assertTrue(projectedProjectile(fighter, 0, true).visible);
  assertFalse(projectedProjectile(fighter, 0, false).visible);
  fighter.status.out = true;
  assertFalse(projectedProjectile(fighter, 0, true).visible);
  assertFalse(projectedProjectile(undefined, 0, true).visible);
  fighter.status.out = false;
  assertFalse(projectedProjectile(fighter, -1, true).visible);
  assertFalse(projectedProjectile(fighter, PROJECTILE_CAPACITY, true).visible);
});
