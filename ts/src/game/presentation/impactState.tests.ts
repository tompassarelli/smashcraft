import { stageBounds } from "../sim/stageBounds";
import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_SLOTS, type ParticipantSlot } from "../input/participants";
import { clearPresentationHistory } from "../match/pacingAndPresentation";
import { Phase } from "../match/rules";
import { createFrameControls } from "../match/controls";
import { captureFrame, createMatchFrameInput } from "../match/frameInput";
import { type TestMatch, captureNext, executeCaptured, executeNext, replayState, testMatch } from "../match/testMatch";
import { stateChecksum } from "../replay/canonical";
import { ReplayCorrections, ReplayHistory } from "../replay/history";
import { firstFighterDifference, firstPoseDifference, firstStateDifference } from "../replay/difference";
import { captureReplaySnapshot, createReplaySnapshot, restoreReplaySnapshot } from "../replay/snapshot";
import { beginFighterAttack } from "../sim/attacks";
import { AttackStyle, Character, DownState, GrabAction } from "../sim/codes";
import { TOP_KO_MINIMUM_UPWARD_KNOCKBACK } from "../sim/knockback";
import { attackStartupFrames, grabContactFrame } from "../sim/moves";
import { fighterAt, isActive } from "../sim/roster";
import { firstFighterPoseDifference } from "./fighterPose";
import { DodgeCue, ImpactLanding, JumpCue, createImpactEvents } from "./impactEvents";
import {
  IMPACTS_PER_KIND, IMPACT_CHARGE, IMPACT_COUNT, IMPACT_DUST, IMPACT_GRAB, IMPACT_SCREEN_KO, IMPACT_STAR_KO, IMPACT_THROW, advanceImpacts, clearImpactState, copyImpactStateInto, createImpactState, emitImpacts, firstImpactDifference, impactLifetime, projectImpact, projectKo,
} from "./impactState";

function projectAll(match: TestMatch): void {
  for (let i = 0; i < IMPACT_COUNT; i++) projectImpact(match.runtime.impacts, i);
}

test("stock dust remains drawn until its slot expires [repro #95]", () => {
  const pool = createImpactState();
  const events = createImpactEvents();
  events.movementDust = true;
  emitImpacts(pool, events, 1);
  const slot = IMPACT_DUST * IMPACTS_PER_KIND;
  for (let frame = 0; frame < impactLifetime(IMPACT_DUST); frame++) {
    const pose = projectImpact(pool, slot);
    assertTrue(pose.visible && pose.alpha > 0);
    advanceImpacts(pool);
  }
  assertFalse(projectImpact(pool, slot).visible);
});

/** Presses a spot dodge, or releases it. */
function dodge(match: TestMatch, slot: ParticipantSlot, pressed: boolean): void {
  const input = match.inputs.inputs[slot];
  input.groundDodgePressed = pressed;
  input.groundDodgeDirection = 0;
  input.shield = pressed;
}

test("impact projection reads only and clearing empties the pool [invariant]", () => {
  const pool = createImpactState();
  const saved = createImpactState();
  const events = createImpactEvents();
  events.x = 100.0;
  events.z = 20.0;
  events.hit = true;
  events.landing = ImpactLanding.tech;
  emitImpacts(pool, events, 0);
  events.hit = false;
  events.landing = ImpactLanding.missedTech;
  events.dodge = DodgeCue.roll;
  events.direction = -1;
  emitImpacts(pool, events, 0);
  events.hit = true;
  events.electric = true;
  events.shieldHit = true;
  events.jump = JumpCue.double;
  events.koDirectionX = 1;
  events.respawn = true;
  events.grab = true;
  events.throwRelease = true;
  events.charge = true;
  events.ready = true;
  events.ledgeCatch = true;
  events.ledgeRecovery = true;
  events.landing = ImpactLanding.none;
  events.dodge = DodgeCue.none;
  emitImpacts(pool, events, 0);
  copyImpactStateInto(saved, pool);
  for (let i = 0; i < IMPACT_COUNT; i++) {
    projectImpact(pool, i);
    projectImpact(pool, i);
  }
  assertEquals(firstImpactDifference(pool, saved), undefined);
  clearImpactState(pool);
  assertEquals(firstImpactDifference(pool, createImpactState()), undefined);
});

test("a snapshot restores the impact pool and its ring pointers [invariant]", () => {
  const match = testMatch(9, Character.rifleman);
  const events = createImpactEvents();
  events.dodge = DodgeCue.spot;
  events.x = 77.0;
  emitImpacts(match.runtime.impacts, events, 0);
  for (let frame = 1; frame <= 5; frame++) advanceImpacts(match.runtime.impacts);
  const saved = createReplaySnapshot();
  captureReplaySnapshot(saved, match.world, match.game, match.inputs, match.runtime);
  const dust = projectImpact(match.runtime.impacts, 24);
  events.dodge = DodgeCue.roll;
  events.direction = -1;
  emitImpacts(match.runtime.impacts, events, 0);
  const changed = createReplaySnapshot();
  captureReplaySnapshot(changed, match.world, match.game, match.inputs, match.runtime);
  assertEquals(stateChecksum(changed), stateChecksum(saved));
  assertTrue(firstPoseDifference(saved, changed) !== undefined);
  restoreReplaySnapshot(saved, match.world, match.game, match.inputs, match.runtime);
  captureReplaySnapshot(changed, match.world, match.game, match.inputs, match.runtime);
  assertEquals(firstPoseDifference(saved, changed), undefined);
  const restored = projectImpact(match.runtime.impacts, 24);
  assertEquals(restored.x, dust.x);
  assertEquals(restored.z, dust.z);
  assertEquals(restored.alpha, dust.alpha);
});

