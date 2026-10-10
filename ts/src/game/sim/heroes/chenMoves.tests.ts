import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../codes";
import { authoredPhysics, melee } from "../tuning";

test("Chen takes his measured body from Ultimate Ryu [k4 reference ssbu]", () => {
  const body = authoredPhysics(Character.chen);
  assertEquals(body.weight, 103.0);
  assertTrue(Math.abs(body.runSpeed - melee(f32(1.6))) < f32(0.00001));
  assertEquals(body.airSpeed, melee(f32(1.12)));
});
