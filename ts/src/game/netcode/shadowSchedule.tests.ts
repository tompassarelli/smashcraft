import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "waygate/src/runtime/testing";
import { imod } from "waygate/src/sim/intMath";
import { Action, bit, has, maskOf } from "../input/actions";
import { type InputRow, type RowFields, copyInput, emptyInput, inputRow, predictInto, sameInput } from "../input/inputRow";
import { type ParticipantInputs, participantInputs } from "../input/participants";
import { INPUT_LAST_FRAME, inputPacket } from "../input/wire";
import { REPLAY_HISTORY_CAPACITY } from "../replay/limits";
import { Capture } from "./capture";
import { FUTURE_LIMIT } from "./ledger";
import { DEFAULT_ROLLBACK_WINDOW, PENDING_CAPACITY, ShadowInputSchedule } from "./shadowSchedule";

const row = (fields: RowFields = {}) => assertDefined(inputRow(fields), "row");
const NEUTRAL = row();
const WALK_RIGHT = row({ held: bit(Action.moveRight), axisX: 127 });

function deliver(schedule: ShadowInputSchedule, sender: number, epoch: number, frame: number, input: InputRow): void {
  assertEquals(schedule.acceptSynchronized(sender, assertDefined(inputPacket(epoch, frame, [input]))), "accepted");
}

/** Captures the sample for F + D, then runs F as local player 0. */
function advanceOne(schedule: ShadowInputSchedule, epoch: number, sample: InputRow, inputs: ParticipantInputs): void {
  const frame = schedule.speculativeFrame();
  assertEquals(schedule.captureLocal(epoch, sample), Capture.captured);
  assertTrue(schedule.resolveSpeculative(epoch, 0, inputs) !== undefined);
  assertTrue(schedule.completeSpeculative(epoch, frame));
}

test("a missing local frame waits for its own input; a later row never stands in", () => {
  const schedule = new ShadowInputSchedule();
  const inputs = participantInputs();
  assertTrue(schedule.beginEpoch(1400, 0, 6, 3));
  assertTrue(schedule.mayAdvanceSpeculative());
  assertFalse(schedule.mayAdvanceSpeculativeFor(0));
  assertEquals(schedule.resolveSpeculative(1400, 0, inputs), undefined);
  assertEquals(schedule.speculativeFrame(), 1);
  assertEquals(schedule.captureLocalAt(1400, 2, NEUTRAL), Capture.captured);
  assertFalse(schedule.mayAdvanceSpeculativeFor(0));
  assertEquals(schedule.captureLocalAt(1400, 1, NEUTRAL), Capture.captured);
  assertTrue(schedule.mayAdvanceSpeculativeFor(0));
  assertFalse(schedule.mayAdvanceSpeculativeFor(2));
  for (const frame of [1, 2]) {
    assertTrue(schedule.mayAdvanceSpeculativeFor(0));
    assertEquals(schedule.resolveSpeculative(1400, 0, inputs), "speculative");
    assertTrue(schedule.completeSpeculative(1400, frame));
  }
  assertFalse(schedule.mayAdvanceSpeculativeFor(0));
  assertEquals(schedule.speculativeFrame(), 3);
  deliver(schedule, 0, 1400, 3, NEUTRAL);
  assertTrue(schedule.mayAdvanceSpeculativeFor(0));
  assertTrue(schedule.resolveSpeculative(1400, 0, inputs) !== undefined);
  assertTrue(schedule.completeSpeculative(1400, 3));
  assertFalse(schedule.mayAdvanceSpeculativeFor(0));
});

test("the largest delay captures the first frame after the seed before anything is confirmed", () => {
  const schedule = new ShadowInputSchedule();
  assertTrue(schedule.beginEpoch(1304, 5, 6, 3));
  assertEquals(schedule.captureTarget(), 6);
  assertEquals(schedule.captureLocal(1304, WALK_RIGHT), Capture.captured);
  assertTrue(sameInput(assertDefined(schedule.pending(1304, 6)), WALK_RIGHT));
  assertEquals(schedule.speculativeFrame(), 1);
  assertEquals(schedule.nextConfirmedFrame(), 1);
});

