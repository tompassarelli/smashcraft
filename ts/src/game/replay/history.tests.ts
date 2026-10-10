import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { type AttackBuffer, attackBuffer, clearAttackBuffer, queueAttack } from "../input/attackBuffer";
import type { FrameControls } from "../match/controls";
import { type MatchFrameInput, borrowMatchFrame, captureFrame, captureNetworkFrame, copyMatchFrameInput, createMatchFrameInput, resetMatchFrameInput, restoreMatchFrame, sameMatchFrameInput } from "../match/frameInput";
import { participantInputs } from "../input/participants";
import { Action, bit } from "../input/actions";
import { type ImpactEvents } from "../presentation/impactEvents";
import { type Controls, createRoster, fighterAt, neutralControls } from "../sim/roster";
import { firstPoseDifference, firstStateDifference } from "./difference";
import { stateChecksum, stateHash } from "./canonical";
import { ReplayCorrections, ReplayHistory } from "./history";
import { REPLAY_HISTORY_CAPACITY, REPLAY_MAX_CORRECTION_FRAMES } from "./limits";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "./snapshot";
import { type TapeWorld, captureTape, createTapeWorld, executeTapeRow, runRecordedTape } from "./tapeWorld";
import { ALL_ITEMS_MASK, Character } from "../sim/codes";
import { type InputRow, copyInput, emptyInput, inputRow, predictInto } from "../input/inputRow";
import { SELECTABLE_CHARACTERS } from "../sim/heroes/registry";
import { matchSpawnX } from "../match/step";
import { scheduleMatchItems } from "../match/centreItem";
import { createFighter } from "../sim/fighter";
import { sweep } from "../../runtime/sweep";

function frameControls(first: Controls, second: Controls, firstCommands: AttackBuffer, secondCommands: AttackBuffer): FrameControls {
  return { inputs: [first, second, neutralControls(), neutralControls()], commands: [firstCommands, secondCommands, attackBuffer(0), attackBuffer(0)] };
}

function execute(tape: TapeWorld, row: MatchFrameInput): void {
  assertTrue(executeTapeRow(tape, row));
}

/**
 * How a confirmed state differs from the straight run's. The #168 sync tests
 * compare the per-frame full-state hash, as clients would (#400), and name
 * the first differing field only when the hashes disagree.
 */
function syncDifference(expected: Readonly<ReplayState>, actual: Readonly<ReplayState>): string | undefined {
  if (stateHash(expected) === stateHash(actual)) return undefined;
  return firstStateDifference(expected, actual) ?? "full-state hash";
}

/** The first difference between two tapes' live states. */
function tapeDifference(expected: TapeWorld, actual: TapeWorld): string | undefined {
  return firstStateDifference(captureTape(expected), captureTape(actual));
}

test("the history ring wraps by epoch and refuses invalid ranges without touching live state [invariant]", () => {
  const tape = createTapeWorld({ stocks: 99 });
  const { live } = tape;
  const last = REPLAY_HISTORY_CAPACITY + 1;
  const history = new ReplayHistory();
  const row = createMatchFrameInput();
  const input = neutralControls();
  const requests = attackBuffer(0);
  const controls = frameControls(input, input, requests, requests);
  const before = createReplaySnapshot();
  assertTrue(history.beginEpoch(7, 1));
  for (let frame = 1; frame <= last; frame++) {
    assertTrue(captureFrame(row, frame, 3, controls, live.runtime));
    assertTrue(history.save(7, row, live));
    assertFalse(history.save(7, row, live));
    execute(tape, row);
  }
  assertFalse(history.contains(7, 1));
  assertTrue(history.contains(7, 2));
  assertTrue(history.contains(7, last));
  assertFalse(history.contains(7, last + 1));
  copyReplayState(before, live);
  assertFalse(history.restore(7, 1, live));
  assertFalse(history.restore(6, 2, live));
  assertFalse(history.restore(7, last + 1, live));
  assertFalse(history.replay(7, 2, last + 1, live));
  assertFalse(history.replay(7, 1, last, live));
  assertFalse(history.replay(7, last, last - 1, live));
  assertEquals(firstStateDifference(before, captureTape(tape)), undefined);
  assertFalse(history.beginEpoch(7, 1));
  assertFalse(history.beginEpoch(6, 1));
  assertTrue(history.contains(7, 2));
  assertTrue(history.restore(7, 2, live));
  assertEquals(live.runtime.simulationFrame, 1);
  assertTrue(history.replay(7, 2, last, live));
  assertEquals(firstStateDifference(before, captureTape(tape)), undefined);
  assertTrue(history.beginEpoch(8, 1));
  assertFalse(history.contains(7, last));
  assertFalse(history.contains(8, last));
  assertFalse(history.restore(8, 2, live));
  live.runtime.simulationFrame = 0;
  resetMatchFrameInput(row);
  assertTrue(captureFrame(row, 1, 3, controls, live.runtime));
  assertFalse(history.save(7, row, live));
  assertTrue(history.save(8, row, live));
  assertTrue(history.contains(8, 1));
});

test("a recorded tape matches an independent run through repeated rollback [invariant]", () => {
  // One complete input cycle crosses the history ring and sees every recorded
  // combat event; longer repetitions are the on-demand replay soak.
  runRecordedTape(192, 1, 99);
});

