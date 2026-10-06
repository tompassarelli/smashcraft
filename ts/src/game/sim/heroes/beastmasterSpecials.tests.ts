// Beastmaster's specials and his bear through the production special, partner,
// placed-object, contact and resource path, against smashcraft:docs/design/roster.md.
import { assertEquals, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, ProjectileKind, SpecialAction } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { type Fighter, createFighter } from "../fighter";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { CompanionMode } from "../heroSpecials";
import { advanceHeroStatus } from "../heroSpecialRules";
import { regenerateMana } from "../mana";
import { advancePlacedObjects } from "../placedObjects";
import { updateProjectiles } from "../projectiles";
import { type Controls, type Roster, createRoster } from "../roster";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { advanceFighter } from "../step";
import { controls } from "../testWorld";
import { copyFighterState } from "../../replay/fighterState";
import { firstFighterDifference } from "../../replay/difference";
import { BEAR } from "./beastmasterSpecials";

const H = HERO_REFERENCE_HEIGHT;
const neutral = controls({ specialPressed: true });
const side = controls({ specialPressed: true, specialX: 1 });
const up = controls({ specialPressed: true, specialZ: 1 });
const down = controls({ specialPressed: true, specialZ: -1 });

function beastmaster(x: number, facing: number): Fighter {
  const f = createFighter(Character.beastmaster, x, facing);
  f.mana.points = 100;
  return f;
}

/** One match-ordered frame: motion, special starts, contacts, specials and partners, projectiles, placed objects, resources. */
function frame(world: Roster, first: Readonly<Controls> = controls(), second: Readonly<Controls> = controls()): void {
  const inputs = [first, second];
  for (let slot = 0; slot < 2; slot++) advanceFighter(world, slot, 0, inputs[slot] ?? controls(), slot === 0 ? -240.0 : 240.0);
  beginDamageContacts();
  for (let slot = 0; slot < 2; slot++) startFighterSpecial(world.fighters[slot]!, 0, 0, inputs[slot] ?? controls());
  resolveAttacks(world);
  advanceSpecials(world, 0, 0);
  updateProjectiles(world);
  finishDamageContacts(world);
  advancePlacedObjects(world);
  for (let slot = 0; slot < 2; slot++) {
    regenerateMana(world.fighters[slot]!);
    advanceHeroStatus(world.fighters[slot]!);
  }
}

function pair(gap: number, facing = 1): { world: Roster; owner: Fighter; target: Fighter } {
  const owner = beastmaster(f32(-gap * 0.5 * facing), facing);
  const target = createFighter(Character.archer, f32(gap * 0.5 * facing), -facing);
  const world = createRoster(3, [owner, target]);
  for (let i = 0; i < 3; i++) frame(world);
  return { world, owner, target };
}

function run(world: Roster, frames: number, press?: Readonly<Controls>): void {
  for (let f = 1; f <= frames; f++) frame(world, f === 1 && press !== undefined ? press : controls());
}

/** Summons the bear (56 frames) and lets it settle behind him. */
function withBear(gap: number, facing = 1) {
  const scene = pair(gap, facing);
  run(scene.world, 56, side);
  run(scene.world, 30);
  return scene;
}

test("Summon Bear costs 25, sets the bear down on f30 and ends on f56; the command and recall then replace side and down", () => {
  const { world, owner } = pair(1000.0);
  run(world, 29, side);
  assertEquals(owner.placed.life, 0);
  frame(world);
  assertGreaterThan(owner.placed.life, 0);
  // Set down 0.6H ahead, it takes its first step toward his heel on the same frame.
  assertNear(f32(owner.placed.x - owner.motion.x), f32(f32(H * f32(0.6)) - BEAR.followSpeed), 1.0);
  assertEquals(owner.placed.durability, 30.0);
  for (let f = 31; f <= 56; f++) frame(world);
  assertEquals(owner.special.action, SpecialAction.none);
  // The trickle refills a point or two over the cast; the summon spent 25.
  assertLessThan(owner.mana.points, 80);
  const before = owner.mana.points;
  frame(world, side);
  assertEquals(owner.special.action, SpecialAction.heroSide);
  assertTrue(owner.mana.points <= before - 8 + 1);
  run(world, 30);
  owner.placed.x = f32(owner.motion.x + 300.0);
  frame(world, down);
  assertEquals(owner.special.action, SpecialAction.heroDown);
  frame(world);
  assertEquals(owner.placed.mode, CompanionMode.returning);
});

test("the bear walks after him 0.8H behind at 0.035H a frame and never leaves its deck", () => {
  const { world, owner } = withBear(600.0);
  owner.motion.x = f32(owner.motion.x + 200.0);
  const start = owner.placed.x;
  frame(world);
  assertNear(f32(owner.placed.x - start), BEAR.followSpeed, f32(0.01));
  run(world, 120);
  assertNear(f32(owner.motion.x - owner.placed.x) * owner.facing, BEAR.followBehind, 1.0);
  // Ordered far past the deck's end, it stops at the edge instead of falling.
  owner.motion.x = -5000.0;
  run(world, 400);
  assertGreaterThan(owner.placed.x, -2000.0);
});