test("tagged captures keep their original frames while speculation stalls", () => {
  const schedule = new ShadowInputSchedule();
  const inputs = participantInputs();
  assertTrue(schedule.beginEpoch(1300, 0, 6, 3));
  for (let frame = 1; frame <= 8; frame++) {
    // The producer's timeline moves on while the service cursor stays at 1.
    const sample = row({ held: frame, pressed: frame, released: frame, axisX: frame, axisZ: -frame, triggerLeft: frame, triggerRight: frame });
    assertEquals(schedule.captureLocalAt(1300, frame, sample), Capture.captured);
    assertEquals(schedule.speculativeFrame(), 1);
    assertEquals(schedule.knownThrough(), 0);
    assertEquals(schedule.nextConfirmedFrame(), 1);
  }
  for (let frame = 1; frame <= 6; frame++) {
    assertTrue(schedule.resolveSpeculative(1300, 0, inputs) !== undefined);
    assertEquals(inputs[0].held, frame);
    assertEquals(inputs[0].pressed, frame);
    assertEquals(inputs[0].released, frame);
    assertTrue(schedule.completeSpeculative(1300, frame));
  }
  assertEquals(schedule.speculativeFrame(), 7);
  assertFalse(schedule.mayAdvanceSpeculative());
  for (let frame = 7; frame <= 8; frame++) {
    const pending = assertDefined(schedule.pending(1300, frame));
    assertEquals(pending.held, frame);
    assertEquals(pending.axisZ, -frame);
    assertEquals(schedule.captureLocalAt(1300, frame, pending), Capture.alreadyCaptured);
  }
  assertEquals(schedule.speculativeFrame(), 7);
  assertEquals(schedule.knownThrough(), 0);
});

test("a tagged duplicate is accepted, a changed one conflicts, and neither moves a cursor", () => {
  const schedule = new ShadowInputSchedule();
  assertTrue(schedule.beginEpoch(1301, 3, 6, 3));
  const original = row({
    held: 7, pressed: bit(Action.special), released: 5, axisX: -12, axisZ: 27, triggerLeft: 42, triggerRight: 255,
    specialX: -1, specialZ: 1, sdi: true, sdiX: 1, sdiZ: -1, throwX: 8, throwZ: -3,
  });
  const changed = row({ ...original, throwZ: -2 });
  assertEquals(schedule.captureLocalAt(1301, 4, original), Capture.captured);
  assertEquals(schedule.captureLocalAt(1301, 4, row({ ...original })), Capture.alreadyCaptured);
  assertEquals(schedule.captureLocalAt(1301, 4, changed), Capture.conflict);
  // Polling the same target reports the immutable repeat, whatever it sampled.
  assertEquals(schedule.captureLocal(1301, changed), Capture.alreadyCaptured);
  assertTrue(sameInput(assertDefined(schedule.pending(1301, 4)), original));
  assertEquals(schedule.captureTarget(), 4);
  assertEquals(schedule.speculativeFrame(), 1);
  assertEquals(schedule.nextConfirmedFrame(), 1);
  assertEquals(schedule.knownThrough(), 3);
});

test("tagged captures outside the epoch, the frame range or the future limit occupy nothing", () => {
  const schedule = new ShadowInputSchedule();
  assertEquals(schedule.captureLocalAt(1302, 1, NEUTRAL), Capture.wrongEpoch);
  assertTrue(schedule.beginEpoch(1302, 0, 6, 3));
  assertEquals(schedule.captureLocalAt(1301, 1, NEUTRAL), Capture.wrongEpoch);
  for (const frame of [0, -1, INPUT_LAST_FRAME + 1]) assertEquals(schedule.captureLocalAt(1302, frame, NEUTRAL), Capture.frameExhausted);
  assertEquals(schedule.pending(1302, 1), undefined);
  assertEquals(schedule.captureLocalAt(1302, 1, NEUTRAL), Capture.captured);
  assertEquals(schedule.captureLocalAt(1302, FUTURE_LIMIT, NEUTRAL), Capture.captured);
  assertEquals(schedule.captureLocalAt(1302, FUTURE_LIMIT + 1, NEUTRAL), Capture.tooFarAhead);
  assertEquals(schedule.captureLocalAt(1302, 1 + PENDING_CAPACITY, NEUTRAL), Capture.tooFarAhead);
  assertEquals(schedule.pending(1302, 1 + PENDING_CAPACITY), undefined);
  assertTrue(sameInput(assertDefined(schedule.pending(1302, 1)), NEUTRAL));
  assertEquals(schedule.speculativeFrame(), 1);
  assertEquals(schedule.nextConfirmedFrame(), 1);
  assertEquals(schedule.knownThrough(), 0);
});

