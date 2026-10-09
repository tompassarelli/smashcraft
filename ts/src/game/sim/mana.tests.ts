import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { floorDiv } from "wisp/src/sim/intMath";
import { Character, ContactKind } from "./codes";
import { collectDamageContact } from "./contacts";
import { createFighter } from "./fighter";
import { SELECTABLE_CHARACTERS } from "./heroes/registry";
import { ROSTER_MANA } from "./mana";
import { startFighterSpecial } from "./specials";
import { checkBlastZone, respawnFighter } from "./stocks";
import { contactBatch, controls, hitEffect, testWorld } from "./testWorld";
import { advanceSolo } from "./testWorld";
import { copyFighterState } from "../replay/fighterState";
import { firstFighterDifference } from "../replay/difference";

test("every regular special starts in its full form at zero meter [spec #335]", () => {
  for (const character of SELECTABLE_CHARACTERS) for (const [x, z] of [[0, 0], [1, 0], [0, 1], [0, -1]] as const) {
    const fighter = createFighter(character, 0.0, 1);
    fighter.motion.grounded = true;
    fighter.motion.surface = 0;
    const world = testWorld(fighter, createFighter(Character.rifleman, 900.0, -1));
    assertEquals(fighter.mana.points, 0);
    assertTrue(startFighterSpecial(fighter, 0, 0, controls({ specialPressed: true, specialX: x, specialZ: z }), world));
    assertEquals(fighter.mana.points, 0);
    assertEquals(fighter.visuals.manaDenied, 0);
  }
});

test("body damage earns 1 meter per whole percent dealt capped at 12 and half as much taken capped at 6 [spec #335]", () => {
  for (const damage of [7.0, 3.5, 20.0]) {
    const whole = Math.floor(damage);
    const dealt = Math.min(ROSTER_MANA.dealtCap, whole * ROSTER_MANA.dealtPerPercent);
    const taken = Math.min(ROSTER_MANA.takenCap, floorDiv(whole, ROSTER_MANA.takenPercentPerPoint));
    for (const [kind, direct] of [[ContactKind.launch, true], [ContactKind.flinch, false], [ContactKind.throw, false], [ContactKind.pummel, true]] as const) {
      const source = createFighter(Character.rifleman, 0.0, 1);
      const target = createFighter(Character.rifleman, 40.0, -1);
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
    const target = createFighter(Character.rifleman, 40.0, -1);
    const start = ROSTER_MANA.max - 2;
    source.mana.points = start; target.mana.points = start;
    target.shield.raised = shielded;
    const world = testWorld(source, target);
    contactBatch(world, () => collectDamageContact(world, 0, 1, hitEffect(10.0, 0.0, 0.0, 1.0, 0.0), 1, ContactKind.launch, true, undefined, shielded));
    assertEquals(source.mana.points, shielded ? start : ROSTER_MANA.max);
    assertEquals(target.mana.points, shielded ? start : ROSTER_MANA.max);
  }
});

test("meter starts empty, never fills idle and survives stock loss and respawn [spec #335]", () => {
  const fighter = createFighter(Character.jaina, 0.0, 1);
  assertEquals(fighter.mana.points, 0);
  for (let frame = 0; frame < 120; frame++) advanceSolo(fighter, 0, controls(), 0.0);
  assertEquals(fighter.mana.points, 0);
  fighter.mana.points = 73;
  const world = testWorld(fighter, createFighter(Character.rifleman, 40.0, -1));
  fighter.motion.x = 10000.0;
  checkBlastZone(world, 0);
  assertTrue(fighter.status.out);
  assertEquals(fighter.mana.points, 73);
  respawnFighter(world, 0, 0.0);
  assertEquals(fighter.mana.points, 73);
});

test("earned and carried meter restores exactly with fighter rollback state [invariant]", () => {
  const fighter = createFighter(Character.rifleman, 0.0, 1);
  fighter.mana.points = 73;
  const copy = createFighter(Character.rifleman, 0.0, 1);
  copyFighterState(copy, fighter, 3);
  assertEquals(firstFighterDifference(copy, fighter, 3, 3), undefined);
});
