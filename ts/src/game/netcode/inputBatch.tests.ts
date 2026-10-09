import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { type RowFields, inputRow } from "../input/inputRow";
import { participantInputs } from "../input/participants";
import { Capture } from "./capture";
import { InputBatch } from "./inputBatch";
import { DEFAULT_ROLLBACK_WINDOW, ShadowInputSchedule } from "./shadowSchedule";

const row = (fields: RowFields = {}) => assertDefined(inputRow(fields), "row");
const NEUTRAL = row();

test("every captured row reaches the ledger verbatim through pause and window-wait singletons [invariant]", () => {
  const schedule = new ShadowInputSchedule();
  const batch = new InputBatch(73);
  const inputs = participantInputs();
  assertTrue(schedule.beginEpoch(73, 3, DEFAULT_ROLLBACK_WINDOW, 3));


  for (let frame = 1; frame <= 9; frame++) {
    assertEquals(schedule.captureTarget(), frame + 3);
    assertEquals(schedule.captureLocal(73, NEUTRAL), Capture.captured);
    assertTrue(schedule.resolveSpeculative(73, 0, inputs) !== undefined);
    assertTrue(schedule.completeSpeculative(73, frame));
  }
  assertFalse(schedule.mayAdvanceSpeculative(0));
  assertEquals(schedule.captureLocal(73, NEUTRAL), Capture.captured);

  assertEquals(schedule.captureLocal(73, NEUTRAL), Capture.alreadyCaptured);
  for (let target = 4; target <= 13; target++) {
    assertTrue(batch.append(73, target, assertDefined(schedule.pending(73, target))));


    if (batch.size() === 2 || target === 6 || target === 13) {
      const packet = assertDefined(batch.packet());
      assertEquals(schedule.acceptSynchronized(0, packet), "accepted");
      assertEquals(schedule.acceptSynchronized(1, packet), "accepted");
      batch.sent();
    }
  }
  assertEquals(schedule.knownThrough(), 13);
  assertTrue(schedule.mayAdvanceSpeculative(0));
  while (schedule.mayAdvanceConfirmed()) {
    const frame = schedule.nextConfirmedFrame();
    assertTrue(schedule.readConfirmed(73, inputs));
    assertTrue(schedule.completeConfirmed(73, frame));
  }
  assertEquals(schedule.nextConfirmedFrame(), 10);
  assertEquals(batch.size(), 0);
});
