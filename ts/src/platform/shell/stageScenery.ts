import { preloadModels, preloadSkies } from "../../game/presentation/stagePreload";
import { STOCK_TERRAIN_LIGHT, STOCK_UNIT_LIGHT, placedPieces, shadowCastingLights, stageScenery } from "../../game/presentation/stageScenery";
import { hideEffect } from "../../game/render/effects";
import type { ShellState } from "./state";

function drawStageFog(s: ShellState): void {
  const scenery = stageScenery(s.game.stageChoice);
  // Fog settings persist between stages and contrast-mask captures.
  BlzSetTerrainFogMaxLinearDensity(1.0);
  BlzSetTerrainFogDrawOverSky(false);
  const fog = scenery.fog;
  if (fog === undefined) { ResetTerrainFog(); return; }
  SetTerrainFogEx(0, fog.start, fog.end, 0.0, fog.red, fog.green, fog.blue);
  const height = scenery.heightFog;
  if (height === undefined) return;
  SetTerrainFogExV(3, height.start, height.end, height.density,
    s.origin.z + height.heightStart, s.origin.z + height.heightEnd,
    fog.start, fog.end, fog.red, fog.green, fog.blue);
  BlzSetTerrainFogMaxLinearDensity(height.maxDensity);
  BlzSetTerrainFogDrawOverSky(height.drawOverSky);
}

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
  SetDayNightModels(STOCK_TERRAIN_LIGHT, STOCK_UNIT_LIGHT);
  drawStageFog(s);
  // Set only once a stage with a shadow-casting light has raised it, then back to none.
  const shadows = shadowCastingLights(s.game.stageChoice);
  if (shadows > 0 || s.shadowLightsRaised) BlzSetMinShadowCastingPointLightCount(shadows);
  s.shadowLightsRaised = shadows > 0;
  const effects: effect[] = [];
  for (const piece of placedPieces(s.game.stageChoice)) {
    const x = s.origin.x + piece.x;
    const y = s.origin.y + piece.y;
    const effect = AddSpecialEffect(piece.model, x, y);
    BlzSetSpecialEffectPosition(effect, x, y, s.origin.z + piece.z);
    BlzSetSpecialEffectScale(effect, piece.scale);
    if (piece.color !== undefined) BlzSetSpecialEffectColor(effect, piece.color[0], piece.color[1], piece.color[2]);
    if (piece.matrixScale !== undefined) BlzSetSpecialEffectMatrixScale(effect, piece.matrixScale[0], piece.matrixScale[1], piece.matrixScale[2]);
    BlzSetSpecialEffectYaw(effect, piece.yaw * (Math.PI / 180.0));
    // An effect plays Birth first; the Temple of Tides' 60-second construction Birth hides its whole body (#263).
    BlzPlaySpecialEffect(effect, ANIM_TYPE_STAND);
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
}

/**
 * `-dev backdrop off` hides the sky, fog, scenery and decks so a capture
 * shows only the fighters: the mask that fighter contrast is measured with
 * (smashcraft:docs/design/visual-quality.md). `on` draws them again.
 */
export function showBackdrop(s: ShellState, visible: boolean): void {
  BlzShowSkyBox(visible);
  const alpha = visible ? 255 : 0;
  const pieces = placedPieces(s.game.stageChoice);
  for (const [index, effect] of (s.stageScenery ?? []).entries()) {
    const piece = pieces[index];
    if (!visible || piece === undefined) hideEffect(effect, s.origin);
    else {
      BlzSetSpecialEffectPosition(effect, s.origin.x + piece.x, s.origin.y + piece.y, s.origin.z + piece.z);
      BlzSetSpecialEffectScale(effect, piece.scale);
      // Matrix scales multiply: reset before reapplying, or each toggle stacks the stretch.
      if (piece.matrixScale !== undefined) {
        BlzResetSpecialEffectMatrix(effect);
        BlzSetSpecialEffectMatrixScale(effect, piece.matrixScale[0], piece.matrixScale[1], piece.matrixScale[2]);
        BlzSetSpecialEffectYaw(effect, piece.yaw * (Math.PI / 180.0));
      }
    }
  }
  for (const deck of [...s.stageDecks, ...s.stageDeckParts]) BlzSetSpecialEffectAlpha(deck, alpha);
  showStageFog(s, visible);
}

/** The stage's own fog, or none: linear fog pushed past the far clip. */
export function showStageFog(s: ShellState, visible: boolean): void {
  if (visible) drawStageFog(s);
  else {
    BlzSetTerrainFogMaxLinearDensity(1.0);
    BlzSetTerrainFogDrawOverSky(false);
    SetTerrainFogEx(0, 100000.0, 200000.0, 0.0, 0.0, 0.0, 0.0);
  }
}

/** Same paused scene, the scenery's stock colours versus the stage's mood; the fighters' light never changes. */
export function showStageLighting(s: ShellState, authored: boolean): void {
  const pieces = placedPieces(s.game.stageChoice, authored);
  for (const [index, effect] of (s.stageScenery ?? []).entries()) {
    const color = pieces[index]?.color;
    if (color !== undefined) BlzSetSpecialEffectColor(effect, color[0], color[1], color[2]);
  }
}
