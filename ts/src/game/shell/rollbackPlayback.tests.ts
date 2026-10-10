import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Action, bit } from "../input/actions";
import { type InputRow, inputRow } from "../input/inputRow";
import { inputPacket } from "../input/wire";
import { Capture } from "../netcode/capture";
import { ShadowInputSchedule } from "../netcode/shadowSchedule";
import { fighterAt } from "../sim/roster";
import { createFighter } from "../sim/fighter";
import { Character } from "../sim/codes";
import { createTapeWorld } from "../replay/tapeWorld";
import { replayHistoryPlayback } from "./rollbackPlayback";
import { paceResume, pacedStop, pauseBarrier, requestRound, stopFrame } from "./pauseBarrier";

const neutral = assertDefined(inputRow(), "neutral input");
const localPress = assertDefined(inputRow({ pressed: bit(Action.jump) }), "local press");
const shield = assertDefined(inputRow({ held: bit(Action.leftTrigger), pressed: bit(Action.leftTrigger), triggerLeft: 255 }), "shield input");

function accept(schedule: ShadowInputSchedule, sender: number, epoch: number, frame: number, row: Readonly<InputRow>): void {
  const packet = assertDefined(inputPacket(epoch, frame, [row]), "packet");
  assertEquals(schedule.acceptSynchronized(sender, packet), "accepted");
}

test("shell rollback replaces a predicted remote row and reports executed local frames [k1 scenario]", () => {
  const epoch = 1;
  const localPlayer = 0;
  const remote = 1;
  const schedule = new ShadowInputSchedule();
  const playback = replayHistoryPlayback();
  const { live } = createTapeWorld({ stocks: 99, humans: 2 });
  const executed: number[] = [];

  assertTrue(schedule.beginEpoch(epoch, 0, 4, live.match.humanMask));
  assertTrue(playback.beginEpoch(epoch, 4));
  for (let frame = 1; frame <= 4; frame++) {
    assertEquals(schedule.captureLocalAt(epoch, frame, frame === 2 ? localPress : neutral), Capture.captured);
  }
  assertTrue(playback.catchUp(schedule, epoch, localPlayer, {
    world: live.world,
    game: live.match,
    controls: live.controls,
    runtime: live.runtime,
  }, 4, undefined, (frame, local) => {
    executed.push(frame);
    assertEquals(local.pressed, frame === 2 ? bit(Action.jump) : 0);
  }));
  assertEquals(executed.length, 4);
  assertEquals(executed[0], 1);
  assertEquals(executed[1], 2);
  assertEquals(executed[2], 3);
  assertEquals(executed[3], 4);
  assertFalse(fighterAt(live.world, remote).shield.raised);

  accept(schedule, remote, epoch, 1, shield);
  const corrected = playback.reconcile(schedule, epoch, localPlayer, {
    world: live.world,
    game: live.match,
    controls: live.controls,
    runtime: live.runtime,
  });
  if (typeof corrected === "string") throw new Error(`expected a correction from frame 1, got ${corrected}`);
  assertEquals(corrected.replayedFrom, 1);

  assertFalse(fighterAt(live.world, remote).shield.raised);
  const match = { world: live.world, game: live.match, controls: live.controls, runtime: live.runtime };
  assertEquals(playback.repair(epoch, match, 3), 3);
  assertFalse(fighterAt(live.world, remote).shield.raised);
  assertEquals(playback.repair(epoch, match, 3), 1);
  assertTrue(fighterAt(live.world, remote).shield.raised);
  assertEquals(playback.repair(epoch, match, 3), 0);
  assertEquals(live.runtime.simulationFrame, 4);
});
