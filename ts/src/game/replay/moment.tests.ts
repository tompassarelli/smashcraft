// wisp#15's round trip in Bun and in 32-bit Lua: a moment the recorder saved
// from a match replays from its snapshot to the checksum of the match itself.
import { assertDefined, assertEquals, test } from "wisp/src/runtime/testing";
import { parseRepro, reproLines } from "wisp/src/runtime/repro";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { adaptInput } from "../input/adapter";
import { Action, bit } from "../input/actions";
import { clearAttackBuffer } from "../input/attackBuffer";
import { type InputRow, emptyInput, inputRow } from "../input/inputRow";
import { PARTICIPANT_SLOTS, type Slots, participantActive } from "../input/participants";
import { createFrameControls } from "../match/controls";
import { captureFrame, captureNetworkFrame, createMatchFrameInput, executeMatchFrame } from "../match/frameInput";
import { computerActive, humanFighterActive, setParticipants } from "../match/rules";
import { produceScenarioComputerInput } from "../shell/scenarios";
import { Character } from "../sim/codes";
import { type Fighter, createFighter } from "../sim/fighter";
import { fighterAt, isActive } from "../sim/roster";
import { stateChecksum } from "./canonical";
import { MOMENT_FRAMES, beginMomentFrame, beginMomentSave, continueMomentSave, createMomentRecorder, momentFrameRan, recordMomentRow, replayRepro } from "./moment";
import { copyReplayState, createReplaySnapshot } from "./snapshot";
import { createTapeWorld } from "./tapeWorld";

/** A player who walks one way for a second, then the other, and taps attack, jump and shield on their own beats. */
function scriptedRow(slot: number, frame: number): InputRow {
  const direction = bit(floorMod(floorDiv(frame + slot * 30, 60), 2) === 0 ? Action.moveRight : Action.moveLeft);
  const turned = floorMod(frame + slot * 30, 60) === 0;
  const tap = (floorMod(frame, 37 + slot * 4) === 0 ? bit(Action.attack) : 0) | (floorMod(frame, 53) === 0 ? bit(Action.jump) : 0) | (floorMod(frame, 71) === 0 ? bit(Action.leftTrigger) : 0);
  return assertDefined(inputRow({ held: direction, pressed: tap | (turned ? direction : 0), released: tap, axisX: direction === bit(Action.moveRight) ? 127 : -127 }), "row");
}

/**
 * Saves the moment that ends after `frames` frames while the match runs on,
 * a save step a frame, and replays it: it must reach the match's checksum at
 * its end. A callback match pits a human Illidan against a computer archer.
 */
function roundTrip(callback: boolean, frames: number, row = scriptedRow, fighters?: { first: Fighter; second: Fighter }): void {
  const tape = callback
    ? createTapeWorld({ stocks: 3, humans: 1, first: createFighter(Character.demonHunter, 0.0, 1), second: createFighter(Character.archer, 100.0, -1) })
    : createTapeWorld({ stocks: 3, humans: 2, ...fighters });
  const { world, match, controls, runtime } = tape.live;
  if (callback) setParticipants(match, 1, 2);
  const recorder = createMomentRecorder();
  const frameInput = createMatchFrameInput();
  const produced = createFrameControls();
  const rows: Slots<InputRow> = [emptyInput(), emptyInput(), emptyInput(), emptyInput()];
  const run = (frame: number) => {
    for (const slot of PARTICIPANT_SLOTS) rows[slot] = row(slot, frame);
    if (callback) {
      // As the shell's callbackMatchTick: humans adapt their rows, the computer chooses.
      for (const slot of PARTICIPANT_SLOTS) {
        if (!humanFighterActive(match, slot) || !isActive(world, slot)) continue;
        recordMomentRow(recorder, frame, slot, rows[slot]);
        adaptInput(rows[slot], fighterAt(world, slot), frame, produced.inputs[slot], produced.commands[slot]);
      }
      for (const slot of PARTICIPANT_SLOTS) if (computerActive(match, slot) && isActive(world, slot)) produceScenarioComputerInput("normal", match, world, runtime, produced, slot, frame);
      assertEquals(captureFrame(frameInput, frame, world.mask, produced, runtime), true);
      for (const slot of PARTICIPANT_SLOTS) if (isActive(world, slot)) clearAttackBuffer(produced.commands[slot]);
    } else assertEquals(captureNetworkFrame(frameInput, frame, rows, world, match.humanMask), true);
    beginMomentFrame(recorder, frame, world, match, controls, runtime);
    assertEquals(executeMatchFrame(frameInput, match, world, controls, runtime, frame), true);
    if (!callback) for (const slot of PARTICIPANT_SLOTS) if (participantActive(match.humanMask, slot)) recordMomentRow(recorder, frame, slot, rows[slot]);
    momentFrameRan(recorder, frame);
  };
  for (let frame = 1; frame <= frames; frame++) run(frame);
  const scratch = createReplaySnapshot();
  copyReplayState(scratch, tape.live);
  const checksum = stateChecksum(scratch);
  assertEquals(beginMomentSave(recorder, callback ? { kind: "callback", scenario: "normal" } : { kind: "network" }, world, match, controls, runtime), true);
  let saved = continueMomentSave(recorder, scratch);
  for (let frame = frames + 1; frame <= frames + 12 && saved === undefined; frame++) {
    run(frame);
    saved = continueMomentSave(recorder, scratch);
  }
  const moment = assertDefined(saved, "moment");
  assertEquals(moment.frame, frames);
  assertEquals(moment.checksum, checksum);
  const repro = parseRepro(reproLines({ build: "test", frame: moment.frame, checksum: moment.checksum }, moment.lines));
  if (typeof repro === "string") throw new Error(repro);
  const result = replayRepro(repro);
  assertEquals(result.problems.join("; "), "");
  assertEquals(result.checksum, repro.checksum);
  // The latest snapshot ten seconds back starts the moment; a younger match's starts at frame 0.
  assertEquals(result.frames, frames >= MOMENT_FRAMES ? frames - 120 * floorDiv(frames - MOMENT_FRAMES, 120) : frames);
}

// Saved a frame before the record replaces the moment's first snapshot and rows.
test("moment: a rollback match's last ten seconds replay from their snapshot to the match's checksum", () => roundTrip(false, 839));

test("moment: a callback match against a computer replays from frame 0 to the match's checksum", () => roundTrip(true, 300));

/** Lich a casts Frost Nova on frame 10 and presses again on frame 60, bursting the orb; nobody else moves. */
function frostNovaRow(slot: number, frame: number): InputRow {
  const special = slot === 0 && (frame === 10 || frame === 60) ? bit(Action.special) : 0;
  return assertDefined(inputRow({ held: 0, pressed: special, released: special, axisX: 0 }), "row");
}

// A decoded moment holds a copy of each kit; the burst finds its orb by the kit's own object.
test("moment: a Frost Nova burst replays from the moment's snapshot to the match's checksum", () =>
  roundTrip(false, 120, frostNovaRow, { first: createFighter(Character.lich, -240.0, 1), second: createFighter(Character.lich, 600.0, -1) }));
