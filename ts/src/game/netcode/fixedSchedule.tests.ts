import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { imod } from "wisp/src/sim/intMath";
import { type InputRow, type RowFields, copyInput, inputRow, sameInput } from "../input/inputRow";
import { participantInputs } from "../input/participants";
import { inputPacket } from "../input/wire";
import { Capture } from "./capture";
import { FixedInputSchedule } from "./fixedSchedule";
import { FUTURE_LIMIT } from "./ledger";

const row = (fields: RowFields = {}) => assertDefined(inputRow(fields), "row");
const packet = (epoch: number, firstFrame: number, ...rows: InputRow[]) => assertDefined(inputPacket(epoch, firstFrame, rows), "packet");
const NEUTRAL = row();


const sampleAt = (frame: number, sender: number) =>
  row({
    held: imod(frame * 7 + sender, 32768), pressed: imod(frame * 13 + sender, 32768), released: imod(frame * 3 + sender, 32768),
    axisX: imod(frame, 255) - 127, axisZ: imod(frame + sender, 255) - 127, triggerLeft: imod(frame, 256), triggerRight: imod(frame + sender, 256),
  });


const rowAt = (frame: number, delay: number, sender: number) => (frame <= delay ? NEUTRAL : sampleAt(frame - delay, sender));

test("every supported delay seeds neutral frames, and each frame completes explicitly in order [spec docs/netcode-proposal.md]", () => {
  const schedule = new FixedInputSchedule();
  const inputs = participantInputs();
  const [first, second] = inputs;
  assertFalse(schedule.mayAdvance());
  assertEquals(schedule.captureTarget(), undefined);
  assertEquals(schedule.captureLocal(0, first), Capture.wrongEpoch);
  for (const delay of [0, 1, 2, 3, 5] as const) {
    assertTrue(schedule.beginEpoch(delay, delay, 3));
    assertEquals(schedule.nextFrame(), 1);
    assertEquals(schedule.delay(), delay);
    assertEquals(schedule.knownThrough(), delay);
    assertEquals(schedule.confirmedThrough(), 0);
    for (let frame = 1; frame <= delay; frame++) {
      assertEquals(schedule.captureTarget(), frame + delay);
      assertFalse(schedule.complete(delay, frame));
      assertTrue(schedule.readNext(delay, inputs));
      assertTrue(sameInput(first, NEUTRAL));
      assertTrue(sameInput(second, NEUTRAL));
      assertEquals(schedule.nextFrame(), frame);
      assertEquals(schedule.confirmedThrough(), frame - 1);
      assertFalse(schedule.complete(delay, frame + 1));
      assertTrue(schedule.complete(delay, frame));
      assertFalse(schedule.complete(delay, frame));
    }
    assertFalse(schedule.mayAdvance());
    assertFalse(schedule.readNext(delay, inputs));
    assertEquals(schedule.nextFrame(), delay + 1);
  }
});

test("a capture opportunity assigns its target once, and local capture never opens the common gate [spec docs/netcode-proposal.md]", () => {
  const schedule = new FixedInputSchedule();
  const inputs = participantInputs();
  const [first, second] = inputs;
  assertTrue(schedule.beginEpoch(1, 3, 3));
  const original = sampleAt(1, 0);
  const later = sampleAt(99, 0);
  assertEquals(schedule.captureLocal(1, original), Capture.captured);
  assertEquals(schedule.captureLocal(1, later), Capture.alreadyCaptured);
  assertTrue(sameInput(assertDefined(schedule.pending(1, 4)), original));
  assertEquals(schedule.accepted(1, 0, 4), undefined);
  assertEquals(schedule.knownThrough(), 3);
  for (let frame = 1; frame <= 3; frame++) {
    assertTrue(schedule.readNext(1, inputs));
    assertTrue(schedule.complete(1, frame));
    assertEquals(schedule.captureLocal(1, later), Capture.captured);
  }
  for (let service = 1; service <= 20; service++) {
    assertEquals(schedule.captureLocal(1, sampleAt(service, 0)), Capture.alreadyCaptured);
    assertFalse(schedule.readNext(1, inputs));
    assertEquals(schedule.nextFrame(), 4);
    assertEquals(schedule.captureTarget(), 7);
    assertEquals(schedule.knownThrough(), 3);
    assertEquals(schedule.confirmedThrough(), 3);
  }

  const sent = packet(1, 4, assertDefined(schedule.pending(1, 4)));
  assertFalse(schedule.mayAdvance());
  assertEquals(schedule.acceptSynchronized(0, sent), "accepted");
  assertFalse(schedule.mayAdvance());
  assertEquals(schedule.acceptSynchronized(0, sent), "accepted");
  assertEquals(schedule.knownThrough(), 3);
  assertEquals(schedule.acceptSynchronized(1, sent), "accepted");
  assertEquals(schedule.knownThrough(), 4);
  assertEquals(schedule.confirmedThrough(), 3);
  assertEquals(schedule.nextFrame(), 4);
  assertFalse(schedule.complete(1, 4));
  assertTrue(schedule.readNext(1, inputs));
  assertTrue(sameInput(first, original));
  assertTrue(sameInput(second, original));
  assertTrue(schedule.complete(1, 4));
});

