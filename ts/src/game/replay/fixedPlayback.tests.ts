import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "waygate/src/runtime/testing";
import { floorDiv, floorMod } from "waygate/src/sim/intMath";
import { Action, bit } from "../input/actions";
import { adaptInput } from "../input/adapter";
import { attackBuffer } from "../input/attackBuffer";
import { type InputRow, inputRow } from "../input/inputRow";
import { inputPacket } from "../input/wire";
import type { FrameControls } from "../match/controls";
import { captureFrame, createMatchFrameInput } from "../match/frameInput";
import { type FixedDelay, FixedInputSchedule } from "../netcode/fixedSchedule";
import { fighterAt, neutralControls } from "../sim/roster";
import { firstStateDifference } from "./difference";
import { FixedInputPlayback } from "./fixedPlayback";
import { type TapeWorld, captureTape, createTapeWorld, executeTapeRow } from "./tapeWorld";

const NEUTRAL = assertDefined(inputRow(), "neutral row");

/** Runs network rows through the adapter and the frame executor directly, without a schedule. */
function directRunner(tape: TapeWorld): (frame: number, first: InputRow, second: InputRow) => void {
  const requests = [attackBuffer(0), attackBuffer(0)] as const;
  const produced: FrameControls = { inputs: [neutralControls(), neutralControls(), neutralControls(), neutralControls()], commands: [requests[0], requests[1], attackBuffer(0), attackBuffer(0)] };
  const row = createMatchFrameInput();
  return (frame, first, second) => {
    adaptInput(first, fighterAt(tape.live.world, 0), frame, produced.inputs[0], requests[0]);
    adaptInput(second, fighterAt(tape.live.world, 1), frame, produced.inputs[1], requests[1]);
    assertTrue(captureFrame(row, frame, 3, produced, tape.live.runtime));
    assertTrue(executeTapeRow(tape, row));
  };
}

/** A sender's row for a frame: neutral seed rows, then a 120-frame cycle of holds, presses and press data. */
function tapeRow(frame: number, delay: number, sender: number): InputRow {
  if (frame <= delay) return NEUTRAL;
  const phase = floorMod((frame - delay) * 17 + sender * 23, 120);
  const towards = sender === 0 ? 1 : -1;
  let held = 0;
  let pressed = 0;
  let released = 0;
  if (phase >= 8 && phase < 42) held += bit(sender === 0 ? Action.moveRight : Action.moveLeft);
  if (phase >= 70 && phase < 94) held += bit(Action.jump);
  if (phase === 4 || phase === 55 || phase === 104) pressed += bit(Action.attack);
  if (phase === 8) pressed += bit(Action.jump);
  if (phase === 64) pressed += bit(sender === 0 ? Action.moveUp : Action.moveDown);
  if (phase === 42) released += bit(sender === 0 ? Action.moveRight : Action.moveLeft);
  if (phase === 94) released += bit(Action.jump);
  const specialPressed = phase === 31;
  if (specialPressed) pressed += bit(Action.special);
  const shieldPressed = phase === 12;
  if (shieldPressed) pressed += bit(Action.leftTrigger);
  const sdi = floorMod(phase, 11) === 0;
  return assertDefined(inputRow({
    held, pressed, released,
    axisX: phase < 42 ? 127 * towards : 0,
    axisZ: phase >= 70 && phase < 94 ? 127 : 0,
    triggerLeft: shieldPressed ? 255 : 0,
    specialX: specialPressed ? towards : 0,
    specialZ: specialPressed ? 1 : 0,
    dodgeX: shieldPressed ? towards : 0,
    dodgeZ: shieldPressed ? -1 : 0,
    sdi,
    sdiX: sdi ? (floorMod(phase, 2) === 0 ? 1 : -1) : 0,
    sdiZ: sdi ? 1 : 0,
    ledgeVertical: phase === 64 ? towards : 0,
    throwX: floorMod(phase, 5) - 2,
    throwZ: floorMod(phase + sender, 5) - 2,
  }), "tape row");
}

function deliver(schedule: FixedInputSchedule, sender: number, epoch: number, firstFrame: number, count: number, delay: number): void {
  const rows = count === 2 ? [tapeRow(firstFrame, delay, sender), tapeRow(firstFrame + 1, delay, sender)] : [tapeRow(firstFrame, delay, sender)];
  assertEquals(schedule.acceptSynchronized(sender, assertDefined(inputPacket(epoch, firstFrame, rows), "packet")), "accepted");
}

function runScheduledGameplayOracle(delay: FixedDelay): void {
  const canonical = createTapeWorld({ stocks: 99, humans: 2 });
  const scheduled = createTapeWorld({ stocks: 99, humans: 2 });
  const runCanonical = directRunner(canonical);
  const schedule = new FixedInputSchedule();
  const playback = new FixedInputPlayback();
  const total = 128;
  const epoch = 700 + delay;
  const sameState = () => assertEquals(firstStateDifference(captureTape(canonical), captureTape(scheduled)), undefined);
  const advanceBoth = (frame: number) => {
    runCanonical(frame, tapeRow(frame, delay, 0), tapeRow(frame, delay, 1));
    assertTrue(playback.advanceNext(schedule, epoch, scheduled.live));
    sameState();
  };
  assertTrue(schedule.beginEpoch(epoch, delay, 3));
  for (let frame = 1; frame <= total; frame++) {
    if (frame <= delay) {
      advanceBoth(frame);
      continue;
    }
    const groupStart = delay + 1 + floorDiv(frame - delay - 1, 4) * 4;
    const groupEnd = Math.min(total, groupStart + 3);
    if (frame !== groupEnd) continue;
    const groupCount = groupEnd - groupStart + 1;
    const earlyCount = Math.min(2, groupCount);
    const laterCount = groupCount - earlyCount;
    if (laterCount > 0) {
      // The later half of each four-row group arrives first. Until the missing
      // prefix arrives, accepted future rows must not open the gate.
      for (const sender of [0, 1]) deliver(schedule, sender, epoch, groupStart + earlyCount, laterCount, delay);
      assertFalse(schedule.mayAdvance());
      assertFalse(playback.advanceNext(schedule, epoch, scheduled.live));
      sameState();
    }
    for (const sender of [0, 1]) deliver(schedule, sender, epoch, groupStart, earlyCount, delay);
    assertTrue(schedule.mayAdvance());
    while (schedule.mayAdvance()) advanceBoth(schedule.nextFrame());
    assertEquals(schedule.confirmedThrough(), groupEnd);
    sameState();
  }
}

test("accepted input rows drive gameplay identical to direct execution at delays 2, 3 and 5", () => {
  for (const delay of [2, 3, 5] as const) runScheduledGameplayOracle(delay);
});
