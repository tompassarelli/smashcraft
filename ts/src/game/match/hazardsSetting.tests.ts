import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { CARRIED_TEST_STAGE, TIMED_TEST_STAGE, surfaceShiftX, surfaceShiftZ, surfaceZAt } from "../sim/stage";
import { createReplaySnapshot, copyReplayState } from "../replay/snapshot";
import { stateChecksum } from "../replay/canonical";
import { firstStateDifference } from "../replay/difference";
import { fighterAt } from "../sim/roster";
import { Phase, stageClock } from "./rules";
import { stepMatch } from "./step";

for (const [stage, period] of [[CARRIED_TEST_STAGE, 920], [TIMED_TEST_STAGE, 420]] as const) {
  test(`stage ${stage}'s complete platform timetable replays exactly and costs no neutral 0% stock [spec docs/stage-hazards.md] [invariant]`, () => {
    const live = createReplaySnapshot(); const saved = createReplaySnapshot(); const replay = createReplaySnapshot();
    live.match.phase = Phase.match; live.match.stageChoice = stage;
    live.match.humanMask = 3; live.match.humanFighterMask = 3;
    const first = fighterAt(live.world, 0);
    first.motion.surface = 1; first.motion.x = stage === CARRIED_TEST_STAGE ? -420.0 : -330.0;
    first.motion.z = surfaceZAt(stage, 1, 0, first.motion.x);
    fighterAt(live.world, 1).motion.x = 0.0;
    copyReplayState(saved, live);
    let moved = 0;
    for (let frame = 1; frame <= period; frame++) {
      stepMatch(live.match, live.world, live.controls, frame);
      if (surfaceShiftX(stage, 1, frame) !== 0 || surfaceShiftZ(stage, 1, frame) !== 0) moved++;
    }
    assertGreaterThan(moved, 0);
    assertEquals(first.status.stocks, 3);
    assertEquals(first.status.damage, 0.0);
    assertEquals(first.motion.surface, 1);
    copyReplayState(replay, saved);
    for (let frame = 1; frame <= period; frame++) stepMatch(replay.match, replay.world, replay.controls, frame);
    assertEquals(firstStateDifference(live, replay), undefined);
    assertEquals(stateChecksum(live), stateChecksum(replay));
  });
  test(`hazards off keeps stage ${stage}'s platforms stopped through an entire cycle and survives rollback [spec docs/stage-hazards.md]`, () => {
    const live = createReplaySnapshot(); const copy = createReplaySnapshot();
    live.match.phase = Phase.match; live.match.stageChoice = stage; live.match.hazards = false;
    copyReplayState(copy, live);
    assertEquals(copy.match.hazards, false);
    assertEquals(stateChecksum(copy), stateChecksum(live));
    copy.match.hazards = true;
    assertEquals(firstStateDifference(live, copy), "match.hazards");
    assertTrue(stateChecksum(copy) !== stateChecksum(live));
    for (let frame = 1; frame <= period; frame++) {
      stepMatch(live.match, live.world, live.controls, frame);
      assertEquals(surfaceShiftX(stage, 1, stageClock(live.match)), 0.0);
      assertEquals(surfaceShiftZ(stage, 1, stageClock(live.match)), 0.0);
    }
  });
}
