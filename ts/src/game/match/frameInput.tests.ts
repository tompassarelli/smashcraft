import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "../../runtime/testing";
import { Action, maskOf } from "../input/actions";
import { queueAttack } from "../input/attackBuffer";
import { type InputRow, emptyInput, inputRow, sameInput } from "../input/inputRow";
import { participantInputs } from "../input/participants";
import { firstFighterPoseDifference } from "../presentation/fighterPose";
import { firstImpactDifference } from "../presentation/impactState";
import { firstFighterDifference } from "../replay/difference";
import { captureReplaySnapshot, createReplaySnapshot, restoreReplaySnapshot } from "../replay/snapshot";
import { analogShieldStrength } from "../sim/shield";
import { Character } from "../sim/codes";
import { fighterAt, neutralControls } from "../sim/roster";
import { createFrameControls } from "./controls";
import {
  captureFrame, captureNetworkFrame, copyExecutedInput, copyMatchFrameInput, copyNetworkRow, createMatchFrameInput,
  executeMatchFrame, hasNetworkRows, networkRowsMatch, replaceNetworkRows, resetMatchFrameInput, sameMatchFrameInput,
} from "./frameInput";
import { createReplayRuntimeState } from "./runtime";
import { type TestMatch, executeNext, testMatch } from "./testMatch";

function row(fields: Parameters<typeof inputRow>[0]): InputRow {
  return assertDefined(inputRow(fields), "input row");
}

/** Both matches' world, poses and impacts agree. */
function assertSameMatch(expected: TestMatch, actual: TestMatch): void {
  for (const slot of [0, 1] as const) {
    assertEquals(firstFighterDifference(fighterAt(expected.world, slot), fighterAt(actual.world, slot), 3, 3), undefined);
    assertEquals(firstFighterPoseDifference(expected.runtime.poses[slot], actual.runtime.poses[slot], expected.world, actual.world), undefined);
  }
  assertEquals(firstImpactDifference(expected.runtime.impacts, actual.runtime.impacts), undefined);
}

test("a row captures a frame once, for a valid participant mask, until it is reset", () => {
  const frame = createMatchFrameInput();
  const controls = createFrameControls();
  const runtime = createReplayRuntimeState();
  assertFalse(captureFrame(frame, -1, 3, controls, runtime));
  assertFalse(captureFrame(frame, 1, 0, controls, runtime));
  assertFalse(captureFrame(frame, 1, 16, controls, runtime));
  assertTrue(captureFrame(frame, 1, 3, controls, runtime));
  assertFalse(captureFrame(frame, 1, 3, controls, runtime));
  resetMatchFrameInput(frame);
  assertTrue(captureFrame(frame, 1, 3, controls, runtime));
});

test("a captured row is detached from the controls that produced it", () => {
  const recorded = testMatch(3, Character.archer);
  const expected = testMatch(3, Character.archer);
  const producer = recorded.inputs;
  queueAttack(producer.commands[0], { style: 0, facing: 0, frame: 1, mayCharge: false });
  producer.inputs[1].shield = true;
  assertTrue(captureFrame(recorded.row, 1, 3, producer, recorded.runtime));
  // Mutating producer storage after capture changes neither the row nor its execution.
  producer.inputs[0].shield = true;
  producer.inputs[1].shield = false;
  producer.commands[0].pending = undefined;
  assertFalse(captureFrame(recorded.row, 1, 3, producer, recorded.runtime));
  queueAttack(expected.inputs.commands[0], { style: 0, facing: 0, frame: 1, mayCharge: false });
  expected.inputs.inputs[1].shield = true;
  executeNext(expected);
  assertTrue(executeMatchFrame(recorded.row, recorded.game, recorded.world, recorded.inputs, recorded.runtime, 1));
  assertEquals(fighterAt(recorded.world, 0).attack.serial, 1);
  assertTrue(fighterAt(recorded.world, 1).shield.raised);
  assertSameMatch(expected, recorded);
});

test("rows differ by analog shield strength and match when recaptured alike", () => {
  const runtime = createReplayRuntimeState();
  const controls = createFrameControls();
  const before = createMatchFrameInput();
  const after = createMatchFrameInput();
  controls.inputs[0].shield = true;
  controls.inputs[0].shieldStrength = analogShieldStrength(128);
  assertTrue(captureFrame(before, 1, 3, controls, runtime));
  controls.inputs[0].shieldStrength = 1.0;
  assertTrue(captureFrame(after, 1, 3, controls, runtime));
  assertFalse(sameMatchFrameInput(before, after));
  controls.inputs[0].shieldStrength = analogShieldStrength(128);
  resetMatchFrameInput(after);
  assertTrue(captureFrame(after, 1, 3, controls, runtime));
  assertTrue(sameMatchFrameInput(before, after));
  controls.inputs[1].specialPressed = true;
  resetMatchFrameInput(after);
  assertTrue(captureFrame(after, 1, 3, controls, runtime));
  assertFalse(sameMatchFrameInput(before, after));
});