test("a correction removes a predicted impact and restores the accepted one's age [invariant]", () => {
  const match = testMatch(9, Character.rifleman);
  const live = replayState(match);
  const history = new ReplayHistory();
  assertTrue(history.beginEpoch(81, 1, 12));
  for (let frame = 1; frame <= 5; frame++) {
    dodge(match, 0, frame === 1);
    dodge(match, 3, frame === 2);
    captureNext(match);
    assertTrue(frame === 1 ? history.save(81, match.row, live) : history.saveSpeculative(81, match.row, live));
    executeCaptured(match);
  }
  const impacts = match.runtime.impacts;
  assertEquals(impacts.nextSlot[IMPACT_DUST], 4);
  assertEquals(impacts.ages[24], 4);
  assertEquals(impacts.ages[26], 3);
  const corrected = createMatchFrameInput();
  assertTrue(captureFrame(corrected, 2, 9, createFrameControls(), match.runtime));
  const corrections = new ReplayCorrections();
  assertTrue(corrections.beginEpoch(81));
  assertTrue(corrections.add(corrected));
  assertEquals(history.correct(81, corrections, live), 2);
  assertEquals(impacts.nextSlot[IMPACT_DUST], 2);
  assertEquals(impacts.ages[24], 4);
  assertTrue(projectImpact(impacts, 24).visible);
  assertFalse(projectImpact(impacts, 26).visible);
  assertFalse(projectImpact(impacts, 27).visible);
});

test("sparse and four-player matches emit the same impacts whether projected each frame or not [invariant]", () => {
  for (const mask of [9, 15]) {
    const sequential = testMatch(mask, Character.rifleman);
    const catchup = testMatch(mask, Character.rifleman);
    for (let frame = 1; frame <= 8; frame++) {
      for (const slot of PARTICIPANT_SLOTS) {
        if (!isActive(sequential.world, slot)) continue;
        dodge(sequential, slot, frame === 1);
        dodge(catchup, slot, frame === 1);
      }
      executeNext(sequential);
      projectAll(sequential);
      projectAll(sequential);
      executeNext(catchup);
    }
    assertEquals(firstImpactDifference(sequential.runtime.impacts, catchup.runtime.impacts), undefined);
    for (let i = 0; i < IMPACT_COUNT; i++) {
      const a = projectImpact(sequential.runtime.impacts, i);
      const b = projectImpact(catchup.runtime.impacts, i);
      assertEquals(a.visible, b.visible);
      assertEquals(a.x, b.x);
      assertEquals(a.alpha, b.alpha);
    }
  }
});

test("a result, a reset or a menu frame empties the impact pool [spec #82]", () => {
  const pool = createImpactState();
  const events = createImpactEvents();
  events.hit = true;
  for (let i = 0; i <= 9; i++) {
    events.x = i * 10.0;
    emitImpacts(pool, events, 0);
  }
  const match = testMatch(15, Character.rifleman);
  const empty = createImpactState();
  copyImpactStateInto(match.runtime.impacts, pool);
  match.game.timeLimitMinutes = 1;
  match.game.remainingFrames = 1;
  executeNext(match);
  assertEquals(match.game.phase, Phase.result);
  assertEquals(firstImpactDifference(match.runtime.impacts, empty), undefined);
  copyImpactStateInto(match.runtime.impacts, pool);
  clearPresentationHistory(match.runtime);
  assertEquals(firstImpactDifference(match.runtime.impacts, empty), undefined);
  copyImpactStateInto(match.runtime.impacts, pool);
  match.game.phase = Phase.characterMenu;
  executeNext(match);
  assertEquals(firstImpactDifference(match.runtime.impacts, empty), undefined);
});

