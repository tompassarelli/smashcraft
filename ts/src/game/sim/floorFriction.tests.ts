

import { assertEquals, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "./codes";
import { type Fighter } from "./fighter";
import { createReferenceFighter } from "./referenceRig";
import { TOMB_OF_SARGERAS_STAGE, WATER_FRICTION } from "./stage";
import { advanceSolo, controls } from "./testWorld";

const FLAT_STAGE = 0;
const RELEASED = controls();
const HELD_RIGHT = controls({ direction: 1 });

function slideToRest(f: Fighter, stage: number, moving: (f: Fighter) => boolean): { frames: number; distance: number } {
  const startX = f.motion.x;
  let frames = 0;
  while (moving(f) && frames < 600) {
    advanceSolo(f, stage, RELEASED, 0.0);
    frames++;
  }
  assertTrue(f.motion.grounded);
  return { frames, distance: f32(f.motion.x - startX) };
}

function runner(stage: number): Fighter {
  const f = createReferenceFighter(Character.sylvanas, -400.0, 1);
  for (let frame = 0; frame < 40; frame++) advanceSolo(f, stage, HELD_RIGHT, 0.0);
  return f;
}

const groundSpeed = (f: Fighter) => f.motion.vx !== 0;

function assertTwiceAsLong(ground: number, water: number): void {
  assertTrue(ground > 0);
  assertNear(f32(water / ground), f32(1.0 / WATER_FRICTION), f32(0.15));
}

test("a run released on water brakes at half traction and slides twice as far [k3 measure docs/physics.md]", () => {
  const ground = runner(FLAT_STAGE);
  const water = runner(TOMB_OF_SARGERAS_STAGE);

  assertEquals(water.motion.vx, ground.motion.vx);
  assertEquals(water.motion.x, ground.motion.x);
  const speed = ground.motion.vx;
  advanceSolo(ground, FLAT_STAGE, RELEASED, 0.0);
  advanceSolo(water, TOMB_OF_SARGERAS_STAGE, RELEASED, 0.0);
  const traction = ground.tuning.physics.traction;
  assertEquals(ground.motion.vx, f32(speed - traction));
  assertEquals(water.motion.vx, f32(speed - f32(traction * WATER_FRICTION)));
  assertTwiceAsLong(slideToRest(ground, FLAT_STAGE, groundSpeed).distance, slideToRest(water, TOMB_OF_SARGERAS_STAGE, groundSpeed).distance);
});

