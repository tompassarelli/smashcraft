

import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "./codes";
import { type Fighter } from "./fighter";
import { createReferenceFighter } from "./referenceRig";
import { setWorldMotionValue } from "./motion";
import { SLOPE_TEST_STAGE, surfaceZAt } from "./stage";
import { advanceSolo, controls } from "./testWorld";
import { melee } from "./tuning";

const STAGE = SLOPE_TEST_STAGE;
const RISE = melee(3.5);

function standing(character: Character, x: number, facing: number): Fighter {
  const fighter = createReferenceFighter(character, x, facing);
  fighter.motion.surface = 0;
  fighter.motion.z = surfaceZAt(STAGE, 0, 0, x);
  setWorldMotionValue(fighter.motion.meleeZ, fighter.motion.z);
  return fighter;
}

function onLine(fighter: Fighter): void {
  assertTrue(fighter.motion.grounded);
  assertEquals(fighter.motion.surface, 0);
  assertEquals(fighter.motion.z, surfaceZAt(STAGE, 0, 0, fighter.motion.x));
}

test("walking down and back up a slope keeps the fighter on the line, moving ground speed along it [spec #193]", () => {
  for (const side of [-1, 1]) {
    const fighter = standing(Character.sylvanas, f32(side * 380.0), side);
    const input = controls({ direction: side, walking: true });
    let crossedSlope = false;
    for (let frame = 0; frame < 400 && Math.abs(fighter.motion.x) < 540.0; frame++) {
      const before = fighter.motion.x;
      advanceSolo(fighter, STAGE, input, 0.0);
      onLine(fighter);
      if (Math.abs(before) > 430.0 && fighter.motion.vx !== 0) {
        crossedSlope = true;

        assertLessThan(Math.abs(f32(fighter.motion.x - before)), Math.abs(fighter.motion.vx));
      }
    }
    assertTrue(crossedSlope);
    assertLessThan(fighter.motion.z, f32(RISE / 2));
    input.direction = -side;
    for (let frame = 0; frame < 400 && Math.abs(fighter.motion.x) > 300.0; frame++) {
      advanceSolo(fighter, STAGE, input, 0.0);
      onLine(fighter);
    }
    assertEquals(fighter.motion.z, RISE);
  }
});

test("a fighter falling onto a slope lands on the line under it [spec #193]", () => {
  for (const x of [-560.0, -510.0, -450.0, 0.0, 450.0, 510.0, 560.0]) {
    const fighter = createReferenceFighter(Character.sylvanas, x, 1);
    fighter.motion.grounded = false;
    fighter.motion.z = 120.0;
    setWorldMotionValue(fighter.motion.meleeZ, fighter.motion.z);
    fighter.motion.vz = -2.0;
    const input = controls();
    for (let frame = 0; frame < 120 && !fighter.motion.grounded; frame++) {
      assertGreaterThan(fighter.motion.z, f32(surfaceZAt(STAGE, 0, 0, fighter.motion.x) - f32(0.001)));
      advanceSolo(fighter, STAGE, input, 0.0);
    }
    onLine(fighter);
    assertEquals(fighter.motion.x, x);

    for (let frame = 0; frame < 30; frame++) advanceSolo(fighter, STAGE, input, 0.0);
    onLine(fighter);
    assertEquals(fighter.motion.x, x);
  }
});