test("corrected predictions refresh snapshots across the ring wrap and a second rollback [invariant]", () => {
  const wrap = REPLAY_HISTORY_CAPACITY;
  const canonical = createTapeWorld({ stocks: 99 });
  const partiallyCorrected = createTapeWorld({ stocks: 99 });
  const predicted = createTapeWorld({ stocks: 99 });
  const canonicalHistory = new ReplayHistory();
  const history = new ReplayHistory();
  const corrections = new ReplayCorrections();
  assertTrue(corrections.beginEpoch(9));
  const row = createMatchFrameInput();
  const wrongRow = createMatchFrameInput();
  const retainedWitness = createMatchFrameInput();
  const actual = Array.from({ length: 6 }, () => createMatchFrameInput());
  const actualAt = (index: number) => {
    const value = actual[index];
    if (value === undefined) throw new Error(`no correction row ${index}`);
    return value;
  };
  const input = neutralControls();
  const neutral = neutralControls();
  const response = neutralControls();
  const requests = attackBuffer(0);
  const noRequests = attackBuffer(0);
  const recorded = frameControls(input, response, requests, noRequests);
  const wrong = frameControls(neutral, neutral, noRequests, noRequests);
  assertTrue(history.beginEpoch(9, 1, 6));
  assertTrue(canonicalHistory.beginEpoch(9, 1));
  for (let frame = 1; frame <= wrap + 4; frame++) {
    response.direction = frame >= wrap + 1 ? 1 : 0;
    input.direction = frame === wrap + 1 ? -1 : 0;
    clearAttackBuffer(requests);
    if (frame === wrap - 1) queueAttack(requests, { style: 1, facing: 1, frame, mayCharge: false });
    assertTrue(captureFrame(row, frame, 3, recorded, canonical.live.runtime));
    assertTrue(canonicalHistory.save(9, row, canonical.live));
    execute(canonical, row);
    assertTrue(captureFrame(wrongRow, frame, 3, wrong, predicted.live.runtime));
    execute(partiallyCorrected, frame === wrap + 1 ? wrongRow : row);
    const mispredicted = frame === wrap - 1 || frame === wrap + 1;
    if (frame >= wrap - 1) {
      copyMatchFrameInput(actualAt(frame - (wrap - 1)), row);
      if (frame === wrap + 2 || frame === wrap + 4) assertTrue(history.save(9, row, predicted.live));
      else assertTrue(history.saveSpeculative(9, mispredicted ? wrongRow : row, predicted.live));
    } else {
      assertTrue(history.save(9, row, predicted.live));
    }
    execute(predicted, mispredicted ? wrongRow : row);
  }
  const finalCanonical = createReplaySnapshot();
  copyReplayState(finalCanonical, canonical.live);
  assertTrue(firstStateDifference(finalCanonical, captureTape(predicted)) !== undefined);
  assertFalse(history.contains(9, 4));
  assertTrue(history.contains(9, 5));
  copyMatchFrameInput(retainedWitness, actualAt(0));
  // Arrival order differs from frame order. An identical row doesn't move the
  // rollback start; the earliest changed row does.
  assertTrue(corrections.add(actualAt(1)));
  assertTrue(corrections.add(actualAt(0)));
  assertEquals(history.correct(9, corrections, predicted.live), wrap - 1);
  assertTrue(sameMatchFrameInput(actualAt(0), retainedWitness));
  assertEquals(tapeDifference(partiallyCorrected, predicted), undefined);
  corrections.clear();
  for (let index = 5; index >= 2; index--) assertTrue(corrections.add(actualAt(index)));
  assertEquals(history.correct(9, corrections, predicted.live), wrap + 1);
  assertEquals(firstStateDifference(finalCanonical, captureTape(predicted)), undefined);
  assertEquals(fighterAt(canonical.live.world, 0).attack.serial, 1);
  assertGreaterThan(fighterAt(canonical.live.world, 1).status.damage, 0.0);
  assertTrue(firstStateDifference(finalCanonical, captureTape(partiallyCorrected)) !== undefined);
  // Every snapshot after the first mismatch restores corrected state,
  // including frames overwritten during the second correction.
  for (let frame = wrap; frame <= wrap + 4; frame++) {
    assertTrue(history.restore(9, frame, predicted.live));
    assertTrue(canonicalHistory.restore(9, frame, canonical.live));
    assertEquals(tapeDifference(canonical, predicted), undefined);
  }
  assertTrue(history.replay(9, wrap, wrap + 4, predicted.live));
  assertTrue(canonicalHistory.replay(9, wrap, wrap + 4, canonical.live));
  assertEquals(tapeDifference(canonical, predicted), undefined);
  assertEquals(history.correct(9, corrections, predicted.live), "unchanged");
  assertEquals(tapeDifference(canonical, predicted), undefined);
  assertTrue(captureFrame(row, wrap + 5, 3, wrong, predicted.live.runtime));
  assertTrue(history.saveSpeculative(9, row, predicted.live));
});

test("the correction window and identical confirmations govern speculation [spec docs/netcode-proposal.md]", () => {
  const tape = createTapeWorld({ stocks: 99 });
  const { live } = tape;
  const history = new ReplayHistory();
  const corrections = new ReplayCorrections();
  assertTrue(corrections.beginEpoch(2));
  const [first, second, third] = [createMatchFrameInput(), createMatchFrameInput(), createMatchFrameInput()];
  const input = neutralControls();
  const requests = attackBuffer(0);
  const controls = frameControls(input, input, requests, requests);
  assertTrue(captureFrame(first, 1, 3, controls, live.runtime));
  assertTrue(history.beginEpoch(1, 1));
  assertFalse(history.saveSpeculative(1, first, live));
  assertFalse(history.beginEpoch(2, 1, REPLAY_MAX_CORRECTION_FRAMES + 1));
  assertFalse(history.beginEpoch(2, 1, -1));
  assertTrue(history.beginEpoch(2, 1, 2));
  assertTrue(history.saveSpeculative(2, first, live));
  execute(tape, first);
  assertTrue(captureFrame(second, 2, 3, controls, live.runtime));
  assertTrue(history.saveSpeculative(2, second, live));
  execute(tape, second);
  assertTrue(captureFrame(third, 3, 3, controls, live.runtime));
  assertFalse(history.saveSpeculative(2, third, live));
  assertFalse(history.save(2, third, live));
  assertTrue(corrections.add(second));
  // A marker outside replay's reach proves an equal row restores and runs nothing.
  const marked = fighterAt(live.world, 0);
  marked.status.damage = 12.5;
  assertEquals(history.correct(2, corrections, live), "unchanged");
  assertEquals(marked.status.damage, 12.5);
  assertEquals(live.runtime.simulationFrame, 2);
  assertFalse(history.saveSpeculative(2, third, live));
  corrections.clear();
  assertTrue(corrections.add(first));
  assertEquals(history.correct(2, corrections, live), "unchanged");
  assertEquals(marked.status.damage, 12.5);
  assertTrue(history.saveSpeculative(2, third, live));
  execute(tape, third);
  assertTrue(history.beginEpoch(3, 1, 1));
  assertEquals(history.correct(2, corrections, live), "rejected");
  live.runtime.simulationFrame = 0;
  assertEquals(history.correct(3, corrections, live), "rejected");
  assertTrue(history.saveSpeculative(3, first, live));
  execute(tape, first);
  assertEquals(history.correct(3, corrections, live), "rejected");
  assertFalse(history.saveSpeculative(3, second, live));
  assertTrue(corrections.beginEpoch(3));
  assertTrue(corrections.add(first));
  assertEquals(history.correct(3, corrections, live), "unchanged");
  assertTrue(history.saveSpeculative(3, second, live));
});

