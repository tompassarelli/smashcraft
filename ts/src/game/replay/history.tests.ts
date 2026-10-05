import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { type AttackBuffer, attackBuffer, clearAttackBuffer, queueAttack } from "../input/attackBuffer";
import type { FrameControls } from "../match/controls";
import { type MatchFrameInput, captureFrame, copyMatchFrameInput, createMatchFrameInput, resetMatchFrameInput, sameMatchFrameInput } from "../match/frameInput";
import { createPacingAndPresentation } from "../match/pacingAndPresentation";
import { type Controls, fighterAt, neutralControls } from "../sim/roster";
import { firstStateDifference } from "./difference";
import { ReplayCorrections, ReplayHistory } from "./history";
import { REPLAY_HISTORY_CAPACITY, REPLAY_MAX_CORRECTION_FRAMES } from "./limits";
import { copyReplayState, createReplaySnapshot } from "./snapshot";
import { type TapeWorld, captureTape, createTapeWorld, executeTapeRow, runRecordedTape } from "./tapeWorld";

function frameControls(first: Controls, second: Controls, firstCommands: AttackBuffer, secondCommands: AttackBuffer): FrameControls {
  return { inputs: [first, second, neutralControls(), neutralControls()], commands: [firstCommands, secondCommands, attackBuffer(0), attackBuffer(0)] };
}

function execute(tape: TapeWorld, row: MatchFrameInput): void {
  assertTrue(executeTapeRow(tape, row));
}

/** The first difference between two tapes' live states. */
function tapeDifference(expected: TapeWorld, actual: TapeWorld): string | undefined {
  return firstStateDifference(captureTape(expected), captureTape(actual));
}

test("the history ring wraps by epoch and refuses invalid ranges without touching live state", () => {
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

test("the history refuses skipped frames and a frame counter that would wrap", () => {
  const tape = createTapeWorld({ stocks: 99 });
  const { live } = tape;
  const history = new ReplayHistory();
  const row = createMatchFrameInput();
  const input = neutralControls();
  const requests = attackBuffer(0);
  const controls = frameControls(input, input, requests, requests);
  assertFalse(history.beginEpoch(-1, 1));
  assertFalse(history.beginEpoch(0, 0));
  assertTrue(history.beginEpoch(0, 1));
  assertTrue(captureFrame(row, 2, 3, controls, live.runtime));
  assertFalse(history.save(0, row, live));
  assertTrue(captureFrame(row, 1, 3, controls, live.runtime));
  live.runtime.simulationFrame = 1;
  assertFalse(history.save(0, row, live));
  live.runtime.simulationFrame = 0;
  assertTrue(history.save(0, row, live));
  assertTrue(history.beginEpoch(1, 2147483646));
  live.runtime.simulationFrame = 2147483645;
  assertTrue(captureFrame(row, 2147483646, 3, controls, live.runtime));
  assertTrue(history.save(1, row, live));
  execute(tape, row);
  assertTrue(captureFrame(row, 2147483647, 3, controls, live.runtime));
  assertFalse(history.save(1, row, live));
  assertTrue(history.contains(1, 2147483646));
  assertTrue(history.restore(1, 2147483646, live));
  assertEquals(live.runtime.simulationFrame, 2147483645);
});

test("a recorded tape matches an independent run through repeated rollback", () => {
  // One complete input cycle crosses the history ring and sees every recorded
  // combat event; longer repetitions are the on-demand replay soak.
  runRecordedTape(192, 1, 99);
});

test("corrected predictions refresh snapshots across the ring wrap and a second rollback", () => {
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

test("the correction window and identical confirmations govern speculation", () => {
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

test("correction preflight rejects a whole batch without changing history or live state", () => {
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
  assertEquals(history.correct(5, corrections, live), 64);
  assertTrue(firstStateDifference(before, captureTape(tape)) !== undefined);
  // A corrected row is authoritative now; a conflicting second value fails.
  input.jumpPressed = false;
  assertTrue(captureFrame(row, 64, 3, controls, live.runtime));
  corrections.clear();
  assertTrue(corrections.add(row));
  assertEquals(history.correct(5, corrections, live), "rejected");
});

test("a correction batch copies its rows, bounds its storage and refuses conflicts", () => {
  const corrections = new ReplayCorrections();
  assertTrue(corrections.beginEpoch(1));
  const row = createMatchFrameInput();
  const copy = createMatchFrameInput();
  const input = neutralControls();
  const requests = attackBuffer(0);
  const controls = frameControls(input, input, requests, requests);
  const runtime = createPacingAndPresentation();
  assertFalse(corrections.add(row));
  for (let frame = 1; frame <= REPLAY_MAX_CORRECTION_FRAMES; frame++) {
    assertTrue(captureFrame(row, frame, 3, controls, runtime));
    assertTrue(corrections.add(row));
  }
  assertEquals(corrections.size(), REPLAY_MAX_CORRECTION_FRAMES);
  assertTrue(corrections.add(row));
  assertTrue(captureFrame(row, REPLAY_MAX_CORRECTION_FRAMES + 1, 3, controls, runtime));
  assertFalse(corrections.add(row));
  input.specialPressed = true;
  assertTrue(captureFrame(row, REPLAY_MAX_CORRECTION_FRAMES, 3, controls, runtime));
  assertFalse(corrections.add(row));
  assertTrue(corrections.copyRow(REPLAY_MAX_CORRECTION_FRAMES - 1, copy));
  assertFalse(sameMatchFrameInput(copy, row));
  input.specialPressed = false;
  resetMatchFrameInput(row);
  assertTrue(captureFrame(row, REPLAY_MAX_CORRECTION_FRAMES, 3, controls, runtime));
  assertTrue(sameMatchFrameInput(copy, row));
  assertFalse(corrections.copyRow(-1, copy));
  assertFalse(corrections.copyRow(REPLAY_MAX_CORRECTION_FRAMES, copy));
  assertTrue(sameMatchFrameInput(copy, row));
  corrections.clear();
  assertTrue(corrections.add(row));
  assertEquals(corrections.size(), 1);
});
