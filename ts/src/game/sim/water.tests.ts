


import { assertEquals, assertFalse, assertGreaterThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { Phase } from "../match/rules";
import { stepMatch } from "../match/step";
import { stateChecksum } from "../replay/canonical";
import { firstStateDifference } from "../replay/difference";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { Character } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { SELECTABLE_CHARACTERS } from "./heroes/registry";
import { fighterAt } from "./roster";
import { FROZEN_THRONE_STAGE, TOMB_OF_SARGERAS_STAGE, mainDeckZ } from "./stage";
import { advanceSolo, controls } from "./testWorld";
import { f32 } from "wisp/src/sim/f32";
import { HYDRA_HIT, HYDRA_STRIKE_FRAME, HYDRA_TELL_FRAMES, HYDRA_TRIGGER_FRAMES, SWIM_ACCELERATION, SWIM_SPEED, WATER_JUMP_FACTOR, WATER_JUMP_REENTRIES, WATER_RISE_CAP, beginWaterJump, inHydraStrike, waterJumpScale } from "./water";
import { SEA_SURFACE_Z, TIDE_FLOW_FRAMES, TIDE_SLACK_FRAMES, TIDE_SPEED, framesUntilTideTurns, seaLeft, seaRight, tideDirection, tideNextDirection, tidePush } from "./stageHazards";
import { hydraWarningX, hydraStrikeZ } from "../presentation/stageHazards";

const TOMB = TOMB_OF_SARGERAS_STAGE;
const UNDER = SEA_SURFACE_Z - 10.0;
const HYDRA_STRIKE = HYDRA_TRIGGER_FRAMES + HYDRA_TELL_FRAMES;

test("the tide pushes 4.8 a frame right through frame 540, is slack from 541, pushes left from 601 and right again from 1201 [spec docs/design/water-stage.md]", () => {
  const flow = TIDE_FLOW_FRAMES, slack = TIDE_SLACK_FRAMES;
  assertEquals(tidePush(TOMB, 1, 0.0, UNDER), TIDE_SPEED);
  assertEquals(tidePush(TOMB, flow, 0.0, UNDER), TIDE_SPEED);
  assertEquals(tidePush(TOMB, flow + 1, 0.0, UNDER), 0.0);
  assertEquals(tidePush(TOMB, flow + slack, 0.0, UNDER), 0.0);
  assertEquals(tidePush(TOMB, flow + slack + 1, 0.0, UNDER), -TIDE_SPEED);
  assertEquals(tidePush(TOMB, 2 * flow + slack, 0.0, UNDER), -TIDE_SPEED);
  assertEquals(tidePush(TOMB, 2 * flow + slack + 1, 0.0, UNDER), 0.0);
  assertEquals(tidePush(TOMB, 2 * (flow + slack) + 1, 0.0, UNDER), TIDE_SPEED);

  assertEquals(tideDirection(flow + 1), 0);
  assertEquals(tideNextDirection(flow + 1), -1);
  assertEquals(framesUntilTideTurns(flow + 1), slack);
  assertEquals(framesUntilTideTurns(flow + slack), 1);
  assertEquals(framesUntilTideTurns(flow + slack + 1), 0);
  assertEquals(tideNextDirection(2 * flow + slack + 1), 1);
});

test("the sea spans blast line to blast line below z -360 on the Tomb only; the deck and the air above the surface are never pushed [spec docs/design/water-stage.md]", () => {
  assertNear(seaLeft(TOMB), -1562.5999755859375, 0.10000000149011612);
  assertNear(seaRight(TOMB), 1562.5999755859375, 0.10000000149011612);
  assertEquals(tidePush(TOMB, 1, 1500.0, SEA_SURFACE_Z), TIDE_SPEED);
  assertEquals(tidePush(TOMB, 1, 0.0, SEA_SURFACE_Z + 1.0), 0.0);
  assertEquals(tidePush(TOMB, 1, 0.0, 0.0), 0.0);
  assertEquals(tidePush(FROZEN_THRONE_STAGE, 1, 0.0, UNDER), 0.0);
});


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

const NEUTRAL = controls();
const JUMP = controls({ jumpPressed: true, jumpHeld: true });
const OPEN_SEA = 900.0;


function floater(character: Character): Fighter {
  const f = createFighter(character, OPEN_SEA, -1);
  f.motion.grounded = false; f.motion.surface = undefined; f.motion.z = SEA_SURFACE_Z;
  advanceSolo(f, TOMB, NEUTRAL, 0.0);
  return f;
}

test("a fighter that falls into the sea sinks, rises at most 18 a frame and then floats at the surface [spec docs/design/water-stage.md]", () => {
  const f = createFighter(Character.rifleman, OPEN_SEA, -1);
  f.motion.grounded = false; f.motion.surface = undefined; f.motion.z = SEA_SURFACE_Z + 60.0;
  let deepest = f.motion.z;
  for (let frame = 0; frame < 240; frame++) {
    advanceSolo(f, TOMB, NEUTRAL, 0.0);
    deepest = Math.min(deepest, f.motion.z);
    assertTrue(f.motion.vz <= WATER_RISE_CAP);
  }
  assertTrue(deepest < SEA_SURFACE_Z);
  assertEquals(f.motion.z, SEA_SURFACE_Z);
  assertEquals(f.motion.vz, 0.0);
  assertEquals(f.status.out, false);

  const under = floater(Character.rifleman);
  under.motion.x = 0.0;
  for (let frame = 0; frame < 60; frame++) advanceSolo(under, TOMB, NEUTRAL, 0.0);
  assertEquals(under.motion.x, 0.0);
  assertEquals(under.motion.z, SEA_SURFACE_Z);
});

test("a floating fighter swims at up to 3.6 a frame, gaining 0.3 a frame [spec docs/design/water-stage.md]", () => {
  const f = floater(Character.rifleman);
  const right = controls({ direction: 1 });
  advanceSolo(f, TOMB, right, 0.0);
  assertNear(f.motion.vx, SWIM_ACCELERATION, 0.0010000000474974513);
  for (let frame = 0; frame < 30; frame++) advanceSolo(f, TOMB, right, 0.0);
  assertEquals(f.motion.vx, SWIM_SPEED);
  assertEquals(f.motion.z, SEA_SURFACE_Z);
});

test("the water jump is the full ground jump, scaled by 0.91 per re-entry since landing up to four times, and keeps the double jump [spec docs/design/water-stage.md]", () => {
  assertEquals(waterJumpScale(1), 1.0);
  assertEquals(waterJumpScale(2), WATER_JUMP_FACTOR);
  assertNear(waterJumpScale(WATER_JUMP_REENTRIES + 1), WATER_JUMP_FACTOR ** WATER_JUMP_REENTRIES, 0.00009999999747378752);
  assertEquals(waterJumpScale(WATER_JUMP_REENTRIES + 5), waterJumpScale(WATER_JUMP_REENTRIES + 1));
  for (const entries of [1, 3, 7]) {
    const f = floater(Character.rifleman);
    f.water.entries = entries;
    f.jump.remaining = 0;
    advanceSolo(f, TOMB, JUMP, 0.0);
    assertGreaterThan(f.motion.z, SEA_SURFACE_Z);
    assertTrue(f.jump.remaining > 0);
  }
  for (const entries of [1, 3, 5]) {
    const f = floater(Character.rifleman); f.water.entries = entries;
    assertTrue(beginWaterJump(f, 0));
    assertEquals(f.motion.vz, f32(f.tuning.physics.fullJumpSpeed * waterJumpScale(entries)));
  }
});

test("every fighter's water jump and double jump from the surface reach above the deck [spec docs/design/water-stage.md]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const f = floater(character);
    f.water.entries = 1;
    advanceSolo(f, TOMB, JUMP, 0.0);
    let highest = f.motion.z;
    let doubled = false;
    for (let frame = 0; frame < 180 && (f.motion.z > SEA_SURFACE_Z || frame === 0); frame++) {
      const press = !doubled && f.motion.vz <= 0;
      if (press) doubled = true;
      advanceSolo(f, TOMB, press ? JUMP : controls({ jumpHeld: true }), 0.0);
      highest = Math.max(highest, f.motion.z);
    }
    if (!(doubled && highest > mainDeckZ(TOMB))) throw new Error(`fighter ${character} reaches ${highest} from the surface, below the deck at ${mainDeckZ(TOMB)}`);
  }
});