test("the future bound moves on completion, not on receipt or read [spec docs/netcode-proposal.md]", () => {
  const schedule = new FixedInputSchedule();
  const inputs = participantInputs();
  assertTrue(schedule.beginEpoch(1, 2, 3));
  for (let frame = 3; frame <= FUTURE_LIMIT; frame++) {
    assertEquals(schedule.acceptSynchronized(0, packet(1, frame, NEUTRAL)), "accepted");
    assertEquals(schedule.acceptSynchronized(1, packet(1, frame, NEUTRAL)), "accepted");
  }
  assertEquals(schedule.knownThrough(), FUTURE_LIMIT);
  assertEquals(schedule.confirmedThrough(), 0);
  assertEquals(schedule.nextFrame(), 1);
  const straddling = packet(1, FUTURE_LIMIT, NEUTRAL, NEUTRAL);
  assertEquals(schedule.acceptSynchronized(0, straddling), "tooFarAhead");
  assertEquals(schedule.accepted(1, 0, FUTURE_LIMIT + 1), undefined);
  assertTrue(schedule.readNext(1, inputs));
  assertEquals(schedule.acceptSynchronized(0, straddling), "tooFarAhead");
  assertTrue(schedule.complete(1, 1));
  assertEquals(schedule.acceptSynchronized(0, straddling), "accepted");
  assertEquals(schedule.acceptSynchronized(1, straddling), "accepted");
  assertEquals(schedule.knownThrough(), FUTURE_LIMIT + 1);
  assertEquals(schedule.confirmedThrough(), 1);
});

test("a new epoch clears pending and prepared rows [spec docs/netcode-proposal.md]", () => {
  const schedule = new FixedInputSchedule();
  const inputs = participantInputs();
  const [first] = inputs;
  assertFalse(schedule.beginEpoch(-1, 3, 3));
  assertTrue(schedule.beginEpoch(0, 3, 3));
  assertEquals(schedule.captureLocal(0, first), Capture.captured);
  assertTrue(schedule.readNext(0, inputs));
  assertFalse(schedule.beginEpoch(0, 5, 3));
  assertEquals(schedule.delay(), 3);
  assertTrue(schedule.pending(0, 4) !== undefined);
  assertTrue(schedule.beginEpoch(1, 5, 3));
  assertEquals(schedule.epoch(), 1);
  assertEquals(schedule.nextFrame(), 1);
  assertEquals(schedule.knownThrough(), 5);
  assertEquals(schedule.confirmedThrough(), 0);
  assertEquals(schedule.pending(1, 4), undefined);
  assertEquals(schedule.pending(0, 4), undefined);
  assertFalse(schedule.complete(0, 1));
  assertFalse(schedule.complete(1, 1));
  assertEquals(schedule.captureLocal(0, first), Capture.wrongEpoch);
  assertEquals(schedule.captureLocal(1, first), Capture.captured);
  assertTrue(schedule.pending(1, 6) !== undefined);
  assertEquals(schedule.pending(1, -1), undefined);
  assertEquals(schedule.pending(1, 2147483647), undefined);
  assertTrue(schedule.beginEpoch(2147483647, 2, 3));
  assertFalse(schedule.beginEpoch(-2147483647, 3, 3));
  assertFalse(schedule.beginEpoch(2147483647, 3, 3));
});



