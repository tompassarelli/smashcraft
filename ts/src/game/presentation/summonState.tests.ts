import { assertEquals, assertFalse, assertLessThan, assertTrue, test } from "waygate/src/runtime/testing";
import { f32 } from "waygate/src/sim/f32";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { Phase } from "../match/rules";
import { resetPoses } from "../match/runtime";
import { createFrameControls } from "../match/controls";
import { captureFrame, createMatchFrameInput } from "../match/frameInput";
import { captureNext, executeCaptured, executeNext, replayState, testMatch } from "../match/testMatch";
import { stateChecksum } from "../replay/canonical";
import { firstPoseDifference, firstStateDifference } from "../replay/difference";
import { ReplayCorrections, ReplayHistory } from "../replay/history";
import { captureReplaySnapshot, createReplaySnapshot, restoreReplaySnapshot } from "../replay/snapshot";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { fighterAt, isActive } from "../sim/roster";
import { SUMMON_BEAR, SUMMON_BEAR_ATTACK, SUMMON_BEAR_WALK, summonClip } from "./summonClipInfo";
import { advanceSummonPose } from "./summonPose";
import { advanceSummons, createSummonState, firstSummonDifference, projectBear } from "./summonState";

const TICK = f32(1.0 / 60.0);

test("a bear spawns walking, swipes on a hit, then queues its walk at the original clip timing", () => {
  const state = createSummonState();
  const fighter = createFighter(Character.rifleman, 0.0, 1);
  const bear = state.bears[3];
  fighter.bear.life = 500;
  fighter.bear.x = 123.0;
  fighter.bear.z = 42.0;
  fighter.bear.velocityX = -14.0;
  advanceSummons(state, fighter, 3);
  const spawn = projectBear(state, fighter, 3);
  assertTrue(spawn.visible);
  assertEquals(spawn.clipIndex, SUMMON_BEAR_WALK);
  assertEquals(spawn.seconds, 0.0);
  assertEquals(spawn.x, 123.0);
  assertEquals(spawn.z, 42.0);
  assertEquals(spawn.yaw, f32(3.141592654));
  assertEquals(spawn.scale, f32(0.8));
  advanceSummons(state, fighter, 3);
  assertEquals(bear.clipTime, TICK);
  fighter.bear.hitSerial++;
  advanceSummons(state, fighter, 3);
  assertEquals(bear.clipIndex, SUMMON_BEAR_ATTACK);
  assertEquals(bear.queuedClip, SUMMON_BEAR_WALK);
  assertEquals(bear.clipTime, 0.0);
  const attack = summonClip(SUMMON_BEAR, SUMMON_BEAR_ATTACK);
  const attackDuration = f32(attack.endSeconds - attack.startSeconds);
  let elapsed = 0.0;
  while (f32(elapsed + TICK) < attackDuration) {
    advanceSummons(state, fighter, 3);
    elapsed = f32(elapsed + TICK);
    assertEquals(bear.clipIndex, SUMMON_BEAR_ATTACK);
  }
  advanceSummons(state, fighter, 3);
  elapsed = f32(elapsed + TICK);
  assertEquals(bear.clipIndex, SUMMON_BEAR_WALK);
  assertEquals(bear.queuedClip, undefined);
  assertEquals(bear.clipTime, f32(elapsed - attackDuration));
  const walk = summonClip(SUMMON_BEAR, SUMMON_BEAR_WALK);
  const walkDuration = f32(walk.endSeconds - walk.startSeconds);
  advanceSummonPose(bear, SUMMON_BEAR, f32(walkDuration * 3.0));
  assertLessThan(Math.abs(bear.clipTime - f32(elapsed - attackDuration)), f32(0.00001));
  fighter.bear.hitSerial++;
  advanceSummons(state, fighter, 3);
  advanceSummons(state, fighter, 3);
  fighter.bear.hitSerial++;
  advanceSummons(state, fighter, 3);
  assertEquals(bear.clipIndex, SUMMON_BEAR_ATTACK);
  assertEquals(bear.clipTime, 0.0);
  fighter.bear.life = 0;
  advanceSummons(state, fighter, 3);
  assertFalse(projectBear(state, fighter, 3).visible);
  fighter.bear.life = 500;
  advanceSummons(state, fighter, 3);
  assertEquals(bear.clipIndex, SUMMON_BEAR_WALK);
  assertEquals(bear.clipTime, 0.0);
});

