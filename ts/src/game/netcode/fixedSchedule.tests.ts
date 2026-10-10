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



test("delivery order, duplicates, waits and ring wrap never change the rows a frame runs [k1 scenario]", () => {
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

test("four participants keep every row across ring reuse [k1 scenario]", () => {
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
