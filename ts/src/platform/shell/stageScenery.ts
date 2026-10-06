import { FLOOR_HEIGHT } from "../../game/presentation/arenaCamera";
import { stageScenery } from "../../game/presentation/stageScenery";
import type { ShellState } from "./state";

/** Shared handle lifetimes, with purely visual sky, fog and backdrop settings. */
export function drawStageScenery(s: ShellState): void {
  for (const effect of s.stageScenery ?? []) {
    BlzSetSpecialEffectPosition(effect, s.origin.x, s.origin.y, s.origin.z - FLOOR_HEIGHT);
    DestroyEffect(effect);
  }
  const scenery = stageScenery(s.game.stageChoice);
  SetSkyModel(scenery.sky);
  if (scenery.fog === undefined) ResetTerrainFog();
  else {
    const { start, end, red, green, blue } = scenery.fog;
    SetTerrainFogEx(0, start, end, 0.0, red, green, blue);
  }
  const effects: effect[] = [];
  for (const piece of scenery.pieces) {
    const x = s.origin.x + piece.x;
    const y = s.origin.y + piece.y;
    const effect = AddSpecialEffect(piece.model, x, y);
    BlzSetSpecialEffectPosition(effect, x, y, s.origin.z + piece.z);
    BlzSetSpecialEffectScale(effect, piece.scale);
    effects.push(effect);
  }
  s.stageScenery = effects;
}