test("delivery order, duplicates, waits and ring wrap never change the rows a frame runs [spec docs/netcode-proposal.md] [invariant]", () => {
  const ordered = new FixedInputSchedule();
  const reordered = new FixedInputSchedule();
  const inputs = participantInputs();
  const otherInputs = participantInputs();
  assertTrue(ordered.beginEpoch(7, 3, 3));
  assertTrue(reordered.beginEpoch(7, 3, 3));
  for (let block = 0; block <= 49; block++) {
    const start = block * 12 + 1;
    for (let frame = start; frame <= start + 11; frame++) {
      for (let sender = 0; sender <= 1; sender++) {
        assertEquals(ordered.acceptSynchronized(sender, packet(7, frame, rowAt(frame, 3, sender))), "accepted");
      }
    }

    assertEquals(reordered.captureLocal(7, sampleAt(start, 0)), Capture.captured);
    for (let service = 1; service <= 4; service++) {
      assertEquals(reordered.captureLocal(7, sampleAt(start + service, 0)), Capture.alreadyCaptured);
      assertEquals(reordered.nextFrame(), start);
    }


    for (let delivery = 0; delivery <= 11; delivery++) {
      const sender = delivery < 6 ? 1 : 0;
      const frame = start + (5 - imod(delivery, 6)) * 2;
      const pair = packet(7, frame, rowAt(frame, 3, sender), rowAt(frame + 1, 3, sender));
      assertEquals(reordered.acceptSynchronized(sender, pair), "accepted");
      assertEquals(reordered.acceptSynchronized(sender, pair), "accepted");
      assertEquals(reordered.confirmedThrough(), start - 1);
      assertEquals(reordered.nextFrame(), start);
      if (block > 0 && delivery < 11) {
        assertFalse(reordered.mayAdvance());
        assertFalse(reordered.readNext(7, inputs));
      }
    }
    assertEquals(reordered.knownThrough(), start + 11);
    for (let frame = start; frame <= start + 11; frame++) {
      const sample = sampleAt(frame, 0);
      assertEquals(ordered.captureLocal(7, sample), Capture.captured);
      assertEquals(reordered.captureLocal(7, sample), frame === start ? Capture.alreadyCaptured : Capture.captured);
      assertEquals(ordered.captureTarget(), frame + 3);
      assertTrue(sameInput(assertDefined(reordered.pending(7, frame + 3)), sample));
      assertTrue(ordered.readNext(7, inputs));
      assertTrue(reordered.readNext(7, otherInputs));
      for (let sender = 0; sender <= 1; sender++) {
        assertTrue(sameInput(inputs[sender]!, otherInputs[sender]!));
        assertTrue(sameInput(inputs[sender]!, rowAt(frame, 3, sender)));
      }
      assertTrue(ordered.complete(7, frame));
      assertTrue(reordered.complete(7, frame));
      assertEquals(reordered.confirmedThrough(), frame);
      assertEquals(reordered.nextFrame(), frame + 1);
    }
  }
  assertEquals(reordered.firstRetained(), 537);
  assertEquals(reordered.accepted(7, 0, 536), undefined);
  assertTrue(reordered.accepted(7, 0, 537) !== undefined);
  assertTrue(reordered.accepted(7, 1, 600) !== undefined);
  assertEquals(reordered.pending(7, 536), undefined);
  assertTrue(reordered.pending(7, 537) !== undefined);
  assertTrue(reordered.pending(7, 603) !== undefined);
  assertEquals(reordered.acceptSynchronized(0, packet(7, 536, NEUTRAL)), "outOfHistory");
  assertTrue(reordered.beginEpoch(8, 2, 3));
  assertEquals(reordered.pending(8, 603), undefined);
  assertEquals(reordered.accepted(8, 0, 537), undefined);
});

test("four participants keep every row across ring reuse [invariant]", () => {
  const schedule = new FixedInputSchedule();
  const inputs = participantInputs();
  assertTrue(schedule.beginEpoch(30, 0, 15));
  for (let frame = 1; frame <= 300; frame++) {
    const local = sampleAt(frame, 3);
    assertEquals(schedule.captureLocal(30, local), Capture.captured);
    assertEquals(schedule.captureLocal(30, row({ ...local, throwX: 12, throwZ: -9 })), Capture.alreadyCaptured);
    assertTrue(sameInput(assertDefined(schedule.pending(30, frame)), local));
    for (let sender = 0; sender <= 2; sender++) {
      assertEquals(schedule.acceptSynchronized(sender, packet(30, frame, sampleAt(frame, sender))), "accepted");
    }
    assertEquals(schedule.knownThrough(), frame - 1);
    copyInput(inputs[3], row({ held: 27 }));
    assertFalse(schedule.readNext(30, inputs));
    assertEquals(inputs[3].held, 27);
    assertEquals(schedule.acceptSynchronized(3, packet(30, frame, local)), "accepted");
    assertTrue(schedule.readNext(30, inputs));
    for (let sender = 0; sender <= 3; sender++) assertTrue(sameInput(inputs[sender]!, sampleAt(frame, sender)));
    assertTrue(schedule.complete(30, frame));
  }
  assertEquals(schedule.firstRetained(), 237);
  assertEquals(schedule.accepted(30, 3, 236), undefined);
  assertTrue(schedule.accepted(30, 3, 237) !== undefined);
  assertEquals(schedule.pending(30, 236), undefined);
  assertTrue(schedule.pending(30, 237) !== undefined);
});
