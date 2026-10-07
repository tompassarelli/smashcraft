// Blademaster's four specials against the roster rows, run through the
// production special, contact and projectile steps.
import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, ProjectileKind, SpecialAction } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { type Fighter, createFighter } from "../fighter";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { advanceHeroStatus } from "../heroSpecialRules";
import { regenerateMana } from "../mana";
import { HurtContact, strikeHurtContact } from "../hurtboxes";
import { advancePlacedObjects } from "../placedObjects";
import { updateProjectiles } from "../projectiles";
import { type Controls, type Roster, createRoster } from "../roster";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { advanceFighter } from "../step";
import { controls } from "../testWorld";

const H = HERO_REFERENCE_HEIGHT;

function frame(world: Roster, first: Readonly<Controls> = controls(), second: Readonly<Controls> = controls()): void {
  const inputs = [first, second];
  for (let slot = 0; slot < 2; slot++) advanceFighter(world, slot, 0, inputs[slot] ?? controls(), slot === 0 ? -240.0 : 240.0);
  beginDamageContacts();
  for (let slot = 0; slot < 2; slot++) startFighterSpecial(world.fighters[slot]!, 0, 0, inputs[slot] ?? controls());
  resolveAttacks(world);
  advanceSpecials(world, 0, 0, [first, second]);
  updateProjectiles(world);
  advancePlacedObjects(world);
  finishDamageContacts(world);
  for (let slot = 0; slot < 2; slot++) {
    regenerateMana(world.fighters[slot]!);
    advanceHeroStatus(world.fighters[slot]!);
  }
}

function match(gap: number, facing = 1): { world: Roster; owner: Fighter; target: Fighter } {
  const owner = createFighter(Character.blademaster, 0.0, facing);
  const target = createFighter(Character.archer, f32(gap * facing), -facing);
  const world = createRoster(3, [owner, target]);
  for (let i = 0; i < 3; i++) frame(world);
  return { world, owner, target };
}

const press = (specialX: number, specialZ: number) => controls({ specialPressed: true, specialX, specialZ });

/** Highest rise and the forward drift over a grounded up special. */
function risingBlade(mana: number, gap = 60.0): { rise: number; drift: number; mana: number; damage: number } {
  const { world, owner, target } = match(gap);
  owner.mana.points = mana;
  const startZ = owner.motion.z;
  let top = startZ;
  frame(world, press(0, 1));
  const spent = owner.mana.points;
  let drift = 0.0;
  for (let f = 2; f <= 80; f++) {
    frame(world, controls({ direction: f >= 7 && f <= 25 ? 1 : 0 }));
    top = Math.max(top, owner.motion.z);
    if (f === 26) drift = owner.motion.x;
  }
  return { rise: f32(top - startZ), drift, mana: spent, damage: target.status.damage };
}

test("Rising Blade peaks 2.0H up and 0.5H out at 15 mana; below 15 its free form reaches 1.4H and 0.35H without a hit", () => {
  const near = (value: number, heights: number) => Math.abs(value - f32(heights * H)) <= f32(f32(0.02) * H);
  const full = risingBlade(100, 900.0);
  assertEquals(full.mana, 85);
  assertTrue(near(full.rise, 2.0) && near(full.drift, 0.5));
  assertGreaterThan(risingBlade(100).damage, 0.0);
  const free = risingBlade(14, 900.0);
  assertEquals(free.mana, 14);
  assertTrue(near(free.rise, f32(1.4)) && near(free.drift, f32(0.35)));
  assertEquals(risingBlade(14).damage, 0.0);
});

test("Wind Cutter sends one reflectable wave at frame 18 and refuses a second while it lives", () => {
  const { world, owner } = match(900.0);
  frame(world, press(0, 0));
  for (let f = 2; f <= 17; f++) frame(world);
  const live = () => owner.projectiles.filter((p) => p.life > 0 && p.kind === ProjectileKind.hero).length;
  assertEquals(live(), 0);
  frame(world);
  assertEquals(live(), 1);
  for (let f = 19; f <= 40; f++) frame(world);
  assertEquals(owner.special.action, SpecialAction.none);
  assertEquals(owner.mana.points, 100);
});

const attack = (direction = 0) => controls({ attackPressed: true, attackRequested: true, direction });
const run = (world: Roster, frames: number, first: Readonly<Controls> = controls(), second: Readonly<Controls> = controls()) => {
  for (let f = 0; f < frames; f++) frame(world, first, second);
};
const ahead = (owner: Fighter, target: Fighter, facing: number) => f32(f32(target.motion.x - owner.motion.x) * facing);

test("Wind Walk costs 18, walks 2.2H through a body without striking and recovers through frame 44", () => {
  for (const facing of [-1, 1]) {
    const { world, owner, target } = match(150.0, facing);
    frame(world, press(facing, 0));
    assertEquals(owner.mana.points, 82);
    run(world, 31);
    assertTrue(Math.abs(f32(f32(owner.motion.x * facing) - f32(f32(2.2) * H))) <= 2.0);
    assertLessThan(ahead(owner, target, facing), 0.0);
    assertEquals(target.status.damage, 0.0);
    assertEquals(owner.special.action, SpecialAction.heroSide);
    run(world, 12);
    assertEquals(owner.special.action, SpecialAction.none);
  }
});

