

import { f32 } from "wisp/src/sim/f32";
import { STAGE_WATER_MODEL, STAGE_LAVA_MODEL, STAGE_SEA_MODEL } from "../assets/terrainAssetInfo";
import { LAVA_CENTER_X, LAVA_HALF_WIDTH } from "../sim/lava";
import { SEA_SURFACE_Z } from "../sim/stageHazards";
import { STAGE_POINT_LIGHT_MODELS, STAGE_SNOW_MODEL } from "../assets/stageAssetInfo";
import { STAGE_LIGHTS, type StageLight } from "../assets/stageLighting";
import { min, toInt } from "../../runtime/numbers";
import { STAGE_POINT_LIGHTS } from "../assets/stagePointLights";
import { STAGE_SKY_MODELS } from "../assets/stageSkyInfo";
import { AHNQIRAJ_SCENERY, BLACKROCK_SCENERY, GRYPHON_SCENERY, NORDRASSIL_SCENERY } from "./hazardStageScenery";
import { STRATHOLME_SCENERY, TOMB_OF_SARGERAS_SCENERY } from "./homeStageScenery";
import { DUROTAR_SCENERY, HELLFIRE_SCENERY, NAXXRAMAS_SCENERY } from "./patrolStageScenery";
import { CANNON_TEST_STAGE, CARRIED_TEST_STAGE, DRIFTING_DECK_STAGE, FROZEN_THRONE_STAGE, HELLFIRE_STAGE, PATTERNED_DECKS_STAGE, STRATHOLME_STAGE, TIMED_TEST_STAGE, TOMB_OF_SARGERAS_STAGE, WIND_TEST_STAGE } from "../sim/stage";

export interface SceneryPiece {
  readonly model: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly scale: number;

  readonly yaw: number;
  readonly matrixScale?: readonly [number, number, number];
  readonly color?: readonly [number, number, number];
  readonly flying?: true;
}

export interface StageScenery {
  readonly sky: string;
  readonly pieces: readonly SceneryPiece[];
  /** The pieces' colour under the stock light, before the stage's mood (sceneryColor). */
  readonly tint?: readonly [number, number, number];
  readonly fog?: { readonly start: number; readonly end: number; readonly red: number; readonly green: number; readonly blue: number };
  /** #360: an opaque full-width surface far below the bottom blast zone; it hides the bases of the pieces that stand in it. */
  readonly floor?: { readonly model: string; readonly z: number; readonly color: readonly [number, number, number] };
  readonly heightFog?: {
    readonly start: number;
    readonly end: number;
    readonly density: number;

    readonly heightStart: number;
    readonly heightEnd: number;
    readonly maxDensity: number;
    readonly drawOverSky: boolean;
  };
}


const SUMMER: StageScenery = {
  sky: STAGE_SKY_MODELS[0] ?? "",
  fog: { start: 6000.0, end: 12000.0, red: 0.6875, green: 0.8125, blue: 0.9375 },
  pieces: [],
};

const FROZEN_THRONE: StageScenery = {
  sky: STAGE_SKY_MODELS[2] ?? "",

  fog: { start: 5000.0, end: 11000.0, red: 0.375, green: 0.625, blue: 0.875 },
  pieces: [

    { model: "Doodads\\Cinematic\\FrozenThrone\\FrozenThrone.mdx", x: 1900.0, y: 6500.0, z: -2620.0, scale: 0.5, yaw: 250.0, matrixScale: [1.0, 1.0, f32(1.763)] },
    { model: "Doodads\\Icecrown\\Rocks\\Glacier\\Glacier0.mdx", x: -1900.0, y: 3700.0, z: -2560.0, scale: 3.5, yaw: 20.0, matrixScale: [1.0, 1.0, f32(1.788)] },
    { model: "Doodads\\Icecrown\\Rocks\\Glacier\\Glacier5.mdx", x: 2300.0, y: 2900.0, z: -2300.0, scale: 2.25, yaw: 140.0, matrixScale: [1.0, 1.0, f32(3.206)] },
    { model: "Doodads\\Icecrown\\Rocks\\Icecrown_Crystal\\Icecrown_Crystal0.mdx", x: -1750.0, y: 2700.0, z: -2290.0, scale: 1.5, yaw: 300.0, matrixScale: [1.0, 1.0, f32(3.187)] },
    { model: "Doodads\\Icecrown\\Rocks\\Icecrown_Crystal\\Icecrown_Crystal3.mdx", x: 500.0, y: 4300.0, z: -3195.0, scale: f32(1.7), yaw: 75.0, matrixScale: [1.0, 1.0, f32(6.933)] },
    { model: "Doodads\\Icecrown\\Props\\IceTorch\\IceTorch.mdx", x: -2200.0, y: 3000.0, z: -1000.0, scale: 1.25, yaw: 270.0 },
    { model: "Doodads\\Icecrown\\Rocks\\Glacier\\Glacier5.mdx", x: -2185.0, y: 3000.0, z: -2500.0, scale: f32(1.05), yaw: 307.0, matrixScale: [1.0, 1.0, f32(6.489)] },
    { model: STAGE_SNOW_MODEL, x: 0.0, y: 4000.0, z: 0.0, scale: 1.0, yaw: 0.0 },
  ],
};

