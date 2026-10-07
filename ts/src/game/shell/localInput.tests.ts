import { assertDefined, assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { emptyInput, inputRow, sameInput } from "../input/inputRow";
import { InputBatch } from "../netcode/inputBatch";
import { Capture } from "../netcode/capture";
import { ShadowInputSchedule } from "../netcode/shadowSchedule";
import { queueLocalRows } from "./localInput";
import { createTapeWorld } from "../replay/tapeWorld";
import { replayHistoryPlayback } from "./rollbackPlayback";

test("local keyboard rows survive a one-second send cut at their original frames", () => {
  const schedule = new ShadowInputSchedule();
  const batch = new InputBatch(1);
  assertTrue(schedule.beginEpoch(1, 2, 24, 1));
  const press = assertDefined(inputRow({ held: 1, pressed: 1, axisX: -127 }));
  const neutral = emptyInput();
  for (let frame = 3; frame < 63; frame++) {
    assertEquals(schedule.captureLocalAt(1, frame, frame === 17 ? press : neutral), Capture.captured);
    assertTrue(queueLocalRows(batch, schedule, 1, 3) !== false);
  }
  let next = 3;
  let sent = 0;
  while (next < 63) {
    assertTrue(queueLocalRows(batch, schedule, 1, next) !== false);
    const packet = assertDefined(batch.packet());
    assertEquals(packet.firstFrame, next);
    for (const row of packet.rows) {
      assertTrue(sameInput(row, next === 17 ? press : neutral));
      next++;
      sent++;
    }
    assertEquals(schedule.acceptSynchronized(0, packet), "accepted");
    batch.sent();
  }
  assertEquals(sent, 60);
  assertEquals(schedule.knownThrough(), 62);
  const playback = replayHistoryPlayback();
  const { live } = createTapeWorld({ stocks: 99 });
  const match = { world: live.world, game: live.match, controls: live.controls, runtime: live.runtime };
  assertTrue(playback.beginEpoch(1, 24));
  let pressFrame = 0;
  for (let callback = 0; callback < 11; callback++) {
    assertTrue(playback.catchUp(schedule, 1, 0, match, 6, 63, (frame, row) => {
      if (row.pressed === 1) pressFrame = frame;
    }));
  }
  assertEquals(live.runtime.simulationFrame, 62);
  assertEquals(pressFrame, 17);
});