test("tagged retention and ring reuse follow confirmed consumption", () => {
  const schedule = new ShadowInputSchedule();
  const inputs = participantInputs();
  assertTrue(schedule.beginEpoch(1303, 0, 6, 1));
  const consumed = PENDING_CAPACITY + 1 - FUTURE_LIMIT;
  for (let frame = 1; frame <= consumed; frame++) {
    advanceOne(schedule, 1303, NEUTRAL, inputs);
    deliver(schedule, 0, 1303, frame, NEUTRAL);
    assertTrue(schedule.readConfirmed(1303, inputs));
    assertTrue(schedule.completeConfirmed(1303, frame));
    if (frame === REPLAY_HISTORY_CAPACITY) assertEquals(schedule.captureLocalAt(1303, 1, NEUTRAL), Capture.alreadyCaptured);
    if (frame === REPLAY_HISTORY_CAPACITY + 1) {
      assertEquals(schedule.captureLocalAt(1303, 1, NEUTRAL), Capture.outOfHistory);
      assertEquals(schedule.pending(1303, 1), undefined);
    }
  }
  const firstRetained = consumed - REPLAY_HISTORY_CAPACITY + 1;
  assertEquals(schedule.firstAcceptedFrame(), firstRetained);
  assertEquals(schedule.captureLocalAt(1303, firstRetained - 1, NEUTRAL), Capture.outOfHistory);
  assertEquals(schedule.captureLocalAt(1303, firstRetained, NEUTRAL), Capture.alreadyCaptured);
  const reused = row({ held: 1, pressed: 2, released: 4, axisX: 99, axisZ: -99, triggerLeft: 12, triggerRight: 34 });
  assertEquals(schedule.captureLocalAt(1303, 1 + PENDING_CAPACITY, reused), Capture.captured);
  assertEquals(schedule.captureLocalAt(1303, 1, reused), Capture.outOfHistory);
  assertTrue(sameInput(assertDefined(schedule.pending(1303, 1 + PENDING_CAPACITY)), reused));
  assertEquals(schedule.captureLocalAt(1303, consumed + FUTURE_LIMIT + 1, reused), Capture.tooFarAhead);
  assertEquals(schedule.speculativeFrame(), consumed + 1);
  assertEquals(schedule.nextConfirmedFrame(), consumed + 1);
  assertEquals(schedule.knownThrough(), consumed);
});

