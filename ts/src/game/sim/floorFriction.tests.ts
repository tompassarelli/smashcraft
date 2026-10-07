// Shallow water's floor friction against ordinary ground: the same fighter,
// state and input on each, every traction slide measured to rest.
import { assertEquals, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { installDamageLaunch } from "./knockback";
import { FROZEN_THRONE_STAGE, TOMB_OF_SARGERAS_STAGE, WATER_FRICTION, floorFriction, surfaceCount } from "./stage";
import { advanceSolo, controls } from "./testWorld";

const FLAT_STAGE = 0;
const RELEASED = controls();
const HELD_RIGHT = controls({ direction: 1 });

/** Frames the fighter takes to come to rest from its current state with neutral input, and how far it travelled. */
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

/** A fighter that has run right for 40 frames from x -400. */
function runner(stage: number): Fighter {
  const f = createFighter(Character.archer, -400.0, 1);
  for (let frame = 0; frame < 40; frame++) advanceSolo(f, stage, HELD_RIGHT, 0.0);
  return f;
}

const groundSpeed = (f: Fighter) => f.motion.vx !== 0;

/** The water slide is about 1 / WATER_FRICTION times the ground slide: twice as long, give or take the last frames' rounding. */
function assertTwiceAsLong(ground: number, water: number): void {
  assertTrue(ground > 0);
  assertNear(f32(water / ground), f32(1.0 / WATER_FRICTION), 0.15);
}

test("only Tomb of Sargeras's main deck has reduced friction", () => {
  for (const stage of [FLAT_STAGE, FROZEN_THRONE_STAGE]) {
    for (let surface = 0; surface < surfaceCount(stage); surface++) assertEquals(floorFriction(stage, { grounded: true, surface }), 1.0);
  }
  assertEquals(floorFriction(TOMB_OF_SARGERAS_STAGE, { grounded: true, surface: 0 }), WATER_FRICTION);
  assertEquals(floorFriction(TOMB_OF_SARGERAS_STAGE, { grounded: false, surface: 0 }), 1.0);
});

test("a run released on water brakes at half traction and slides twice as far", () => {
  const ground = runner(FLAT_STAGE);
  const water = runner(TOMB_OF_SARGERAS_STAGE);
  // Running speed and position are the same until the stick is released: acceleration is unchanged.
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

test("a landing slide (wavedash and waveland) carries twice as far on water", () => {
  const slide = (stage: number) => {
    const f = createFighter(Character.rifleman, -300.0, 1);
    f.motion.vx = 14.0;
    f.landing.lag = 10;
    return slideToRest(f, stage, groundSpeed).distance;
  };
  assertTwiceAsLong(slide(FLAT_STAGE), slide(TOMB_OF_SARGERAS_STAGE));
});

test("ground knockback slides twice as far on water", () => {
  const slide = (stage: number) => {
    const f = createFighter(Character.archer, -300.0, 1);
    installDamageLaunch(f, 60.0, 1.0, 0.0, true);
    f.launch.hitstun = 24;
    assertTrue(f.motion.grounded);
    return slideToRest(f, stage, g => g.launch.groundKnockbackX !== 0).distance;
  };
  assertTwiceAsLong(slide(FLAT_STAGE), slide(TOMB_OF_SARGERAS_STAGE));
});

test("shield pushback slides twice as far on water", () => {
  const slide = (stage: number) => {
    const f = createFighter(Character.archer, -300.0, 1);
    const shielding = controls({ shield: true });
    advanceSolo(f, stage, shielding, 0.0);
    f.shield.pushbackX = 9.0;
    const startX = f.motion.x;
    let frames = 0;
    while (f.shield.pushbackX !== 0 && frames < 600) {
      advanceSolo(f, stage, shielding, 0.0);
      frames++;
    }
    return f32(f.motion.x - startX);
  };
  assertTwiceAsLong(slide(FLAT_STAGE), slide(TOMB_OF_SARGERAS_STAGE));
});
