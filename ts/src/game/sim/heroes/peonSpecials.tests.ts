import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, SpecialAction } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { createFighter } from "../fighter";
import { advanceHeroStatus } from "../heroSpecialRules";
import { advancePlacedObjects } from "../placedObjects";
import { attackStartupFrames } from "../moves";
import { updateProjectiles } from "../projectiles";
import { type Controls, type Roster, fighterAt } from "../roster";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { advanceFighter } from "../step";
import { controls, testWorld } from "../testWorld";
import { clearSpecialOnStock } from "../transitions";

function frame(world: Roster, input: Controls = controls()): void {
  advanceFighter(world, 0, 0, input, -240.0);
  advanceFighter(world, 1, 0, controls(), 240.0);
  beginDamageContacts();
  startFighterSpecial(fighterAt(world, 0), 0, 0, input);
  resolveAttacks(world);
  advanceSpecials(world, 0, 0);
  updateProjectiles(world, 0, 0);
  advancePlacedObjects(world);
  finishDamageContacts(world);
  advanceHeroStatus(fighterAt(world, 0));
  advanceHeroStatus(fighterAt(world, 1));
}

function pair(gap = 400.0, facing = 1) {
  const owner = createFighter(Character.peon, -gap * 0.5 * facing, facing);
  const target = createFighter(Character.archer, gap * 0.5 * facing, -facing);
  const world = testWorld(owner, target);
  for (let tick = 0; tick < 3; tick++) frame(world);
  return { world, owner, target };
}
const neutral = controls({ specialPressed: true });
const side = controls({ specialPressed: true, specialX: 1 });
const up = controls({ specialPressed: true, specialZ: 1 });
const down = controls({ specialPressed: true, specialZ: -1 });

test("Peon four special inputs spend once and finish on the authored frame", () => {
  for (const [input, action, cost, end] of [
    [neutral, SpecialAction.heroNeutral, 0, 42], [side, SpecialAction.heroSide, 20, 52],
    [up, SpecialAction.heroUp, 15, 28], [down, SpecialAction.heroDown, 20, 38],
  ] as const) {
    const { world, owner } = pair(900.0);
    frame(world, input);
    assertEquals(owner.special.action, action);
    assertEquals(owner.mana.points, 100 - cost);
    for (let tick = 2; tick <= end; tick++) frame(world);
    assertEquals(owner.special.action, SpecialAction.none);
    assertEquals(owner.mana.points, 100 - cost);
  }
});

test("Peon Lumber Toss strikes once in both facings and never creates a second live log", () => {
  for (const facing of [-1, 1]) {
    const { world, owner, target } = pair(280.0, facing);
    frame(world, neutral);
    for (let tick = 2; tick <= 110; tick++) {
      frame(world, tick === 45 ? neutral : controls());
      assertTrue(owner.projectiles.filter(p => p.life > 0).length <= 1);
    }
    assertEquals(target.status.damage, 14.0);
    assertTrue(owner.projectiles.filter(p => p.life > 0).length <= 1);
  }
});

test("Peon Burrow fires its scheduled spear, packs away, and clears on stock loss", () => {
  const { world, owner, target } = pair(360.0);
  frame(world, side);
  for (let tick = 2; tick <= 26; tick++) frame(world);
  assertEquals(owner.placed.age, 1);
  assertEquals(owner.placed.life, 239);
  assertEquals(owner.placed.durability, 24.0);
  for (let tick = 27; tick <= 100; tick++) frame(world);
  assertGreaterThan(target.status.damage, 0.0);
  frame(world, side);
  for (let tick = 2; tick <= 52; tick++) frame(world);
  assertEquals(owner.placed.life, 0);
  frame(world, side);
  for (let tick = 2; tick <= 26; tick++) frame(world);
  assertGreaterThan(owner.placed.life, 0);
  clearSpecialOnStock(owner);
  assertEquals(owner.placed.life, 0);
});

test("Peon Worksite Launch offers paid and free recovery, spends the jump and ends helpless", () => {
  for (const mana of [100, 0]) {
    const { world, owner } = pair(900.0);
    owner.mana.points = mana;
    owner.motion.grounded = false;
    owner.motion.surface = undefined;
    owner.motion.z = 100.0;
    const start = owner.motion.z;
    frame(world, up);
    for (let tick = 2; tick <= 28; tick++) frame(world);
    assertGreaterThan(owner.motion.z - start, mana === 0 ? 130.0 : 190.0);
    assertEquals(owner.jump.remaining, 0);
    assertTrue(owner.special.fall);
    assertEquals(owner.mana.points, mana === 0 ? 0 : 85);
    frame(world, up);
    assertEquals(owner.special.action, SpecialAction.none);
  }
});

test("Peon Repair heals only a timed contact and leaves a missed read punishable", () => {
  const { world, owner, target } = pair(45.0);
  owner.status.damage = 30.0;
  frame(world, down);
  frame(world);
  frame(world);
  beginFighterAttack(world, 1, AttackStyle.jab, false);
  target.attack.frame = attackStartupFrames(AttackStyle.jab, target.tuning.moves) - 1;
  frame(world);
  assertEquals(owner.status.damage, 26.0);
  assertEquals(owner.status.guardHealed, 4.0);
  const miss = pair(900.0);
  miss.owner.status.damage = 30.0;
  frame(miss.world, down);
  for (let tick = 2; tick <= 38; tick++) frame(miss.world);
  assertEquals(miss.owner.status.damage, 30.0);
});
