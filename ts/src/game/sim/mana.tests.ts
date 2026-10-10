import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { floorDiv } from "wisp/src/sim/intMath";
import { Character, ContactKind } from "./codes";
import { collectDamageContact } from "./contacts";
import { createFighter } from "./fighter";
import { SELECTABLE_CHARACTERS } from "./heroes/registry";
import { ROSTER_MANA } from "./mana";
import { startFighterSpecial } from "./specials";
import { contactBatch, controls, hitEffect, testWorld } from "./testWorld";

test("every regular special starts in its full form at zero meter [k3 measure #335]", () => {
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