test("correction preflight rejects a whole batch without changing history or live state [invariant]", () => {
  const tape = createTapeWorld({ stocks: 99 });
  const { live } = tape;
  const history = new ReplayHistory();
  const corrections = new ReplayCorrections();
  assertTrue(corrections.beginEpoch(5));
  const row = createMatchFrameInput();
  const changed = createMatchFrameInput();
  const input = neutralControls();
  const requests = attackBuffer(0);
  const controls = frameControls(input, input, requests, requests);
  const before = createReplaySnapshot();
  assertTrue(history.beginEpoch(5, 1, 6));
  for (let frame = 1; frame <= 66; frame++) {
    assertTrue(captureFrame(row, frame, 3, controls, live.runtime));
    assertTrue(frame >= 64 ? history.saveSpeculative(5, row, live) : history.save(5, row, live));
    execute(tape, row);
  }
  copyReplayState(before, live);
  input.jumpPressed = true;
  assertTrue(captureFrame(changed, 64, 3, controls, live.runtime));
  assertTrue(corrections.add(changed));
  assertEquals(history.correct(4, corrections, live), "rejected");
  // A future, an overwritten and an authoritative-conflict row each reject the
  // valid correction before them as part of the same batch.
  for (const badFrame of [67, 1, 63]) {
    assertTrue(captureFrame(row, badFrame, 3, controls, live.runtime));
    assertTrue(corrections.add(row));
    assertEquals(history.correct(5, corrections, live), "rejected");
    assertEquals(firstStateDifference(before, captureTape(tape)), undefined);
    assertTrue(history.replay(5, 64, 66, live));
    assertEquals(firstStateDifference(before, captureTape(tape)), undefined);
    corrections.clear();
    assertTrue(corrections.add(changed));
  }
  assertTrue(history.restore(5, 66, live));
  assertEquals(history.correct(5, corrections, live), "rejected");
  assertEquals(live.runtime.simulationFrame, 65);
  assertTrue(history.replay(5, 66, 66, live));
  assertEquals(history.correct(5, corrections, live), changed.frame);
  assertTrue(firstStateDifference(before, captureTape(tape)) !== undefined);
  // A corrected row is authoritative now; a conflicting second value fails.
  input.jumpPressed = false;
  assertTrue(captureFrame(row, 64, 3, controls, live.runtime));
  corrections.clear();
  assertTrue(corrections.add(row));
  assertEquals(history.correct(5, corrections, live), "rejected");
});

test("a confirmed frame takes history's state after it only when history ran the same row from a corrected state [invariant]", () => {
  const speculative = createTapeWorld({ stocks: 99 });
  const confirmed = createTapeWorld({ stocks: 99 });
  const restored = createTapeWorld({ stocks: 99 });
  const history = new ReplayHistory();
  assertTrue(history.beginEpoch(1, 1, REPLAY_MAX_CORRECTION_FRAMES));
  const requests = attackBuffer(0);
  const still = frameControls(neutralControls(), neutralControls(), requests, requests);
  const walking = frameControls({ ...neutralControls(), direction: 1 }, neutralControls(), requests, requests);
  const row = createMatchFrameInput();
  // Frames 1-3 authoritative; frame 4 predicted walking but confirmed still; 5-6 predicted still.
  for (let frame = 1; frame <= 6; frame++) {
    assertTrue(captureFrame(row, frame, 3, frame === 4 ? walking : still, speculative.live.runtime));
    assertTrue(frame <= 3 ? history.save(1, row, speculative.live) : history.saveSpeculative(1, row, speculative.live));
    execute(speculative, row);
  }
  const confirmedRow = createMatchFrameInput();
  const restoredRow = createMatchFrameInput();
  for (let frame = 1; frame <= 5; frame++) {
    assertTrue(captureFrame(confirmedRow, frame, 3, still, confirmed.live.runtime));
    assertTrue(captureFrame(restoredRow, frame, 3, still, restored.live.runtime));
    const after = history.stateAfter(1, frame, confirmedRow);
    execute(confirmed, confirmedRow);
    if (frame >= 4) {
      // Frame 4 ran another row; frame 5 ran from the state it left.
      assertEquals(after, undefined);
      execute(restored, restoredRow);
      continue;
    }
    if (after === undefined) throw new Error(`frame ${frame} has no state after it`);
    assertEquals(firstStateDifference(captureTape(confirmed), after), undefined);
    const { match, world, controls, runtime } = restored.live;
    assertTrue(restoreMatchFrame(restoredRow, match, world, controls, runtime, frame, after));
    assertEquals(tapeDifference(confirmed, restored), undefined);
  }
  assertEquals(history.stateAfter(1, 6, confirmedRow), undefined);
});

