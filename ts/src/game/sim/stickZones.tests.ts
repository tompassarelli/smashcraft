import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, GroundAction } from "./codes";
import { createFighter } from "./fighter";
import { GroundState, StickZone, TAP_JUMP_WINDOW, stickZone } from "./stickZones";
import { advanceSolo, controls } from "./testWorld";

const FRESH = 0;
const STALE = 3;

type Sample = readonly [x: number, z: number, sideAge: number, upAge: number, state: GroundState, zone: StickZone];

const S = GroundState;
const Z = StickZone;
const SAMPLES: readonly Sample[] = [
  [0.0, 0.0, STALE, TAP_JUMP_WINDOW, S.stand, Z.deadzone],
  [f32(0.2799), 0.0, FRESH, TAP_JUMP_WINDOW, S.stand, Z.deadzone],
  [f32(0.28), 0.0, FRESH, TAP_JUMP_WINDOW, S.stand, Z.walkSlow],
  [f32(0.3999), 0.0, STALE, TAP_JUMP_WINDOW, S.walk, Z.walkSlow],
  [f32(0.4), 0.0, STALE, TAP_JUMP_WINDOW, S.walk, Z.walkMiddle],
  [f32(0.7999), 0.0, FRESH, TAP_JUMP_WINDOW, S.stand, Z.walkMiddle],
  [f32(0.8), 0.0, STALE, TAP_JUMP_WINDOW, S.walk, Z.walkFast],
  [1.0, 0.0, STALE, TAP_JUMP_WINDOW, S.walk, Z.walkFast],
  [f32(0.8), 0.0, FRESH, TAP_JUMP_WINDOW, S.stand, Z.dashSlow],
  [f32(0.8), 0.0, 2, TAP_JUMP_WINDOW, S.walk, Z.dashSlow],
  [f32(0.9999), 0.0, FRESH, TAP_JUMP_WINDOW, S.stand, Z.dashSlow],
  [1.0, 0.0, FRESH, TAP_JUMP_WINDOW, S.stand, Z.dashFast],
  [f32(-0.2799), 0.0, FRESH, TAP_JUMP_WINDOW, S.stand, Z.deadzone],
  [f32(-0.28), 0.0, FRESH, TAP_JUMP_WINDOW, S.stand, Z.tiltTurn],
  [f32(-0.7999), 0.0, FRESH, TAP_JUMP_WINDOW, S.stand, Z.tiltTurn],
  [-1.0, 0.0, STALE, TAP_JUMP_WINDOW, S.stand, Z.tiltTurn],
  [f32(-0.8), 0.0, FRESH, TAP_JUMP_WINDOW, S.stand, Z.smashTurn],
  [f32(-0.8), 0.0, FRESH, TAP_JUMP_WINDOW, S.dash, Z.dashSlow],
  [0.0, f32(0.6624), 0, 0, S.stand, Z.deadzone],
  [0.0, f32(0.6625), 0, 0, S.stand, Z.jump],
  [0.0, f32(0.6625), 0, 3, S.stand, Z.jump],
  [0.0, f32(0.6625), 0, 4, S.stand, Z.deadzone],
  [0.0, 0.5625, 0, 0, S.run, Z.jump],
  [0.0, f32(0.5624), 0, 0, S.run, Z.deadzone],
  [f32(0.8), 0.5625, FRESH, 0, S.stand, Z.dashJump],
  [f32(0.8), f32(0.5624), FRESH, 0, S.stand, Z.dashSlow],
  [f32(0.8), 0.5625, FRESH, TAP_JUMP_WINDOW, S.stand, Z.dashSlow],
  [f32(0.7), f32(0.6625), FRESH, 0, S.stand, Z.jump],
  [0.0, -0.6875, STALE, TAP_JUMP_WINDOW, S.stand, Z.deadzone],
  [0.0, f32(-0.6876), STALE, TAP_JUMP_WINDOW, S.stand, Z.crouch],
  [f32(-0.7), f32(-0.7), STALE, TAP_JUMP_WINDOW, S.stand, Z.crouch],
  [f32(0.8), f32(-0.6), FRESH, TAP_JUMP_WINDOW, S.stand, Z.dashSlow],
  [f32(0.8), f32(-0.69), STALE, TAP_JUMP_WINDOW, S.stand, Z.crouch],
  [0.0, -0.625, STALE, TAP_JUMP_WINDOW, S.crouch, Z.crouch],
  [0.0, f32(-0.6249), STALE, TAP_JUMP_WINDOW, S.crouch, Z.deadzone],
];

test("stick map: a sample in every zone and on each boundary selects Melee's zone from PlCo.dat's thresholds [reference]", () => {
  for (const [x, z, sideAge, upAge, state, zone] of SAMPLES) {
    for (const facing of [-1, 1]) {
      const actual = stickZone(f32(x * facing), z, sideAge, upAge, facing, state);
      if (actual !== zone) throw new Error(`stick (${x * facing}, ${z}) side ${sideAge} up ${upAge} state ${state} facing ${facing}: zone ${actual}, expected ${zone}`);
    }
  }
  const seen = new Set(SAMPLES.map((sample) => sample[5]));
  assertEquals(seen.size, Object.keys(StickZone).length);
});

test("stick map: mirroring the stick and facing keeps the zone over a 81x81 grid in every state [invariant]", () => {
  for (let i = -40; i <= 40; i++) {
    for (let j = -40; j <= 40; j++) {
      const x = f32(i / 40.0);
      const z = f32(j / 40.0);
      for (let state = 0; state <= 6; state++) {
        for (const age of [0, 2, 3, 4]) {
          const right = stickZone(x, z, age, age, 1, state as GroundState);
          assertEquals(stickZone(f32(-x), z, age, age, -1, state as GroundState), right);
        }
      }
    }
  }
});

test("ground states: an analog walk's speed follows the stick and the walk modifier is one full-speed walk [spec #204]", () => {
  const speeds: number[] = [];
  for (const x of [f32(0.3), f32(0.5), f32(0.79)]) {
    const f = createFighter(Character.rifleman, -500.0, 1);
    for (let frame = 0; frame < 120; frame++) advanceSolo(f, 0, controls({ direction: 1, diStickValid: true, diStickX: x }), 0.0);
    assertEquals(f.ground.action, GroundAction.none);
    speeds.push(f.motion.vx);
    assertTrue(Math.abs(f.motion.vx - f32(f.tuning.physics.walkSpeed * x)) < f32(0.05));
  }
  assertTrue(speeds[0]! < speeds[1]! && speeds[1]! < speeds[2]!);
  for (const x of [f32(0.3), 1.0]) {
    const f = createFighter(Character.rifleman, -500.0, 1);
    for (let frame = 0; frame < 120; frame++) advanceSolo(f, 0, controls({ direction: 1, diStickValid: true, diStickX: x, walking: true }), 0.0);
    assertTrue(Math.abs(f.motion.vx - f.tuning.physics.walkSpeed) < f32(0.05));
  }
  const keyboard = createFighter(Character.rifleman, 0.0, 1);
  advanceSolo(keyboard, 0, controls({ direction: 1, diStickValid: true, diStickX: 1.0 }), 0.0);
  assertEquals(keyboard.ground.action, GroundAction.dash);
});