test("replaying from a snapshot restores accepted grab and throw cues, and projection consumes none [invariant]", () => {
  const match = testMatch(3, Character.rifleman);
  const owner = fighterAt(match.world, 0);
  const target = fighterAt(match.world, 1);
  owner.motion.x = 0.0;
  owner.motion.surface = 0;
  target.motion.x = 90.0;
  target.motion.surface = 0;
  beginFighterAttack(match.world, 0, AttackStyle.grab, false);
  owner.attack.frame = attackStartupFrames(AttackStyle.grab) - 1;
  const before = createReplaySnapshot();
  const accepted = createReplaySnapshot();
  const replayed = createReplaySnapshot();
  captureReplaySnapshot(before, match.world, match.game, match.inputs, match.runtime);
  const grabAndThrow = () => {
    executeNext(match);
    match.inputs.inputs[0].grabThrowX = 1;
    executeNext(match);
    match.inputs.inputs[0].grabThrowX = 0;
    for (let tick = 2; tick <= grabContactFrame(GrabAction.throwForward); tick++) executeNext(match);
  };
  grabAndThrow();
  assertEquals(target.visuals.grab, 1);
  assertEquals(target.visuals.throw, 1);
  assertEquals(match.runtime.impacts.nextSlot[IMPACT_GRAB], 1);
  assertEquals(match.runtime.impacts.nextSlot[IMPACT_THROW], 1);
  captureReplaySnapshot(accepted, match.world, match.game, match.inputs, match.runtime);
  // Paused presentation projects repeatedly without consuming or aging a cue.
  for (let tick = 1; tick <= 20; tick++) projectAll(match);
  captureReplaySnapshot(replayed, match.world, match.game, match.inputs, match.runtime);
  assertEquals(firstPoseDifference(accepted, replayed), undefined);
  restoreReplaySnapshot(before, match.world, match.game, match.inputs, match.runtime);
  grabAndThrow();
  captureReplaySnapshot(replayed, match.world, match.game, match.inputs, match.runtime);
  assertEquals(firstStateDifference(accepted, replayed), undefined);
  assertEquals(firstPoseDifference(accepted, replayed), undefined);
});

test("a corrected charge removes its cue [invariant]", () => {
  const match = testMatch(3, Character.rifleman);
  const live = replayState(match);
  const history = new ReplayHistory();
  assertTrue(history.beginEpoch(82, 1, 12));
  match.inputs.inputs[0].attackHeld = true;
  beginFighterAttack(match.world, 0, AttackStyle.upSmash, true);
  fighterAt(match.world, 0).attack.frame = attackStartupFrames(AttackStyle.upSmash) - 1;
  for (let frame = 1; frame <= 3; frame++) {
    captureNext(match);
    assertTrue(history.saveSpeculative(82, match.row, live));
    executeCaptured(match);
  }
  assertEquals(match.runtime.impacts.nextSlot[IMPACT_CHARGE], 1);
  const corrected = createMatchFrameInput();
  const neutral = createFrameControls();
  const corrections = new ReplayCorrections();
  assertTrue(corrections.beginEpoch(82));
  for (let frame = 1; frame <= 3; frame++) {
    assertTrue(captureFrame(corrected, frame, 3, neutral, match.runtime));
    assertTrue(corrections.add(corrected));
  }
  assertEquals(history.correct(82, corrections, live), 1);
  assertEquals(match.runtime.impacts.nextSlot[IMPACT_CHARGE], 0);
  assertFalse(projectImpact(match.runtime.impacts, IMPACT_CHARGE * IMPACTS_PER_KIND).visible);
});

test("replaying a confirmed top KO restores one body and the same stocks [invariant]", () => {
  const match = testMatch(3, Character.rifleman);
  const fighter = fighterAt(match.world, 0);
  fighter.motion.z = f32(stageBounds(match.game.stageChoice).blast.top + 1.0);
  fighter.motion.grounded = false;
  fighter.launch.knockbackZ = f32(TOP_KO_MINIMUM_UPWARD_KNOCKBACK + 10.0);
  fighter.down.state = DownState.tumble;
  fighter.down.frame = 1;
  const before = createReplaySnapshot();
  const after = createReplaySnapshot();
  const replayed = createReplaySnapshot();
  const koBodies = () => (match.runtime.impacts.nextSlot[IMPACT_STAR_KO] ?? 0) + (match.runtime.impacts.nextSlot[IMPACT_SCREEN_KO] ?? 0);
  captureReplaySnapshot(before, match.world, match.game, match.inputs, match.runtime);
  executeNext(match);
  assertTrue(fighter.status.out);
  assertEquals(koBodies(), 1);
  for (let frame = 1; frame <= 8; frame++) executeNext(match);
  assertEquals(koBodies(), 1);
  captureReplaySnapshot(after, match.world, match.game, match.inputs, match.runtime);
  restoreReplaySnapshot(before, match.world, match.game, match.inputs, match.runtime);
  for (let frame = 0; frame <= 8; frame++) {
    captureNext(match);
    executeCaptured(match);
  }
  captureReplaySnapshot(replayed, match.world, match.game, match.inputs, match.runtime);
  assertEquals(firstFighterDifference(fighterAt(after.world, 0), fighterAt(replayed.world, 0), 3, 3), undefined);
  assertEquals(after.match.remainingFrames, replayed.match.remainingFrames);
  assertEquals(firstImpactDifference(after.runtime.impacts, replayed.runtime.impacts), undefined);
  assertEquals(firstFighterPoseDifference(after.runtime.poses[0], replayed.runtime.poses[0], after.world, replayed.world), undefined);
  restoreReplaySnapshot(before, match.world, match.game, match.inputs, match.runtime);
  assertFalse(projectKo(match.runtime.impacts, IMPACT_SCREEN_KO * IMPACTS_PER_KIND).visible);
  assertFalse(projectKo(match.runtime.impacts, IMPACT_STAR_KO * IMPACTS_PER_KIND).visible);
});
