// Every model a stage's scene creates, so the shell can load them before a match.
import { STAGE_DECK_MODEL, STAGE_DECK_MODELS, STAGE_MAIN_DECK_MODEL } from "../assets/stageAssetInfo";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { surfaceCount } from "../sim/stage";
import { hasCannon } from "../sim/stageHazards";
import { CANNON_MODEL } from "./stageHazards";
import { placedPieces, stageLightModel, stageScenery } from "./stageScenery";

/** The model drawn for one deck of a stage, in the stage's palette. */
export function deckModel(stage: number, index: number): string {
  const themed = STAGE_DECK_MODELS[stage];
  if (index === 0 && !hasCannon(stage)) return themed === undefined ? STAGE_MAIN_DECK_MODEL : themed.main;
  return themed === undefined ? STAGE_DECK_MODEL : themed.slab;
}

/** The effect models a stage's scene draws: decks, cannon and scenery pieces. */
export function stageModels(stage: number): string[] {
  const models: string[] = [];
  for (let index = 0; index < surfaceCount(stage); index++) models.push(deckModel(stage, index));
  if (hasCannon(stage)) models.push(CANNON_MODEL);
  for (const piece of placedPieces(stage, true)) models.push(piece.model);
  return models;
}

/** Each distinct effect model of every selectable stage. */
export function preloadModels(): string[] {
  const models: string[] = [];
  for (const { id } of STAGE_CATALOG) for (const model of stageModels(id)) if (!models.includes(model)) models.push(model);
  return models;
}

/** Each distinct lighting model of every selectable stage. */
export function preloadLights(): string[] {
  const lights: string[] = [];
  for (const { id } of STAGE_CATALOG) {
    const light = stageLightModel(id);
    if (!lights.includes(light)) lights.push(light);
  }
  return lights;
}

/** Each distinct sky of every selectable stage. */
export function preloadSkies(): string[] {
  const skies: string[] = [];
  for (const { id } of STAGE_CATALOG) {
    const { sky } = stageScenery(id);
    if (!skies.includes(sky)) skies.push(sky);
  }
  return skies;
}
