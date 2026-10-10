import { assertGreaterThan, assertNear, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../codes";
import { authoredPhysics, melee } from "../tuning";
import { heroBody } from "./heroBodies";

test("Cairne takes King K. Rool's weight and speeds and has a larger body than Pit Lord [reference] [spec docs/design/cairne.md]", () => {
  const physics = authoredPhysics(Character.cairne);
  assertNear(physics.weight, 133.0, f32(0.0001));
  assertNear(physics.runSpeed, melee(f32(1.485)), f32(0.0001));
  assertNear(physics.airSpeed, melee(f32(0.945)), f32(0.0001));
  assertGreaterThan(heroBody(Character.cairne)?.width ?? 0, heroBody(Character.pitLord)?.width ?? 0);
  assertGreaterThan(heroBody(Character.cairne)?.height ?? 0, heroBody(Character.pitLord)?.height ?? 0);
});