test("Bear Command lunges the bear 0.9H for an 11 bite once, and a second command refuses while it lunges", () => {
  for (const facing of [1, -1]) {
    const { world, owner, target } = withBear(f32(H * f32(1.4)), facing);
    owner.facing = facing;
    // The player has walked the bear in front: it stands 0.9H short of the Archer.
    owner.placed.x = f32(target.motion.x - f32(facing * f32(H * f32(0.9))));
    const start = owner.placed.x;
    frame(world, controls({ specialPressed: true, specialX: facing }));
    const spent = owner.mana.points;
    run(world, 3);
    assertEquals(owner.placed.mode, CompanionMode.lunge);
    frame(world, controls({ specialPressed: true, specialX: facing }));
    assertEquals(owner.mana.points >= spent, true);
    for (let f = 0; f < 40 && target.status.damage === 0.0; f++) frame(world);
    assertEquals(target.status.damage, 11.0);
    assertGreaterThan(f32(target.launch.knockbackX * facing), 0.0);
    run(world, 60);
    assertEquals(target.status.damage, 11.0);
    assertEquals(owner.placed.mode, CompanionMode.follow);
    assertTrue(Math.abs(f32(owner.placed.x - start)) > 0.0);
  }
});

test("a hit on the lunging bear stuns it 18 frames and cancels the bite", () => {
  const { world, owner, target } = withBear(f32(H * f32(1.4)));
  frame(world, side);
  run(world, 3);
  assertEquals(owner.placed.mode, CompanionMode.lunge);
  // The Archer jabs the bear where it stands.
  target.motion.x = f32(owner.placed.x + 45.0);
  target.facing = -1;
  beginFighterAttack(world, 1, AttackStyle.jab, false);
  let stunned = false;
  for (let f = 0; f < 10 && !stunned; f++) {
    frame(world);
    stunned = owner.placed.mode === CompanionMode.stunned;
  }
  assertTrue(stunned);
  assertLessThan(owner.placed.durability, 30.0);
  run(world, 30);
  assertEquals(owner.placed.mode, CompanionMode.follow);
});

test("the bear never bites while he is in hitstun", () => {
  const { world, owner, target } = withBear(f32(H * f32(1.4)));
  frame(world, side);
  run(world, 4);
  owner.launch.hitstun = 40;
  run(world, 30);
  assertEquals(target.status.damage, 0.0);
  assertEquals(owner.placed.mode, CompanionMode.follow);
});

test("Bear Recall walks it back at 0.06H a frame; past 6H for 120 frames it leaves", () => {
  const { world, owner } = withBear(1000.0);
  owner.placed.x = f32(owner.motion.x + 500.0);
  frame(world, down);
  frame(world);
  const start = owner.placed.x;
  frame(world);
  assertNear(f32(start - owner.placed.x), BEAR.returnSpeed, f32(0.01));
  run(world, 120);
  assertEquals(owner.placed.mode, CompanionMode.follow);
  assertGreaterThan(owner.placed.life, 0);
  owner.placed.surface = undefined;
  owner.placed.x = f32(owner.motion.x + f32(H * 11.0));
  run(world, 119);
  assertGreaterThan(owner.placed.life, 0);
  // Following at 0.035H a frame from 11H out, it is still past 6H on the 120th frame.
  frame(world);
  assertEquals(owner.placed.life, 0);
});

test("without a bear: Throwing Axe is free, Quillbeast Dart costs 3, and Hawk Lift's free form peaks near 1.4H", () => {
  const axe = pair(f32(H * 2.0));
  frame(axe.world, neutral);
  assertEquals(axe.owner.mana.points, 100);
  for (let f = 0; f < 40 && axe.target.status.damage === 0.0; f++) frame(axe.world);
  assertEquals(axe.target.status.damage, 7.0);
  const dart = pair(f32(H * 1.5));
  frame(dart.world, down);
  assertEquals(dart.owner.special.action, SpecialAction.heroDown);
  assertEquals(dart.owner.mana.points, 97);
  for (let f = 0; f < 40 && dart.target.status.damage === 0.0; f++) frame(dart.world);
  assertEquals(dart.target.status.damage, 4.0);
  assertTrue(dart.owner.projectiles.every(p => p.life <= 0 || p.kind === ProjectileKind.hero));
  for (const [mana, rise] of [[100, f32(2.0)], [10, f32(1.4)]] as const) {
    const { world, owner } = pair(1000.0);
    owner.mana.points = mana;
    const ground = owner.motion.z;
    let peak = ground;
    frame(world, up);
    assertEquals(owner.mana.points, mana === 100 ? 85 : 10);
    for (let f = 2; f <= 60; f++) {
      frame(world);
      peak = Math.max(peak, owner.motion.z);
    }
    assertNear(f32(peak - ground), f32(H * rise), f32(H * f32(0.1)));
  }
});

test("rollback restores the bear mid-lunge", () => {
  const { world, owner, target } = withBear(f32(H * f32(1.4)));
  owner.placed.x = f32(target.motion.x - f32(H * f32(0.9)));
  frame(world, side);
  run(world, 10);
  const savedOwner = createFighter(Character.beastmaster, 0.0, 1);
  const savedTarget = createFighter(Character.archer, 0.0, 1);
  copyFighterState(savedOwner, owner, 3);
  copyFighterState(savedTarget, target, 3);
  run(world, 20);
  const expectedOwner = createFighter(Character.beastmaster, 0.0, 1);
  const expectedTarget = createFighter(Character.archer, 0.0, 1);
  copyFighterState(expectedOwner, owner, 3);
  copyFighterState(expectedTarget, target, 3);
  assertEquals(target.status.damage, 11.0);
  copyFighterState(owner, savedOwner, 3);
  copyFighterState(target, savedTarget, 3);
  run(world, 20);
  assertEquals(firstFighterDifference(expectedOwner, owner, 3, 3), undefined);
  assertEquals(firstFighterDifference(expectedTarget, target, 3, 3), undefined);
});
