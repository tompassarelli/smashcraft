import { assertNear, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../codes";
import { authoredPhysics, melee } from "../tuning";

test("Jaina body takes weight, run speed and air speed from Melee Zelda [reference] [spec docs/design/jaina.md]", () => {
  const body = authoredPhysics(Character.jaina);
  assertNear(body.weight, 90.0, f32(0.0001));
  assertNear(body.runSpeed, melee(f32(1.1)), f32(0.0001));
  assertNear(body.airSpeed, melee(f32(0.95)), f32(0.0001));
});
