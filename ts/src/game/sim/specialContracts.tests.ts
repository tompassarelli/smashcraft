import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, DownState, HippogryphKind, ProjectileKind, SpecialAction } from "./codes";
import { createFighter, SHIELD_MAX } from "./fighter";
import { advanceSpecials } from "./specials";
import { cancelSpecialState } from "./transitions";
import { updateProjectiles } from "./projectiles";
import { createRoster } from "./roster";
import { respawnFighter } from "./stocks";
import { testWorld } from "./testWorld";

test("bearRunsWithoutSwipingUntilATargetEntersItsPath", () => {
  const owner = createFighter(Character.rifleman, -100.0, 1);
  const target = createFighter(Character.archer, 500.0, -1);
  owner.bear.life = 80;
  owner.bear.x = -100.0;
  owner.bear.z = 0.0;
  owner.bear.velocityX = 14.0;
  owner.bear.surface = 0;
  const world = testWorld(owner, target);
  for (let frame = 1; frame <= 10; frame++) advanceSpecials(world, 0, 0);
  assertEquals(owner.bear.hitSerial, 0);
  assertEquals(owner.bear.swipeCooldown, 0);
  assertEquals(target.status.damage, 0.0);
  target.motion.x = f32(owner.bear.x + 40.0);
  advanceSpecials(world, 0, 0);
  assertEquals(owner.bear.hitSerial, 1);
  assertGreaterThan(target.status.damage, 0.0);
  advanceSpecials(world, 0, 0);
  assertEquals(owner.bear.hitSerial, 1);
});

test("summonedEntitiesSurviveActionInterruptionButNotStockReset", () => {
  const owner = createFighter(Character.rifleman, -100.0, 1);
  owner.special.action = SpecialAction.riflemanBear;
  owner.bear.life = 30;
  owner.bear.swipeCooldown = 8;
  owner.hippogryph.kind = HippogryphKind.strike;
  owner.hippogryph.life = 12;
  owner.special.hit = true;
  cancelSpecialState(owner);
  assertEquals(owner.special.action, SpecialAction.none);
  assertEquals(owner.bear.life, 30);
  assertEquals(owner.bear.swipeCooldown, 8);
  assertEquals(owner.hippogryph.life, 12);
  assertTrue(owner.special.hit);
  owner.hippogryph.kind = HippogryphKind.mount;
  cancelSpecialState(owner);
  assertEquals(owner.hippogryph.life, 0);
  respawnFighter(createRoster(1, [owner]), 0, -240.0);
  assertEquals(owner.bear.life, 0);
  assertEquals(owner.special.hit, false);
});

test("arrowTravelDirectionDoesNotFollowTheShootersLaterFacing", () => {
  const owner = createFighter(Character.archer, -100.0, -1);
  const target = createFighter(Character.rifleman, 20.0, -1);
  Object.assign(owner.projectiles[0]!, {
    life: 10, kind: ProjectileKind.arrow, direction: 1, x: 0.0, z: 45.0, velocityX: 30.0,
  });
  updateProjectiles(testWorld(owner, target));
  assertGreaterThan(target.status.damage, 0.0);
  assertEquals(owner.projectiles[0]!.x, 30.0);
  assertEquals(target.launch.knockbackX, 0.0);
});

test("bothArcherArrowKindsPreserveReactionMovementAndActionState", () => {
  for (let kind = ProjectileKind.arrow; kind <= ProjectileKind.fanArrow; kind++) {
    const owner = createFighter(Character.archer, -100.0, 1);
    const target = createFighter(Character.rifleman, 20.0, -1);
    Object.assign(owner.projectiles[0]!, {
      life: 10, kind, direction: 1, x: 0.0, z: 45.0, velocityX: 30.0,
    });
    target.motion.grounded = false;
    target.motion.vx = 3.0;
    target.motion.vz = -4.0;
    target.launch.knockbackX = 5.0;
    target.launch.knockbackZ = 6.0;
    target.launch.hitstun = 8;
    target.launch.hitlag = 2;
    target.down.state = DownState.tumble;
    target.down.frame = 3;
    target.status.frozenFrames = 20;
    updateProjectiles(testWorld(owner, target));
    assertEquals(target.status.damage, kind === ProjectileKind.arrow ? 7.0 : 4.0);
    assertEquals(target.motion.grounded, false);
    assertEquals(target.motion.vx, 3.0);
    assertEquals(target.motion.vz, -4.0);
    assertEquals(target.launch.knockbackX, 5.0);
    assertEquals(target.launch.knockbackZ, 6.0);
    assertEquals(target.launch.hitstun, 8);
    assertEquals(target.launch.hitlag, 2);
    assertEquals(target.down.state, DownState.tumble);
    assertEquals(target.down.frame, 3);
    assertEquals(target.status.frozenFrames, 0);
    assertEquals(owner.projectiles[0]!.life, 0);
  }
});

test("arrowsDamageShieldWithoutAddingShieldstunOrHitlag", () => {
  for (let kind = ProjectileKind.arrow; kind <= ProjectileKind.fanArrow; kind++) {
    const owner = createFighter(Character.archer, -100.0, 1);
    const target = createFighter(Character.rifleman, 20.0, -1);
    Object.assign(owner.projectiles[0]!, {
      life: 10, kind, direction: 1, x: 0.0, z: 45.0, velocityX: 30.0,
    });
    target.shield.raised = true;
    updateProjectiles(testWorld(owner, target));
    assertTrue(target.shield.raised);
    assertGreaterThan(SHIELD_MAX, target.shield.energy);
    assertEquals(target.status.damage, 0.0);
    assertEquals(target.shield.stun, 0);
    assertEquals(target.launch.hitlag, 0);
  }
});