/** Every stage draws with the stock Lordaeron light, so fighters are lit as at stock (#375). */
export const STOCK_TERRAIN_LIGHT = "Environment\\DNC\\DNCLordaeron\\DNCLordaeronTerrain\\DNCLordaeronTerrain.mdl";
export const STOCK_UNIT_LIGHT = "Environment\\DNC\\DNCLordaeron\\DNCLordaeronUnit\\DNCLordaeronUnit.mdl";

/**
 * A scenery colour under the stage's mood: the stage light (stageLighting.ts)
 * divided by the stock noon light, its first entry, averaging key and fill.
 * Only scenery takes it; the fighters keep the stock light.
 */
export function sceneryColor(stage: number, color: readonly [number, number, number]): readonly [number, number, number] {
  return moodColor(STAGE_LIGHTS.find(entry => entry.stage === stage)?.light, color);
}

export function moodColor(light: StageLight | undefined, color: readonly [number, number, number]): readonly [number, number, number] {
  const stock = STAGE_LIGHTS[0]?.light;
  if (stock === undefined || light === undefined) return color;
  const intensity = light.intensity ?? 1.0;
  const channel = (index: 0 | 1 | 2) => min(255, toInt(f32(f32(f32(color[index] * f32(intensity * (light.key[index] + light.ambient[index]))) / (stock.key[index] + stock.ambient[index])) + 0.5)));
  return [channel(0), channel(1), channel(2)];
}

export function stageScenery(stage: number): StageScenery {
  if (stage === FROZEN_THRONE_STAGE) return FROZEN_THRONE;
  if (stage === WIND_TEST_STAGE) return NORDRASSIL_SCENERY;
  if (stage === CARRIED_TEST_STAGE) return GRYPHON_SCENERY;
  if (stage === DRIFTING_DECK_STAGE) return DUROTAR_SCENERY;
  if (stage === PATTERNED_DECKS_STAGE) return NAXXRAMAS_SCENERY;
  if (stage === HELLFIRE_STAGE) return HELLFIRE_SCENERY;
  if (stage === CANNON_TEST_STAGE) return BLACKROCK_SCENERY;
  if (stage === TIMED_TEST_STAGE) return AHNQIRAJ_SCENERY;
  if (stage === STRATHOLME_STAGE) return STRATHOLME_SCENERY;
  if (stage === TOMB_OF_SARGERAS_STAGE) return TOMB_OF_SARGERAS_SCENERY;
  return SUMMER;
}


export function terrainPieces(stage: number): readonly SceneryPiece[] {
  if (stage === TOMB_OF_SARGERAS_STAGE) return [
    { model: STAGE_WATER_MODEL, x: 0.0, y: 0.0, z: 1.0, scale: 1.0, matrixScale: [12.0, 1.0, 1.0], yaw: 0.0 },
    // The sea extends beneath the camera so it reads as a surface, rather than a narrow tile.
    { model: STAGE_SEA_MODEL, x: 0.0, y: 2200.0, z: SEA_SURFACE_Z, scale: 1.0,
      matrixScale: [240.0, 140.0, 1.0], color: [176, 160, 144], yaw: 0.0 },
  ];
  const floor = stageScenery(stage).floor;
  if (floor !== undefined) return [
    { model: floor.model, x: 0.0, y: 2200.0, z: floor.z, scale: 1.0, matrixScale: [240.0, 140.0, 1.0], color: floor.color, yaw: 0.0 },
  ];
  return [];
}

export function hiddenBelow(stage: number): number | undefined {
  return stage === TOMB_OF_SARGERAS_STAGE ? SEA_SURFACE_Z : stageScenery(stage).floor?.z;
}

export function lavaPiece(side: -1 | 1): SceneryPiece {
  return { model: STAGE_LAVA_MODEL, x: side * LAVA_CENTER_X, y: 0.0, z: 1.0, scale: 1.0, matrixScale: [(2 * LAVA_HALF_WIDTH) / 100, 1.0, 1.0], yaw: 0.0 };
}


export function pointLightPieces(stage: number): readonly SceneryPiece[] {
  const models = STAGE_POINT_LIGHT_MODELS[stage] ?? [];
  const lights = STAGE_POINT_LIGHTS.find(entry => entry.stage === stage)?.lights ?? [];
  return lights.map((light, index) => ({ model: models[index] ?? "", x: light.x, y: light.y, z: light.z, scale: 1.0, yaw: 0.0 }));
}


export function shadowCastingLights(stage: number): number {
  return (STAGE_POINT_LIGHTS.find(entry => entry.stage === stage)?.lights ?? []).filter(light => light.castsShadow).length;
}

/** Every effect a stage's scene places, in the order the shell creates them. */
export function placedPieces(stage: number, mood = true): readonly SceneryPiece[] {
  const scenery = stageScenery(stage);
  const pieces = scenery.pieces.map(piece => {
    const color = scenery.tint ?? piece.color ?? [255, 255, 255] as const;
    return { ...piece, color: mood ? sceneryColor(stage, color) : color };
  });
  return [...pieces, ...terrainPieces(stage), ...pointLightPieces(stage)];
}
