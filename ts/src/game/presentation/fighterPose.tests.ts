import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { createFrameControls } from "../match/controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "../match/frameInput";
import { Phase, createMatchState } from "../match/rules";
import { createReplayRuntimeState } from "../match/runtime";
import { stateChecksum } from "../replay/canonical";
import { firstPoseDifference, firstStateDifference } from "../replay/difference";
import { ReplayHistory } from "../replay/history";
import { type ReplayState, captureReplaySnapshot, copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { AttackStyle, Character, GrabAction } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { attackDurationFramesForGrounding } from "../sim/moves";
import { fighterAt, neutralControls } from "../sim/roster";
import { soloWorld, testWorld } from "../sim/testWorld";
import * as dh from "./demonHunterAssetInfo";
import { advanceFighterPose, createFighterPose } from "./fighterPose";

test("replaying rows from a restored frame reproduces each pose's selection and clock", () => {
  for (const character of [Character.archer, Character.rifleman, Character.demonHunter]) {
    const game = createMatchState();
    game.phase = Phase.match;
    game.timeLimitMinutes = 0;
    const live: ReplayState = {
      world: testWorld(createFighter(character, -200.0, 1), createFighter(Character.rifleman, 200.0, -1)),
      match: game, controls: createFrameControls(), runtime: createReplayRuntimeState(),
    };
    const captured = createFrameControls();
    const row = createMatchFrameInput();
    const history = new ReplayHistory();
    const expected = createReplaySnapshot();
    const actual = createReplaySnapshot();
    assertTrue(history.beginEpoch(1, 1));
    for (let frame = 1; frame <= 24; frame++) {
      const input = captured.inputs[0];
      input.direction = frame < 12 ? 1 : -1;
      input.jumpPressed = frame === 4 || frame === 15;
      input.jumpHeld = frame < 10;
      assertTrue(captureFrame(row, frame, 3, captured, live.runtime));
      assertTrue(history.save(1, row, live));
      assertTrue(executeMatchFrame(row, game, live.world, live.controls, live.runtime, frame));
    }
    copyReplayState(expected, live);
    assertTrue(history.replay(1, 8, 24, live));
    copyReplayState(actual, live);
    assertEquals(firstStateDifference(expected, actual), undefined);
    assertEquals(firstPoseDifference(expected, actual), undefined);
    const gameplayChecksum = stateChecksum(actual);
    actual.runtime.poses[0].clipTime += 1.0;
    assertEquals(firstPoseDifference(expected, actual), "pose[0].clipTime");
    assertEquals(stateChecksum(actual), gameplayChecksum);
  }
});

test("hitlag freezes the reaction clip and a repeated hit restarts it", () => {
  for (const character of [Character.archer, Character.rifleman, Character.demonHunter]) {
    const f = createFighter(character, 0.0, 1);
    const world = soloWorld(f);
    const input = neutralControls();
    const pose = createFighterPose();
    f.launch.hitstun = 20;
    f.launch.hitlag = 5;
    advanceFighterPose(pose, f, world, input, false, false, false, true);
    const selected = pose.selectionSerial;
    assertEquals(pose.clipTime, 0.0);
    assertEquals(pose.rate, 0.0);
    for (let frame = 1; frame <= 4; frame++) {
      advanceFighterPose(pose, f, world, input, false, false, false, false);
      assertEquals(pose.selectionSerial, selected);
      assertEquals(pose.clipTime, 0.0);
    }
    f.launch.hitlag = 0;
    advanceFighterPose(pose, f, world, input, false, false, false, false);
    assertEquals(pose.selectionSerial, selected);
    advanceFighterPose(pose, f, world, input, false, false, false, false);
    assertGreaterThan(pose.clipTime, 0.0);
    f.launch.hitlag = 3;
    advanceFighterPose(pose, f, world, input, false, false, false, true);
    assertEquals(pose.selectionSerial, selected + 1);
    assertEquals(pose.clipTime, 0.0);
    f.status.frozenFrames = 10;
    advanceFighterPose(pose, f, world, input, false, false, false, false);
    assertEquals(pose.clipTime, 0.0);
    assertEquals(pose.rate, 0.0);
  }
});

test("a double jump restarts the jump clip and a landing keeps its entry rate", () => {
  const f = createFighter(Character.demonHunter, 0.0, 1);
  const world = soloWorld(f);
  const input = neutralControls();
  const pose = createFighterPose();
  f.motion.grounded = false;
  f.motion.vz = 5.0;
  advanceFighterPose(pose, f, world, input, false, true, false, false);
  assertEquals(pose.clipIndex, dh.DEMON_HUNTER_JUMP_INDEX);
  advanceFighterPose(pose, f, world, input, false, false, false, false);
  assertGreaterThan(pose.clipTime, 0.0);
  const selected = pose.selectionSerial;
  f.jump.isDouble = true;
  advanceFighterPose(pose, f, world, input, false, true, false, false);
  assertEquals(pose.clipIndex, dh.DEMON_HUNTER_DOUBLE_JUMP_INDEX);
  assertEquals(pose.selectionSerial, selected + 1);
  assertEquals(pose.clipTime, 0.0);
  f.special.fall = true;
  advanceFighterPose(pose, f, world, input, false, false, false, false);
  f.special.fall = false;
  f.motion.grounded = true;
  f.landing.lag = 12;
  advanceFighterPose(pose, f, world, input, false, false, false, false);
  assertEquals(pose.clipIndex, dh.DEMON_HUNTER_LAND_SPECIAL_INDEX);
  const rate = pose.rate;
  const landing = pose.selectionSerial;
  f.landing.lag = 11;
  advanceFighterPose(pose, f, world, input, false, false, false, false);
  assertEquals(pose.rate, rate);
  assertEquals(pose.selectionSerial, landing);
});

test("a snapshot's pose escapes from its own copy of the previous holder", () => {
  const first = createFighter(Character.demonHunter, 0.0, 1);
  const second = createFighter(Character.rifleman, 50.0, -1);
  const world = testWorld(first, second);
  const game = createMatchState();
  const controls = createFrameControls();
  const runtime = createReplayRuntimeState();
  const input = neutralControls();
  const snapshot = createReplaySnapshot();
  first.grab.owner = 1;
  advanceFighterPose(runtime.poses[0], first, world, input, false, false, false, false);
  captureReplaySnapshot(snapshot, world, game, controls, runtime);
  // Changing the live holder must not reach detached presentation history.
  second.grab.action = GrabAction.throwForward;
  const victim = fighterAt(snapshot.world, 0);
  victim.grab.owner = undefined;
  victim.launch.hitstun = 10;
  fighterAt(snapshot.world, 1).grab.action = GrabAction.escape;
  const pose = snapshot.runtime.poses[0];
  advanceFighterPose(pose, victim, snapshot.world, input, false, false, false, false);
  assertEquals(pose.clipIndex, dh.DEMON_HUNTER_GRAB_ESCAPE_INDEX);
  assertEquals(pose.motion.escapeRemaining, 10);
});

test("an attack restart and a smash release keep their authored clips", () => {
  const f = createFighter(Character.demonHunter, 0.0, 1);
  const world = soloWorld(f);
  const input = neutralControls();
  const pose = createFighterPose();
  f.attack.style = AttackStyle.upSmash;
  f.attack.frame = 1;
  f.attack.duration = attackDurationFramesForGrounding(AttackStyle.upSmash, true);
  advanceFighterPose(pose, f, world, input, false, false, true, false);
  assertEquals(pose.clipIndex, dh.DEMON_HUNTER_UP_SMASH_INDEX);
  f.attack.smashCharging = true;
  advanceFighterPose(pose, f, world, input, false, false, false, false);
  assertEquals(pose.clipIndex, dh.DEMON_HUNTER_UP_SMASH_CHARGE_INDEX);
  assertEquals(pose.rate, 0.0);
  f.attack.smashCharging = false;
  advanceFighterPose(pose, f, world, input, false, false, false, false);
  assertEquals(pose.clipIndex, dh.DEMON_HUNTER_UP_SMASH_RELEASE_INDEX);
  assertEquals(pose.clipTime, 0.0);
  assertGreaterThan(pose.rate, 0.0);
  advanceFighterPose(pose, f, world, input, false, false, false, false);
  assertGreaterThan(pose.clipTime, 0.0);
  advanceFighterPose(pose, f, world, input, false, false, true, false);
  assertEquals(pose.clipIndex, dh.DEMON_HUNTER_UP_SMASH_INDEX);
  assertEquals(pose.clipTime, 0.0);
});

