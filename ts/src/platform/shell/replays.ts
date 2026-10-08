// Recording every match as a replay in this client's CustomMapData
// (smashcraft:ts/src/game/replay/matchReplay.ts): parts during the match,
// each written once PART_LINES lines wait, and the manifest at its end. Local:
// every client records the confirmed match it ran and nothing is
// synchronized. A replay shares its serial with its match record.
import { writeLines } from "wisp/src/platform/fileio";
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

/** Writes the open replay's last part and, unless it recorded nothing, its manifest. */
function finishReplay(s: ShellState): void {
  const { recorder, serial } = s.replay;
  const end = finishMatchReplay(recorder, s.moment.recorder, s.world, s.game, s.controls, s.runtime);
  writePart(s, true);
  if (end === undefined) return;
  writeLines(replayFile(serial), replayManifestLines({ build: s.build.id, version: sourceVersion(), serial, frame: end.frame, checksum: end.checksum, parts: recorder.parts }));
}

/** Before the confirmed match runs `frame` and before the moment recorder sees it. */
export function beginReplayFrame(s: ShellState, frame: number): void {
  const { recorder } = s.replay;
  if (recorder.open && frame === 1) finishReplay(s);
  const begun = beginMatchReplayFrame(recorder, s.moment.recorder, frame, momentInput(s.build), s.world, s.game, s.controls, s.runtime);
  if (begun !== ReplayBegin.opened) return;
  const serial = takeMatchSerial();
  s.replay.serial = serial;
  s.replay.recordSerial = serial;
}

/** After the confirmed match ran `frame` and the moment recorded its rows; test builds (with the dev console) record each frame's digest (wisp#69). */
export function replayFrameRan(s: ShellState, frame: number): void {
  matchReplayFrameRan(s.replay.recorder, s.moment.recorder, frame, s.world, s.game, s.controls, s.runtime, s.build.devConsole);
}

/** Before the shell changes the match between frames, beside keepMomentEnd. */
export function endReplaySegment(s: ShellState): void {
  endMatchReplaySegment(s.replay.recorder, s.moment.recorder, s.world, s.game, s.controls, s.runtime);
}

/** Every game callback: the next piece of a starting state, a part once enough lines wait, the manifest once the match left play. */
export function serviceReplay(s: ShellState): void {
  const { recorder } = s.replay;
  if (!recorder.open) return;
  continueMatchReplay(recorder);
  if (matchReplayDone(recorder, s.game)) finishReplay(s);
  else writePart(s, false);
}