function assertSameFields<T>(expected: T, actual: T): void {
  for (const key in expected) assertEquals(actual[key], expected[key], key);
}

test("a borrowed confirmed snapshot stays fixed when its history slot is reused [invariant]", () => {
  const tape = createTapeWorld({ stocks: 99 });
  const history = new ReplayHistory();
  assertTrue(history.beginEpoch(1, 1));
  const requests = attackBuffer(0);
  const controls = frameControls({ ...neutralControls(), direction: 1 }, neutralControls(), requests, requests);
  const row = createMatchFrameInput();
  const first = createMatchFrameInput();
  for (let frame = 1; frame <= 2; frame++) {
    assertTrue(captureFrame(row, frame, 3, controls, tape.live.runtime));
    assertTrue(history.save(1, row, tape.live));
    execute(tape, row);
    if (frame === 1) copyMatchFrameInput(first, row);
  }
  const borrowed = history.stateAfter(1, 1, first);
  if (borrowed === undefined) throw new Error("frame 1 is available");
  const expected = createReplaySnapshot();
  copyReplayState(expected, borrowed);
  for (let frame = 3; frame <= REPLAY_HISTORY_CAPACITY + 2; frame++) {
    assertTrue(captureFrame(row, frame, 3, controls, tape.live.runtime));
    assertTrue(history.save(1, row, tape.live));
    execute(tape, row);
  }
  assertEquals(firstStateDifference(expected, borrowed), undefined);
});

test("restored and borrowed network frames preserve CPU state and every confirmed impact event [invariant]", () => {
  const predicted = createTapeWorld({ stocks: 99 });
  const restored = createTapeWorld({ stocks: 99 });
  let borrowed = createTapeWorld({ stocks: 99 }).live;
  predicted.live.match.computerMask = 2;
  restored.live.match.computerMask = 2;
  borrowed.match.computerMask = 2;
  const history = new ReplayHistory();
  assertTrue(history.beginEpoch(1, 1, REPLAY_MAX_CORRECTION_FRAMES));
  const inputs = participantInputs();
  const row = createMatchFrameInput();
  const restoredRow = createMatchFrameInput();
  const impacts: ImpactEvents[][] = [];
  let contacts = 0;
  for (let frame = 1; frame <= 180; frame++) {
    assertTrue(captureNetworkFrame(row, frame, inputs, predicted.live.world, 1));
    assertTrue(history.save(1, row, predicted.live));
    execute(predicted, row);
    impacts.push(predicted.live.runtime.frameImpacts.map(events => ({ ...events })));
    if (frame === 1) continue;
    assertTrue(captureNetworkFrame(restoredRow, frame - 1, inputs, restored.live.world, 1));
    const after = history.stateAfter(1, frame - 1, restoredRow);
    if (after === undefined) throw new Error("confirmed network frame missing");
    const { match, world, controls, runtime } = restored.live;
    assertTrue(borrowMatchFrame(restoredRow, borrowed.world, borrowed.runtime, frame - 1, after));
    borrowed = after;
    assertTrue(restoreMatchFrame(restoredRow, match, world, controls, runtime, frame - 1, after));
    assertEquals(firstStateDifference(restored.live, after), undefined);
    for (const slot of [0, 1] as const) {
      const expected = impacts[frame - 2]?.[slot];
      if (expected === undefined) throw new Error("confirmed impacts missing");
      assertSameFields(expected, runtime.frameImpacts[slot]);
      assertSameFields(expected, after.runtime.frameImpacts[slot]);
      if (expected.hit || expected.shieldHit) contacts++;
    }
  }
  assertGreaterThan(contacts, 0);
});

test("a repair that repeats unchanged computer decisions reaches the state of play without rollback [invariant]", () => {
  // The human's stick turns every 15 frames and its rows arrive 4 frames late,
  // so each turn is mispredicted; the computer fights it throughout.
  const late = 4;
  const straight = createTapeWorld({ stocks: 99 });
  const rolled = createTapeWorld({ stocks: 99 });
  straight.live.match.computerMask = 2;
  rolled.live.match.computerMask = 2;
  const history = new ReplayHistory();
  const corrections = new ReplayCorrections();
  assertTrue(history.beginEpoch(1, 1, REPLAY_MAX_CORRECTION_FRAMES));
  assertTrue(corrections.beginEpoch(1));
  const actual = participantInputs();
  const predicted = participantInputs();
  const actualAt = (frame: number) => {
    const human = actual[0];
    human.axisX = floorMod(floorDiv(frame, 15), 2) === 0 ? 100 : -100;
    human.held = floorMod(frame, 9) < 2 ? bit(Action.attack) : 0;
    human.pressed = floorMod(frame, 9) === 0 ? bit(Action.attack) : 0;
    return actual;
  };
  const row = createMatchFrameInput();
  const actualRow = createMatchFrameInput();
  const confirm = (frame: number) => {
    resetMatchFrameInput(actualRow);
    assertTrue(captureNetworkFrame(actualRow, frame, actualAt(frame), rolled.live.world, 1));
    corrections.clear();
    assertTrue(corrections.add(actualRow));
    assertTrue(history.correct(1, corrections, rolled.live) !== "rejected");
  };
  let diverged = false;
  const last = 240;
  for (let frame = 1; frame <= last; frame++) {
    resetMatchFrameInput(row);
    assertTrue(captureNetworkFrame(row, frame, actualAt(frame), straight.live.world, 1));
    execute(straight, row);
    // The prediction repeats the last row that arrived.
    const known = actualAt(Math.max(1, frame - late))[0];
    predicted[0].axisX = known.axisX;
    predicted[0].held = known.held;
    predicted[0].pressed = 0;
    resetMatchFrameInput(row);
    assertTrue(captureNetworkFrame(row, frame, predicted, rolled.live.world, 1));
    assertTrue(history.saveSpeculative(1, row, rolled.live));
    execute(rolled, row);
    if (tapeDifference(straight, rolled) !== undefined) diverged = true;
    if (frame > late) confirm(frame - late);
  }
  for (let frame = last - late + 1; frame <= last; frame++) confirm(frame);
  assertTrue(diverged);
  assertEquals(tapeDifference(straight, rolled), undefined);
  assertGreaterThan(fighterAt(straight.live.world, 0).status.damage + fighterAt(straight.live.world, 1).status.damage, 0.0);
  assertGreaterThan(history.repeatedComputerDecisions(), 0);
});

