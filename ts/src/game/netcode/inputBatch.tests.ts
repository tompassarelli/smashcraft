import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Action, bit } from "../input/actions";
import { type RowFields, inputRow } from "../input/inputRow";
import { participantInputs } from "../input/participants";
import { decodePacket, encodePacket } from "../input/wire";
import { Capture } from "./capture";
import { InputBatch } from "./inputBatch";
import { DEFAULT_ROLLBACK_WINDOW, ShadowInputSchedule } from "./shadowSchedule";

const row = (fields: RowFields = {}) => assertDefined(inputRow(fields), "row");
const NEUTRAL = row();

test("a batch carries two consecutive captures with their own edges, and no more", () => {
  const batch = new InputBatch(70);
  const press = row({ held: bit(Action.attack), pressed: bit(Action.attack) });
  const release = row({ released: bit(Action.attack) });
  assertTrue(batch.append(70, 4, press));
  assertFalse(batch.append(70, 4, release));
  assertFalse(batch.append(70, 6, release));
  assertFalse(batch.append(71, 5, release));
  assertTrue(batch.append(70, 5, release));
  assertFalse(batch.append(70, 6, release));
  // Appending copies: later sampling cannot change a queued row.
  release.released = 0;
  const wire = encodePacket(assertDefined(batch.packet()));
  assertEquals(wire.length, 23);
  const decoded = assertDefined(decodePacket(wire));
  assertEquals(decoded.rows[0]?.pressed, bit(Action.attack));
  assertEquals(decoded.rows[1]?.released, bit(Action.attack));
  batch.sent();
  assertEquals(batch.size(), 0);
  assertEquals(batch.packet(), undefined);
});

test("every captured row reaches the ledger verbatim through pause and window-wait singletons", () => {
  const schedule = new ShadowInputSchedule();
  const batch = new InputBatch(73);
  const inputs = participantInputs();
  assertTrue(schedule.beginEpoch(73, 3, DEFAULT_ROLLBACK_WINDOW, 3));
  // Withhold all transport until the six-frame window fills, then flush its
  // incomplete tail.
  for (let frame = 1; frame <= 9; frame++) {
    assertEquals(schedule.captureTarget(), frame + 3);
    assertEquals(schedule.captureLocal(73, NEUTRAL), Capture.captured);
    assertTrue(schedule.resolveSpeculative(73, 0, inputs) !== undefined);
    assertTrue(schedule.completeSpeculative(73, frame));
  }
  assertFalse(schedule.mayAdvanceSpeculative());
  assertEquals(schedule.captureLocal(73, NEUTRAL), Capture.captured);
  // Repeated polling at a blocked target cannot rewrite the capture.
  assertEquals(schedule.captureLocal(73, NEUTRAL), Capture.alreadyCaptured);
  for (let target = 4; target <= 13; target++) {
    assertTrue(batch.append(73, target, assertDefined(schedule.pending(73, target))));
    // Frame 6 stands for a pause or transition singleton; the tail for a
    // repeated-target wait with no second row coming.
    if (batch.size() === 2 || target === 6 || target === 13) {
      const packet = assertDefined(batch.packet());
      assertEquals(schedule.acceptSynchronized(0, packet), "accepted");
      assertEquals(schedule.acceptSynchronized(1, packet), "accepted");
      batch.sent();
    }
  }
  assertEquals(schedule.knownThrough(), 13);
  assertTrue(schedule.mayAdvanceSpeculative());
  while (schedule.mayAdvanceConfirmed()) {
    const frame = schedule.nextConfirmedFrame();
    assertTrue(schedule.readConfirmed(73, inputs));
    assertTrue(schedule.completeConfirmed(73, frame));
  }
  assertEquals(schedule.nextConfirmedFrame(), 10);
  assertEquals(batch.size(), 0);
});