/** Frames until fighter 0, floating at x from match frame 1, passes the right blast line. */
function framesToBlastLine(x: number, hazards: boolean): number {
  const state = seaMatch(x, SEA_SURFACE_Z);
  state.match.hazards = hazards;
  const f = fighterAt(state.world, 0);
  for (let frame = 1; frame <= 400; frame++) {
    stepMatch(state.match, state.world, state.controls, frame);
    if (f.status.out || f.motion.x > seaRight(TOMB)) return frame;
    assertEquals(f.motion.z, SEA_SURFACE_Z);
  }
  return -1;
}

// With hazards off, so the hydra doesn't bite first: the current is the stage and stays.
test("the flood carries a floating fighter from the ledge past the side blast line in 201 frames and from under the deck's centre in 326 [spec docs/design/water-stage.md]", () => {
  assertEquals(framesToBlastLine(600.0, false), 201);
  assertEquals(framesToBlastLine(0.0, false), 326);
});

test("swimming against the tide still loses 1.2 a frame; jumping out ends the push that frame [spec docs/design/water-stage.md]", () => {
  const state = seaMatch(0.0, SEA_SURFACE_Z);
  const f = fighterAt(state.world, 0);
  state.controls.inputs[0].direction = -1;
  play(state, 1, 40);
  const before = f.motion.x;
  play(state, 41, 41);
  assertNear(f32(f.motion.x - before), f32(TIDE_SPEED - SWIM_SPEED), 0.0010000000474974513);
  state.controls.inputs[0].direction = 0;
  state.controls.inputs[0].jumpPressed = true;
  const atJump = f.motion.x;
  play(state, 42, 42);
  assertGreaterThan(f.motion.z, SEA_SURFACE_Z);
  assertFalse(f.water.inWater);
  assertNear(f.motion.x, atJump, 4.0);
});