test("a copied row executes as its source", () => {
  const original = testMatch(3, Character.rifleman);
  const copied = testMatch(3, Character.rifleman);
  const copy = createMatchFrameInput();
  for (let frame = 1; frame <= 12; frame++) {
    original.inputs.inputs[0].specialPressed = frame === 1;
    original.inputs.inputs[0].down = true;
    original.inputs.inputs[0].specialZ = -1;
    original.inputs.inputs[1].direction = frame < 6 ? -1 : 0;
    assertTrue(captureFrame(original.row, frame, 3, original.inputs, original.runtime));
    copyMatchFrameInput(copy, original.row);
    assertTrue(sameMatchFrameInput(copy, original.row));
    assertTrue(executeMatchFrame(original.row, original.game, original.world, original.inputs, original.runtime, frame));
    assertTrue(executeMatchFrame(copy, copied.game, copied.world, copied.inputs, copied.runtime, frame));
  }
  assertTrue(fighterAt(original.world, 0).freezeTrap.life > 0);
  assertSameMatch(original, copied);
});

test("network rows are copied, compared and replaced for their senders only", () => {
  const match = testMatch(3, Character.archer);
  const sender = row({ held: maskOf(Action.moveRight, Action.attack), pressed: maskOf(Action.moveRight, Action.attack), axisX: 127, triggerLeft: 255 });
  const source = participantInputs();
  Object.assign(source[0], sender);
  Object.assign(source[1], row({ held: maskOf(Action.moveLeft), pressed: maskOf(Action.moveLeft) }));
  const copied = emptyInput();
  assertTrue(captureNetworkFrame(match.row, 1, source, match.world, 1));
  assertFalse(captureNetworkFrame(match.row, 1, source, match.world, 1));
  assertTrue(hasNetworkRows(match.row));
  assertTrue(copyNetworkRow(match.row, 0, copied));
  assertTrue(sameInput(copied, sender));
  assertFalse(copyNetworkRow(match.row, 1, copied));
  assertTrue(networkRowsMatch(match.row, source));
  Object.assign(source[1], emptyInput());
  assertTrue(networkRowsMatch(match.row, source));
  Object.assign(source[0], row({ held: maskOf(Action.moveLeft), pressed: maskOf(Action.moveLeft) }));
  assertFalse(networkRowsMatch(match.row, source));
  assertTrue(replaceNetworkRows(match.row, source));
  assertTrue(networkRowsMatch(match.row, source));
  assertTrue(copyNetworkRow(match.row, 0, copied));
  assertTrue(sameInput(copied, source[0]));
  const adapted = createMatchFrameInput();
  assertTrue(captureFrame(adapted, 1, 3, match.inputs, match.runtime));
  assertFalse(hasNetworkRows(adapted));
  assertFalse(copyNetworkRow(adapted, 0, copied));
  assertFalse(networkRowsMatch(adapted, source));
  assertFalse(replaceNetworkRows(adapted, source));
});

test("a network row adapts again from the world it replays into", () => {
  const match = testMatch(3, Character.archer);
  const source = participantInputs();
  Object.assign(source[0], row({ held: maskOf(Action.moveRight), pressed: maskOf(Action.moveRight), axisX: 127 }));
  Object.assign(source[1], row({ held: maskOf(Action.leftTrigger), pressed: maskOf(Action.leftTrigger), triggerLeft: 255 }));
  const before = createReplaySnapshot();
  const after = createReplaySnapshot();
  captureReplaySnapshot(before, match.world, match.game, match.inputs, match.runtime);
  assertTrue(captureNetworkFrame(match.row, 1, source, match.world, 3));
  assertTrue(executeMatchFrame(match.row, match.game, match.world, match.inputs, match.runtime, 1));
  const executed = neutralControls();
  assertTrue(copyExecutedInput(match.row, 0, executed));
  assertEquals(executed.direction, 1);
  assertFalse(copyExecutedInput(match.row, 2, executed));
  assertTrue(fighterAt(match.world, 1).shield.raised);
  captureReplaySnapshot(after, match.world, match.game, match.inputs, match.runtime);
  restoreReplaySnapshot(before, match.world, match.game, match.inputs, match.runtime);
  assertTrue(executeMatchFrame(match.row, match.game, match.world, match.inputs, match.runtime, 1));
  for (const slot of [0, 1] as const) {
    assertEquals(firstFighterDifference(fighterAt(after.world, slot), fighterAt(match.world, slot), 3, 3), undefined);
    assertEquals(firstFighterPoseDifference(after.runtime.poses[slot], match.runtime.poses[slot], after.world, match.world), undefined);
  }
});

test("execution refuses a row for another frame, a skipped frame or another roster", () => {
  const match = testMatch(3, Character.archer);
  const other = testMatch(9, Character.archer);
  assertTrue(captureFrame(match.row, 2, 3, match.inputs, match.runtime));
  assertFalse(executeMatchFrame(match.row, match.game, match.world, match.inputs, match.runtime, 1));
  assertFalse(executeMatchFrame(match.row, match.game, match.world, match.inputs, match.runtime, 2));
  assertEquals(match.runtime.simulationFrame, 0);
  resetMatchFrameInput(match.row);
  assertTrue(captureFrame(match.row, 1, 3, match.inputs, match.runtime));
  assertFalse(executeMatchFrame(match.row, other.game, other.world, other.inputs, other.runtime, 1));
  assertEquals(other.runtime.simulationFrame, 0);
  assertTrue(executeMatchFrame(match.row, match.game, match.world, match.inputs, match.runtime, 1));
  assertEquals(match.runtime.simulationFrame, 1);
  assertFalse(executeMatchFrame(match.row, match.game, match.world, match.inputs, match.runtime, 1));
});
