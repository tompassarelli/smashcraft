








import { isParticipantSlot } from "../../game/input/participants";
import { Phase, firstHumanSlot } from "../../game/match/rules";
import { parsePlaytestRequest } from "../../game/shell/playtest";
import { PLAYTEST_GO_FILE, PLAYTEST_REQUEST_FILE, playtestReceiptFile } from "../../runtime/gameFiles";
import { readChunk, writeLine } from "wisp/src/platform/fileio";
import { startPlaytest } from "./menus";
import { type ShellState, localSlot, playtestProgress } from "./state";

export const PLAYTEST = "shell.playtest";
export const PLAYTEST_PREFIX = "SC_PLAY";
const LOOK_FRAMES = 30;


export function readPlaytestRequest(s: ShellState): void {
  if (firstHumanSlot(s.game) !== localSlot()) return;
  const line = readChunk(PLAYTEST_REQUEST_FILE);
  playtestProgress().request = line !== undefined && parsePlaytestRequest(line) !== undefined ? line : undefined;
}


export function servicePlaytestRequest(s: ShellState): void {
  const state = playtestProgress();
  if (state.request === undefined || state.sent || s.game.phase !== Phase.characterMenu) return;
  if (++state.looked < LOOK_FRAMES) return;
  state.looked = 0;
  if (readChunk(PLAYTEST_GO_FILE) === undefined) return;
  state.sent = true;
  BlzSendSyncData(PLAYTEST_PREFIX, state.request);
}


export function playtestRequested(s: ShellState): void {
  if (GetPlayerId(GetTriggerPlayer()) !== firstHumanSlot(s.game)) return;
  const line = BlzGetTriggerSyncData();
  const request = parsePlaytestRequest(line);
  const started = !playtestProgress().cancelled && request !== undefined && startPlaytest(s, request);
  const slot = localSlot();
  if (isParticipantSlot(slot)) writeLine(playtestReceiptFile(slot), `${line} ${started ? "started" : "refused"}`);
}
