// Native cost trials share the playable input and pooled presentation.
// Only this diagnostic entry adds setup commands and the frame meter.
import { on, trampoline } from "wisp/src/platform/dispatch";
import { startFrameCostCapture } from "wisp/src/platform/frameMeter";
import { PARTICIPANT_SLOTS } from "../game/input/participants";
import { Phase } from "../game/match/rules";
import { parseDecimal } from "../game/netcode/journal/decimal";
import type { MapBuild } from "../game/shell/build";
import { PLAYABLE_BUILD } from "../game/shell/currentBuild";
import { installFrameMeter, startMatchFrameMeter } from "./frameMeter";
import { install as installGame, startBuild } from "./main";
import { shellState } from "./shell/state";

const NATIVE_PERF_BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "typescript-native-perf", devConsole: true };
const CAPTURE_COMMAND = "-dev capture ";
const CAPTURE_HANDLER = "nativePerf.capture";

function captureCommand(): void {
  const state = shellState();
  if (state === undefined || state.game.phase !== Phase.match) throw new Error("start a match before capturing frame cost");
  const text = GetEventPlayerChatString().substring(CAPTURE_COMMAND.length);
  const frames = parseDecimal(text);
  if (frames === undefined || `${frames}` !== text) throw new Error("capture needs a whole frame count");
  const run = startFrameCostCapture(frames);
  DisplayTimedTextToPlayer(GetTriggerPlayer(), 0, 0, 5, `dev: capture run=${run} frames=${frames} match-frame=${state.game.matchFrame}`);
}

export function install(this: void): void {
  installGame(NATIVE_PERF_BUILD);
  installFrameMeter();
  on(CAPTURE_HANDLER, captureCommand);
}

export function start(this: void): void {
  startBuild(NATIVE_PERF_BUILD);
  startMatchFrameMeter();
  on(CAPTURE_HANDLER, captureCommand);
  const chat = CreateTrigger();
  for (const slot of PARTICIPANT_SLOTS) TriggerRegisterPlayerChatEvent(chat, Player(slot), CAPTURE_COMMAND, false);
  TriggerAddAction(chat, trampoline(CAPTURE_HANDLER));
}