test("a bear's clip restores backward from a snapshot and projects read-only", () => {
  const match = testMatch(9, Character.rifleman);
  const fighter = fighterAt(match.world, 3);
  fighter.bear.life = 500;
  fighter.bear.x = fighter.motion.x;
  fighter.bear.velocityX = 0.0;
  executeNext(match);
  fighter.bear.hitSerial++;
  executeNext(match);
  for (let frame = 1; frame <= 4; frame++) executeNext(match);
  const early = createReplaySnapshot();
  const later = createReplaySnapshot();
  const rendered = createReplaySnapshot();
  captureReplaySnapshot(early, match.world, match.game, match.inputs, match.runtime);
  const earlyTime = match.runtime.summons.bears[3].clipTime;
  for (let frame = 1; frame <= 6; frame++) executeNext(match);
  captureReplaySnapshot(later, match.world, match.game, match.inputs, match.runtime);
  restoreReplaySnapshot(early, match.world, match.game, match.inputs, match.runtime);
  assertEquals(match.runtime.summons.bears[3].clipTime, earlyTime);
  assertEquals(match.runtime.summons.bears[3].queuedClip, SUMMON_BEAR_WALK);
  // Paused callbacks project without executing a match frame.
  for (let callback = 1; callback <= 20; callback++) {
    assertEquals(projectBear(match.runtime.summons, fighterAt(match.world, 3), 3).seconds, earlyTime);
    assertFalse(projectBear(match.runtime.summons, undefined, 1).visible);
  }
  captureReplaySnapshot(rendered, match.world, match.game, match.inputs, match.runtime);
  assertEquals(firstStateDifference(early, rendered), undefined);
  assertEquals(firstPoseDifference(early, rendered), undefined);
  match.runtime.summons.bears[3].clipTime = f32(match.runtime.summons.bears[3].clipTime + TICK);
  captureReplaySnapshot(rendered, match.world, match.game, match.inputs, match.runtime);
  assertEquals(stateChecksum(early), stateChecksum(rendered));
  assertEquals(firstPoseDifference(early, rendered), "summons.slot[3].clipTime");
  restoreReplaySnapshot(later, match.world, match.game, match.inputs, match.runtime);
  assertTrue(match.runtime.summons.bears[3].clipTime > earlyTime);
  resetPoses(match.runtime);
  assertFalse(projectBear(match.runtime.summons, fighterAt(match.world, 3), 3).visible);
});

