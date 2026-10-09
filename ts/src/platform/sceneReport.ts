


import { installSceneReport, startSceneReport } from "wisp/src/platform/scene";
import { FLOOR_HEIGHT, HIDDEN_EFFECT_DEPTH } from "../game/presentation/arenaCamera";
import { HERO_ROSTER } from "../game/sim/heroes/registry";
import { shellState } from "./shell/state";

export { installSceneReport };


export function startMatchSceneReport(): void {
  startSceneReport({

    frame: () => shellState()?.runtime.simulationFrame ?? 0,
    // AddSpecialEffect starts at ground level; hideEffect parks it below ground.

    parked: (_x, _y, z) => {
      const s = shellState();
      if (s === undefined) return false;
      const ground = s.origin.z - FLOOR_HEIGHT;
      return Math.abs(z - ground) < 1.0 || z < ground - HIDDEN_EFFECT_DEPTH + 1.0;
    },

    unitModel: (unitType) => HERO_ROSTER.find(({ presentation }) => presentation.objectId === unitType)?.presentation.model,
  });
}
