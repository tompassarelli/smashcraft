import { assertEquals, assertFalse, assertTrue, test } from "../../runtime/testing";
import { Character, SurfaceContact } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { cloneFighterState, copyFighterState } from "./fighterState";

test("fighter replay copies detach every mutable record and retain participant-slot references", () => {
  const source = createFighter(Character.archer, -12, 1);
  source.motion.meleeX.original = 18.25;
  source.motion.meleeX.published = -12;
  source.motion.surface = 3;
  source.launch.knockbackAge = 7;
  source.hits.entries[2]!.attacker = 3;
  source.hits.entries[2]!.attackSerial = 19;
  source.special.hitTargets[1] = 2;
  source.projectiles[4]!.newlyReflected = true;
  source.projectiles[4]!.damageMultiplier = 1.75;
  source.surfaceRecovery.state = SurfaceContact.techWall;
  source.surfaceRecovery.lastReflectedSurface = 5;
  source.grab.owner = 3;
  source.grab.target = 0;
  source.status.frozenFrames = 11;

  const copy = cloneFighterState(source);
  assertFalse(copy === source);
  assertFalse(copy.motion === source.motion);
  assertFalse(copy.motion.meleeX === source.motion.meleeX);
  assertFalse(copy.tuning.physics === source.tuning.physics);
  assertFalse(copy.hits.entries === source.hits.entries);
  assertFalse(copy.hits.entries[2] === source.hits.entries[2]);
  assertFalse(copy.special.cooldowns === source.special.cooldowns);
  assertFalse(copy.special.hitTargets === source.special.hitTargets);
  assertFalse(copy.projectiles === source.projectiles);
  assertFalse(copy.projectiles[4] === source.projectiles[4]);
  assertEquals(copy.motion.meleeX.original, 18.25);
  assertEquals(copy.motion.surface, 3);
  assertEquals(copy.launch.knockbackAge, 7);
  assertEquals(copy.hits.entries[2]!.attacker, 3);
  assertEquals(copy.hits.entries[2]!.attackSerial, 19);
  assertEquals(copy.special.hitTargets[1], 2);
  assertTrue(copy.projectiles[4]!.newlyReflected);
  assertEquals(copy.projectiles[4]!.damageMultiplier, 1.75);
  assertEquals(copy.surfaceRecovery.lastReflectedSurface, 5);
  assertEquals(copy.grab.owner, 3);
  assertEquals(copy.grab.target, 0);
  assertEquals(copy.status.frozenFrames, 11);

  source.motion.meleeX.original = 0;
  source.hits.entries[2]!.attacker = undefined;
  source.projectiles[4]!.damageMultiplier = 0;
  assertEquals(copy.motion.meleeX.original, 18.25);
  assertEquals(copy.hits.entries[2]!.attacker, 3);
  assertEquals(copy.projectiles[4]!.damageMultiplier, 1.75);

  const reused = createFighter(Character.rifleman, 4, -1);
  copyFighterState(reused, copy);
  assertEquals(reused.character, copy.character);
  assertEquals(reused.status.frozenFrames, 11);
  assertFalse(reused.motion.meleeX === copy.motion.meleeX);
});
