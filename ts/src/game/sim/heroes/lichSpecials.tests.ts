// Lich's specials through the production special, projectile, contact and
// resource functions: costs, placement, the free recovery and the armor shell.
import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, ProjectileKind, SpecialAction } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { type Fighter, createFighter } from "../fighter";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { advanceHeroStatus, regenerateMana } from "../heroSpecialRules";
import { fighterHurtParts } from "../hurtboxes";
import { updateProjectiles } from "../projectiles";
import { type Controls, type Roster, createRoster } from "../roster";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { advanceFighter } from "../step";
import { controls } from "../testWorld";
import { copyFighterState } from "../../replay/fighterState";
import { firstFighterDifference } from "../../replay/difference";

const H = HERO_REFERENCE_HEIGHT;

/** One match-ordered frame on `stage`: motion, special starts, contacts, specials, projectiles, resources. */
function frame(world: Roster, first: Readonly<Controls> = controls(), second: Readonly<Controls> = controls(), stage = 0): void {
  const inputs = [first, second];
  for (let slot = 0; slot < 2; slot++) advanceFighter(world, slot, stage, inputs[slot] ?? controls(), slot === 0 ? -240.0 : 240.0);
  beginDamageContacts();
  for (let slot = 0; slot < 2; slot++) startFighterSpecial(world.fighters[slot]!, stage, 0, inputs[slot] ?? controls());
  resolveAttacks(world);
  advanceSpecials(world, stage, 0, inputs);
  updateProjectiles(world);
  finishDamageContacts(world);
  for (let slot = 0; slot < 2; slot++) {
    regenerateMana(world.fighters[slot]!);
    advanceHeroStatus(world.fighters[slot]!);
  }
}

function lichPair(gap: number, opponent: Character = Character.archer): { world: Roster; lich: Fighter; target: Fighter } {
  const lich = createFighter(Character.lich, f32(-gap * 0.5), 1);
  const target = createFighter(opponent, f32(gap * 0.5), -1);
  const world = createRoster(3, [lich, target]);
  for (let i = 0; i < 3; i++) frame(world);
  lich.mana.sinceSpend = 120;
  return { world, lich, target };
}

const live = (f: Readonly<Fighter>) => f.projectiles.filter(p => p.life > 0 && p.kind === ProjectileKind.hero);
const neutral = controls({ specialPressed: true });
const sideForward = controls({ specialPressed: true, specialX: 1 });
const sideBack = controls({ specialPressed: true, specialX: -1 });
const up = controls({ specialPressed: true, specialZ: 1 });
const down = controls({ specialPressed: true, specialZ: -1 });

test("Frost Shard is free, leaves the hand on frame 20 and keeps one shard alive", () => {
  const { world, lich } = lichPair(1200.0);
  frame(world, neutral);
  assertEquals(lich.special.action, SpecialAction.heroNeutral);
  for (let f = 2; f <= 19; f++) frame(world);
  assertEquals(live(lich).length, 0);
  frame(world);
  assertEquals(live(lich).length, 1);
  assertNear(Math.abs(live(lich)[0]!.velocityX), f32(H * f32(0.10)), f32(0.01));
  for (let f = 21; f <= 45; f++) frame(world);
  assertEquals(lich.special.action, SpecialAction.none);
  frame(world, neutral);
  assertEquals(lich.special.action, SpecialAction.none);
  assertEquals(lich.mana.points, 100);
});

test("Frost Nova costs 20, places a fixed marker 1.5H ahead and bursts on frame 30 only", () => {
  const ahead = f32(H * f32(1.5));
  const { world, lich, target } = lichPair(ahead);
  frame(world, sideForward);
  assertEquals(lich.mana.points, 80);
  for (let f = 2; f <= 8; f++) frame(world);
  const marker = live(lich)[0]!;
  assertNear(marker.x, f32(lich.motion.x + ahead), 1.0);
  for (let f = 9; f <= 29; f++) frame(world);
  assertNear(marker.x, f32(lich.motion.x + ahead), 1.0);
  assertEquals(target.status.damage, 0.0);
  frame(world);
  assertEquals(target.status.damage, 11.0);
  for (let f = 31; f <= 58; f++) frame(world);
  assertEquals(lich.special.action, SpecialAction.none);
  assertEquals(target.status.damage, 11.0);
});