test("delays of zero and one keep seed assignment, confirmation and epoch boundaries", () => {
  for (const delay of [0, 1] as const) {
    const epoch = 1000 + delay;
    const schedule = new ShadowInputSchedule();
    const inputs = participantInputs();
    const [first, second] = inputs;
    const sample = row({ held: bit(Action.moveRight), pressed: bit(Action.jump), axisX: 127 });
    assertTrue(schedule.beginEpoch(epoch, delay, 12, 3));
    assertEquals(schedule.knownThrough(), delay);
    assertEquals(schedule.captureTarget(), 1 + delay);
    assertEquals(schedule.captureLocal(epoch, sample), Capture.captured);
    assertEquals(schedule.captureLocal(epoch, NEUTRAL), Capture.alreadyCaptured);
    assertTrue(sameInput(assertDefined(schedule.pending(epoch, 1 + delay)), sample));
    assertEquals(schedule.accepted(epoch, 0, 1 + delay), undefined);
    for (let frame = 1; frame <= delay + 1; frame++) {
      if (frame > 1) assertEquals(schedule.captureLocal(epoch, NEUTRAL), Capture.captured);
      assertTrue(schedule.resolveSpeculative(epoch, 0, inputs) !== undefined);
      assertTrue(sameInput(first, frame <= delay ? NEUTRAL : sample));
      assertTrue(sameInput(second, NEUTRAL));
      assertTrue(schedule.completeSpeculative(epoch, frame));
      if (frame <= delay) {
        assertTrue(schedule.readConfirmed(epoch, inputs));
        assertTrue(sameInput(first, NEUTRAL));
        assertTrue(schedule.completeConfirmed(epoch, frame));
      }
    }
    assertEquals(schedule.knownThrough(), delay);
    assertFalse(schedule.mayAdvanceConfirmed());
    deliver(schedule, 0, epoch, 1 + delay, sample);
    assertFalse(schedule.mayAdvanceConfirmed());
    deliver(schedule, 1, epoch, 1 + delay, NEUTRAL);
    assertEquals(schedule.knownThrough(), 1 + delay);
    assertTrue(schedule.readConfirmed(epoch, inputs));
    assertTrue(sameInput(first, sample));
    assertTrue(sameInput(second, NEUTRAL));
    assertTrue(schedule.completeConfirmed(epoch, 1 + delay));
    assertFalse(schedule.beginEpoch(epoch, delay, 12, 3));
    assertTrue(schedule.beginEpoch(epoch + 10, delay, 12, 3));
    assertEquals(schedule.knownThrough(), delay);
    assertEquals(schedule.captureTarget(), 1 + delay);
    assertEquals(schedule.pending(epoch + 10, 1 + delay), undefined);
    assertEquals(schedule.captureLocal(epoch, sample), Capture.wrongEpoch);
  }
});

test("pending local samples never move the common frontier", () => {
  const schedule = new ShadowInputSchedule();
  const inputs = participantInputs();
  assertTrue(schedule.beginEpoch(901, 3, DEFAULT_ROLLBACK_WINDOW, 3));
  assertEquals(schedule.knownThrough(), 3);
  assertEquals(schedule.captureLocal(901, WALK_RIGHT), Capture.captured);
  assertEquals(schedule.captureLocal(901, WALK_RIGHT), Capture.alreadyCaptured);
  assertEquals(schedule.knownThrough(), 3);
  assertEquals(schedule.speculativeFrame(), 1);
  assertTrue(schedule.mayAdvanceSpeculative());
  assertEquals(schedule.resolveSpeculative(901, 0, inputs), "accepted");
  assertEquals(inputs[0].held, 0);
  assertEquals(inputs[1].held, 0);
  assertTrue(schedule.completeSpeculative(901, 1));
  assertEquals(schedule.knownThrough(), 3);
});

test("a late remote row is predicted with its holds kept and its edges dropped", () => {
  const schedule = new ShadowInputSchedule();
  const inputs = participantInputs();
  assertTrue(schedule.beginEpoch(903, 3, DEFAULT_ROLLBACK_WINDOW, 3));
  for (let frame = 1; frame <= 3; frame++) advanceOne(schedule, 903, NEUTRAL, inputs);
  deliver(schedule, 1, 903, 4, row({ held: bit(Action.moveRight), pressed: bit(Action.attack), axisX: 127 }));
  deliver(schedule, 0, 903, 4, NEUTRAL);
  advanceOne(schedule, 903, NEUTRAL, inputs);
  assertEquals(inputs[0].held, 0);
  assertTrue(has(inputs[1].pressed, Action.attack));
  assertEquals(schedule.captureLocal(903, WALK_RIGHT), Capture.captured);
  assertEquals(schedule.resolveSpeculative(903, 0, inputs), "speculative");
  assertEquals(inputs[1].held, bit(Action.moveRight));
  assertEquals(inputs[1].pressed, 0);
  assertEquals(inputs[1].released, 0);
});

