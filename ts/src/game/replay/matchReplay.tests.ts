// #141's round trip in Bun and in 32-bit Lua: the replay a recorder writes of
// a whole match, in parts and with a segment break where the match changed
// between frames, replays to every checksum it recorded.
import { assertDefined, assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { Action, bit } from "../input/actions";
import { clearAttackBuffer } from "../input/attackBuffer";
import { type InputRow, emptyInput, inputRow } from "../input/inputRow";
import { PARTICIPANT_SLOTS, type Slots, participantActive } from "../input/participants";
import { captureNetworkFrame, createMatchFrameInput, executeMatchFrame } from "../match/frameInput";
import { Phase } from "../match/rules";
import { stateChecksum } from "./canonical";
import {
  ReplayBegin, beginMatchReplayFrame, createFrameScratch, runReplayFrame, continueMatchReplay, createMatchReplayRecorder, endMatchReplaySegment, finishMatchReplay, joinReplay,
  matchReplayDone, matchReplayFrameRan, parseReplay, parseReplayHeader, parseReplayPart, replayManifestLines, replayMatch, replayPartLines, takeMatchReplayPart,
} from "./matchReplay";
import { beginMomentFrame, createMomentRecorder, keepMomentEnd, momentFrameRan, recordMomentRow } from "./moment";
import { copyReplayState, createReplaySnapshot } from "./snapshot";
import { createTapeWorld } from "./tapeWorld";

function scriptedRow(slot: number, frame: number): InputRow {
  const direction = bit(floorMod(floorDiv(frame + slot * 30, 50), 2) === 0 ? Action.moveRight : Action.moveLeft);
  const tap = (floorMod(frame, 29 + slot * 6) === 0 ? bit(Action.attack) : 0) | (floorMod(frame, 47) === 0 ? bit(Action.jump) : 0);
  return assertDefined(inputRow({ held: direction, pressed: tap, released: tap, axisX: direction === bit(Action.moveRight) ? 127 : -127 }), "row");
}

test("match replay: a rollback match recorded in parts, paused once, replays to every checksum", () => {
  const tape = createTapeWorld({ stocks: 3, humans: 2 });
  const { world, match, controls, runtime } = tape.live;
  const moment = createMomentRecorder();
  const recorder = createMatchReplayRecorder();
  const frameInput = createMatchFrameInput();
  const rows: Slots<InputRow> = [emptyInput(), emptyInput(), emptyInput(), emptyInput()];
  const parts: (readonly string[])[] = [];
  const service = () => {
    continueMatchReplay(recorder);
    const part = takeMatchReplayPart(recorder, false);
    if (part !== undefined) parts.push(replayPartLines(7, recorder.parts, part));
  };
  const frames = 700;
  let segments = 0;
  for (let frame = 1; frame <= frames; frame++) {
    if (frame === 401) {
      // A pause: the shell ends the segment, then clears the attack buffers between frames.
      keepMomentEnd(moment, world, match, controls, runtime);
      endMatchReplaySegment(recorder, moment, world, match, controls, runtime);
      for (const slot of PARTICIPANT_SLOTS) clearAttackBuffer(controls.commands[slot]);
    }
    for (const slot of PARTICIPANT_SLOTS) rows[slot] = scriptedRow(slot, frame);
    assertTrue(captureNetworkFrame(frameInput, frame, rows, world, match.humanMask));
    const begun = beginMatchReplayFrame(recorder, moment, frame, { kind: "network" }, world, match, controls, runtime);
    if (begun !== ReplayBegin.none) segments++;
    beginMomentFrame(moment, frame, world, match, controls, runtime);
    assertTrue(executeMatchFrame(frameInput, match, world, controls, runtime, frame));
    for (const slot of PARTICIPANT_SLOTS) if (participantActive(match.humanMask, slot)) recordMomentRow(moment, frame, slot, rows[slot]);
    momentFrameRan(moment, frame);
    matchReplayFrameRan(recorder, moment, frame, world, match, controls, runtime);
    service();
  }
  assertEquals(segments, 2);
  keepMomentEnd(moment, world, match, controls, runtime);
  endMatchReplaySegment(recorder, moment, world, match, controls, runtime);
  const scratch = createReplaySnapshot();
  copyReplayState(scratch, tape.live);
  const fullChecksum = stateChecksum(scratch);
  match.phase = Phase.result;
  while (!matchReplayDone(recorder, match)) service();
  const end = assertDefined(finishMatchReplay(recorder, moment, world, match, controls, runtime), "end");
  const last = takeMatchReplayPart(recorder, true);
  if (last !== undefined) parts.push(replayPartLines(7, recorder.parts, last));
  assertEquals(end.frame, frames);
  assertTrue(parts.length > 1);
  const manifest = replayManifestLines({ build: "test", version: "development", serial: 7, frame: end.frame, checksum: end.checksum, parts: recorder.parts });
  const header = parseReplayHeader(manifest);
  if (typeof header === "string") throw new Error(header);
  assertEquals(header.parts, parts.length);
  const bodies = parts.map((part, index) => {
    const body = parseReplayPart(part, 7, index + 1);
    if (typeof body === "string") throw new Error(body);
    return body;
  });
  const joined = joinReplay(header, bodies);
  const result = replayMatch(joined);
  assertEquals(result.problems.join("; "), "");
  assertEquals(result.frames, frames);
  assertEquals(result.reached, result.recorded);
  // Two segment starts, a checkpoint every two seconds of each, both segment ends and the manifest's.
  assertEquals(result.recorded, 2 + 3 + 2 + 2 + 1);
  // The written state is the whole state: the last segment replays to the canonical checksum the match ended on.
  const replay = parseReplay(joined);
  if (typeof replay === "string") throw new Error(replay);
  assertEquals(replay.segments.length, 2);
  const segment = assertDefined(replay.segments[1], "segment");
  const state = createReplaySnapshot();
  copyReplayState(state, segment.state);
  const frameScratch = createFrameScratch();
  segment.frames.forEach((saved, index) => assertTrue(runReplayFrame(state, replay.input, frameScratch, saved, segment.start + index + 1)));
  const replayed = createReplaySnapshot();
  copyReplayState(replayed, state);
  assertEquals(stateChecksum(replayed), fullChecksum);
});

test("match replay: a part cut short or from another replay is refused", () => {
  const part = replayPartLines(3, 1, ["rows 1:0:"]);
  assertEquals(typeof parseReplayPart(part, 3, 1), "object");
  assertEquals(parseReplayPart(part.slice(0, part.length - 1), 3, 1), "part 1 is cut short");
  assertEquals(parseReplayPart(part, 4, 1), "part 1 isn't part 1 of replay 4");
});
