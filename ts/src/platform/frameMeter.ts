// Development and diagnostic builds measure each frame's cost
// (wisp:docs/frame-cost.md): `-dev perf` shows it to the player who types it,
// and every hot reload reports it to `bun wisp hot --watch` and `bun wisp dev`.
// `-dev capture N` records the next N callbacks' raw costs into each client's
// `smashcraft-perf-capture-pSLOT-runRUN.txt` (wisp:docs/frame-cost.md#a-bounded-native-capture).
// Playable entries never import this module, so their bundles carry none of it.
import { on, trampoline } from "wisp/src/platform/dispatch";
import { installFrameMeter as installWispFrameMeter, startFrameCostCapture, startFrameMeter } from "wisp/src/platform/frameMeter";
import { PARTICIPANT_SLOTS } from "../game/input/participants";
import { Phase } from "../game/match/rules";
import { parseDecimal } from "../game/netcode/journal/decimal";
import { shellState } from "./shell/state";

/** Chat text that shows or hides the frame-cost overlay. */
export const PERF_COMMAND = "-dev perf";
/** Chat text, followed by a whole callback count, that starts a raw frame-cost capture. */
export const CAPTURE_COMMAND = "-dev capture ";
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

/** In every `install()`: the meter, and the capture command's handler for this bundle. */
export function installFrameMeter(): void {
  installWispFrameMeter();
  on(CAPTURE_HANDLER, captureCommand);
}

/** Starts the meter once the shell has started: each run of its 60 Hz handler, shell.ts's "shell.tick", ends a frame. */
export function startMatchFrameMeter(): void {
  startFrameMeter({
    frame: "shell.tick",
    // The confirmed frame: what a callback advanced is its catch-up.
    simulationFrame: () => shellState()?.runtime.simulationFrame ?? 0,
    toggle: PERF_COMMAND,
  });
  on(CAPTURE_HANDLER, captureCommand);
  const chat = CreateTrigger();
  for (const slot of PARTICIPANT_SLOTS) TriggerRegisterPlayerChatEvent(chat, Player(slot), CAPTURE_COMMAND, false);
  TriggerAddAction(chat, trampoline(CAPTURE_HANDLER));
}
