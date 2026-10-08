import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character, ContactKind } from "./codes";
import { collectDamageContact } from "./contacts";
import { createFighter } from "./fighter";
import { HERO_ROSTER } from "./heroes/registry";
import { startFighterSpecial } from "./specials";
import { checkBlastZone, respawnFighter } from "./stocks";
import { contactBatch, controls, hitEffect, testWorld } from "./testWorld";
import { advanceSolo } from "./testWorld";
import { copyFighterState } from "../replay/fighterState";
import { firstFighterDifference } from "../replay/difference";

const roster: readonly Character[] = [Character.archer, Character.rifleman, Character.demonHunter, ...HERO_ROSTER.map(hero => hero.character)];

test("all 88 regular specials start in their full form at zero meter [spec #335]", () => {
  let count = 0;
  for (const character of roster) for (const [x, z] of [[0, 0], [1, 0], [0, 1], [0, -1]] as const) {
    const fighter = createFighter(character, 0.0, 1);
    fighter.motion.grounded = true;
    fighter.motion.surface = 0;
    const world = testWorld(fighter, createFighter(Character.archer, 900.0, -1));
    assertEquals(fighter.mana.points, 0);
    assertTrue(startFighterSpecial(fighter, 0, 0, controls({ specialPressed: true, specialX: x, specialZ: z }), world));
    assertEquals(fighter.mana.points, 0);
    assertEquals(fighter.visuals.manaDenied, 0);
    count++;
  }
  assertEquals(count, 88);
});

test("body damage earns 1 meter per whole percent dealt capped at 12 and half as much taken capped at 6 [spec #335]", () => {
  for (const [damage, dealt, taken] of [[7.0, 7, 3], [3.5, 3, 1], [20.0, 12, 6]] as const) {
    for (const [kind, direct] of [[ContactKind.launch, true], [ContactKind.flinch, false], [ContactKind.throw, false], [ContactKind.pummel, true]] as const) {
      const source = createFighter(Character.rifleman, 0.0, 1);
      const target = createFighter(Character.archer, 40.0, -1);
      source.mana.points = 50;
      target.mana.points = 50;
      const world = testWorld(source, target);
      contactBatch(world, () => collectDamageContact(world, 0, 1, hitEffect(damage, 0.0, 0.0, 1.0, 0.0), 1, kind, direct, undefined, false));
      assertEquals(source.mana.points, 50 + dealt);
      assertEquals(target.mana.points, 50 + taken);
    }
  }
});

test("shielded damage earns no meter and a full bar stops at 100 [spec #335]", () => {
  for (const shielded of [false, true]) {
    const source = createFighter(Character.rifleman, 0.0, 1);
    const target = createFighter(Character.archer, 40.0, -1);
    source.mana.points = 98; target.mana.points = 98;
    target.shield.raised = shielded;
    const world = testWorld(source, target);
    contactBatch(world, () => collectDamageContact(world, 0, 1, hitEffect(10.0, 0.0, 0.0, 1.0, 0.0), 1, ContactKind.launch, true, undefined, shielded));
    assertEquals(source.mana.points, shielded ? 98 : 100);
    assertEquals(target.mana.points, shielded ? 98 : 100);
  }
});

test("meter starts empty, never fills idle and survives stock loss and respawn [spec #335]", () => {
  const fighter = createFighter(Character.jaina, 0.0, 1);
  assertEquals(fighter.mana.points, 0);
  for (let frame = 0; frame < 120; frame++) advanceSolo(fighter, 0, controls(), 0.0);
  assertEquals(fighter.mana.points, 0);
  fighter.mana.points = 73;
  const world = testWorld(fighter, createFighter(Character.archer, 40.0, -1));
  fighter.motion.x = 10000.0;
  checkBlastZone(world, 0);
  assertTrue(fighter.status.out);
  assertEquals(fighter.mana.points, 73);
  respawnFighter(world, 0, 0.0);
  assertEquals(fighter.mana.points, 73);
});

test("earned and carried meter restores exactly with fighter rollback state [invariant]", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  fighter.mana.points = 73;
  const copy = createFighter(Character.archer, 0.0, 1);
  copyFighterState(copy, fighter, 3);
  assertEquals(firstFighterDifference(copy, fighter, 3, 3), undefined);
});
