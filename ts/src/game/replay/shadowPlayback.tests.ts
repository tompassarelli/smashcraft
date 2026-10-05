// Speculation, confirmation and correction share one two-cursor fixture;
// retain the full transitions through delivery, pause, ring wrap and slot changes.
import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "waygate/src/runtime/testing";
import { Action, bit, maskOf } from "../input/actions";
import { type InputRow, type RowFields, emptyInput, inputRow, predictInto, sameInput } from "../input/inputRow";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { inputPacket } from "../input/wire";
import { createFrameControls } from "../match/controls";
import { copyNetworkRow, createMatchFrameInput } from "../match/frameInput";
import {
  Phase,
  computerActive,
  copyMatchState,
  createMatchState,
  cycleSlotMode,
  fighterActive,
  fighterMask,
  humanActive,
  humanFighterActive,
  requestStageSelect,
  requestStart,
  selectCharacter,
  setParticipants,
} from "../match/rules";
import { createReplayRuntimeState } from "../match/runtime";
import { matchSpawnX } from "../match/step";
import { Capture } from "../netcode/capture";
import { DEFAULT_ROLLBACK_WINDOW, ShadowInputSchedule } from "../netcode/shadowSchedule";
import { AttackStyle, Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { createRoster, fighterAt } from "../sim/roster";
import { stateChecksum } from "./canonical";
import { firstStateDifference } from "./difference";
import { ReplayHistory } from "./history";
import { shadowSpeculativeStepBudget, ShadowInputPlayback } from "./shadowPlayback";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "./snapshot";
import { type TapeWorld, captureTape, createTapeWorld } from "./tapeWorld";

const row = (fields: RowFields = {}) => assertDefined(inputRow(fields), "row");
const NEUTRAL = row();
const SHIELD = row({ held: bit(Action.leftTrigger), pressed: bit(Action.leftTrigger), triggerLeft: 255 });
const JUMP = row({ held: bit(Action.jump), pressed: bit(Action.jump) });
const ATTACK = row({ pressed: bit(Action.attack) });
const WALK_RIGHT = row({ held: bit(Action.moveRight), pressed: bit(Action.moveRight) });
const SLOT_CHARACTERS = [Character.archer, Character.rifleman, Character.demonHunter, Character.archer] as const;

/** Two archers 200 apart for two connected humans. */
function shadowWorld(): TapeWorld {
  return createTapeWorld({ stocks: 99, humans: 2, first: createFighter(Character.archer, -100.0, 1), second: createFighter(Character.archer, 100.0, -1) });
}

function deliver(schedule: ShadowInputSchedule, sender: number, epoch: number, frame: number, input: Readonly<InputRow>): void {
  assertEquals(schedule.acceptSynchronized(sender, assertDefined(inputPacket(epoch, frame, [input]), "packet")), "accepted");
}

function sameTapes(expected: TapeWorld, actual: TapeWorld): void {
  assertEquals(firstStateDifference(captureTape(expected), captureTape(actual)), undefined);
}

function confirmAll(schedule: ShadowInputSchedule, playback: ShadowInputPlayback, epoch: number, live: ReplayState, history: ReplayHistory): void {
  while (schedule.mayAdvanceConfirmed()) assertTrue(playback.advanceConfirmed(schedule, epoch, live, history));
}

function networkRow(history: ReplayHistory, epoch: number, frame: number, slot: number): InputRow {
  const recorded = createMatchFrameInput();
  const used = emptyInput();
  assertTrue(history.copyInputRow(epoch, frame, recorded));
  assertTrue(copyNetworkRow(recorded, slot, used));
  return used;
}

test("an admitted shield reaches the fighter within the catch-up budget and pause frontier", () => {
  const epoch = 950;
  const schedule = new ShadowInputSchedule();
  const playback = new ShadowInputPlayback();
  const history = new ReplayHistory();
  const { live } = shadowWorld();
  assertTrue(schedule.beginEpoch(epoch, 0, 24, 3));
  assertTrue(playback.beginEpoch(epoch));
  assertTrue(history.beginEpoch(epoch, 1, 24));
  assertEquals(schedule.captureLocalAt(epoch, 1, NEUTRAL), Capture.captured);
  assertEquals(schedule.captureLocalAt(epoch, 2, SHIELD), Capture.captured);
  assertTrue(playback.catchUpSpeculative(schedule, epoch, 0, live, history, shadowSpeculativeStepBudget(true)));
  assertEquals(live.runtime.simulationFrame, 2);
  assertTrue(fighterAt(live.world, 0).shield.raised);
  assertEquals(schedule.speculativeFrame(), 3);
  assertTrue(sameInput(networkRow(history, epoch, 2, 0), SHIELD));
  for (let frame = 3; frame <= 12; frame++) assertEquals(schedule.captureLocalAt(epoch, frame, NEUTRAL), Capture.captured);
  // Available backlog can't exceed the per-callback execution budget.
  assertTrue(playback.catchUpSpeculative(schedule, epoch, 0, live, history, shadowSpeculativeStepBudget(true)));
  assertEquals(live.runtime.simulationFrame, 8);
  // An acknowledged pause frontier excludes that frame even when rows exist.
  assertTrue(playback.catchUpSpeculative(schedule, epoch, 0, live, history, shadowSpeculativeStepBudget(true), 10));
  assertEquals(live.runtime.simulationFrame, 9);
  assertTrue(playback.catchUpSpeculative(schedule, epoch, 0, live, history, shadowSpeculativeStepBudget(true)));
  assertEquals(live.runtime.simulationFrame, 12);
  // Catch-up never invents the missing local frame 13.
  assertEquals(schedule.speculativeFrame(), 13);
  // Live callback capture keeps one-step service even with seeded delay rows.
  const liveSchedule = new ShadowInputSchedule();
  const livePlayback = new ShadowInputPlayback();
  const liveHistory = new ReplayHistory();
  const second = shadowWorld();
  assertTrue(liveSchedule.beginEpoch(epoch, 3, 24, 3));
  assertTrue(livePlayback.beginEpoch(epoch));
  assertTrue(liveHistory.beginEpoch(epoch, 1, 24));
  assertEquals(liveSchedule.captureLocal(epoch, NEUTRAL), Capture.captured);
  assertTrue(livePlayback.catchUpSpeculative(liveSchedule, epoch, 0, second.live, liveHistory, shadowSpeculativeStepBudget(false)));
  assertEquals(second.live.runtime.simulationFrame, 1);
  assertEquals(liveSchedule.captureTarget(), 5);
});

test("a late held input re-predicts the tail and an accepted release stops it", () => {
  for (const localPlayer of [0, 1]) {
    const epoch = 930 + localPlayer;
    const remote = 1 - localPlayer;
    const schedule = new ShadowInputSchedule();
    const playback = new ShadowInputPlayback();
    const history = new ReplayHistory();
    const confirmedHistory = new ReplayHistory();
    const world = shadowWorld();
    const confirmed = shadowWorld();
    const special = row({ pressed: bit(Action.special), specialX: -1, specialZ: 1, sdi: true, sdiX: 1, throwX: 1, throwZ: -1 });
    const hold = row({ held: bit(Action.leftTrigger), pressed: bit(Action.leftTrigger), triggerLeft: 255, sdi: true, sdiX: 1, throwX: 1, throwZ: -1 });
    const release = row({ released: bit(Action.leftTrigger) });
    assertTrue(schedule.beginEpoch(epoch, 0, 9, 3));
    assertTrue(playback.beginEpoch(epoch));
    assertTrue(history.beginEpoch(epoch, 1, 9));
    assertTrue(confirmedHistory.beginEpoch(epoch, 1));
    for (let frame = 1; frame <= 9; frame++) {
      assertEquals(schedule.captureLocal(epoch, frame === 2 ? special : NEUTRAL), Capture.captured);
      assertTrue(playback.advanceSpeculative(schedule, epoch, localPlayer, world.live, history));
    }
    const remoteFighter = fighterAt(world.live.world, remote);
    assertFalse(remoteFighter.shield.raised);
    deliver(schedule, localPlayer, epoch, 1, NEUTRAL);
    deliver(schedule, remote, epoch, 1, hold);
    assertEquals(playback.reconcile(schedule, epoch, localPlayer, world.live, history), 1);
    // A held shield survives the corrected prediction tail.
    assertTrue(remoteFighter.shield.raised);
    assertFalse(history.isSpeculative(epoch, 1));
    const predicted = emptyInput();
    predictInto(predicted, hold);
    for (let frame = 2; frame <= 9; frame++) {
      assertTrue(history.isSpeculative(epoch, frame));
      assertTrue(sameInput(networkRow(history, epoch, frame, remote), predicted));
      assertTrue(sameInput(networkRow(history, epoch, frame, localPlayer), assertDefined(schedule.pending(epoch, frame))));
    }
    // The next newly resolved row continues from the rebuilt present.
    assertEquals(schedule.captureLocal(epoch, NEUTRAL), Capture.captured);
    assertTrue(playback.advanceSpeculative(schedule, epoch, localPlayer, world.live, history));
    assertTrue(sameInput(networkRow(history, epoch, 10, remote), predicted));
    // An accepted remote row beyond the common prefix breaks the held chain.
    deliver(schedule, remote, epoch, 3, release);
    assertEquals(schedule.knownThrough(), 1);
    assertEquals(playback.reconcile(schedule, epoch, localPlayer, world.live, history), 3);
    assertFalse(remoteFighter.shield.raised);
    assertTrue(history.isSpeculative(epoch, 3));
    assertTrue(sameInput(networkRow(history, epoch, 3, remote), release));
    for (let frame = 4; frame <= 10; frame++) {
      assertTrue(history.isSpeculative(epoch, frame));
      assertTrue(sameInput(networkRow(history, epoch, frame, remote), NEUTRAL));
    }
    // Confirmation keeps the accepted edge and converges with a fresh run.
    for (let frame = 2; frame <= 10; frame++) {
      deliver(schedule, localPlayer, epoch, frame, assertDefined(schedule.pending(epoch, frame)));
      if (frame !== 3) deliver(schedule, remote, epoch, frame, frame === 2 ? predicted : NEUTRAL);
    }
    assertEquals(playback.reconcile(schedule, epoch, localPlayer, world.live, history), "unchanged");
    confirmAll(schedule, playback, epoch, confirmed.live, confirmedHistory);
    sameTapes(confirmed, world);
    for (let frame = 1; frame <= 10; frame++) {
      assertFalse(history.isSpeculative(epoch, frame));
      assertTrue(history.replay(epoch, frame, 10, world.live));
      sameTapes(confirmed, world);
    }
  }
});

test("a late jump correction re-adapts a later attack against the air state", () => {
  const epoch = 920;
  const schedule = new ShadowInputSchedule();
  const playback = new ShadowInputPlayback();
  const speculativeHistory = new ReplayHistory();
  const confirmedHistory = new ReplayHistory();
  const speculative = shadowWorld();
  const confirmed = shadowWorld();
  assertTrue(schedule.beginEpoch(epoch, 2, DEFAULT_ROLLBACK_WINDOW, 3));
  assertTrue(playback.beginEpoch(epoch));
  assertEquals(playback.epoch(), epoch);
  assertTrue(speculativeHistory.beginEpoch(epoch, 1, DEFAULT_ROLLBACK_WINDOW));
  assertTrue(confirmedHistory.beginEpoch(epoch, 1));
  deliver(schedule, 0, epoch, 7, NEUTRAL);
  deliver(schedule, 1, epoch, 7, ATTACK);
  for (let frame = 1; frame <= 7; frame++) {
    assertEquals(schedule.captureLocal(epoch, NEUTRAL), Capture.captured);
    assertEquals(schedule.speculativeFrame(), frame);
    assertEquals(speculative.live.runtime.simulationFrame, frame - 1);
    assertTrue(playback.advanceSpeculative(schedule, epoch, 0, speculative.live, speculativeHistory));
    confirmAll(schedule, playback, epoch, confirmed.live, confirmedHistory);
  }
  const second = fighterAt(speculative.live.world, 1);
  assertEquals(second.attack.style, AttackStyle.jab);
  assertTrue(second.motion.grounded);
  for (let frame = 3; frame <= 6; frame++) {
    deliver(schedule, 1, epoch, frame, frame === 3 ? JUMP : NEUTRAL);
    deliver(schedule, 0, epoch, frame, NEUTRAL);
  }
  assertEquals(schedule.knownThrough(), 7);
  assertEquals(playback.reconcile(schedule, epoch, 0, speculative.live, speculativeHistory), 3);
  assertFalse(second.motion.grounded);
  assertEquals(second.attack.style, AttackStyle.neutralAir);
  confirmAll(schedule, playback, epoch, confirmed.live, confirmedHistory);
  sameTapes(confirmed, speculative);
  assertEquals(playback.reconcile(schedule, epoch, 0, speculative.live, speculativeHistory), "unchanged");
});

test("a matching late prediction confirms without replaying", () => {
  const epoch = 921;
  const schedule = new ShadowInputSchedule();
  const playback = new ShadowInputPlayback();
  const history = new ReplayHistory();
  const { live } = shadowWorld();
  assertTrue(schedule.beginEpoch(epoch, 2, DEFAULT_ROLLBACK_WINDOW, 3));
  assertTrue(playback.beginEpoch(epoch));
  assertTrue(history.beginEpoch(epoch, 1, DEFAULT_ROLLBACK_WINDOW));
  for (let frame = 1; frame <= 8; frame++) {
    assertEquals(schedule.captureLocal(epoch, NEUTRAL), Capture.captured);
    assertTrue(playback.advanceSpeculative(schedule, epoch, 0, live, history));
  }
  assertEquals(live.runtime.simulationFrame, 8);
  deliver(schedule, 0, epoch, 3, NEUTRAL);
  deliver(schedule, 1, epoch, 3, NEUTRAL);
  assertEquals(schedule.knownThrough(), 3);
  assertEquals(playback.reconcile(schedule, epoch, 0, live, history), "unchanged");
  assertEquals(live.runtime.simulationFrame, 8);
  assertEquals(schedule.captureLocal(epoch, NEUTRAL), Capture.captured);
  assertTrue(playback.advanceSpeculative(schedule, epoch, 0, live, history));
  assertEquals(live.runtime.simulationFrame, 9);
});

test("twelve late rows replay at full depth and rebuild every snapshot", () => {
  const epoch = 922;
  const schedule = new ShadowInputSchedule();
  const playback = new ShadowInputPlayback();
  const speculativeHistory = new ReplayHistory();
  const confirmedHistory = new ReplayHistory();
  const speculative = shadowWorld();
  const confirmed = shadowWorld();
  assertTrue(schedule.beginEpoch(epoch, 3, 12, 3));
  assertTrue(playback.beginEpoch(epoch));
  assertTrue(speculativeHistory.beginEpoch(epoch, 1, schedule.rollbackFrames()));
  assertTrue(confirmedHistory.beginEpoch(epoch, 1));
  for (let frame = 1; frame <= 15; frame++) {
    assertEquals(schedule.captureLocal(epoch, NEUTRAL), Capture.captured);
    assertTrue(playback.advanceSpeculative(schedule, epoch, 0, speculative.live, speculativeHistory));
  }
  assertFalse(schedule.mayAdvanceSpeculative());
  assertEquals(speculative.live.runtime.simulationFrame, 15);
  for (let frame = 4; frame <= 15; frame++) {
    deliver(schedule, 0, epoch, frame, NEUTRAL);
    deliver(schedule, 1, epoch, frame, frame === 4 ? JUMP : frame === 5 ? ATTACK : NEUTRAL);
  }
  assertEquals(schedule.knownThrough(), 15);
  assertEquals(playback.reconcile(schedule, epoch, 0, speculative.live, speculativeHistory), 4);
  const second = fighterAt(speculative.live.world, 1);
  assertFalse(second.motion.grounded);
  assertEquals(second.attack.style, AttackStyle.neutralAir);
  confirmAll(schedule, playback, epoch, confirmed.live, confirmedHistory);
  sameTapes(confirmed, speculative);
  for (let frame = 4; frame <= 15; frame++) {
    assertFalse(speculativeHistory.isSpeculative(epoch, frame));
    assertTrue(speculativeHistory.replay(epoch, frame, 15, speculative.live));
    sameTapes(confirmed, speculative);
  }
  assertEquals(playback.reconcile(schedule, epoch, 0, speculative.live, speculativeHistory), "unchanged");
  assertTrue(schedule.mayAdvanceSpeculative());
});

test("twenty-four late rows re-predict and rebuild every snapshot", () => {
  const epoch = 940;
  const schedule = new ShadowInputSchedule();
  const playback = new ShadowInputPlayback();
  const history = new ReplayHistory();
  const confirmedHistory = new ReplayHistory();
  const world = shadowWorld();
  const confirmed = shadowWorld();
  const { live } = world;
  assertTrue(schedule.beginEpoch(epoch, 0, 24, 3));
  assertTrue(playback.beginEpoch(epoch));
  assertTrue(history.beginEpoch(epoch, 1, 24));
  assertTrue(confirmedHistory.beginEpoch(epoch, 1));
  for (let frame = 1; frame <= 24; frame++) {
    assertEquals(schedule.captureLocal(epoch, NEUTRAL), Capture.captured);
    assertTrue(playback.advanceSpeculative(schedule, epoch, 0, live, history));
  }
  assertFalse(schedule.mayAdvanceSpeculative());
  assertFalse(playback.advanceSpeculative(schedule, epoch, 0, live, history));
  assertEquals(live.runtime.simulationFrame, 24);
  deliver(schedule, 0, epoch, 1, NEUTRAL);
  deliver(schedule, 1, epoch, 1, SHIELD);
  assertEquals(playback.reconcile(schedule, epoch, 0, live, history), 1);
  const second = fighterAt(live.world, 1);
  assertTrue(second.shield.raised);
  const predicted = emptyInput();
  predictInto(predicted, SHIELD);
  for (let frame = 1; frame <= 24; frame++) {
    assertEquals(history.isSpeculative(epoch, frame), frame > 1);
    assertTrue(sameInput(networkRow(history, epoch, frame, 0), NEUTRAL));
    assertTrue(sameInput(networkRow(history, epoch, frame, 1), frame === 1 ? SHIELD : predicted));
  }
  for (let frame = 2; frame <= 24; frame++) {
    deliver(schedule, 0, epoch, frame, NEUTRAL);
    deliver(schedule, 1, epoch, frame, NEUTRAL);
  }
  assertEquals(schedule.knownThrough(), 24);
  assertEquals(playback.reconcile(schedule, epoch, 0, live, history), 2);
  assertFalse(second.shield.raised);
  confirmAll(schedule, playback, epoch, confirmed.live, confirmedHistory);
  sameTapes(confirmed, world);
  for (let frame = 1; frame <= 24; frame++) {
    assertFalse(history.isSpeculative(epoch, frame));
    assertTrue(history.replay(epoch, frame, 24, live));
    sameTapes(confirmed, world);
  }
  assertEquals(schedule.captureLocal(epoch, NEUTRAL), Capture.captured);
  assertTrue(playback.advanceSpeculative(schedule, epoch, 0, live, history));
  assertEquals(live.runtime.simulationFrame, 25);
});

/** A started lobby match with a fighter in every slot the match fields, and storage to capture it into. */
function lobbyState(game: ReturnType<typeof createMatchState>): ReplayState {
  const world = createRoster(fighterMask(game));
  for (const slot of PARTICIPANT_SLOTS) {
    if (fighterActive(game, slot)) world.fighters[slot] = createFighter(SLOT_CHARACTERS[slot], matchSpawnX(slot), slot === 0 || slot === 2 ? 1 : -1);
  }
  return { world, match: game, controls: createFrameControls(), runtime: createReplayRuntimeState() };
}

function capture(state: ReplayState): ReplayState {
  const snapshot = createReplaySnapshot();
  copyReplayState(snapshot, state);
  return snapshot;
}

test("lobby computers replay from corrected humans without network senders", () => {
  // One human with three computers, and sparse two-human, one-computer occupancy.
  for (const variant of [0, 1]) {
    const humans = variant === 0 ? 8 : 9;
    const computers = variant === 0 ? 7 : 4;
    const epoch = 970 + variant;
    const schedule = new ShadowInputSchedule();
    const playback = new ShadowInputPlayback();
    const history = new ReplayHistory();
    const confirmedHistory = new ReplayHistory();
    const game = createMatchState();
    setParticipants(game, humans, computers);
    game.phase = Phase.match;
    game.timeLimitMinutes = 0;
    const confirmedGame = createMatchState();
    copyMatchState(confirmedGame, game);
    const live = lobbyState(game);
    const confirmed = lobbyState(confirmedGame);
    assertTrue(schedule.beginEpoch(epoch, 0, 24, humans));
    assertTrue(playback.beginEpoch(epoch));
    assertTrue(history.beginEpoch(epoch, 1, 24));
    assertTrue(confirmedHistory.beginEpoch(epoch, 1));
    for (let frame = 1; frame <= 8; frame++) {
      assertEquals(schedule.captureLocal(epoch, NEUTRAL), Capture.captured);
      assertTrue(playback.advanceSpeculative(schedule, epoch, 3, live, history));
    }
    // Neither computers nor empty slots submit a packet.
    for (let frame = 1; frame <= 8; frame++) {
      for (const slot of PARTICIPANT_SLOTS) if (humanActive(game, slot)) deliver(schedule, slot, epoch, frame, slot === 0 ? WALK_RIGHT : NEUTRAL);
    }
    assertEquals(schedule.knownThrough(), 8);
    assertEquals(playback.reconcile(schedule, epoch, 3, live, history), variant === 0 ? "unchanged" : 1);
    confirmAll(schedule, playback, epoch, confirmed, confirmedHistory);
    const expected = capture(confirmed);
    assertEquals(firstStateDifference(capture(live), expected), undefined);
    const computer = fighterAt(live.world, 2);
    assertTrue(computer.motion.x !== matchSpawnX(2) || computer.attack.serial > 0);
    assertTrue(history.replay(epoch, 1, 8, live));
    assertEquals(firstStateDifference(capture(live), expected), undefined);
  }
});

function slotModeJournalOutcome(variant: number, heldInactiveInput: boolean): string {
  const humans = variant < 2 ? 9 : 1;
  const epoch = 990 + variant;
  const schedule = new ShadowInputSchedule();
  const playback = new ShadowInputPlayback();
  const history = new ReplayHistory();
  const confirmedHistory = new ReplayHistory();
  const game = createMatchState();
  setParticipants(game, humans, 6);
  assertTrue(cycleSlotMode(game, 0, 0));
  if (variant === 1 || variant === 3) assertTrue(cycleSlotMode(game, 0, 0));
  if (variant < 2) selectCharacter(game, 3, 0);
  assertTrue(requestStageSelect(game, 0));
  assertTrue(requestStart(game, 0));
  game.timeLimitMinutes = 0;
  const confirmedGame = createMatchState();
  copyMatchState(confirmedGame, game);
  const live = lobbyState(game);
  const confirmed = lobbyState(confirmedGame);
  const buttons = maskOf(Action.moveRight, Action.attack, Action.leftTrigger);
  const sample = heldInactiveInput ? row({ held: buttons, pressed: buttons, axisX: 127, triggerLeft: 255 }) : NEUTRAL;
  assertTrue(schedule.beginEpoch(epoch, 0, 24, humans));
  assertTrue(playback.beginEpoch(epoch));
  assertTrue(history.beginEpoch(epoch, 1, 24));
  assertTrue(confirmedHistory.beginEpoch(epoch, 1));
  for (let frame = 1; frame <= 8; frame++) {
    assertEquals(schedule.captureLocal(epoch, sample), Capture.captured);
    assertTrue(playback.advanceSpeculative(schedule, epoch, 0, live, history));
  }
  for (let frame = 1; frame <= 8; frame++) {
    deliver(schedule, 0, epoch, frame, sample);
    if (variant < 2) deliver(schedule, 3, epoch, frame, WALK_RIGHT);
  }
  assertEquals(schedule.knownThrough(), 8);
  assertEquals(playback.reconcile(schedule, epoch, 0, live, history), variant < 2 ? 1 : "unchanged");
  const recorded = createMatchFrameInput();
  const copied = emptyInput();
  assertTrue(history.copyInputRow(epoch, 1, recorded));
  assertTrue(copyNetworkRow(recorded, 0, copied));
  assertTrue(sameInput(copied, sample));
  assertFalse(copyNetworkRow(recorded, 1, copied));
  confirmAll(schedule, playback, epoch, confirmed, confirmedHistory);
  const expected = capture(confirmed);
  assertEquals(firstStateDifference(capture(live), expected), undefined);
  assertTrue(history.replay(epoch, 1, 8, live));
  const actual = capture(live);
  assertEquals(firstStateDifference(actual, expected), undefined);
  assertEquals(game.humanMask, humans);
  assertFalse(humanFighterActive(game, 0));
  assertEquals(computerActive(game, 0), variant === 0 || variant === 2);
  return stateChecksum(actual);
}

test("computer and empty slot owners still confirm and replay without phantom senders", () => {
  for (let variant = 0; variant <= 3; variant++) assertEquals(slotModeJournalOutcome(variant, true), slotModeJournalOutcome(variant, false));
});
