import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character, SpecialAction } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { neutralControls } from "../sim/roster";
import { mainDeckLeft, mainDeckRight, mainDeckZ } from "../sim/stage";
import { steerRunningSpecial } from "./botKitOptions";
import { FULL_SKILL } from "./cpuSkill";

test("Rifleman CPU aims level above the deck and upward below it on both recoil shots", () => {
  for (const side of [-1, 1]) for (const below of [false, true]) {
    const edge = side < 0 ? mainDeckLeft(0) : mainDeckRight(0);
    const fighter = createFighter(Character.rifleman, edge + side * 180.0, -side);
    fighter.motion.z = mainDeckZ(0) + (below ? -40.0 : 10.0);
    fighter.motion.grounded = false;
    fighter.special.action = SpecialAction.riflemanRecovery;
    for (const frame of [3, 11]) {
      fighter.special.frame = frame;
      const input = neutralControls();
      assertTrue(steerRunningSpecial(fighter, undefined, 0, FULL_SKILL, input));
      assertEquals(input.direction, -side);
      assertEquals(input.verticalDirection, below ? 1 : 0);
      if (frame === 11) {
        assertTrue(input.specialPressed);
        assertEquals(input.specialX, -side);
        assertEquals(input.specialZ, below ? 1 : 0);
      }
    }
  }
});