test("the hydra's tell starts on a fighter's 150th frame in the water, its visible mark warns for all 45 frames, and it strikes on the 195th: 15% and straight down through the bottom blast line [spec docs/design/water-stage.md] [repro #277]", () => {
  const state = seaMatch(-1000.0, SEA_SURFACE_Z);
  const f = fighterAt(state.world, 0);
  let tell = 0; let strike = 0; let out = 0; let bitten = 0.0; let fall = 0.0; let warningFrames = 0;
  play(state, 1, 320, (frame, fighter) => {
    if (frame <= HYDRA_STRIKE) {
      const warning = hydraWarningX(TOMB, fighter.water);
      if (frame < HYDRA_TRIGGER_FRAMES || frame === HYDRA_STRIKE) assertEquals(warning, undefined);
      else {
        assertEquals(warning, fighter.water.hydraX);
        assertEquals(fighter.status.damage, 0.0);
        warningFrames++;
      }
    }
    if (tell === 0 && fighter.water.hydraFrame === 1) tell = frame;
    if (strike === 0 && fighter.status.damage > 0) { strike = frame; bitten = fighter.status.damage; fall = fighter.launch.knockbackZ; }
    if (out === 0 && fighter.status.out) out = frame;
  });
  assertEquals(warningFrames, HYDRA_TELL_FRAMES);
  assertEquals(tell, HYDRA_TRIGGER_FRAMES);
  assertEquals(strike, HYDRA_STRIKE);
  assertEquals(bitten, HYDRA_HIT.damage);
  assertTrue(fall < 0.0);
  assertGreaterThan(out, strike);
  assertEquals(f.water.hydraFrame, 0);
});

