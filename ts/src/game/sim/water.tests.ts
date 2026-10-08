// The Tomb of Sargeras sea (smashcraft:docs/design/water-stage.md, #277):
// the tide's timetable and push, floating, swimming, the water jump and the
// hydra, each pinned to the design's numbers.
import { assertEquals, assertGreaterThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { Phase } from "../match/rules";
import { stepMatch } from "../match/step";
import { stateChecksum } from "../replay/canonical";
import { firstStateDifference } from "../replay/difference";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import type { Fighter } from "./fighter";
import { fighterAt } from "./roster";
import { FROZEN_THRONE_STAGE, TOMB_OF_SARGERAS_STAGE } from "./stage";
import { SEA_SURFACE_Z, TIDE_SPEED, framesUntilTideTurns, seaLeft, seaRight, tideDirection, tideNextDirection, tidePush } from "./stageHazards";

const TOMB = TOMB_OF_SARGERAS_STAGE;
const UNDER = SEA_SURFACE_Z - 10.0;

test("the tide pushes 4.8 a frame right through frame 540, is slack from 541, pushes left from 601 and right again from 1201 [spec docs/design/water-stage.md]", () => {
  assertNear(TIDE_SPEED, 4.800000190734863, 0.0010000000474974513);
  assertEquals(tidePush(TOMB, 1, 0.0, UNDER), TIDE_SPEED);
  assertEquals(tidePush(TOMB, 540, 0.0, UNDER), TIDE_SPEED);
  assertEquals(tidePush(TOMB, 541, 0.0, UNDER), 0.0);
  assertEquals(tidePush(TOMB, 600, 0.0, UNDER), 0.0);
  assertEquals(tidePush(TOMB, 601, 0.0, UNDER), -TIDE_SPEED);
  assertEquals(tidePush(TOMB, 1140, 0.0, UNDER), -TIDE_SPEED);
  assertEquals(tidePush(TOMB, 1141, 0.0, UNDER), 0.0);
  assertEquals(tidePush(TOMB, 1201, 0.0, UNDER), TIDE_SPEED);
  // The slack names the coming direction and counts down to it.
  assertEquals(tideDirection(541), 0);
  assertEquals(tideNextDirection(541), -1);
  assertEquals(framesUntilTideTurns(541), 60);
  assertEquals(framesUntilTideTurns(600), 1);
  assertEquals(framesUntilTideTurns(601), 0);
  assertEquals(tideNextDirection(1141), 1);
});

test("the sea spans blast line to blast line below z -360 on the Tomb only; the deck and the air above the surface are never pushed [spec docs/design/water-stage.md]", () => {
  assertNear(seaLeft(TOMB), -1562.5999755859375, 0.10000000149011612);
  assertNear(seaRight(TOMB), 1562.5999755859375, 0.10000000149011612);
  assertEquals(tidePush(TOMB, 1, 1500.0, SEA_SURFACE_Z), TIDE_SPEED);
  assertEquals(tidePush(TOMB, 1, 0.0, SEA_SURFACE_Z + 1.0), 0.0);
  assertEquals(tidePush(TOMB, 1, 0.0, 0.0), 0.0);
  assertEquals(tidePush(FROZEN_THRONE_STAGE, 1, 0.0, UNDER), 0.0);
});

/** A two-fighter practice match on the Tomb with fighter 0 dropped, airborne, at (x, z). */
function seaMatch(x: number, z: number): ReplayState {
  const state = createReplaySnapshot();
  state.match.phase = Phase.match; state.match.stageChoice = TOMB;
  state.match.humanMask = 3; state.match.humanFighterMask = 3; state.match.practice = true;
  const f = fighterAt(state.world, 0);
  f.motion.x = x; f.motion.z = z; f.motion.grounded = false; f.motion.surface = undefined;
  return state;
}

function play(state: ReplayState, from: number, to: number, each?: (frame: number, f: Fighter) => void): void {
  for (let frame = from; frame <= to; frame++) {
    stepMatch(state.match, state.world, state.controls, frame);
    each?.(frame, fighterAt(state.world, 0));
  }
}

test("a fighter's water count runs only while it is in the sea, counts one entry and restarts when it lands [spec docs/design/water-stage.md]", () => {
  const state = seaMatch(0.0, SEA_SURFACE_Z + 2.0);
  const f = fighterAt(state.world, 0);
  let wet = 0;
  play(state, 1, 10, (_frame, fighter) => { if (fighter.motion.z <= SEA_SURFACE_Z) wet++; });
  assertGreaterThan(wet, 0);
  assertTrue(f.water.inWater);
  assertEquals(f.water.frames, wet);
  assertEquals(f.water.entries, 1);
  // Standing on the deck again clears the visit.
  const standing = fighterAt(state.world, 1);
  standing.water.frames = 40; standing.water.entries = 3;
  play(state, 11, 11);
  assertEquals(standing.water.frames, 0);
  assertEquals(standing.water.entries, 0);
});

test("a fighter's water state is saved with the match: a rollback into the sea replays 30 frames with no difference [invariant]", () => {
  const live = seaMatch(-300.0, SEA_SURFACE_Z + 20.0);
  const saved = createReplaySnapshot(); const replay = createReplaySnapshot();
  play(live, 1, 6);
  assertGreaterThan(fighterAt(live.world, 0).water.frames, 0);
  copyReplayState(saved, live);
  play(live, 7, 36);
  copyReplayState(replay, saved);
  play(replay, 7, 36);
  assertEquals(firstStateDifference(live, replay), undefined);
  assertEquals(stateChecksum(live), stateChecksum(replay));
});
