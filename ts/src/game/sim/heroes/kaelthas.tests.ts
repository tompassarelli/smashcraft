import { assertNear, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../codes";
import { createFighter } from "../fighter";

test("Kaelthas intentionally adapts Ultimate Mewtwo with the roster air-speed cap [k4 reference ssbu]", () => {
  const fighter = createFighter(Character.kaelthas, 0.0, 1);
  assertNear(fighter.tuning.physics.weight, 79.0, f32(0.0001)); assertNear(fighter.tuning.physics.runSpeed, f32(13.53), f32(0.0001));
  assertNear(fighter.tuning.physics.airSpeed, 7.5, f32(0.0001));
});
