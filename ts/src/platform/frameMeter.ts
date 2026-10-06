// Development and diagnostic builds measure each frame's cost
// (wisp:docs/frame-cost.md): `-dev perf` shows it to the player who types it,
// and every hot reload reports it to `bun wisp hot --watch` and `bun wisp dev`.
// Playable entries never import this module, so their bundles carry none of it.
import { installFrameMeter, startFrameMeter } from "wisp/src/platform/frameMeter";
import { shellState } from "./shell/state";

export { installFrameMeter };

/** Chat text that shows or hides the frame-cost overlay. */
export const PERF_COMMAND = "-dev perf";

/** Starts the meter once the shell has started: each run of its 60 Hz handler, shell.ts's "shell.tick", ends a frame. */
export function startMatchFrameMeter(): void {
  startFrameMeter({
    frame: "shell.tick",
    // The confirmed frame: what a callback advanced is its catch-up.
    simulationFrame: () => shellState()?.runtime.simulationFrame ?? 0,
    toggle: PERF_COMMAND,
  });
}