test("Wind Walk stops short of a raised shield, and the Backstab is blocked by it", () => {
  const { world, owner, target } = match(150.0);
  const guard = controls({ shield: true, shieldTriggerActive: true });
  frame(world, press(1, 0), guard);
  run(world, 15, controls(), guard);
  assertTrue(target.shield.raised);
  assertGreaterThan(ahead(owner, target, 1), 40.0);
  frame(world, attack(), guard);
  run(world, 10, controls(), guard);
  assertEquals(target.status.damage, 0.0);
});

test("Backstab: an attack press in the walk slashes in front, or behind with the stick held back", () => {
  for (const facing of [-1, 1]) {
    const front = match(180.0, facing);
    frame(front.world, press(facing, 0));
    run(front.world, 11);
    frame(front.world, attack())
    run(front.world, 9);
    assertEquals(front.target.status.damage, 11.460000038146973);
    run(front.world, 20);
    assertGreaterThan(f32(front.target.motion.x * facing), 180.0);
    const behind = match(60.0, facing);
    frame(behind.world, press(facing, 0));
    run(behind.world, 15);
    assertLessThan(ahead(behind.owner, behind.target, facing), 0.0);
    frame(behind.world, attack(-facing));
    assertEquals(behind.owner.facing, -facing);
    run(behind.world, 9);
    assertEquals(behind.target.status.damage, 11.460000038146973);
    run(behind.world, 20);
    assertLessThan(f32(behind.target.motion.x * facing), 60.0);
  }
});

test("Step out: a special press in the walk stops it and ends the action 8 frames later", () => {
  const { world, owner, target } = match(900.0);
  frame(world, press(1, 0));
  run(world, 11);
  const x = owner.motion.x;
  frame(world, press(0, 0));
  run(world, 7);
  assertEquals(owner.special.action, SpecialAction.none);
  assertTrue(Math.abs(f32(owner.motion.x - x)) <= f32(f32(0.1) * H));
  assertEquals(owner.mana.points, 82);
  assertEquals(target.status.damage, 0.0);
  run(world, 1);
  assertEquals(owner.attack.cooldown, 0);
});

test("Wind Walk in the air is once per airtime and ends helpless", () => {
  const { world, owner } = match(900.0);
  owner.motion.grounded = false;
  owner.motion.surface = undefined;
  owner.motion.z = 400.0;
  frame(world, press(1, 0));
  run(world, 43);
  assertEquals(owner.special.action, SpecialAction.none);
  assertTrue(owner.special.fall);
  owner.special.fall = false;
  frame(world, press(1, 0));
  assertEquals(owner.special.action, SpecialAction.none);
});

test("Mirror Image leaves an image and steps 1.0H away; down special again swaps onto it and slashes", () => {
  for (const facing of [-1, 1]) {
    const { world, owner, target } = match(70.0, facing);
    frame(world, press(0, -1));
    assertEquals(owner.mana.points, 85);
    run(world, 23);
    assertEquals(owner.special.action, SpecialAction.none);
    assertTrue(owner.placed.life > 0);
    assertEquals(owner.placed.x, 0.0);
    assertTrue(Math.abs(f32(f32(owner.motion.x * facing) + f32(1.0 * H))) <= 2.0);
    frame(world, press(0, -1));
    assertEquals(owner.mana.points, 85);
    run(world, 5);
    assertEquals(owner.motion.x, 0.0);
    assertEquals(owner.placed.life, 0);
    run(world, 5);
    assertEquals(target.status.damage, 9.550000190734863);
  }
});

test("Mirror Image counterplay: a hit shatters the image, so the next press is a new image; a shield blocks the swap slash", () => {
  const { world, owner } = match(40.0);
  frame(world, press(0, -1));
  run(world, 23);
  assertTrue(owner.placed.life > 0);
  beginFighterAttack(world, 1, AttackStyle.jab, false);
  run(world, 20);
  assertEquals(owner.placed.life, 0);
  const before = owner.mana.points;
  frame(world, press(0, -1));
  assertEquals(owner.mana.points, before - 15);
  const guarded = match(70.0);
  const guard = controls({ shield: true, shieldTriggerActive: true });
  frame(guarded.world, press(0, -1));
  run(guarded.world, 23);
  frame(guarded.world, press(0, -1), guard);
  run(guarded.world, 12, controls(), guard);
  assertEquals(guarded.target.status.damage, 0.0);
});

test("Backstab exposes the sword arm around its slash while the blade stays disjoint", () => {
  const { world, owner } = match(900.0);
  frame(world, press(1, 0));
  const probe = (x: number, z: number) => strikeHurtContact({ x1: f32(owner.motion.x + x), z1: z, x2: f32(owner.motion.x + x), z2: z, radius: 4.0 }, owner);
  run(world, 11);
  frame(world, attack());
  run(world, 2);
  assertEquals(probe(46.0, 56.0), HurtContact.none);
  run(world, 1);
  assertEquals(probe(46.0, 56.0), HurtContact.hit);
  assertEquals(probe(110.0, 50.0), HurtContact.none);
});
