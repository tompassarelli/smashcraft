// Every model a stage's scene creates, so the shell can load them before a match.
import { STAGE_DECK_MODEL, STAGE_DECK_MODELS, STAGE_MAIN_DECK_MODEL } from "../assets/stageAssetInfo";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { surfaceCount } from "../sim/stage";
import { hasCannon, hasTide } from "../sim/stageHazards";
import { hasLava } from "../sim/lava";
import { STAGE_LAVA_MODEL } from "../assets/terrainAssetInfo";
import { CANNON_MODEL, HYDRA_CREST_MODEL, HYDRA_RING_MODEL } from "./stageHazards";
import { placedPieces, stageLightModel, stageScenery } from "./stageScenery";
import { platformParts } from "./stockPlatforms";
import { CARRIED_TEST_STAGE, TOMB_OF_SARGERAS_STAGE, surfacePass } from "../sim/stage";
import { f32 } from "wisp/src/sim/f32";
import { stageEdgeLight, STAGE_EDGE_LIGHT_MODEL } from "./stageEdgeLights";

/** The model drawn for one deck of a stage, in the stage's palette. */
export function deckModel(stage: number, index: number): string {
  const [stock] = platformParts(stage, index);
  if (stock !== undefined) return stock.model;
  const themed = STAGE_DECK_MODELS[stage];
  if (index === 0) return themed === undefined ? STAGE_MAIN_DECK_MODEL : themed.main;
  if (themed?.alternate !== undefined && (stage === CARRIED_TEST_STAGE ? index === 1 : index === 2)) return themed.alternate;
  return themed === undefined ? STAGE_DECK_MODEL : themed.slab;
}

/**
 * The matrix scale the shell gives a deck's palette model `width` wide: a
 * slab's walking plane spans [-50, 50] at z = 0 and its body stays below it;
 * undefined draws the main deck's own model as built from its collision.
 */
export function slabScale(stage: number, index: number, width: number): readonly [x: number, y: number, z: number] | undefined {
  if (index === 0) return undefined;
  const pass = surfacePass(stage, index);
  return [width / 100, pass ? f32(0.65) : 1.0, pass ? stage === TOMB_OF_SARGERAS_STAGE ? 2.0 : f32(0.45) : 1.0];
}

/** The effect models a stage's scene draws: decks, cannon, lava and scenery pieces. */
export function stageModels(stage: number): string[] {
  const models: string[] = [];
  for (let index = 0; index < surfaceCount(stage); index++) {
    models.push(deckModel(stage, index));
    for (const part of platformParts(stage, index).slice(1)) models.push(part.model);
  }
  if (hasCannon(stage)) models.push(CANNON_MODEL);
  if (hasLava(stage)) models.push(STAGE_LAVA_MODEL);
  if (hasTide(stage)) models.push(HYDRA_CREST_MODEL, HYDRA_RING_MODEL);
  for (const piece of placedPieces(stage)) models.push(piece.model);
  if (stageEdgeLight(stage, 0, 0) !== undefined) models.push(STAGE_EDGE_LIGHT_MODEL);
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
