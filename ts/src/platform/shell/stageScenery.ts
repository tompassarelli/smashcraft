import { preloadLights, preloadModels, preloadSkies } from "../../game/presentation/stagePreload";
import { placedPieces, shadowCastingLights, stageLightModel, stageScenery } from "../../game/presentation/stageScenery";
import { hideEffect } from "../../game/render/effects";
import type { ShellState } from "./state";

let shadowLightsRaised = false;

/** Shared handle lifetimes, with purely visual sky, light, fog and backdrop settings. */
export function drawStageScenery(s: ShellState): void {
  for (const effect of s.stageScenery ?? []) {
    // DestroyEffect plays the model's death sequence before disposal.
    hideEffect(effect, s.origin);
    DestroyEffect(effect);
  }
  const scenery = stageScenery(s.game.stageChoice);
  // Stages float: no ground shows beneath the deck (smashcraft:docs/design/stage-art.md, rule 11).
  BlzShowTerrain(false);
  SetSkyModel(scenery.sky);
  const light = stageLightModel(s.game.stageChoice);
  SetDayNightModels(light, light);
  if (scenery.fog === undefined) ResetTerrainFog();
  else {
    const { start, end, red, green, blue } = scenery.fog;
    SetTerrainFogEx(0, start, end, 0.0, red, green, blue);
  }
  // Set only once a stage with a shadow-casting light has raised it, then back to none.
  const shadows = shadowCastingLights(s.game.stageChoice);
  if (shadows > 0 || shadowLightsRaised) BlzSetMinShadowCastingPointLightCount(shadows);
  shadowLightsRaised = shadows > 0;
  const effects: effect[] = [];
  for (const piece of placedPieces(s.game.stageChoice, s.game.hazards)) {
    const x = s.origin.x + piece.x;
    const y = s.origin.y + piece.y;
    const effect = AddSpecialEffect(piece.model, x, y);
    BlzSetSpecialEffectPosition(effect, x, y, s.origin.z + piece.z);
    BlzSetSpecialEffectScale(effect, piece.scale);
    if (piece.matrixScale !== undefined) BlzSetSpecialEffectMatrixScale(effect, piece.matrixScale[0], piece.matrixScale[1], piece.matrixScale[2]);
    BlzSetSpecialEffectYaw(effect, piece.yaw * (Math.PI / 180.0));
    effects.push(effect);
  }
  s.stageScenery = effects;
}

/** Loads every stage's models and skies while the map starts, so no match frame waits on a first load. */
export function preloadStageAssets(s: ShellState): void {
  const { x, y } = s.origin;
  for (const model of preloadModels()) {
    const effect = AddSpecialEffect(model, x, y);
    hideEffect(effect, s.origin);
    DestroyEffect(effect);
  }
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
  const pieces = placedPieces(s.game.stageChoice, s.game.hazards);
  for (const [index, effect] of (s.stageScenery ?? []).entries()) {
    const piece = pieces[index];
    if (!visible || piece === undefined) hideEffect(effect, s.origin);
    else {
      BlzSetSpecialEffectPosition(effect, s.origin.x + piece.x, s.origin.y + piece.y, s.origin.z + piece.z);
      BlzSetSpecialEffectScale(effect, piece.scale);
      if (piece.matrixScale !== undefined) BlzSetSpecialEffectMatrixScale(effect, piece.matrixScale[0], piece.matrixScale[1], piece.matrixScale[2]);
    }
  }
  for (const deck of [...s.stageDecks, ...s.stageDeckParts]) BlzSetSpecialEffectAlpha(deck, alpha);
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
