import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Character, GrabAction, LedgeState } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { neutralControls } from "../sim/roster";
import { advanceSolo, testWorld } from "../sim/testWorld";
import { INITIAL_DASH_FRAMES } from "../sim/tuning";
import { IllidanLocomotion, advanceIllidanMotion, createIllidanMotion } from "./illidanMotion";

test("Illidan's locomotion follows dash, brake, crouch and fast fall", () => {
  const f = createFighter(Character.demonHunter, 0.0, 1);
  const other = createFighter(Character.archer, 600.0, -1);
  const world = testWorld(f, other);
  const input = neutralControls();
  const motion = createIllidanMotion();
  const step = () => {
    advanceSolo(f, 0, input, 0.0);
    advanceIllidanMotion(motion, f, input, world);
  };
  input.direction = 1;
  step();
  assertEquals(motion.motion, IllidanLocomotion.dash);
  for (let tick = 1; tick <= INITIAL_DASH_FRAMES; tick++) step();
  assertEquals(motion.motion, IllidanLocomotion.run);
  input.direction = -1;
  step();
  assertEquals(motion.motion, IllidanLocomotion.turn);
  input.direction = 0;
  input.down = true;
  for (let tick = 1; tick <= 40; tick++) step();
  assertEquals(motion.motion, IllidanLocomotion.crouch);
  input.down = false;
  advanceSolo(f, 0, input, 0.0);
  input.down = true;
  f.motion.grounded = false;
  f.motion.z = 400.0;
  f.motion.vz = -1.0;
  step();
  assertEquals(motion.motion, IllidanLocomotion.fastFall);
});

test("Illidan's transitions do not advance during hitlag", () => {
  const f = createFighter(Character.demonHunter, 0.0, 1);
  const world = testWorld(f, createFighter(Character.archer, 600.0, -1));
  const input = neutralControls();
  const motion = createIllidanMotion();
  advanceIllidanMotion(motion, f, input, world);
  f.ledge.state = LedgeState.hang;
  f.motion.grounded = false;
  advanceIllidanMotion(motion, f, input, world);
  assertEquals(motion.ledgeCatchRemaining, 6);
  f.launch.hitlag = 4;
  for (let tick = 1; tick <= 4; tick++) {
    advanceIllidanMotion(motion, f, input, world);
    assertEquals(motion.ledgeCatchRemaining, 6);
  }
  f.launch.hitlag = 0;
  advanceIllidanMotion(motion, f, input, world);
  assertEquals(motion.ledgeCatchRemaining, 5);
  f.ledge.state = LedgeState.none;
  f.jump.serial++;
  advanceIllidanMotion(motion, f, input, world);
  assertTrue(motion.ledgeJump);
  f.motion.grounded = true;
  advanceIllidanMotion(motion, f, input, world);
  assertFalse(motion.ledgeJump);
});

test("Illidan's escape is distinct from a throw, and an input interrupts his respawn", () => {
  const f = createFighter(Character.demonHunter, 0.0, 1);
  const owner = createFighter(Character.demonHunter, 50.0, -1);
  const world = testWorld(f, owner);
  const input = neutralControls();
  const motion = createIllidanMotion();
  f.grab.owner = 1;
  advanceIllidanMotion(motion, f, input, world);
  f.grab.owner = undefined;
  f.launch.hitstun = 10;
  owner.grab.action = GrabAction.throwForward;
  advanceIllidanMotion(motion, f, input, world);
  assertEquals(motion.escapeRemaining, 0);
  f.grab.owner = 1;
  advanceIllidanMotion(motion, f, input, world);
  f.grab.owner = undefined;
  owner.grab.action = GrabAction.escape;
  advanceIllidanMotion(motion, f, input, world);
  assertEquals(motion.escapeRemaining, 10);
  f.launch.hitstun = 0;
  f.status.out = true;
  advanceIllidanMotion(motion, f, input, world);
  f.status.out = false;
  f.motion.grounded = false;
  advanceIllidanMotion(motion, f, input, world);
  assertEquals(motion.respawnRemaining, 24);
  input.direction = 1;
  advanceIllidanMotion(motion, f, input, world);
  assertEquals(motion.respawnRemaining, 0);
});
