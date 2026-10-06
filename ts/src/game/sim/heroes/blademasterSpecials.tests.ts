// Blademaster's four specials against the roster rows, run through the
// production special, contact and projectile steps.
import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { resolveAttacks } from "../attacks";
import { Character, ProjectileKind, SpecialAction } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { type Fighter, createFighter } from "../fighter";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { advanceHeroStatus, regenerateMana } from "../heroSpecialRules";
import { HurtContact, strikeHurtContact } from "../hurtboxes";
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
  advanceSpecials(world, 0, 0);
  updateProjectiles(world);
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
    frame(world);
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

test("Wind Walk Strike costs 18, stops short of a raised shield and slashes an exposed target", () => {
  for (const facing of [-1, 1]) {
    const { world, owner, target } = match(150.0, facing);
    const guard = controls({ shield: true, shieldTriggerActive: true });
    frame(world, press(facing, 0), guard);
    assertEquals(owner.mana.points, 82);
    for (let f = 2; f <= 22; f++) frame(world, controls(), guard);
    assertTrue(target.shield.raised);
    assertGreaterThan(f32(f32(target.motion.x - owner.motion.x) * facing), 48.0);
    assertEquals(target.status.damage, 0.0);
    const open = match(300.0, facing);
    frame(open.world, press(facing, 0));
    for (let f = 2; f <= 30; f++) frame(open.world);
    assertEquals(open.target.status.damage, 11.0);
    assertGreaterThan(f32(f32(open.target.motion.x - open.owner.motion.x) * facing), 0.0);
  }
});

test("Mirror Feint steps back 0.5H; a second press inside its window requests the real slash", () => {
  const { world, owner, target } = match(60.0);
  frame(world, press(0, -1));
  assertEquals(owner.mana.points, 85);
  for (let f = 2; f <= 11; f++) frame(world);
  frame(world, press(0, -1));
  for (let f = 2; f <= 4; f++) frame(world);
  assertTrue(Math.abs(owner.motion.x + f32(0.5 * H)) <= f32(f32(0.02) * H));
  for (let f = 5; f <= 12; f++) frame(world);
  assertEquals(target.status.damage, 10.0);
  assertEquals(owner.mana.points, 85);
  const missed = match(140.0);
  frame(missed.world, press(0, -1));
  for (let f = 2; f <= 24; f++) frame(missed.world);
  assertEquals(missed.owner.special.action, SpecialAction.none);
  assertEquals(missed.target.status.damage, 0.0);
});

test("Wind Walk Strike exposes the sword arm around its slash while the blade stays disjoint", () => {
  const { world, owner } = match(900.0);
  frame(world, press(1, 0));
  const probe = (x: number, z: number) => strikeHurtContact({ x1: f32(owner.motion.x + x), z1: z, x2: f32(owner.motion.x + x), z2: z, radius: 4.0 }, owner);
  for (let f = 2; f <= 17; f++) frame(world);
  assertEquals(probe(46.0, 56.0), HurtContact.none);
  frame(world);
  assertEquals(probe(46.0, 56.0), HurtContact.hit);
  assertEquals(probe(110.0, 50.0), HurtContact.none);
});