test("a late correction removes or restores a bear's spawn and swipe", () => {
  for (const initiallySummons of [0, 1]) {
    const match = testMatch(9, Character.rifleman);
    const live = replayState(match);
    fighterAt(match.world, 3).motion.x = -150.0;
    const history = new ReplayHistory();
    assertTrue(history.beginEpoch(92, 1, 12));
    for (let frame = 1; frame <= 8; frame++) {
      match.inputs.inputs[0].specialPressed = frame === 1 && initiallySummons === 1;
      match.inputs.inputs[0].specialX = frame === 1 ? initiallySummons : 0;
      captureNext(match);
      assertTrue(history.saveSpeculative(92, match.row, live));
      executeCaptured(match);
    }
    const summons = match.runtime.summons;
    assertEquals(projectBear(summons, fighterAt(match.world, 0), 0).visible, initiallySummons === 1);
    if (initiallySummons === 1) {
      assertEquals(summons.bears[0].clipIndex, SUMMON_BEAR_ATTACK);
      assertEquals(summons.bearHitSerial[0], 1);
    }
    const replacement = createFrameControls();
    replacement.inputs[0].specialPressed = initiallySummons === 0;
    replacement.inputs[0].specialX = 1 - initiallySummons;
    const row = createMatchFrameInput();
    assertTrue(captureFrame(row, 1, 9, replacement, match.runtime));
    const corrections = new ReplayCorrections();
    assertTrue(corrections.beginEpoch(92));
    assertTrue(corrections.add(row));
    assertEquals(history.correct(92, corrections, live), 1);
    const expected = testMatch(9, Character.rifleman);
    fighterAt(expected.world, 3).motion.x = -150.0;
    for (let frame = 1; frame <= 8; frame++) {
      expected.inputs.inputs[0].specialPressed = frame === 1 && initiallySummons === 0;
      expected.inputs.inputs[0].specialX = frame === 1 ? 1 - initiallySummons : 0;
      executeNext(expected);
    }
    assertEquals(firstSummonDifference(summons, expected.runtime.summons), undefined);
    assertEquals(projectBear(summons, fighterAt(match.world, 0), 0).visible, initiallySummons === 0);
    assertEquals(summons.bearHitSerial[0], 1 - initiallySummons);
    if (initiallySummons === 0) {
      assertEquals(summons.bears[0].clipIndex, SUMMON_BEAR_ATTACK);
      assertTrue(summons.bears[0].clipTime > 0.0);
    }
  }
});

test("sparse and four-slot bears match whether projected or not, and end with their match", () => {
  for (const mask of [9, 15]) {
    const sequential = testMatch(mask, Character.rifleman);
    const catchup = testMatch(mask, Character.rifleman);
    for (let frame = 1; frame <= 8; frame++) {
      for (const slot of PARTICIPANT_SLOTS) {
        if (!isActive(sequential.world, slot) || frame !== slot + 1) continue;
        for (const fighter of [fighterAt(sequential.world, slot), fighterAt(catchup.world, slot)]) {
          fighter.bear.life = 500;
          fighter.bear.x = fighter.motion.x;
          fighter.bear.velocityX = 0.0;
        }
      }
      executeNext(sequential);
      executeNext(catchup);
      for (const slot of PARTICIPANT_SLOTS) {
        if (!isActive(sequential.world, slot)) continue;
        projectBear(sequential.runtime.summons, fighterAt(sequential.world, slot), slot);
        projectBear(sequential.runtime.summons, fighterAt(sequential.world, slot), slot);
      }
    }
    const summons = sequential.runtime.summons;
    assertEquals(firstSummonDifference(summons, catchup.runtime.summons), undefined);
    for (const slot of PARTICIPANT_SLOTS) {
      assertEquals(summons.bears[slot].active, isActive(sequential.world, slot));
      if (!isActive(sequential.world, slot)) continue;
      assertLessThan(Math.abs(summons.bears[slot].clipTime - (7 - slot) / 60.0), f32(0.00001));
      assertEquals(projectBear(summons, fighterAt(sequential.world, slot), slot).x, -240.0 + slot * 150.0);
    }
    const last = fighterAt(sequential.world, 3);
    last.status.out = true;
    last.status.respawn = 60;
    executeNext(sequential);
    assertFalse(summons.bears[3].active);
    assertFalse(projectBear(summons, last, 3).visible);
    const empty = createSummonState();
    catchup.game.timeLimitMinutes = 1;
    catchup.game.remainingFrames = 1;
    executeNext(catchup);
    assertEquals(catchup.game.phase, Phase.result);
    assertEquals(firstSummonDifference(catchup.runtime.summons, empty), undefined);
    sequential.game.phase = Phase.characterMenu;
    executeNext(sequential);
    assertEquals(firstSummonDifference(summons, empty), undefined);
  }
});
