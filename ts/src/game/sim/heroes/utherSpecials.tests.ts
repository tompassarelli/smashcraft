// Uther's four specials through the production special, contact, projectile
// and mana functions (smashcraft:docs/design/roster.md, "Uther").
import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { copyFighterState } from "../../replay/fighterState";
import { firstFighterDifference } from "../../replay/difference";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, ProjectileKind, SpecialAction } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { type Fighter, createFighter } from "../fighter";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { advanceHeroStatus, refillMana, regenerateMana } from "../heroSpecialRules";
import { updateProjectiles } from "../projectiles";
import { type Controls, type Roster, createRoster } from "../roster";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { advanceFighter } from "../step";
import { controls } from "../testWorld";
import { UTHER_SPECIALS } from "./utherSpecials";

/** One match-ordered frame; `strike` starts the second fighter's attack before contacts. */
function frame(world: Roster, first: Readonly<Controls> = controls(), strike?: AttackStyle): void {
  const inputs = [first, controls()];
  for (let slot = 0; slot < 2; slot++) advanceFighter(world, slot, 0, inputs[slot] ?? controls(), slot === 0 ? -240.0 : 240.0);
  beginDamageContacts();
  for (let slot = 0; slot < 2; slot++) startFighterSpecial(world.fighters[slot]!, 0, 0, inputs[slot] ?? controls());
  beginFighterAttack(world, 1, strike, false);
  resolveAttacks(world);
  advanceSpecials(world, 0, 0);
  updateProjectiles(world);
  finishDamageContacts(world);
  for (let slot = 0; slot < 2; slot++) {
    regenerateMana(world.fighters[slot]!);
    advanceHeroStatus(world.fighters[slot]!);
  }
}

function pair(gap: number, opponent: Character = Character.archer): { world: Roster; owner: Fighter; target: Fighter } {
  const owner = createFighter(Character.uther, f32(-gap * 0.5), 1);
  const target = createFighter(opponent, f32(gap * 0.5), -1);
  const world = createRoster(3, [owner, target]);
  for (let i = 0; i < 3; i++) frame(world);
  return { world, owner, target };
}

const H = HERO_REFERENCE_HEIGHT;
const neutral = controls({ specialPressed: true });
const side = controls({ specialPressed: true, specialX: 1 });
const up = controls({ specialPressed: true, specialZ: 1 });
const down = controls({ specialPressed: true, specialZ: -1 });


const near = (actual: number, expected: number, tolerance: number) => assertTrue(Math.abs(actual - expected) <= tolerance);

test("Uther's specials spend their listed mana once and end on their listed frames", () => {
  for (const [input, action, cost, end] of [
    [neutral, SpecialAction.heroNeutral, 5, 47],
    [side, SpecialAction.heroSide, 20, 47],
    [up, SpecialAction.heroUp, 15, 29],
    [down, SpecialAction.heroDown, 25, 36],
  ] as const) {
    const { world, owner } = pair(900.0);
    frame(world, input);
    assertEquals(owner.special.action, action);
    assertEquals(owner.mana.points, 100 - cost);
    for (let f = 2; f <= end; f++) {
      assertEquals(owner.special.action, action);
      frame(world);
    }
    assertEquals(owner.special.action, SpecialAction.none);
    assertEquals(owner.mana.points, 100 - cost);
  }
  assertEquals(UTHER_SPECIALS.up.free?.cost, 0);
});

test("Holy Bolt leaves on frame 22, flies straight or 30 degrees up when up is held, and strikes once for 7", () => {
  for (const vertical of [0, 1]) {
    const { world, owner, target } = pair(300.0);
    frame(world, controls({ specialPressed: true, verticalDirection: vertical }));
    assertEquals(owner.special.action, SpecialAction.heroNeutral);
    for (let f = 2; f <= 21; f++) frame(world);
    assertEquals(owner.projectiles.filter((p) => p.life > 0).length, 0);
    frame(world);
    const bolt = owner.projectiles.find((p) => p.life > 0 && p.kind === ProjectileKind.hero);
    assertTrue(bolt !== undefined);
    if (bolt === undefined) continue;
    if (vertical === 0) assertEquals(bolt.velocityZ, 0.0);
    else near(bolt.velocityZ / bolt.velocityX, Math.tan(Math.PI / 6), f32(0.001));
    for (let f = 0; f < 40; f++) frame(world);
    assertEquals(target.status.damage, vertical === 0 ? 7.0 : 0.0);
  }
});

test("Crusader Rush advances 0.9H, strikes once for 11, and only the grounded rush carries armor", () => {
  const far = pair(900.0);
  const start = far.owner.motion.x;
  frame(far.world, side);
  for (let f = 2; f <= 48; f++) {
    frame(far.world);
    // Armor set after frame f covers the hits resolved on frame f + 1: f12-15.
    assertEquals(far.owner.status.armorFrames > 0, f >= 11 && f <= 14);
  }
  near(f32(far.owner.motion.x - start) / H, f32(0.9), f32(0.02));
  const close = pair(150.0);
  frame(close.world, side);
  for (let f = 2; f <= 48; f++) frame(close.world);
  assertEquals(close.target.status.damage, 11.0);
  const air = pair(900.0);
  air.owner.motion.grounded = false;
  air.owner.motion.z = 1200.0;
  frame(air.world, side);
  for (let f = 2; f <= 47; f++) {
    assertEquals(air.owner.status.armorFrames, 0);
    frame(air.world);
  }
  assertTrue(air.owner.special.fall);
  air.owner.special.fall = false;
  frame(air.world, side);
  assertEquals(air.owner.special.action, SpecialAction.none);
});

