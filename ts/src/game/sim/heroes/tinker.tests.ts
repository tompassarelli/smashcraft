import { assertNear, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../codes";
import { createFighter } from "../fighter";
import { AUTHORED_PHYSICS } from "../tuning";

test("Tinker body preserves the named Ultimate ROB weight, run and air speed [k4 reference ssbu]", () => {
  const f = createFighter(Character.tinker, 0.0, 1);
  const reference = AUTHORED_PHYSICS.reference;
  assertNear(f.tuning.physics.weight, 106.0, f32(0.001));
  assertNear(f.tuning.physics.runSpeed / reference.runSpeed, f32(f32(1.725) / f32(2.2)), f32(0.00001));
  assertNear(f.tuning.physics.airSpeed / reference.airSpeed, f32(f32(1.134) / f32(0.83)), f32(0.00001));
});
