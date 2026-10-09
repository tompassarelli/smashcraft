import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Capture } from "../netcode/capture";
import { FixedInputSchedule } from "../netcode/fixedSchedule";
import { Action, bit, has, maskOf } from "./actions";
import { type InputRow, emptyInput, inputRow, sameInput } from "./inputRow";
import { type KeyboardCapture, captureKeys, keyboardCapture, resetKeys, sampleKeys } from "./keyboardCapture";
import { participantInputs } from "./participants";


const row = (capture: KeyboardCapture): InputRow => assertDefined(inputRow({ ...capture.row }), "valid row");

function sampled(...masks: number[]): KeyboardCapture {
  const capture = keyboardCapture();
  for (const mask of masks) assertTrue(sampleKeys(capture, mask));
  return capture;
}

test("a tap between samples keeps both edges until a schedule takes the row [spec docs/netcode-proposal.md]", () => {
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

test("a tap while the schedule waits goes to the next target and never rewrites an assigned row [spec docs/netcode-proposal.md]", () => {
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

test("opposite directions cancel and C-stick actions never move the stick [spec docs/netcode-proposal.md]", () => {
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

test("focus loss releases held keys, and resuming from held keys invents no press or pulse [spec docs/controller-platforms.md]", () => {
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
