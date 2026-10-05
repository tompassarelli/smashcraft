import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character, HippogryphKind, LedgeState, ProjectileKind, SpecialAction } from "./codes";
import { createFighter } from "./fighter";
import { beginFighterAttack, resolveAttacks } from "./attacks";
import { attackStartupFrames } from "./moves";
import { advanceSpecials, startFighterSpecial } from "./specials";
import { updateProjectiles } from "./projectiles";
import { createRoster } from "./roster";
import { advanceFreezeTraps, startFreezeTrap } from "./summons";
import { controls } from "./testWorld";
import { resolveLedges } from "./ledge";
import { imod } from "wisp/src/sim/intMath";

function fourWorld() {
  return createRoster(15, [
    createFighter(Character.archer, -300.0, 1),
    createFighter(Character.archer, -100.0, -1),
    createFighter(Character.archer, 100.0, 1),
    createFighter(Character.archer, 300.0, -1),
  ]);
}

test("multipleAttackersKeepIndependentVictimHitWindows", () => {
  const world = fourWorld();
  world.fighters[0]!.motion.x = 0.0;
  world.fighters[2]!.motion.x = 0.0;
  world.fighters[3]!.motion.x = 100.0;
  for (const slot of [0, 2]) {
    beginFighterAttack(world, slot, AttackStyle.jab, false);
    world.fighters[slot]!.attack.frame = attackStartupFrames(AttackStyle.jab);
  }
  resolveAttacks(world);
  assertEquals(world.fighters[3]!.status.damage, 24.0);
  world.fighters[0]!.launch.hitlag = 0;
  world.fighters[2]!.launch.hitlag = 0;
  resolveAttacks(world);
  assertEquals(world.fighters[3]!.status.damage, 24.0);
});

test("oneMeleeSwingCanContactAllThreeOpponents", () => {
  const world = fourWorld();
  world.fighters[0]!.motion.x = 0.0;
  for (let slot = 1; slot <= 3; slot++) world.fighters[slot]!.motion.x = 80.0 + slot * 5;
  beginFighterAttack(world, 0, AttackStyle.jab, false);
  world.fighters[0]!.attack.frame = attackStartupFrames(AttackStyle.jab);
  resolveAttacks(world);
  for (let slot = 1; slot <= 3; slot++) assertEquals(world.fighters[slot]!.status.damage, 12.0);
});

test("competingGrabsChooseOneVictimAndThirdPartyHitBreaksLinks", () => {
  const world = fourWorld();
  world.fighters[0]!.motion.x = 0.0;
  world.fighters[1]!.motion.x = 25.0;
  world.fighters[2]!.motion.x = 35.0;
  world.fighters[3]!.motion.x = -400.0;
  beginFighterAttack(world, 0, AttackStyle.grab, false);
  world.fighters[0]!.attack.frame = attackStartupFrames(AttackStyle.grab);
  resolveAttacks(world);
  assertEquals(world.fighters[0]!.grab.target, 1);
  assertEquals(world.fighters[1]!.grab.owner, 0);
  assertEquals(world.fighters[2]!.grab.owner, undefined);
  world.fighters[3]!.motion.x = -100.0;
  world.fighters[3]!.facing = 1;
  beginFighterAttack(world, 3, AttackStyle.jab, false);
  world.fighters[3]!.attack.frame = attackStartupFrames(AttackStyle.jab);
  resolveAttacks(world);
  assertEquals(world.fighters[0]!.grab.target, undefined);
  assertEquals(world.fighters[1]!.grab.owner, undefined);
});

test("projectileMovesOnceAndHitsNearestOpponent", () => {
  const world = fourWorld();
  const owner = world.fighters[0]!;
  Object.assign(owner.projectiles[0]!, {
    life: 10, x: 0.0, z: 45.0, velocityX: 100.0, direction: 1, kind: ProjectileKind.blaster,
  });
  world.fighters[1]!.motion.x = 70.0;
  world.fighters[2]!.motion.x = 25.0;
  world.fighters[3]!.motion.x = 90.0;
  updateProjectiles(world);
  assertEquals(owner.projectiles[0]!.x, 100.0);
  assertEquals(owner.projectiles[0]!.life, 0);
  assertEquals(world.fighters[1]!.status.damage, 0.0);
  assertEquals(world.fighters[2]!.status.damage, 3.0);
  assertEquals(world.fighters[3]!.status.damage, 0.0);
  Object.assign(owner.projectiles[1]!, { life: 10, x: -400.0, z: 45.0, velocityX: 10.0 });
  updateProjectiles(world);
  assertEquals(owner.projectiles[1]!.life, 9);
  assertEquals(owner.projectiles[1]!.x, -390.0);
});