test("Ascension rises 1.9H with one hit, its free form 1.3H without one, both drifting 0.45H into a helpless fall", () => {
  for (const [mana, rise, damage] of [[100, f32(1.9), 8.0], [14, f32(1.3), 0.0]] as const) {
    const { world, owner } = pair(900.0);
    owner.mana.points = mana;
    const x = owner.motion.x;
    const z = owner.motion.z;
    frame(world, up);
    assertEquals(owner.mana.points, mana === 100 ? 85 : 14);
    let top = z;
    for (let f = 2; f <= 30; f++) {
      frame(world);
      top = Math.max(top, owner.motion.z);
    }
    near(f32(top - z) / H, rise, f32(0.03));
    near(f32(owner.motion.x - x) / H, f32(0.45), f32(0.03));
    assertTrue(owner.special.fall);
    const close = pair(40.0);
    close.owner.mana.points = mana;
    frame(close.world, up);
    for (let f = 2; f <= 30; f++) frame(close.world);
    assertEquals(close.target.status.damage, damage);
  }
});

test("Divine Guard fails in the air without spending and is intangible only on f6-9", () => {
  const air = pair(900.0);
  air.owner.motion.grounded = false;
  air.owner.motion.z = 400.0;
  frame(air.world, down);
  assertEquals(air.owner.special.action, SpecialAction.none);
  assertEquals(air.owner.mana.points, 100);
  // A second Uther's jab (active on its frames 5-6) pressed on the guard's frame `press`.
  for (let press = 2; press <= 8; press++) {
    const { world, owner } = pair(60.0, Character.uther);
    owner.status.damage = 20.0;
    frame(world, down);
    for (let f = 2; f <= 40; f++) frame(world, controls(), f === press ? AttackStyle.jab : undefined);
    const guarded = press <= 5;
    assertEquals(owner.status.guardHealed, guarded ? 3.0 : 0.0);
    // Pressed on frame 5, the jab's second active frame lands on frame 10, after the guard.
    assertEquals(owner.status.damage, press <= 4 ? 17.0 : press === 5 ? 21.0 : 24.0);
  }
});

test("Divine Guard's healing stops at 8 percent a stock, never below zero damage, and a new stock restores it", () => {
  const { world, owner } = pair(60.0, Character.uther);
  owner.status.damage = 30.0;
  for (let guard = 0; guard < 4; guard++) {
    owner.mana.points = 100;
    frame(world, down);
    for (let f = 2; f <= 40; f++) frame(world, controls(), f === 3 ? AttackStyle.jab : undefined);
  }
  assertEquals(owner.status.guardHealed, 8.0);
  assertEquals(owner.status.damage, 22.0);
  refillMana(owner);
  assertEquals(owner.status.guardHealed, 0.0);
  owner.status.damage = 1.0;
  frame(world, down);
  for (let f = 2; f <= 40; f++) frame(world, controls(), f === 3 ? AttackStyle.jab : undefined);
  assertEquals(owner.status.damage, 0.0);
  assertEquals(owner.status.guardHealed, 1.0);
});

test("a grab beats Divine Guard once its intangible frames end", () => {
  const { world, owner, target } = pair(60.0, Character.uther);
  frame(world, down);
  for (let f = 2; f <= 12; f++) frame(world, controls(), f === 4 ? AttackStyle.grab : undefined);
  assertEquals(target.grab.target, 0);
  assertEquals(owner.grab.owner, 1);
  assertEquals(owner.special.action, SpecialAction.none);
});

test("replaying Uther's guard and rush from a restored snapshot reproduces every fighter field", () => {
  const { world, owner, target } = pair(60.0, Character.uther);
  owner.status.damage = 20.0;
  const savedOwner = createFighter(Character.uther, 0.0, 1);
  const savedTarget = createFighter(Character.uther, 0.0, 1);
  frame(world, down);
  copyFighterState(savedOwner, owner, 3);
  copyFighterState(savedTarget, target, 3);
  const run = () => {
    for (let f = 2; f <= 40; f++) frame(world, f === 38 ? side : controls(), f === 3 ? AttackStyle.jab : undefined);
    for (let f = 0; f < 50; f++) frame(world);
  };
  run();
  const endOwner = createFighter(Character.uther, 0.0, 1);
  const endTarget = createFighter(Character.uther, 0.0, 1);
  copyFighterState(endOwner, owner, 3);
  copyFighterState(endTarget, target, 3);
  assertGreaterThan(owner.status.guardHealed, 0.0);
  assertLessThan(owner.mana.points, 100);
  copyFighterState(owner, savedOwner, 3);
  copyFighterState(target, savedTarget, 3);
  assertFalse(owner.special.guarded);
  run();
  assertEquals(firstFighterDifference(endOwner, owner, 3, 3), undefined);
  assertEquals(firstFighterDifference(endTarget, target, 3, 3), undefined);
});