test("#206 a client that predicted past the pause frame returns to the state before it [repro #206]", () => {
  const tape = createTapeWorld({ stocks: 99 });
  const { live } = tape;
  const history = new ReplayHistory();
  const row = createMatchFrameInput();
  const input = neutralControls();
  const requests = attackBuffer(0);
  const controls = frameControls(input, input, requests, requests);
  assertTrue(history.beginEpoch(4, 1, 8));
  let beforePause: ReturnType<typeof captureTape> | undefined;
  for (let frame = 1; frame <= 6; frame++) {
    if (frame === 4) beforePause = captureTape(tape);
    assertTrue(captureFrame(row, frame, 3, controls, live.runtime));
    assertTrue(frame === 1 ? history.save(4, row, live) : history.saveSpeculative(4, row, live));
    execute(tape, row);
  }
  // Frame 1 ran on every accepted row: no pause can return before it.
  assertFalse(history.truncate(4, 1, live));
  assertTrue(history.truncate(4, 7, live));
  assertEquals(history.lastRecordedFrame(), 6);
  assertTrue(history.truncate(4, 4, live));
  assertEquals(history.lastRecordedFrame(), 3);
  assertEquals(firstStateDifference(beforePause ?? captureTape(tape), captureTape(tape)), undefined);
  assertTrue(captureFrame(row, 4, 3, controls, live.runtime));
  assertTrue(history.saveSpeculative(4, row, live));
});

/**
 * Four humans; slot 0's stick turns every 10 frames and its rows arrive 4
 * frames late, so each turn is mispredicted and repaired. Slot 1 jabs every
 * 12 frames from `jabberX`, or, as Illidan with a full meter, fires one Eye
 * Blast at frame `blastAt`. Returns the scoped steps the repairs took and
 * the first difference from the same match repaired whole, frame by frame.
 */
function scopedAgainstWhole(mode: "auto" | "force", jabberX: number, blastAt?: number): { scoped: number; difference: string | undefined } {
  const late = 4;
  const world = (): TapeWorld => {
    const tape = createTapeWorld({ stocks: 99, humans: 4 });
    const attacker = createFighter(blastAt === undefined ? Character.rifleman : Character.demonHunter, jabberX, -1);
    if (blastAt !== undefined) attacker.mana.points = 100;
    const fighters = [createFighter(Character.demonHunter, -300.0, 1), attacker, createFighter(Character.rifleman, 250.0, -1), createFighter(Character.demonHunter, 400.0, -1)];
    for (const fighter of fighters) fighter.status.stocks = 99;
    const live = { ...tape.live, world: createRoster(15, fighters) };
    for (const slot of [0, 1, 2, 3] as const) live.controls.commands[slot] = attackBuffer(4);
    return { live, snapshot: tape.snapshot };
  };
  const scoped = world();
  const whole = world();
  const histories = [new ReplayHistory(), new ReplayHistory()] as const;
  histories[0].scopedRepair = mode;
  histories[1].scopedRepair = "off";
  const corrections = new ReplayCorrections();
  for (const history of histories) assertTrue(history.beginEpoch(1, 1, REPLAY_MAX_CORRECTION_FRAMES));
  assertTrue(corrections.beginEpoch(1));
  const actual = participantInputs();
  const predicted = participantInputs();
  const actualAt = (frame: number) => {
    actual[0].axisX = floorMod(floorDiv(frame, 10), 2) === 0 ? 100 : -100;
    if (blastAt === undefined) {
      actual[1].held = floorMod(frame, 12) < 2 ? bit(Action.attack) : 0;
      actual[1].pressed = floorMod(frame, 12) === 0 ? bit(Action.attack) : 0;
    } else {
      actual[1].held = frame === blastAt ? bit(Action.rightTrigger) : 0;
      actual[1].pressed = frame === blastAt ? bit(Action.special) : 0;
    }
    return actual;
  };
  const row = createMatchFrameInput();
  let difference: string | undefined;
  const confirm = (frame: number) => {
    resetMatchFrameInput(row);
    assertTrue(captureNetworkFrame(row, frame, actualAt(frame), scoped.live.world, 15));
    corrections.clear();
    assertTrue(corrections.add(row));
    assertTrue(histories[0].correct(1, corrections, scoped.live) !== "rejected");
    assertTrue(histories[1].correct(1, corrections, whole.live) !== "rejected");
    difference ??= tapeDifference(whole, scoped);
  };
  const last = 64;
  for (let frame = 1; frame <= last; frame++) {
    // Every row but slot 0's is known; slot 0's repeats the last one that arrived.
    const now = actualAt(frame);
    for (const slot of [1, 2, 3] as const) Object.assign(predicted[slot], now[slot]);
    predicted[0].axisX = actualAt(Math.max(1, frame - late))[0].axisX;
    for (const [index, tape] of [scoped, whole].entries()) {
      resetMatchFrameInput(row);
      assertTrue(captureNetworkFrame(row, frame, predicted, tape.live.world, 15));
      assertTrue(histories[index === 0 ? 0 : 1].saveSpeculative(1, row, tape.live));
      execute(tape, row);
    }
    if (frame > late) confirm(frame - late);
  }
  for (let frame = last - late + 1; frame <= last; frame++) confirm(frame);
  assertEquals(histories[1].scopedRepairSteps(), 0);
  return { scoped: histories[0].scopedRepairSteps(), difference };
}

