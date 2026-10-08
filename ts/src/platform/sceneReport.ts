// Development and diagnostic builds report the effects they draw, for the
// host's player-view check (wisp:docs/player-view.md). Playable entries never
// import this module, so their bundles carry none of it.
import { installSceneReport, startSceneReport } from "wisp/src/platform/scene";
import { FLOOR_HEIGHT } from "../game/presentation/arenaCamera";
import { HERO_ROSTER } from "../game/sim/heroes/registry";
import { shellState } from "./shell/state";

export { installSceneReport };

/** Starts the report once the runtime is configured, before the shell creates its first effect. */
export function startMatchSceneReport(): void {
  startSceneReport({
    // The confirmed frame stands still in menus, results and a pause.
    frame: () => shellState()?.runtime.simulationFrame ?? 0,
    // AddSpecialEffect creates effects on the ground and hideEffect parks them 4096 below it;
    // stage scenery stands between the two, reaching below the frame (smashcraft:docs/design/stage-art.md, rule 11).
    parked: (_x, _y, z) => {
      const s = shellState();
      if (s === undefined) return false;
      const ground = s.origin.z - FLOOR_HEIGHT;
      return Math.abs(z - ground) < 1.0 || z < ground - 4096.0 + 1.0;
    },
    // Heroes draw with their fighter unit (shell/fighterBody.ts), the original fighters with effects.
    unitModel: (unitType) => HERO_ROSTER.find(({ presentation }) => presentation.objectId === unitType)?.presentation.model,
  });
}