test("a twelve-frame window stops at K + 12, keeps captures immutable and holds for the epoch", () => {
  const schedule = new ShadowInputSchedule();
  const inputs = participantInputs();
  assertTrue(schedule.beginEpoch(906, 3, 12, 3));
  assertEquals(schedule.rollbackFrames(), 12);
  for (let frame = 1; frame <= 15; frame++) {
    assertEquals(schedule.captureTarget(), frame + 3);
    advanceOne(schedule, 906, NEUTRAL, inputs);
  }
  assertEquals(schedule.speculativeFrame(), 16);
  assertEquals(schedule.knownThrough(), 3);
  assertFalse(schedule.mayAdvanceSpeculative());
  assertEquals(schedule.captureLocal(906, NEUTRAL), Capture.captured);
  assertEquals(schedule.captureLocal(906, WALK_RIGHT), Capture.alreadyCaptured);
  assertEquals(schedule.pending(906, 19)?.held, 0);
  deliver(schedule, 0, 906, 4, NEUTRAL);
  assertFalse(schedule.mayAdvanceSpeculative());
  deliver(schedule, 1, 906, 4, NEUTRAL);
  assertEquals(schedule.knownThrough(), 4);
  assertTrue(schedule.mayAdvanceSpeculative());
  assertFalse(schedule.beginEpoch(906, 3, 6, 3));
  assertFalse(schedule.beginEpoch(907, 3, 0, 3));
  assertFalse(schedule.beginEpoch(907, 3, 25, 3));
  assertEquals(schedule.rollbackFrames(), 12);
  assertEquals(schedule.speculativeFrame(), 16);
  assertTrue(schedule.beginEpoch(907, 3, DEFAULT_ROLLBACK_WINDOW, 3));
  assertEquals(schedule.rollbackFrames(), 6);
});

test("a twenty-four-frame window stops and resumes without reassigning local input", () => {
  const schedule = new ShadowInputSchedule();
  const inputs = participantInputs();
  assertTrue(schedule.beginEpoch(908, 0, 24, 3));
  assertEquals(schedule.rollbackFrames(), 24);
  for (let frame = 1; frame <= 24; frame++) {
    assertEquals(schedule.captureTarget(), frame);
    advanceOne(schedule, 908, NEUTRAL, inputs);
  }
  assertEquals(schedule.speculativeFrame(), 25);
  assertEquals(schedule.knownThrough(), 0);
  assertFalse(schedule.mayAdvanceSpeculative());
  assertEquals(schedule.captureLocal(908, NEUTRAL), Capture.captured);
  assertEquals(schedule.captureLocal(908, WALK_RIGHT), Capture.alreadyCaptured);
  assertEquals(schedule.resolveSpeculative(908, 0, inputs), undefined);
  deliver(schedule, 1, 908, 1, NEUTRAL);
  assertFalse(schedule.mayAdvanceSpeculative());
  deliver(schedule, 0, 908, 1, NEUTRAL);
  assertEquals(schedule.knownThrough(), 1);
  assertTrue(schedule.mayAdvanceSpeculative());
  assertTrue(schedule.resolveSpeculative(908, 0, inputs) !== undefined);
  assertTrue(sameInput(inputs[0], NEUTRAL));
  assertTrue(schedule.completeSpeculative(908, 25));
  assertFalse(schedule.mayAdvanceSpeculative());
  assertFalse(schedule.beginEpoch(908, 0, 12, 3));
  assertFalse(schedule.beginEpoch(909, 0, 25, 3));
  assertEquals(schedule.rollbackFrames(), 24);
  assertEquals(schedule.speculativeFrame(), 26);
});

