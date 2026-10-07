import { FLOOR_HEIGHT } from "../../game/presentation/arenaCamera";
import { preloadLights, preloadModels, preloadSkies } from "../../game/presentation/stagePreload";
import { stageLightModel, stageScenery } from "../../game/presentation/stageScenery";
import { hideEffect } from "../../game/render/effects";
import type { ShellState } from "./state";

/** Shared handle lifetimes, with purely visual sky, light, fog and backdrop settings. */
export function drawStageScenery(s: ShellState): void {
  for (const effect of s.stageScenery ?? []) {
    BlzSetSpecialEffectPosition(effect, s.origin.x, s.origin.y, s.origin.z - FLOOR_HEIGHT);
    DestroyEffect(effect);
  }
  const scenery = stageScenery(s.game.stageChoice);
  SetSkyModel(scenery.sky);
  const light = stageLightModel(s.game.stageChoice);
  SetDayNightModels(light, light);
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
    BlzSetSpecialEffectYaw(effect, piece.yaw * (Math.PI / 180.0));
    effects.push(effect);
  }
  s.stageScenery = effects;
}

/** Loads every stage's models and skies while the map starts, so no match frame waits on a first load. */
export function preloadStageAssets(s: ShellState): void {
  const { x, y } = s.origin;
  for (const model of preloadModels()) DestroyEffect(AddSpecialEffect(model, x, y));
  for (const sky of preloadSkies()) SetSkyModel(sky);
  for (const light of preloadLights()) SetDayNightModels(light, light);
}

/**
 * `-dev backdrop off` hides the sky, fog, scenery and decks so a capture
 * shows only the fighters: the mask that fighter contrast is measured with
 * (smashcraft:docs/design/visual-quality.md). `on` draws them again.
 */
export function showBackdrop(s: ShellState, visible: boolean): void {
  BlzShowSkyBox(visible);
  const alpha = visible ? 255 : 0;
  const scenery = stageScenery(s.game.stageChoice);
  for (const [index, effect] of (s.stageScenery ?? []).entries()) {
    const piece = scenery.pieces[index];
    if (!visible || piece === undefined) hideEffect(effect, s.origin);
    else {
      BlzSetSpecialEffectPosition(effect, s.origin.x + piece.x, s.origin.y + piece.y, s.origin.z + piece.z);
      BlzSetSpecialEffectScale(effect, piece.scale);
    }
  }
  for (const deck of s.stageDecks) BlzSetSpecialEffectAlpha(deck, alpha);
  const fog = stageScenery(s.game.stageChoice).fog;
  if (visible && fog !== undefined) SetTerrainFogEx(0, fog.start, fog.end, 0.0, fog.red, fog.green, fog.blue);
  else if (visible) ResetTerrainFog();
  else SetTerrainFogEx(0, 100000.0, 200000.0, 0.0, 0.0, 0.0, 0.0);
}

/** Same paused scene, old stock lighting versus the stage's authored lighting. */
export function showStageLighting(s: ShellState, authored: boolean): void {
  if (authored) {
    const light = stageLightModel(s.game.stageChoice);
    SetDayNightModels(light, light);
  } else SetDayNightModels(
    "Environment\\DNC\\DNCLordaeron\\DNCLordaeronTerrain\\DNCLordaeronTerrain.mdl",
    "Environment\\DNC\\DNCLordaeron\\DNCLordaeronUnit\\DNCLordaeronUnit.mdl",
  );
}
