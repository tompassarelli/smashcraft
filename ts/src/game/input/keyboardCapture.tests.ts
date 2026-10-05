import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "../../runtime/testing";
import { Capture } from "../netcode/capture";
import { FixedInputSchedule } from "../netcode/fixedSchedule";
import { Action, bit, has, maskOf } from "./actions";
import { type InputRow, copyInput, emptyInput, inputRow, sameInput } from "./inputRow";
import { type KeyboardCapture, captureKeys, keyboardCapture, resetKeys, sampleKeys } from "./keyboardCapture";
import { participantInputs } from "./participants";

/** The capture's row, which must always be one a controller can send. */
const row = (capture: KeyboardCapture): InputRow => assertDefined(inputRow({ ...capture.row }), "valid row");

function sampled(...masks: number[]): KeyboardCapture {
  const capture = keyboardCapture();
  for (const mask of masks) assertTrue(sampleKeys(capture, mask));
  return capture;
}

test("a tap between samples keeps both edges until a schedule takes the row", () => {
  const schedule = new FixedInputSchedule();
  assertTrue(schedule.beginEpoch(1, 3, 3));
  const capture = sampled(bit(Action.jump), bit(Action.jump), 0);
  assertEquals(row(capture).held, 0);
  assertEquals(row(capture).pressed, bit(Action.jump));
  assertEquals(row(capture).released, bit(Action.jump));
  assertEquals(captureKeys(capture, schedule, 1), Capture.captured);
  const assigned = assertDefined(schedule.pending(1, 4));
  assertTrue(has(assigned.pressed, Action.jump) && has(assigned.released, Action.jump));
  assertEquals(row(capture).pressed, 0);
  assertEquals(row(capture).released, 0);
});

test("a tap while the schedule waits goes to the next target and never rewrites an assigned row", () => {
  const schedule = new FixedInputSchedule();
  const inputs = participantInputs();
  assertTrue(schedule.beginEpoch(1, 3, 3));
  const capture = keyboardCapture();
  assertEquals(captureKeys(capture, schedule, 1), Capture.captured);
  assertTrue(sampleKeys(capture, bit(Action.attack)));
  assertTrue(sampleKeys(capture, 0));
  for (let service = 0; service < 20; service++) assertEquals(captureKeys(capture, schedule, 1), Capture.alreadyCaptured);
  assertEquals(assertDefined(schedule.pending(1, 4)).pressed, 0);
  assertEquals(schedule.knownThrough(), 3);
  assertTrue(schedule.readNext(1, inputs));
  assertTrue(schedule.complete(1, 1));
  assertEquals(captureKeys(capture, schedule, 1), Capture.captured);
  const next = assertDefined(schedule.pending(1, 5));
  assertTrue(has(next.pressed, Action.attack) && has(next.released, Action.attack));
  assertEquals(next.held, 0);
});

test("opposite directions cancel and C-stick actions never move the stick", () => {
  const capture = sampled(maskOf(Action.moveLeft, Action.moveRight, Action.moveDown, Action.moveUp));
  assertEquals(row(capture).axisX, 0);
  assertEquals(row(capture).axisZ, 0);
  assertTrue(sampleKeys(capture, maskOf(Action.smashDown, Action.leftTrigger)));
  assertEquals(row(capture).axisX, 0);
  assertEquals(row(capture).axisZ, 0);
  assertTrue(has(row(capture).pressed, Action.smashDown));
  assertEquals(row(capture).triggerLeft, 255);
  assertEquals(row(capture).triggerRight, 0);
  assertTrue(sampleKeys(capture, maskOf(Action.moveRight, Action.moveDown)));
  assertEquals(row(capture).axisX, 127);
  assertEquals(row(capture).axisZ, -127);
});

test("rejected masks and a refused capture leave a pending tap untouched", () => {
  const capture = sampled(bit(Action.special), 0);
  const before = emptyInput();
  copyInput(before, row(capture));
  for (const mask of [-1, 32768]) {
    assertFalse(sampleKeys(capture, mask));
    assertFalse(resetKeys(capture, mask));
  }
  assertEquals(captureKeys(capture, new FixedInputSchedule(), 1), Capture.wrongEpoch);
  assertTrue(sameInput(row(capture), before));
});