test("the hydra's mark drifts with the tide, not toward the fighter: swimming against the tide through the tell escapes it, and Hazards Off removes it [spec docs/design/water-stage.md]", () => {
  const swimmer = seaMatch(-1000.0, SEA_SURFACE_Z);
  const f = fighterAt(swimmer.world, 0);
  play(swimmer, 1, 149);
  swimmer.controls.inputs[0].direction = -1;
  play(swimmer, 150, 200, (frame, fighter) => { if (frame === 194) assertEquals(fighter.water.hydraFrame, HYDRA_STRIKE_FRAME - 1); });
  assertEquals(f.status.damage, 0.0);
  assertEquals(f.water.hydraFrame, 0);
  assertEquals(f.water.frames > 0 && f.water.frames < 10, true);
  const off = seaMatch(-1000.0, SEA_SURFACE_Z);
  off.match.hazards = false;
  play(off, 1, 200);
  assertEquals(fighterAt(off.world, 0).water.hydraFrame, 0);
  assertEquals(fighterAt(off.world, 0).status.damage, 0.0);
  // The lunge: radius 90 round the mark, from the surface to 150 above it.
  assertTrue(inHydraStrike(0.0, 89.0, SEA_SURFACE_Z));
  assertFalse(inHydraStrike(0.0, 91.0, SEA_SURFACE_Z));
  assertTrue(inHydraStrike(0.0, 0.0, SEA_SURFACE_Z + 230.0));
  assertFalse(inHydraStrike(0.0, 0.0, SEA_SURFACE_Z + 250.0));
});

test("a hydra strike replays through rollback with no difference, and a dodged lunge at its drifting mark submerges after 18 frames and restores through rollback [invariant] [repro #277]", () => {
  const live = seaMatch(-1000.0, SEA_SURFACE_Z);
  const saved = createReplaySnapshot(); const replay = createReplaySnapshot();
  play(live, 1, 170);
  copyReplayState(saved, live);
  play(live, 171, 230);
  copyReplayState(replay, saved);
  play(replay, 171, 230);
  assertGreaterThan(fighterAt(live.world, 0).status.damage, 0.0);
  assertEquals(firstStateDifference(live, replay), undefined);
  assertEquals(stateChecksum(live), stateChecksum(replay));
  const dodged = seaMatch(-1000.0, SEA_SURFACE_Z);
  play(dodged, 1, HYDRA_STRIKE - 1);
  const fighter = fighterAt(dodged.world, 0);
  const mark = fighter.water.hydraX;
  fighter.motion.x += 200.0;
  const dodgedSaved = createReplaySnapshot();
  copyReplayState(dodgedSaved, dodged);
  play(dodged, HYDRA_STRIKE, HYDRA_STRIKE + 17, (frame, f) => {
    assertEquals(f.status.damage, 0.0);
    assertEquals(f.water.hydraStrikeFrame, HYDRA_STRIKE);
    assertEquals(f.water.hydraX, f32(mark + TIDE_SPEED));
    assertEquals(hydraStrikeZ(TOMB, f.water, frame), -210.0 - (frame - HYDRA_STRIKE) * 20.0);
  });
  const dodgedReplay = createReplaySnapshot();
  copyReplayState(dodgedReplay, dodgedSaved);
  play(dodgedReplay, HYDRA_STRIKE, HYDRA_STRIKE + 17);
  assertEquals(firstStateDifference(dodged, dodgedReplay), undefined);
  assertEquals(stateChecksum(dodged), stateChecksum(dodgedReplay));
  play(dodged, HYDRA_STRIKE + 18, HYDRA_STRIKE + 18);
  assertEquals(hydraStrikeZ(TOMB, fighter.water, HYDRA_STRIKE + 18), undefined);
});
