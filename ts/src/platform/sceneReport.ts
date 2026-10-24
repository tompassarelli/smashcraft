


import { installSceneReport, startSceneReport } from "wisp/src/platform/scene";
import { FLOOR_HEIGHT, HIDDEN_EFFECT_DEPTH } from "../game/presentation/arenaCamera";
import { HERO_ROSTER } from "../game/sim/heroes/registry";
import { shellState } from "../host/loop/state";
import { presentedFrame } from "../host/loop/presentedMatch";
import { heroLook } from "../game/roster/looks";

export { installSceneReport };


export function startMatchSceneReport(): void {
  startSceneReport({

    // Pool-predicted play places effects at the speculative frame; confirmed frames arrive in bursts with remote input.
    frame: () => { const s = shellState(); return s === undefined ? 0 : presentedFrame(s); },
    // AddSpecialEffect starts at ground level; hideEffect parks it below ground.

    parked: (_x, _y, z) => {
      const s = shellState();
      if (s === undefined) return true;
      const ground = s.origin.z - FLOOR_HEIGHT;
      return Math.abs(z - ground) < 1.0 || z < ground - HIDDEN_EFFECT_DEPTH + 1.0;
    },

    unitModel: (unitType) => HERO_ROSTER.map(({ character }) => heroLook(character)).find((look) => look?.objectId === unitType)?.model,
  });
}