test("every local slot predicts each remote from that remote's own causal history", () => {
  const schedule = new ShadowInputSchedule();
  const inputs = participantInputs();
  const later = row({ held: 99, axisX: 99, axisZ: 99, triggerLeft: 99, triggerRight: 99 });
  for (let localPlayer = 0; localPlayer <= 3; localPlayer++) {
    const epoch = 1100 + localPlayer;
    assertTrue(schedule.beginEpoch(epoch, 0, 6, 15));
    const source = [0, 1, 2, 3].map((sender) =>
      row({
        held: 1 + sender, pressed: maskOf(Action.special, Action.leftTrigger, Action.moveUp), released: 7,
        axisX: 10 + sender, axisZ: -10 - sender, triggerLeft: 31 + sender, triggerRight: 250 - sender,
        specialX: 1, specialZ: -1, dodgeX: -1, dodgeZ: 1, sdi: true, sdiX: -1, sdiZ: 1, ledgeVertical: 1,
        throwX: sender + 3, throwZ: -sender - 5,
      }));
    const local = source[localPlayer]!;
    source.forEach((input, sender) => {
      if (sender !== localPlayer) deliver(schedule, sender, epoch, 1, input);
    });
    assertEquals(schedule.captureLocal(epoch, local), Capture.captured);
    assertEquals(schedule.captureLocal(epoch, NEUTRAL), Capture.alreadyCaptured);
    assertEquals(schedule.resolveSpeculative(epoch, localPlayer, inputs), "speculative");
    source.forEach((input, sender) => assertTrue(sameInput(inputs[sender]!, input)));
    assertTrue(schedule.completeSpeculative(epoch, 1));
    assertEquals(schedule.knownThrough(), 0);
    assertEquals(schedule.captureLocal(epoch, local), Capture.captured);
    // A remote row accepted for a later frame cannot influence an earlier prediction.
    deliver(schedule, imod(localPlayer + 1, 4), epoch, 3, later);
    assertEquals(schedule.resolveSpeculative(epoch, localPlayer, inputs), "speculative");
    source.forEach((input, sender) => {
      const expected = emptyInput();
      if (sender === localPlayer) copyInput(expected, input);
      else predictInto(expected, input);
      assertTrue(sameInput(inputs[sender]!, expected));
    });
    assertTrue(schedule.completeSpeculative(epoch, 2));
    deliver(schedule, localPlayer, epoch, 1, local);
    assertEquals(schedule.knownThrough(), 1);
    assertTrue(schedule.readConfirmed(epoch, inputs));
    source.forEach((input, sender) => assertTrue(sameInput(inputs[sender]!, input)));
    assertTrue(schedule.completeConfirmed(epoch, 1));
  }
});

test("sparse membership with local slot three invents no inactive or missing accepted rows", () => {
  const schedule = new ShadowInputSchedule();
  const inputs = participantInputs();
  const local = row({ held: 45, axisX: -127, axisZ: 81, triggerLeft: 7, triggerRight: 89 });
  assertTrue(schedule.beginEpoch(1200, 0, 6, 13));
  copyInput(inputs[1], row({ held: 123 }));
  assertEquals(schedule.resolveSpeculative(1200, 3, inputs), undefined);
  assertEquals(schedule.captureLocal(1200, local), Capture.captured);
  assertEquals(schedule.resolveSpeculative(1200, 1, inputs), undefined);
  assertFalse(schedule.rememberResolvedInput(1, local));
  assertTrue(schedule.rememberResolvedInput(2, local));
  assertEquals(schedule.resolveSpeculative(1200, 3, inputs), "speculative");
  assertEquals(inputs[1].held, 123);
  assertTrue(sameInput(inputs[2], local));
  assertTrue(sameInput(inputs[3], local));
  assertTrue(schedule.completeSpeculative(1200, 1));
  deliver(schedule, 0, 1200, 1, local);
  deliver(schedule, 2, 1200, 1, local);
  assertEquals(schedule.knownThrough(), 0);
  assertFalse(schedule.readConfirmed(1200, inputs));
  deliver(schedule, 3, 1200, 1, local);
  assertEquals(schedule.knownThrough(), 1);
  assertTrue(schedule.readConfirmed(1200, inputs));
  assertTrue(schedule.completeConfirmed(1200, 1));
  assertFalse(schedule.beginEpoch(1201, 0, 6, 0));
  assertEquals(schedule.participantMask(), 13);
  assertTrue(schedule.beginEpoch(1201, 0, 6, 8));
  assertEquals(schedule.pending(1201, 1), undefined);
  assertFalse(schedule.isActive(2));
});