test("a fighter-scoped repair of a mispredicted input ends on the same state as repairing every fighter [invariant]", () => {
  // The jabber strikes the air 600 units from the corrected fighter.
  const far = scopedAgainstWhole("auto", 300.0);
  assertGreaterThan(far.scoped, 20);
  assertEquals(far.difference, undefined);
  // In range, its jabs reach the corrected fighter, so those frames repair whole.
  const near = scopedAgainstWhole("auto", -260.0);
  assertEquals(near.difference, undefined);
  // Scoping them anyway loses the hits: the comparison above catches broken eligibility.
  assertTrue(scopedAgainstWhole("force", -260.0).difference !== undefined);
  // Eye Blast's beam hits the corrected fighter from 600 away, beyond the strike reach of every other move.
  const blast = scopedAgainstWhole("auto", 300.0, 2);
  assertGreaterThan(blast.scoped, 0);
  assertEquals(blast.difference, undefined);
  assertTrue(scopedAgainstWhole("force", 300.0, 2).difference !== undefined);
});

const seededHash = (a: number, b: number): number => floorMod(floorMod(a * 7919 + b * 104729 + 12345, 2147483647) * 48271, 2147483647);

function beatRow(fields: Parameters<typeof inputRow>[0]): InputRow {
  const row = inputRow(fields);
  assertTrue(row !== undefined);
  return row ?? emptyInput();
}

/** Slot `slot`'s seeded beat: runs, taps of attack, jump, special or shield, walks and rests in 70-frame segments. */
function seededBeat(slot: number, frame: number, seed: number): InputRow {
  const right = bit(Action.moveRight) | bit(Action.smashRight);
  const left = bit(Action.moveLeft) | bit(Action.smashLeft);
  const segment = floorDiv(frame + slot * 17, 70);
  const at = floorMod(frame + slot * 17, 70);
  const pick = floorMod(seededHash(segment + seed * 1000, slot), 8);
  const hold = 4 + floorMod(seededHash(segment, slot + seed), 60);
  const bits = floorMod(segment, 2) === 0 ? right : left;
  if (pick <= 3) {
    if (at < hold) return beatRow({ held: bits, pressed: at === 0 ? bits : 0, axisX: bits === right ? 127 : -127 });
    return beatRow({ released: at === hold ? bits : 0 });
  }
  if (pick <= 5 && at === 0) {
    const tap = bit([Action.attack, Action.jump, Action.special, Action.leftTrigger][floorMod(segment, 4)] ?? Action.attack);
    return beatRow({ pressed: tap, released: tap });
  }
  if (pick === 6) return beatRow({ held: bits, pressed: at === 0 ? bits : 0, axisX: bits === right ? 60 : -60 });
  return emptyInput();
}

/**
 * Two humans and two computers with items on stage 6; slot 1's rows arrive
 * 2 to 8 frames late, in order, so the history repairs (scoping where it
 * may) as each one lands. Returns the first difference of a confirmed state
 * from the same match played straight on the actual rows.
 */
function confirmedAgainstStraight(seed: number, frames: number): string | undefined {
  const world = (): TapeWorld => {
    const tape = createTapeWorld({ stocks: 3, humans: 2 });
    const fighters = [24, 25, 0, 1].map((index, slot) => createFighter(SELECTABLE_CHARACTERS[index] ?? Character.rifleman, matchSpawnX(slot), floorMod(slot, 2) === 0 ? 1 : -1));
    for (const fighter of fighters) fighter.status.stocks = 3;
    const match = tape.live.match;
    match.stageChoice = 6;
    match.computerMask = 12;
    match.matchSeed = seed;
    match.startHold = 180;
    match.items.on = true;
    match.items.enabledMask = ALL_ITEMS_MASK;
    scheduleMatchItems(match);
    const live = { ...tape.live, world: createRoster(15, fighters) };
    for (const slot of [0, 1, 2, 3] as const) live.controls.commands[slot] = attackBuffer(4);
    return { live, snapshot: tape.snapshot };
  };
  const rolled = world();
  const straight = world();
  const history = new ReplayHistory();
  const corrections = new ReplayCorrections();
  assertTrue(history.beginEpoch(1, 1, REPLAY_MAX_CORRECTION_FRAMES));
  assertTrue(corrections.beginEpoch(1));
  const actual = participantInputs();
  const predicted = participantInputs();
  const actualAt = (frame: number) => {
    for (const slot of [0, 1] as const) copyInput(actual[slot], seededBeat(slot, frame, seed));
    return actual;
  };
  const arrival = [0];
  for (let frame = 1; frame <= frames; frame++) arrival.push(Math.max(arrival[frame - 1] ?? 0, frame + 2 + floorMod(seededHash(frame, seed), 7)));
  const row = createMatchFrameInput();
  const confirmed = createReplaySnapshot();
  let known = 0;
  let settled = 0;
  for (let frame = 1; frame <= frames; frame++) {
    copyInput(predicted[0], actualAt(frame)[0]);
    predictInto(predicted[1], known > 0 ? seededBeat(1, known, seed) : emptyInput());
    resetMatchFrameInput(row);
    assertTrue(captureNetworkFrame(row, frame, predicted, rolled.live.world, 3));
    assertTrue(history.saveSpeculative(1, row, rolled.live));
    execute(rolled, row);
    while (known < frames && (arrival[known + 1] ?? frames + 1) <= frame) {
      known++;
      resetMatchFrameInput(row);
      assertTrue(captureNetworkFrame(row, known, actualAt(known), rolled.live.world, 3));
      corrections.clear();
      assertTrue(corrections.add(row));
      assertTrue(history.amend(1, corrections, rolled.live) !== "rejected");
      assertTrue(history.repair(1, 4, rolled.live, 4) !== "rejected");
    }
    for (; settled < known; settled++) {
      const next = settled + 1;
      const input = history.inputRow(1, next);
      const after = input === undefined ? undefined : history.stateAfter(1, next, input);
      if (after === undefined) break;
      copyReplayState(confirmed, after);
      resetMatchFrameInput(row);
      assertTrue(captureNetworkFrame(row, next, actualAt(next), straight.live.world, 3));
      execute(straight, row);
      const difference = syncDifference(captureTape(straight), confirmed);
      if (difference !== undefined) return `seed ${seed}: confirmed frame ${next} differs: ${difference}`;
    }
  }
  return undefined;
}