test("summonAndSpecialClocksAdvanceOnceWithFourOpponents", () => {
  const world = fourWorld();
  const owner = world.fighters[3]!;
  owner.character = Character.rifleman;
  owner.bear.life = 30;
  owner.bear.x = 0.0;
  owner.bear.velocityX = 14.0;
  owner.bear.surface = 0;
  owner.bear.swipeCooldown = 10;
  owner.hippogryph.life = 20;
  owner.hippogryph.kind = HippogryphKind.mount;
  owner.special.action = SpecialAction.riflemanBear;
  owner.special.duration = 18;
  advanceSpecials(world, 0);
  assertEquals(owner.bear.life, 29);
  assertEquals(owner.bear.x, 14.0);
  assertEquals(owner.bear.swipeCooldown, 9);
  assertEquals(owner.hippogryph.life, 19);
  assertEquals(owner.special.frame, 1);
});

test("fourFightersArbitrateBothLedgesByDistance", () => {
  const world = fourWorld();
  for (let slot = 0; slot < 4; slot++) {
    const fighter = world.fighters[slot]!;
    const side = slot < 2 ? -1 : 1;
    fighter.motion.x = side * (imod(slot, 2) === 0 ? 630.0 : 620.0);
    fighter.motion.z = -30.0;
    fighter.motion.vz = -2.0;
    fighter.motion.grounded = false;
    fighter.facing = -side;
  }
  resolveLedges(world, 0, [controls(), controls(), controls(), controls()]);
  assertEquals(world.fighters[0]!.ledge.state, LedgeState.none);
  assertEquals(world.fighters[1]!.ledge.state, LedgeState.hang);
  assertEquals(world.fighters[2]!.ledge.state, LedgeState.none);
  assertEquals(world.fighters[3]!.ledge.state, LedgeState.hang);
});

test("freezeTrapChoosesNearestEligibleFighterOnce", () => {
  const world = fourWorld();
  const owner = world.fighters[3]!;
  owner.character = Character.rifleman;
  owner.motion.x = 0.0;
  owner.motion.surface = 0;
  for (let slot = 0; slot < 3; slot++) world.fighters[slot]!.motion.surface = 0;
  assertTrue(startFreezeTrap(owner, 0));
  owner.freezeTrap.arming = 0;
  world.fighters[0]!.motion.x = 30.0;
  world.fighters[1]!.motion.x = 10.0;
  world.fighters[2]!.motion.x = -20.0;
  advanceFreezeTraps(world);
  assertEquals(owner.freezeTrap.life, 0);
  assertEquals(world.fighters[0]!.status.frozenFrames, 0);
  assertEquals(world.fighters[1]!.status.frozenFrames, 300);
  assertEquals(world.fighters[2]!.status.frozenFrames, 0);
});

test("immolateContactsEachOpponentOnlyOnce", () => {
  const world = fourWorld();
  const owner = world.fighters[0]!;
  owner.character = Character.demonHunter;
  owner.motion.x = 0.0;
  owner.special.action = SpecialAction.demonHunterImmolate;
  owner.special.frame = 3;
  owner.special.duration = 27;
  for (let slot = 1; slot <= 3; slot++) world.fighters[slot]!.motion.x = 50.0 + slot * 10;
  advanceSpecials(world, 0);
  for (let slot = 1; slot <= 3; slot++) assertEquals(world.fighters[slot]!.status.damage, 7.0);
  owner.launch.hitlag = 0;
  advanceSpecials(world, 0);
  for (let slot = 1; slot <= 3; slot++) assertEquals(world.fighters[slot]!.status.damage, 7.0);
});

test("summonHitMemorySurvivesStartingAnUnrelatedSpecial", () => {
  const world = fourWorld();
  const owner = world.fighters[0]!;
  owner.motion.x = 0.0;
  owner.hippogryph.kind = HippogryphKind.strike;
  owner.hippogryph.life = 18;
  owner.hippogryph.x = 0.0;
  owner.hippogryph.velocityX = 0.0;
  world.fighters[3]!.motion.x = 30.0;
  advanceSpecials(world, 0);
  assertEquals(world.fighters[3]!.status.damage, 8.0);
  assertTrue(startFighterSpecial(owner, 0, controls({ specialPressed: true })));
  advanceSpecials(world, 0);
  assertEquals(world.fighters[3]!.status.damage, 8.0);
});
