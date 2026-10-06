// A whole match recorded as a replay, without the shell: two humans on a
// tape world (tapeWorld.ts) walking and attacking on their own beats, with
// a pause that ends a segment. Tests in Bun and 32-bit Lua and the client's
// viewer tests replay it (smashcraft:ts/src/game/replay/matchReplay.ts).
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { Action, bit } from "../input/actions";
import { clearAttackBuffer } from "../input/attackBuffer";
import { type InputRow, emptyInput, inputRow } from "../input/inputRow";
import { PARTICIPANT_SLOTS, type Slots, participantActive } from "../input/participants";
import { captureNetworkFrame, createMatchFrameInput, executeMatchFrame } from "../match/frameInput";
import { Phase } from "../match/rules";
import { stateChecksum } from "./canonical";
import {
  ReplayBegin, beginMatchReplayFrame, continueMatchReplay, createMatchReplayRecorder, endMatchReplaySegment, finishMatchReplay,
  matchReplayDone, matchReplayFrameRan, replayManifestLines, replayPartLines, takeMatchReplayPart,
} from "./matchReplay";
import { beginMomentFrame, createMomentRecorder, keepMomentEnd, momentFrameRan, recordMomentRow } from "./moment";
import { copyReplayState, createReplaySnapshot } from "./snapshot";
import { createTapeWorld } from "./tapeWorld";

export const TAPE_REPLAY_SERIAL = 7;

function scriptedRow(slot: number, frame: number): InputRow {
  const direction = bit(floorMod(floorDiv(frame + slot * 30, 50), 2) === 0 ? Action.moveRight : Action.moveLeft);
  const tap = (floorMod(frame, 29 + slot * 6) === 0 ? bit(Action.attack) : 0) | (floorMod(frame, 47) === 0 ? bit(Action.jump) : 0);
  const row = inputRow({ held: direction, pressed: tap, released: tap, axisX: direction === bit(Action.moveRight) ? 127 : -127 });
  if (row === undefined) throw new Error("tape replay: a scripted row out of range");
  return row;
}

export interface TapeReplay {
  /** Each part file's lines, as the shell writes them. */
  readonly parts: readonly (readonly string[])[];
  readonly manifest: readonly string[];
  /** Segments the recorder started. */
  readonly segments: number;
  /** The canonical checksum of the match on its last frame. */
  readonly finalChecksum: string;
}

const must = (ok: boolean, what: string) => {
  if (!ok) throw new Error(`tape replay: ${what}`);
};

/** A rollback match of `frames` frames, paused before frame `pauseAt`, recorded as the shell records one. */
export function recordTapeReplay(frames: number, pauseAt: number): TapeReplay {
  const tape = createTapeWorld({ stocks: 3, humans: 2 });
  const { world, match, controls, runtime } = tape.live;
  const moment = createMomentRecorder();
  const recorder = createMatchReplayRecorder();
  const frameInput = createMatchFrameInput();
  const rows: Slots<InputRow> = [emptyInput(), emptyInput(), emptyInput(), emptyInput()];
  const parts: (readonly string[])[] = [];
  const service = (all: boolean) => {
    continueMatchReplay(recorder);
    const part = takeMatchReplayPart(recorder, all);
    if (part !== undefined) parts.push(replayPartLines(TAPE_REPLAY_SERIAL, recorder.parts, part));
  };
  let segments = 0;
  for (let frame = 1; frame <= frames; frame++) {
    if (frame === pauseAt) {
      // A pause: the shell ends the segment, then clears the attack buffers between frames.
      keepMomentEnd(moment, world, match, controls, runtime);
      endMatchReplaySegment(recorder, moment, world, match, controls, runtime);
      for (const slot of PARTICIPANT_SLOTS) clearAttackBuffer(controls.commands[slot]);
    }
    for (const slot of PARTICIPANT_SLOTS) rows[slot] = scriptedRow(slot, frame);
    must(captureNetworkFrame(frameInput, frame, rows, world, match.humanMask), `frame ${frame} captured`);
    if (beginMatchReplayFrame(recorder, moment, frame, { kind: "network" }, world, match, controls, runtime) !== ReplayBegin.none) segments++;
    beginMomentFrame(moment, frame, world, match, controls, runtime);
    must(executeMatchFrame(frameInput, match, world, controls, runtime, frame), `frame ${frame} ran`);
    for (const slot of PARTICIPANT_SLOTS) if (participantActive(match.humanMask, slot)) recordMomentRow(moment, frame, slot, rows[slot]);
    momentFrameRan(moment, frame);
    matchReplayFrameRan(recorder, moment, frame, world, match, controls, runtime);
    service(false);
  }
  keepMomentEnd(moment, world, match, controls, runtime);
  endMatchReplaySegment(recorder, moment, world, match, controls, runtime);
  const scratch = createReplaySnapshot();
  copyReplayState(scratch, tape.live);
  const finalChecksum = stateChecksum(scratch);
  match.phase = Phase.result;
  while (!matchReplayDone(recorder, match)) service(false);
  const end = finishMatchReplay(recorder, moment, world, match, controls, runtime);
  if (end === undefined) throw new Error("tape replay: the recorder kept nothing");
  service(true);
  const manifest = replayManifestLines({ build: "test", version: "development", serial: TAPE_REPLAY_SERIAL, frame: end.frame, checksum: end.checksum, parts: recorder.parts });
  return { parts, manifest, segments, finalChecksum };
}
