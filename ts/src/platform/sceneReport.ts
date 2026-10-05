// Development and diagnostic builds report the effects they draw, for the
// host's player-view check (wisp:docs/player-view.md). Playable entries never
// import this module, so their bundles carry none of it.
import { installSceneReport, startSceneReport } from "wisp/src/platform/scene";
import { FLOOR_HEIGHT } from "../game/render/effects";
import { shellState } from "./shell/state";

export { installSceneReport };

/** Starts the report once the runtime is configured, before the shell creates its first effect. */
export function startMatchSceneReport(): void {
  startSceneReport({
    // The confirmed frame stands still in menus, results and a pause.
    frame: () => shellState()?.runtime.simulationFrame ?? 0,
    // hideEffect parks effects on the ground beneath the floor, where AddSpecialEffect also creates them.
    parked: (_x, _y, z) => {
      const s = shellState();
      return s !== undefined && z < s.origin.z - FLOOR_HEIGHT + 1.0;
    },
  });
}
