// Every model a stage's scene creates, so the shell can load them before a match.
import { STAGE_DECK_MODEL, STAGE_MAIN_DECK_MODEL } from "../assets/stageAssetInfo";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { surfaceCount } from "../sim/stage";
import { hasCannon } from "../sim/stageHazards";
import { CANNON_MODEL } from "./stageHazards";
import { stageScenery } from "./stageScenery";

/** The model drawn for one deck of a stage. */
export function deckModel(stage: number, index: number): string {
  return index === 0 && !hasCannon(stage) ? STAGE_MAIN_DECK_MODEL : STAGE_DECK_MODEL;
}

/** The effect models a stage's scene draws: decks, cannon and scenery pieces. */
export function stageModels(stage: number): string[] {
  const models: string[] = [];
  for (let index = 0; index < surfaceCount(stage); index++) models.push(deckModel(stage, index));
  if (hasCannon(stage)) models.push(CANNON_MODEL);
  for (const piece of stageScenery(stage).pieces) models.push(piece.model);
  return models;
}

/** Each distinct effect model of every selectable stage. */
export function preloadModels(): string[] {
  const models: string[] = [];
  for (const { id } of STAGE_CATALOG) for (const model of stageModels(id)) if (!models.includes(model)) models.push(model);
  return models;
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