test("Frost Nova pressed backward keeps Lich's facing and places the marker 0.9H ahead", () => {
  const { world, lich } = lichPair(1200.0);
  frame(world, sideBack);
  assertEquals(lich.special.action, SpecialAction.heroSide);
  assertEquals(lich.facing, 1);
  for (let f = 2; f <= 8; f++) frame(world);
  assertNear(live(lich)[0]!.x, f32(lich.motion.x + f32(H * f32(0.9))), 1.0);
});

test("interrupting Lich before the burst removes the marker", () => {
  const { world, lich, target } = lichPair(70.0, Character.lich);
  frame(world, sideForward);
  for (let f = 2; f <= 10; f++) frame(world);
  assertEquals(live(lich).length, 1);
  beginFighterAttack(world, 1, AttackStyle.forwardTilt, false);
  for (let f = 0; f < 12; f++) frame(world);
  assertGreaterThan(lich.status.damage, 0.0);
  assertEquals(live(lich).length, 0);
  assertEquals(target.status.damage, 0.0);
});

test("Frost Nova is not placed through solid stage geometry", () => {
  const placedFrom = (z: number): number => {
    const { world, lich } = lichPair(1600.0);
    // Below the main deck's top, off its left wall, facing the deck.
    lich.motion.x = -680.0;
    lich.motion.z = z;
    lich.motion.grounded = false;
    lich.motion.surface = undefined;
    frame(world, sideForward);
    for (let f = 2; f <= 8; f++) frame(world);
    return live(lich).length;
  };
  assertEquals(placedFrom(-90.0), 0);
  assertEquals(placedFrom(160.0), 1);
});

test("Spectral Ascent rises 2.1H and steers at most 0.4H; the zero-mana form rises 1.4H for free", () => {
  const ascend = (mana: number, stick: number) => {
    const { world, lich } = lichPair(600.0);
    lich.mana.points = mana;
    const steer = controls({ direction: stick });
    frame(world, up);
    for (let f = 2; f <= 9; f++) frame(world);
    const x = lich.motion.x;
    const z = lich.motion.z;
    // Velocity set on frame N moves the fighter on frame N + 1.
    for (let f = 10; f <= 35; f++) frame(world, steer);
    return { rise: f32(lich.motion.z - z), drift: f32(lich.motion.x - x), mana: lich.mana.points, helpless: lich.special.fall };
  };
  const full = ascend(100, 0);
  assertNear(full.rise, f32(H * f32(2.1)), 2.0);
  assertEquals(full.mana, 85);
  assertTrue(full.helpless);
  assertLessThan(Math.abs(full.drift), 1.0);
  const steered = ascend(100, -1);
  assertNear(steered.drift, f32(-H * f32(0.4)), 2.0);
  const free = ascend(10, 0);
  assertEquals(free.mana, 10);
  assertNear(free.rise, f32(H * f32(1.4)), 2.0);
  assertTrue(free.helpless);
});

