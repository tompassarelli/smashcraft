// Magnifier rules through helper journal packets, synchronized rows and the
// production frame executor. A frozen airborne fixture isolates the timer.
import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { fighterAt } from "../sim/roster";
import { outsideCamera } from "../sim/matchCamera";
import { stageBounds } from "../sim/stageBounds";
import { padMatch, playPads } from "./helperPads";
import { testMatch, replayState, executeCaptured } from "./testMatch";
import { copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { firstStateDifference } from "../replay/difference";

/** Between the match stage's camera limit and its blast line. */
function offscreenX(stage: number): number {
  const { camera, blast } = stageBounds(stage);
  return f32(f32(camera.right + blast.right) * 0.5);
}

function magnifier() {
  const run = padMatch(testMatch(3, 0), "magnifier");
  const fighter = fighterAt(run.match.world, 0);
  fighter.motion.x = offscreenX(run.match.game.stageChoice);
  fighter.motion.z = 300.0;
  fighter.motion.grounded = false;
  fighter.status.frozenFrames = 1000;
  return { run, fighter };
}

test("magnifier damage is 1% per 60 consecutive offscreen frames, stops at 150%, and training disables it [reference]", () => {
  const { run, fighter } = magnifier();
  for (let frame = 1; frame <= 59; frame++) playPads(run, {}, {});
  assertFalse(fighter.status.out);
  assertEquals(fighter.status.damage, 0.0);
  assertEquals(fighter.status.offscreenFrames, 59);
  playPads(run, {}, {});
  assertEquals(fighter.status.damage, 1.0);
  assertEquals(fighter.status.offscreenFrames, 0);
  for (let frame = 1; frame <= 30; frame++) playPads(run, {}, {});
  fighter.motion.x = 0.0;
  fighter.motion.z = 60.0;
  playPads(run, {}, {});
  assertEquals(fighter.status.offscreenFrames, 0);
  fighter.motion.x = offscreenX(run.match.game.stageChoice);
  for (let frame = 1; frame <= 60; frame++) playPads(run, {}, {});
  assertEquals(fighter.status.damage, 2.0);
  fighter.status.damage = 149.0;
  for (let frame = 1; frame <= 120; frame++) playPads(run, {}, {});
  assertEquals(fighter.status.damage, 150.0);
  fighter.status.offscreenFrames = 17;
  fighter.motion.x = 0.0;
  playPads(run, {}, {});
  assertEquals(fighter.status.offscreenFrames, 17);
  run.match.game.practice = true;
  fighter.status.damage = 0.0;
  fighter.motion.x = offscreenX(run.match.game.stageChoice);
  for (let frame = 1; frame <= 120; frame++) playPads(run, {}, {});
  assertEquals(fighter.status.damage, 0.0);
  assertEquals(fighter.status.offscreenFrames, 0);
});

test("a fighter that outruns the current camera counts magnifier frames inside the stage camera limits [spec #80]", () => {
  const run = padMatch(testMatch(3, 0), "camera-outrun");
  for (let frame = 1; frame <= 60; frame++) playPads(run, {}, {});
  const fighter = fighterAt(run.match.world, 0);
  fighter.motion.x = 1000.0;
  fighter.motion.z = 300.0;
  fighter.motion.grounded = false;
  fighter.status.frozenFrames = 1000;
  playPads(run, {}, {});
  assertTrue(outsideCamera(run.match.game.camera, fighter.motion.x, f32(fighter.motion.z + 60.0)));
  assertEquals(fighter.status.offscreenFrames, 1);
});

test("restoring a snapshot reproduces the camera and the magnifier damage frame [invariant]", () => {
  const { run, fighter } = magnifier();
  for (let frame = 1; frame <= 59; frame++) playPads(run, {}, {});
  const before = createReplaySnapshot();
  const after = createReplaySnapshot();
  copyReplayState(before, replayState(run.match));
  playPads(run, {}, {});
  assertEquals(fighter.status.damage, 1.0);
  copyReplayState(after, replayState(run.match));
  copyReplayState(replayState(run.match), before);
  executeCaptured(run.match);
  assertEquals(firstStateDifference(after, replayState(run.match)), undefined);
});