test("every confirmed state of a seeded match with late rows equals its straight run [invariant]", () => {
  assertEquals(confirmedAgainstStraight(76, 120), undefined);
});

// At the old 300 reach (#168), seeds 76 and 105 diverged on an earlier main and seed 107 on this one: a strike outran the scoped repair's eligibility distance.
for (const [seed, frames] of [[107, 760], [76, 1500], [105, 1500]] as const) {
  sweep(`every confirmed state of seed ${seed}'s match with late rows, scoped repairs among them, equals the straight run [invariant]`, () => {
    assertEquals(confirmedAgainstStraight(seed, frames), undefined);
  });
}

/**
 * Two humans far apart; slot 0's Illidan crouches for 3 frames every 16 and
 * holds walk without a direction for 3 more. His rows arrive 4 frames late,
 * so each is mispredicted and repaired the way the shell does, a few frames
 * a callback. Walk alone changes nothing, so those repairs reach the stored
 * snapshots at once; crouching changes only his pose, which the checksum
 * leaves out. Returns the frames repairs kept and the first difference,
 * gameplay or presentation, from the same match replaying every frame.
 */
function convergedAgainstWhole(sameState?: ReplayHistory["sameState"]): { kept: number; difference: string | undefined } {
  const late = 4;
  const world = (): TapeWorld => createTapeWorld({ stocks: 99, humans: 2, first: createFighter(Character.demonHunter, -300.0, 1), second: createFighter(Character.rifleman, 300.0, -1) });
  const kept = world();
  const whole = world();
  const histories = [new ReplayHistory(), new ReplayHistory()] as const;
  if (sameState !== undefined) histories[0].sameState = sameState;
  histories[1].convergence = false;
  const corrections = new ReplayCorrections();
  for (const history of histories) assertTrue(history.beginEpoch(1, 1, REPLAY_MAX_CORRECTION_FRAMES));
  assertTrue(corrections.beginEpoch(1));
  const actual = participantInputs();
  const predicted = participantInputs();
  const actualAt = (frame: number) => {
    const beat = floorMod(frame, 16);
    actual[0].held = beat >= 4 && beat < 7 ? bit(Action.moveDown) : beat >= 10 && beat < 13 ? bit(Action.walk) : 0;
    return actual;
  };
  const row = createMatchFrameInput();
  let difference: string | undefined;
  const compare = (when: string) => {
    const expected = captureTape(whole);
    const got = captureTape(kept);
    const found = firstStateDifference(expected, got) ?? firstPoseDifference(expected, got);
    if (found !== undefined) difference ??= `${when}: ${found}`;
  };
  const tapes = [kept, whole] as const;
  const repair = () => {
    for (const index of [0, 1] as const) assertTrue(histories[index].repair(1, 3, tapes[index].live, 6) !== "rejected");
  };
  const last = 96;
  for (let frame = 1; frame <= last; frame++) {
    predicted[0].held = actualAt(Math.max(1, frame - late))[0].held;
    for (const index of [0, 1] as const) {
      resetMatchFrameInput(row);
      assertTrue(captureNetworkFrame(row, frame, predicted, tapes[index].live.world, 3));
      assertTrue(histories[index].saveSpeculative(1, row, tapes[index].live));
      execute(tapes[index], row);
    }
    if (frame > late) {
      resetMatchFrameInput(row);
      assertTrue(captureNetworkFrame(row, frame - late, actualAt(frame - late), kept.live.world, 3));
      corrections.clear();
      assertTrue(corrections.add(row));
      for (const index of [0, 1] as const) assertTrue(histories[index].amend(1, corrections, tapes[index].live) !== "rejected");
    }
    repair();
    compare(`frame ${frame}`);
  }
  for (let settle = 0; settle < 4; settle++) repair();
  compare("settled");
  // Every retained snapshot, too: later corrections start from them.
  const expected = createReplaySnapshot();
  const got = createReplaySnapshot();
  for (let frame = histories[0].firstRetainedFrame(); frame <= last; frame++) {
    assertTrue(histories[1].restore(1, frame, expected));
    assertTrue(histories[0].restore(1, frame, got));
    difference ??= firstStateDifference(expected, got) ?? firstPoseDifference(expected, got);
  }
  assertEquals(histories[1].convergedRepairFrames(), 0);
  return { kept: histories[0].convergedRepairFrames(), difference };
}

test("a repair that reaches a stored snapshot keeps the later frames and ends as replaying them all [invariant]", () => {
  const converged = convergedAgainstWhole();
  assertGreaterThan(converged.kept, 20);
  assertEquals(converged.difference, undefined);
  // A checksum leaves the crouching pose out: declaring convergence on it keeps snapshots that differ.
  const checksum = convergedAgainstWhole((stored, state) => stateChecksum(stored) === stateChecksum(state));
  assertTrue(checksum.difference !== undefined);
});

interface PausedMatch {
  readonly late: number;
  readonly frames: number;
  readonly computer: boolean;
  readonly seed: number;
  readonly stick?: (frame: number) => number;
  readonly rewind: (tick: number, pending: number | undefined, history: ReplayHistory, draw: (range: number) => number) => number | undefined;
}

