





import { on, trampoline } from "wisp/src/platform/dispatch";
import { installFrameMeter as installWispFrameMeter, startFrameCostCapture, startFrameMeter } from "wisp/src/platform/frameMeter";
import { PARTICIPANT_SLOTS } from "../game/input/participants";
import { Phase } from "../game/match/rules";
import { parseDecimal } from "../game/netcode/journal/decimal";
import { shellState } from "./shell/state";


const PERF_COMMAND = "-dev perf";

const CAPTURE_COMMAND = "-dev capture ";
const CAPTURE_HANDLER = "frameMeter.capture";

function captureCommand(): void {
  const state = shellState();
  if (state === undefined || state.game.phase !== Phase.match) throw new Error("start a match before capturing frame cost");
  const text = GetEventPlayerChatString().substring(CAPTURE_COMMAND.length);
  const frames = parseDecimal(text);
  if (frames === undefined || `${frames}` !== text) throw new Error("capture needs a whole frame count");
  const run = startFrameCostCapture(frames);
  DisplayTimedTextToPlayer(GetTriggerPlayer(), 0, 0, 5, `dev: capture run=${run} frames=${frames} match-frame=${state.game.matchFrame}`);
}


export function installFrameMeter(): void {
  installWispFrameMeter();
  on(CAPTURE_HANDLER, captureCommand);
}


export function startMatchFrameMeter(): void {
  startFrameMeter({
    frame: "shell.tick",

    simulationFrame: () => shellState()?.runtime.simulationFrame ?? 0,
    toggle: PERF_COMMAND,
  });
  on(CAPTURE_HANDLER, captureCommand);
  const chat = CreateTrigger();
  for (const slot of PARTICIPANT_SLOTS) TriggerRegisterPlayerChatEvent(chat, Player(slot), CAPTURE_COMMAND, false);
  TriggerAddAction(chat, trampoline(CAPTURE_HANDLER));
}
