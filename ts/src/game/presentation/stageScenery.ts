// Stage scenery is presentation only: arena coordinates never become collision.
// Composition rules (asymmetric dressing, depth bands, motion budget): smashcraft:docs/design/stage-art.md.
import { f32 } from "wisp/src/sim/f32";
import { STAGE_WATER_MODEL, STAGE_LAVA_MODEL } from "../assets/terrainAssetInfo";
import { LAVA_INNER_X } from "../sim/lava";
import { STAGE_LIGHT_MODELS, STAGE_POINT_LIGHT_MODELS, STAGE_SNOW_MODEL } from "../assets/stageAssetInfo";
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
  /** Facing in degrees, counterclockwise from +x; the camera looks along +y, so 270 faces it. */
  readonly yaw: number;
  readonly matrixScale?: readonly [number, number, number];
}

export interface StageScenery {
  readonly sky: string;
  readonly pieces: readonly SceneryPiece[];
  readonly fog?: { readonly start: number; readonly end: number; readonly red: number; readonly green: number; readonly blue: number };
  readonly heightFog?: {
    readonly start: number;
    readonly end: number;
    readonly density: number;
    /** Heights relative to the arena origin, below the fighting deck. */
    readonly heightStart: number;
    readonly heightEnd: number;
    readonly maxDensity: number;
    readonly drawOverSky: boolean;
  };
}

/** The practice stage keeps a plain sky as the neutral baseline. */
const SUMMER: StageScenery = {
  sky: STAGE_SKY_MODELS[0] ?? "",
  fog: { start: 6000.0, end: 12000.0, red: 0.6875, green: 0.8125, blue: 0.9375 },
  pieces: [],
};

const FROZEN_THRONE: StageScenery = {
  sky: STAGE_SKY_MODELS[2] ?? "",
  // Fog begins beyond the fighting plane; the deck and fighters retain their contrast.
  fog: { start: 5000.0, end: 11000.0, red: 0.375, green: 0.625, blue: 0.875 },
  pieces: [
    // Landmark on the right third; a broad glacier wall counterweights it on the left.
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

/** The stage's day/night lighting model (stageLighting.ts); a stage without its own takes the neutral one. */
export function stageLightModel(stage: number): string {
  return STAGE_LIGHT_MODELS[stage] ?? STAGE_LIGHT_MODELS[0] ?? "";
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

/** Visible liquid sits within its contact surface; background pieces keep their own depth bands. */
export function terrainPieces(stage: number, hazards: boolean): readonly SceneryPiece[] {
  if (stage === TOMB_OF_SARGERAS_STAGE) return [{ model: STAGE_WATER_MODEL, x: 0.0, y: 0.0, z: 1.0, scale: 1.0, matrixScale: [12.0, 1.0, 1.0], yaw: 0.0 }];
  if (stage !== CANNON_TEST_STAGE || !hazards) return [];
  const width = 600.0 - LAVA_INNER_X;
  const x = LAVA_INNER_X + width / 2;
  return [-x, x].map(position => ({ model: STAGE_LAVA_MODEL, x: position, y: 0.0, z: 1.0, scale: 1.0, matrixScale: [width / 100, 1.0, 1.0] as const, yaw: 0.0 }));
}

/** A stage's backdrop omni lights (stagePointLights.ts), placed as light-only models. */
export function pointLightPieces(stage: number): readonly SceneryPiece[] {
  const models = STAGE_POINT_LIGHT_MODELS[stage] ?? [];
  const lights = STAGE_POINT_LIGHTS.find(entry => entry.stage === stage)?.lights ?? [];
  return lights.map((light, index) => ({ model: models[index] ?? "", x: light.x, y: light.y, z: light.z, scale: 1.0, yaw: 0.0 }));
}

/** How many of a stage's point lights cast shadows. */
export function shadowCastingLights(stage: number): number {
  return (STAGE_POINT_LIGHTS.find(entry => entry.stage === stage)?.lights ?? []).filter(light => light.castsShadow).length;
}

/** Every effect a stage's scene places, in the order the shell creates them. */
export function placedPieces(stage: number, hazards: boolean): readonly SceneryPiece[] {
  return [...stageScenery(stage).pieces, ...terrainPieces(stage, hazards), ...pointLightPieces(stage)];
}
