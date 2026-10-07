// Stage scenery is presentation only: arena coordinates never become collision.
// Composition rules (asymmetric dressing, depth bands, motion budget): smashcraft:docs/design/stage-art.md.
import { STAGE_LIGHT_MODELS, STAGE_SNOW_MODEL } from "../assets/stageAssetInfo";
import { AHNQIRAJ_SCENERY, BLACKROCK_SCENERY, GRYPHON_SCENERY, NORDRASSIL_SCENERY } from "./hazardStageScenery";
import { DUROTAR_SCENERY, HELLFIRE_SCENERY, NAXXRAMAS_SCENERY } from "./patrolStageScenery";
import { CANNON_TEST_STAGE, CARRIED_TEST_STAGE, DRIFTING_DECK_STAGE, FROZEN_THRONE_STAGE, HELLFIRE_STAGE, PATTERNED_DECKS_STAGE, TIMED_TEST_STAGE, WIND_TEST_STAGE } from "../sim/stage";

export interface SceneryPiece {
  readonly model: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly scale: number;
  /** Facing in degrees, counterclockwise from +x; the camera looks along +y, so 270 faces it. */
  readonly yaw: number;
}

export interface StageScenery {
  readonly sky: string;
  readonly pieces: readonly SceneryPiece[];
  readonly fog?: { readonly start: number; readonly end: number; readonly red: number; readonly green: number; readonly blue: number };
}

/** The practice stage keeps a plain sky as the neutral baseline. */
const SUMMER: StageScenery = {
  sky: "Environment\\Sky\\LordaeronSummerSky\\LordaeronSummerSky.mdl",
  fog: { start: 6000.0, end: 12000.0, red: 0.6875, green: 0.8125, blue: 0.9375 },
  pieces: [],
};

const FROZEN_THRONE: StageScenery = {
  sky: "Environment\\Sky\\LordaeronWinterSky\\LordaeronWinterSky.mdl",
  // Fog begins beyond the fighting plane; the deck and fighters retain their contrast.
  fog: { start: 5000.0, end: 11000.0, red: 0.375, green: 0.625, blue: 0.875 },
  pieces: [
    // Landmark on the right third; a broad glacier wall counterweights it on the left.
    { model: "Doodads\\Cinematic\\FrozenThrone\\FrozenThrone.mdx", x: 1300.0, y: 6500.0, z: -1600.0, scale: 1.0, yaw: 250.0 },
    { model: "Doodads\\Icecrown\\Rocks\\Glacier\\Glacier0.mdx", x: -1900.0, y: 3700.0, z: -1300.0, scale: 3.5, yaw: 20.0 },
    { model: "Doodads\\Icecrown\\Rocks\\Glacier\\Glacier5.mdx", x: 2300.0, y: 2900.0, z: -1200.0, scale: 2.25, yaw: 140.0 },
    { model: "Doodads\\Icecrown\\Rocks\\Icecrown_Crystal\\Icecrown_Crystal0.mdx", x: -1150.0, y: 2300.0, z: -600.0, scale: 2.25, yaw: 300.0 },
    { model: "Doodads\\Icecrown\\Rocks\\Icecrown_Crystal\\Icecrown_Crystal3.mdx", x: 500.0, y: 4300.0, z: -900.0, scale: 1.5, yaw: 75.0 },
    { model: "Doodads\\Icecrown\\Props\\IceTorch\\IceTorch.mdx", x: -1550.0, y: 2100.0, z: -100.0, scale: 2.0, yaw: 270.0 },
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
  return SUMMER;
}
