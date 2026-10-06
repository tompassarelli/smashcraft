// The host's playtest request (smashcraft:ts/src/game/shell/playtest.ts).
// `bun wisp play` leaves the request in CustomMapData before Warcraft starts
// and a go-ahead once the player's controller helper runs. The first human's
// client reads the request once at map start; only with one does it look for
// the go-ahead at fighter selection, twice a second, so a normal session
// reads no file there (a missing file's lookup reads all of CustomMapData
// under Wine). The request's line then goes to every client, and each adds
// the computers, starts the match and writes its receipt. Preloader keeps a
// file's first content for the session, so one request is taken per session.
import { isParticipantSlot } from "../../game/input/participants";
import { Phase, firstHumanSlot } from "../../game/match/rules";
import { parsePlaytestRequest } from "../../game/shell/playtest";
import { PLAYTEST_GO_FILE, PLAYTEST_REQUEST_FILE, playtestReceiptFile } from "../../runtime/gameFiles";
import { readChunk, writeLine } from "wisp/src/platform/fileio";
import { startPlaytest } from "./menus";
import { type ShellState, localSlot } from "./state";

export const PLAYTEST = "shell.playtest";
export const PLAYTEST_PREFIX = "SC_PLAY";
const LOOK_FRAMES = 30;

declare global {
  var __smashcraftPlaytest: { request: string | undefined; looked: number; sent: boolean } | undefined;
}

const progress = () => (globalThis.__smashcraftPlaytest ??= { request: undefined, looked: 0, sent: false });

/** At map start, on the first human's client: the host's request, if it left one. */
export function readPlaytestRequest(s: ShellState): void {
  if (firstHumanSlot(s.game) !== localSlot()) return;
  const line = readChunk(PLAYTEST_REQUEST_FILE);
  progress().request = line !== undefined && parsePlaytestRequest(line) !== undefined ? line : undefined;
}

/** Every game callback: with a request, look for the go-ahead at fighter selection until the request is sent. */
export function servicePlaytestRequest(s: ShellState): void {
  const state = progress();
  if (state.request === undefined || state.sent || s.game.phase !== Phase.characterMenu) return;
  if (++state.looked < LOOK_FRAMES) return;
  state.looked = 0;
  if (readChunk(PLAYTEST_GO_FILE) === undefined) return;
  state.sent = true;
  BlzSendSyncData(PLAYTEST_PREFIX, state.request);
}

/** The request's line arrived on this client: from the first human only. */
export function playtestRequested(s: ShellState): void {
  if (GetPlayerId(GetTriggerPlayer()) !== firstHumanSlot(s.game)) return;
  const line = BlzGetTriggerSyncData();
  const computers = parsePlaytestRequest(line);
  const started = computers !== undefined && startPlaytest(s, computers);
  const slot = localSlot();
  if (isParticipantSlot(slot)) writeLine(playtestReceiptFile(slot), `${line} ${started ? "started" : "refused"}`);
}