test("focus loss releases held keys, and resuming from held keys invents no press or pulse", () => {
  const schedule = new FixedInputSchedule();
  assertTrue(schedule.beginEpoch(1, 3, 3));
  const capture = sampled(bit(Action.attack));
  assertEquals(captureKeys(capture, schedule, 1), Capture.captured);
  assertTrue(sampleKeys(capture, bit(Action.attack)));
  assertEquals(row(capture).pressed, 0);
  assertTrue(sampleKeys(capture, 0));
  assertTrue(has(row(capture).released, Action.attack));
  assertFalse(has(row(capture).held, Action.attack));
  assertTrue(sampleKeys(capture, bit(Action.jump)));
  assertTrue(resetKeys(capture, bit(Action.jump)));
  assertTrue(sampleKeys(capture, bit(Action.jump)));
  assertEquals(row(capture).held, bit(Action.jump));
  assertEquals(row(capture).pressed, 0);
  assertEquals(row(capture).released, 0);
  assertTrue(sampleKeys(capture, 0));
  assertTrue(sampleKeys(capture, bit(Action.jump)));
  assertTrue(has(row(capture).pressed, Action.jump) && has(row(capture).released, Action.jump));
  assertTrue(resetKeys(capture, 0));
  assertTrue(sameInput(row(capture), emptyInput()));
  assertTrue(resetKeys(capture, maskOf(Action.moveLeft, Action.moveUp)));
  assertEquals(row(capture).axisX, -127);
  assertEquals(row(capture).axisZ, 127);
  assertFalse(row(capture).sdi);
  assertEquals(row(capture).pressed, 0);
});

test("the first Special keeps its direction and the latest shield press sets the dodge, across releases", () => {
  const capture = sampled(maskOf(Action.moveDown, Action.special, Action.leftTrigger), maskOf(Action.moveUp, Action.rightTrigger));
  assertEquals(row(capture).axisZ, 127);
  assertTrue(has(row(capture).pressed, Action.special));
  assertEquals(row(capture).specialZ, -1);
  assertEquals(row(capture).dodgeX, 0);
  assertEquals(row(capture).dodgeZ, 1);
  assertTrue(has(row(capture).released, Action.special) && has(row(capture).released, Action.moveDown));
  // A later Special in the same uncaptured row does not replace the first direction.
  assertTrue(sampleKeys(capture, maskOf(Action.moveUp, Action.rightTrigger, Action.special)));
  assertEquals(row(capture).specialZ, -1);
  assertEquals(captureKeys(capture, new FixedInputSchedule(), 1), Capture.wrongEpoch);
  assertEquals(row(capture).specialZ, -1);
});

test("smash DI keeps the latest entered direction, and the latest up or down press sets the ledge direction", () => {
  const capture = sampled(bit(Action.moveRight), maskOf(Action.moveRight, Action.moveDown));
  assertEquals(row(capture).ledgeVertical, -1);
  assertTrue(row(capture).sdi);
  assertEquals(row(capture).sdiX, 1);
  assertEquals(row(capture).sdiZ, -1);
  assertTrue(sampleKeys(capture, maskOf(Action.moveRight, Action.moveDown, Action.moveUp)));
  assertEquals(row(capture).ledgeVertical, 1);
  assertEquals(row(capture).sdiX, 1);
  assertEquals(row(capture).sdiZ, -1);
  assertTrue(sampleKeys(capture, bit(Action.moveLeft)));
  assertEquals(row(capture).ledgeVertical, 1);
  assertEquals(row(capture).sdiX, -1);
  assertEquals(row(capture).sdiZ, 0);
  // Up and down pressed in one sample cancel.
  assertEquals(row(sampled(maskOf(Action.moveUp, Action.moveDown))).ledgeVertical, 0);
});

test("repeated throw-direction taps keep their signed sum", () => {
  const capture = sampled(bit(Action.moveLeft), 0, bit(Action.moveLeft), 0, bit(Action.moveRight));
  assertEquals(row(capture).axisX, 127);
  assertTrue(has(row(capture).pressed, Action.moveLeft) && has(row(capture).pressed, Action.moveRight));
  assertEquals(row(capture).throwX, -1);
});