function pausedAgainstStraight(match: PausedMatch): { ontoRepair: number; rewinds: number; difference: string | undefined } {
  const world = (): TapeWorld => createTapeWorld({ stocks: 99, humans: match.computer ? 1 : 2 });
  const straight = world();
  const rolled = world();
  const senders = match.computer ? 1 : 3;
  if (match.computer) {
    straight.live.match.computerMask = 2;
    rolled.live.match.computerMask = 2;
  }
  let state = match.seed;
  const draw = (range: number): number => {
    state = floorMod(state * 75 + 74, 65537);
    return floorMod(state, range);
  };
  const sticks = [-100, -60, 0, 60, 100];
  const actual = Array.from({ length: match.frames + 1 }, () => participantInputs());
  for (let frame = 1; frame <= match.frames; frame++) {
    const was = actual[frame - 1]?.[0];
    const human = actual[frame]?.[0];
    if (was === undefined || human === undefined) throw new Error(`no inputs for frame ${frame}`);
    human.axisX = match.stick?.(frame) ?? (draw(6) === 0 ? sticks[draw(5)] ?? 0 : was.axisX);
    human.pressed = match.stick === undefined && draw(9) === 0 ? bit(draw(2) === 0 ? Action.attack : Action.special) : 0;
    human.held = human.pressed;
    const other = actual[frame]?.[1];
    if (other !== undefined && !match.computer) other.axisX = floorMod(floorDiv(frame, 20), 2) === 0 ? 40 : -40;
  }
  const inputsAt = (frame: number) => {
    const inputs = actual[frame];
    if (inputs === undefined) throw new Error(`no inputs for frame ${frame}`);
    return inputs;
  };
  const history = new ReplayHistory();
  const corrections = new ReplayCorrections();
  assertTrue(history.beginEpoch(1, 1, REPLAY_MAX_CORRECTION_FRAMES));
  assertTrue(corrections.beginEpoch(1));
  const row = createMatchFrameInput();
  const predicted = participantInputs();
  let confirmed = 0;
  let ontoRepair = 0;
  let rewinds = 0;
  const deliver = (through: number) => {
    while (confirmed < through) {
      confirmed++;
      resetMatchFrameInput(row);
      assertTrue(captureNetworkFrame(row, confirmed, inputsAt(confirmed), rolled.live.world, senders));
      corrections.clear();
      assertTrue(corrections.add(row));
      assertTrue(history.amend(1, corrections, rolled.live) !== "rejected");
    }
  };
  for (let tick = 1; history.lastRecordedFrame() < match.frames; tick++) {
    const frame = history.lastRecordedFrame() + 1;
    Object.assign(predicted[1], inputsAt(frame)[1]);
    predicted[0].axisX = inputsAt(Math.max(1, confirmed))[0].axisX;
    predicted[0].held = 0;
    predicted[0].pressed = 0;
    resetMatchFrameInput(row);
    assertTrue(captureNetworkFrame(row, frame, predicted, rolled.live.world, senders));
    assertTrue(history.saveSpeculative(1, row, rolled.live));
    execute(rolled, row);
    deliver(Math.max(0, frame - match.late));
    assertTrue(history.repair(1, 2, rolled.live, 3) !== "rejected");
    const pending = history.pendingRepairFrame(1);
    const to = match.rewind(tick, pending, history, draw);
    if (to === undefined || to < history.firstCorrectableFrame() || to > history.lastRecordedFrame()) continue;
    assertTrue(history.truncate(1, to, rolled.live));
    rewinds++;
    if (to === pending) ontoRepair++;
  }
  deliver(match.frames);
  while (history.pendingRepairFrame(1) !== undefined) assertTrue(history.repair(1, 2, rolled.live, 3) !== "rejected");
  let difference: string | undefined;
  const got = createReplaySnapshot();
  for (let frame = 1; frame <= match.frames; frame++) {
    if (difference === undefined && frame >= history.firstRetainedFrame()) {
      assertTrue(history.restore(1, frame, got));
      const found = syncDifference(captureTape(straight), got);
      if (found !== undefined) difference = `snapshot ${frame}: ${found}`;
    }
    resetMatchFrameInput(row);
    assertTrue(captureNetworkFrame(row, frame, inputsAt(frame), straight.live.world, senders));
    execute(straight, row);
  }
  difference ??= tapeDifference(straight, rolled);
  return { ontoRepair, rewinds, difference };
}

test("#397 a pause rewind onto a positioned repair's frame keeps the correction to earlier frames [repro #397]", () => {
  const result = pausedAgainstStraight({
    late: 4,
    frames: 40,
    computer: false,
    seed: 1,
    stick: (frame) => (frame < 10 ? 100 : -100),
    rewind: (tick, pending) => (tick === 14 ? pending : undefined),
  });
  assertEquals(result.ontoRepair, 1);
  assertEquals(result.difference, undefined);
});

function seededPauses(seed: number): { ontoRepair: number; rewinds: number; difference: string | undefined } {
  return pausedAgainstStraight({
    late: 2 + floorMod(seed, 5),
    frames: 120,
    computer: floorMod(seed, 2) === 1,
    seed,
    rewind: (_tick, pending, history, draw) => {
      if (draw(12) !== 0) return undefined;
      if (pending !== undefined && draw(2) === 0) return pending;
      const first = history.firstCorrectableFrame();
      return first + draw(Math.max(1, history.lastRecordedFrame() - first + 1));
    },
  });
}

test("a seeded match with late inputs and pause rewinds confirms the state of the straight match [invariant]", () => {
  const result = seededPauses(3);
  assertGreaterThan(result.rewinds, 0);
  assertEquals(result.difference, undefined);
});

sweep("seeded matches with late inputs and pause rewinds confirm the state of the straight match [invariant]", () => {
  let ontoRepair = 0;
  for (let seed = 1; seed <= 32; seed++) {
    const result = seededPauses(seed);
    if (result.difference !== undefined) throw new Error(`seed ${seed}: ${result.difference}`);
    ontoRepair += result.ontoRepair;
  }
  assertGreaterThan(ontoRepair, 10);
});