test("Frost Armor's shell outlasts the cast, takes one small hit's reaction and blocks a recast", () => {
  const { world, lich, target } = lichPair(70.0, Character.lich);
  lich.facing = 1;
  frame(world, down);
  assertEquals(lich.mana.points, 75);
  for (let f = 2; f <= 20; f++) frame(world);
  assertEquals(lich.status.armorFrames, 0);
  frame(world);
  assertGreaterThan(lich.status.armorFrames, 0);
  for (let f = 22; f <= 120; f++) frame(world);
  assertEquals(lich.special.action, SpecialAction.none);
  assertGreaterThan(lich.status.armorFrames, 0);
  frame(world, down);
  assertEquals(lich.special.action, SpecialAction.none);
  assertEquals(lich.mana.points, 75);
  // A 3% Bone Knuckle: damage applies, the reaction does not, and the shell is spent.
  target.facing = -1;
  beginFighterAttack(world, 1, AttackStyle.jab, false);
  for (let f = 0; f < 8; f++) frame(world);
  assertEquals(lich.status.damage, 3.0);
  assertEquals(lich.launch.hitstun, 0);
  assertEquals(lich.status.armorFrames, 0);
  for (let f = 0; f < 20; f++) frame(world);
  beginFighterAttack(world, 1, AttackStyle.jab, false);
  for (let f = 0; f < 8; f++) frame(world);
  assertEquals(lich.status.damage, 6.0);
  assertFalse(lich.launch.hitstun === 0 && lich.launch.hitlag === 0 && lich.motion.vx === 0.0);
});

test("an unbroken Frost Armor shell expires 180 frames after it forms", () => {
  const { world, lich } = lichPair(600.0);
  frame(world, down);
  for (let f = 2; f <= 22 + 178; f++) frame(world);
  assertGreaterThan(lich.status.armorFrames, 0);
  frame(world);
  frame(world);
  assertEquals(lich.status.armorFrames, 0);
});


test("Frost Shard and Frost Nova casts extend Lich's hittable casting arm only while casting", () => {
  const { world, lich } = lichPair(1200.0);
  frame(world, neutral);
  for (let f = 2; f <= 15; f++) frame(world);
  assertEquals(fighterHurtParts(lich).length, 1);
  frame(world);
  assertEquals(fighterHurtParts(lich).length, 2);
  for (let f = 17; f <= 27; f++) frame(world);
  assertEquals(fighterHurtParts(lich).length, 1);
  for (let f = 28; f <= 45; f++) frame(world);
  frame(world, sideForward);
  for (let f = 2; f <= 5; f++) frame(world);
  assertEquals(fighterHurtParts(lich).length, 2);
});

test("replaying Lich's nova, armor and ascent from a restored snapshot reproduces both fighters", () => {
  const { world, lich, target } = lichPair(f32(H * f32(1.5)));
  const savedLich = createFighter(Character.lich, 0.0, 1);
  const savedTarget = createFighter(Character.archer, 0.0, 1);
  copyFighterState(savedLich, lich, 3);
  copyFighterState(savedTarget, target, 3);
  const run = () => {
    frame(world, sideForward);
    for (let f = 2; f <= 60; f++) frame(world);
    frame(world, down);
    for (let f = 2; f <= 50; f++) frame(world);
    frame(world, up);
    for (let f = 2; f <= 40; f++) frame(world, controls({ direction: 1 }));
  };
  run();
  assertGreaterThan(target.status.damage, 0.0);
  assertGreaterThan(lich.status.armorFrames, 0);
  const endLich = createFighter(Character.lich, 0.0, 1);
  const endTarget = createFighter(Character.archer, 0.0, 1);
  copyFighterState(endLich, lich, 3);
  copyFighterState(endTarget, target, 3);
  copyFighterState(lich, savedLich, 3);
  copyFighterState(target, savedTarget, 3);
  run();
  assertEquals(firstFighterDifference(endLich, lich, 3, 3), undefined);
  assertEquals(firstFighterDifference(endTarget, target, 3, 3), undefined);
});

test("an Archer inside forward-tilt range challenges Frost Shard's startup and no shard is thrown", () => {
  const { world, lich } = lichPair(90.0);
  frame(world, neutral);
  for (let f = 2; f <= 6; f++) frame(world);
  beginFighterAttack(world, 1, AttackStyle.jab, false);
  for (let f = 7; f <= 25; f++) frame(world);
  assertGreaterThan(lich.status.damage, 0.0);
  assertEquals(lich.special.action, SpecialAction.none);
  assertEquals(live(lich).length, 0);
});
