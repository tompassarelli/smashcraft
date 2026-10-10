

import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character, ParryBuffer } from "./codes";
import { type Fighter } from "./fighter";
import { createReferenceFighter } from "./referenceRig";
import { type Controls } from "./roster";
import { advanceLaunchClocks, applyVerticalVelocity, resolveEdgesAndLanding, steerHorizontalVelocity } from "./step";
import { stickX } from "./stick";
import { advanceSolo, controls, soloWorld } from "./testWorld";

const FLAT_STAGE = 0;
const NEUTRAL = controls();

function standing(x: number, facing: number): Fighter {
  const f = createReferenceFighter(Character.sylvanas, x, facing);
  for (let frame = 0; frame < 4; frame++) advanceSolo(f, FLAT_STAGE, NEUTRAL, 0.0);
  return f;
}

function airborne(x: number, facing: number, vx: number): Fighter {
  const f = standing(x, facing);
  f.motion.grounded = false;
  f.motion.surface = undefined;
  f.motion.z = 400.0;
  f.motion.vx = vx;
  f.motion.vz = 1.0;
  return f;
}

function steer(f: Fighter, input: Readonly<Controls>): number {
  return steerHorizontalVelocity(f, FLAT_STAGE, input, stickX(input), true, false, false, false, false, false);
}

test("launch phase: a buffered parry option is released once, on the frame hitlag ends, for every hitlag length [k2 property]", () => {
  for (let hitlag = 1; hitlag <= 8; hitlag++) {
    const f = standing(0.0, 1);
    f.launch.hitlag = hitlag;
    f.shield.parryBuffer = ParryBuffer.jump;
    f.shield.parryBufferDirection = 1;
    let released = 0;
    let releasedOn = 0;
    for (let frame = 1; frame <= hitlag + 2; frame++) {
      const option = advanceLaunchClocks(f, NEUTRAL, f.launch.hitlag);
      if (option === ParryBuffer.none) continue;
      assertEquals(option, ParryBuffer.jump);
      released++;
      releasedOn = frame;
    }
    assertEquals(released, 1);
    assertEquals(releasedOn, hitlag);
    assertEquals(f.shield.parryBufferDirection, 0);
  }
});

test("ground and air steering: a mirrored body with a mirrored stick moves exactly mirrored, frame by frame [k2 property]", () => {
  for (const direction of [-1, 1]) {
    for (const walking of [false, true]) {
      const pairs = [[standing(0.0, 1), standing(0.0, -1)], [airborne(0.0, 1, 0.5), airborne(0.0, -1, -0.5)]];
      for (const [right, left] of pairs) {
        if (right === undefined || left === undefined) continue;
        const toward = controls({ direction, walking });
        const away = controls({ direction: -direction, walking });
        for (let frame = 0; frame < 12; frame++) {
          const input = frame < 8 ? toward : NEUTRAL;
          const mirrored = frame < 8 ? away : NEUTRAL;
          assertEquals(steer(left, mirrored), -steer(right, input));
          assertEquals(left.motion.vx, -right.motion.vx);
        }
      }
    }
  }
});

test("air phase: falling never speeds upward, and a mirrored body falls identically [k2 property]", () => {
  const right = airborne(0.0, 1, 0.5);
  const left = airborne(0.0, -1, -0.5);
  for (let frame = 0; frame < 40; frame++) {
    const before = right.motion.vz;
    assertEquals(applyVerticalVelocity(right, FLAT_STAGE, 0, NEUTRAL, undefined, false, false, false, false, false, false), false);
    applyVerticalVelocity(left, FLAT_STAGE, 0, NEUTRAL, undefined, false, false, false, false, false, false);
    assertTrue(right.motion.vz <= before);
    assertEquals(left.motion.vz, right.motion.vz);
  }
});

test("ledge and edge phase: a body standing still on the deck stays put, grounded on the same deck [k2 property]", () => {
  for (const x of [-200.0, 0.0, 200.0]) {
    const f = standing(x, 1);
    const { motion } = f;
    assertTrue(motion.grounded);
    const surface = motion.surface;
    const z = motion.z;
    resolveEdgesAndLanding(soloWorld(f), 0, FLAT_STAGE, 0, NEUTRAL, motion.x, motion.z, surface, 0.0);
    assertTrue(motion.grounded);
    assertEquals(motion.surface, surface);
    assertEquals(motion.x, x);
    assertEquals(motion.z, z);
    assertEquals(f.surfaceRecovery.wallJumpsUsed, 0);
  }
});
