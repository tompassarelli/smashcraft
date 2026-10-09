




import { writeLines } from "wisp/src/platform/fileio";
import { settleNextObservation } from "../../game/match/botPerception";
import {
  ReplayBegin, beginMatchReplayFrame, continueMatchReplay, endMatchReplaySegment,
  finishMatchReplay, matchReplayDone, matchReplayFrameRan, replayManifestLines, replayPartLines, takeMatchReplayPart,
} from "../../game/replay/matchReplay";
import { momentInput } from "../../game/replay/moment";
import { sourceVersion } from "../../game/shell/sourceVersion";
import { replayFile, replayPartFile } from "../../runtime/gameFiles";
import { takeMatchSerial } from "./matchRecords";
import type { ShellState } from "./state";

function writePart(s: ShellState, all: boolean): void {
  const { recorder, serial } = s.replay;
  const lines = takeMatchReplayPart(recorder, all);
  if (lines !== undefined) writeLines(replayPartFile(serial, recorder.parts), replayPartLines(serial, recorder.parts, lines));
}


function finishReplay(s: ShellState): void {
  const { recorder, serial } = s.replay;
  const end = finishMatchReplay(recorder, s.moment.recorder, s.world, s.game, s.controls, s.runtime);
  writePart(s, true);
  if (end === undefined) return;
  writeLines(replayFile(serial), replayManifestLines({ build: s.build.id, version: sourceVersion(), serial, frame: end.frame, checksum: end.checksum, parts: recorder.parts }));
}


export function beginReplayFrame(s: ShellState, frame: number): void {
  const { recorder } = s.replay;
  if (recorder.open && frame === 1) finishReplay(s);
  const begun = beginMatchReplayFrame(recorder, s.moment.recorder, frame, momentInput(s.build), s.world, s.game, s.controls, s.runtime);
  if (begun !== ReplayBegin.opened) return;
  const serial = takeMatchSerial();
  s.replay.serial = serial;
  s.replay.recordSerial = serial;
}


export function replayFrameRan(s: ShellState, frame: number): void {
  matchReplayFrameRan(s.replay.recorder, s.moment.recorder, frame, s.world, s.game, s.controls, s.runtime, s.build.devConsole);
}


export function endReplaySegment(s: ShellState): void {
  endMatchReplaySegment(s.replay.recorder, s.moment.recorder, s.world, s.game, s.controls, s.runtime);
}


export function serviceReplay(s: ShellState): void {
  const { recorder } = s.replay;
  if (!recorder.open) return;
  settleNextObservation(s.runtime.botMemory);
  continueMatchReplay(recorder);
  if (matchReplayDone(recorder, s.game)) finishReplay(s);
  else writePart(s, false);
}
