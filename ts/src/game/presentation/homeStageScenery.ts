import { f32 } from "wisp/src/sim/f32";

import { STAGE_SEA_MODEL } from "../assets/terrainAssetInfo";
import { STAGE_SKY_MODELS } from "../assets/stageSkyInfo";
import type { StageScenery } from "./stageScenery";

const SPIRES = "Doodads\\Outland\\Rocks\\Outland_Spires\\Outland_Spires7.mdx";
const TOWN_FIRE = "Doodads\\Cinematic\\TownBurningFireEmitter\\TownBurningFireEmitter.mdx";


export const STRATHOLME_SCENERY: StageScenery = {
  sky: STAGE_SKY_MODELS[6] ?? "",
  fog: { start: 5000.0, end: 11000.0, red: 0.5, green: 0.28125, blue: 0.1875 },
  floor: { model: STAGE_SEA_MODEL, z: -1300.0, color: [104, 51, 42] },
  pieces: [
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingLarge_45_Ruined\\CityBuildingLarge_45_Ruined.mdx", x: -3900.0, y: 4000.0, z: -1300.0, scale: 2.8125, yaw: 15.0, matrixScale: [1.0, 1.0, 1.25] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingSmall45_0_Ruined\\CityBuildingSmall45_0_Ruined.mdx", x: -3040.0, y: 4220.0, z: -1300.0, scale: 3.1875, yaw: 76.0, matrixScale: [1.0, 1.0, 1.25] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingLarge_0_Ruined\\CityBuildingLarge_0_Ruined.mdx", x: -2180.0, y: 4440.0, z: -1300.0, scale: 3.0, yaw: 137.0, matrixScale: [1.0, 1.0, 1.25] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingSmall90_2_Ruined\\CityBuildingSmall90_2_Ruined.mdx", x: -1320.0, y: 4000.0, z: -1300.0, scale: 2.8125, yaw: 198.0, matrixScale: [1.0, 1.0, 1.25] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingLarge_45_Ruined\\CityBuildingLarge_45_Ruined.mdx", x: -460.0, y: 4220.0, z: -1300.0, scale: 3.1875, yaw: 259.0, matrixScale: [1.0, 1.0, 1.25] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingSmall45_0_Ruined\\CityBuildingSmall45_0_Ruined.mdx", x: 400.0, y: 4440.0, z: -1300.0, scale: 3.0, yaw: 320.0, matrixScale: [1.0, 1.0, 1.25] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingLarge_0_Ruined\\CityBuildingLarge_0_Ruined.mdx", x: 1260.0, y: 4000.0, z: -1300.0, scale: 2.8125, yaw: 21.0, matrixScale: [1.0, 1.0, 1.25] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingSmall90_2_Ruined\\CityBuildingSmall90_2_Ruined.mdx", x: 2120.0, y: 4220.0, z: -1300.0, scale: 3.1875, yaw: 82.0, matrixScale: [1.0, 1.0, 1.25] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingLarge_45_Ruined\\CityBuildingLarge_45_Ruined.mdx", x: 2980.0, y: 4440.0, z: -1300.0, scale: 3.0, yaw: 143.0, matrixScale: [1.0, 1.0, 1.25] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingSmall45_0_Ruined\\CityBuildingSmall45_0_Ruined.mdx", x: 3880.0, y: 4000.0, z: -1300.0, scale: 2.8125, yaw: 204.0, matrixScale: [1.0, 1.0, 1.25] },
    { model: SPIRES, x: -3550.0, y: 5300.0, z: -1271.0, scale: 3.0, yaw: 0.0, matrixScale: [2.0, 1.0, 1.25] },
    { model: SPIRES, x: -2400.0, y: 5550.0, z: -1502.0, scale: 3.75, yaw: 53.0, matrixScale: [2.0, 1.0, 1.25] },
    { model: SPIRES, x: -1100.0, y: 5300.0, z: -1171.0, scale: 3.0, yaw: 106.0, matrixScale: [2.0, 1.0, 1.25] },
    { model: SPIRES, x: 300.0, y: 5550.0, z: -1271.0, scale: 3.75, yaw: 159.0, matrixScale: [2.0, 1.0, 1.0] },
    { model: SPIRES, x: 1600.0, y: 5300.0, z: -1416.0, scale: 3.0, yaw: 212.0, matrixScale: [2.0, 1.0, 1.5] },
    { model: SPIRES, x: 2900.0, y: 5550.0, z: -1171.0, scale: 3.75, yaw: 265.0, matrixScale: [2.0, 1.0, 1.0] },
    { model: SPIRES, x: 4000.0, y: 5300.0, z: -1271.0, scale: 3.0, yaw: 318.0, matrixScale: [2.0, 1.0, 1.25] },
    { model: "Doodads\\Cityscape\\Structures\\CathedralRuined\\CathedralRuined.mdx", x: 1500.0, y: 4900.0, z: -1300.0, scale: 4.0, yaw: 250.0 },
    { model: "Doodads\\Cityscape\\Structures\\CityWallEntrance\\CityWallEntrance.mdx", x: -1900.0, y: 3500.0, z: -1350.0, scale: 2.5, yaw: 285.0 },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingSmall135_1_Ruined\\CityBuildingSmall135_1_Ruined.mdx", x: 2450.0, y: 3300.0, z: -1300.0, scale: 2.0625, yaw: 160.0 },
    { model: TOWN_FIRE, x: -1280.0, y: 4300.0, z: -200.0, scale: 1.75, yaw: 0.0 },
    { model: TOWN_FIRE, x: 2160.0, y: 4500.0, z: -150.0, scale: 1.5, yaw: 90.0 },
    { model: "Doodads\\LordaeronFall\\Structures\\AndrohalClockTower_Destroyed\\AndrohalClockTower_Destroyed.mdx", x: -1600.0, y: 7600.0, z: -1800.0, scale: 2.0, yaw: 270.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks2.mdx", x: -1600.0, y: 7600.0, z: -4000.0, scale: 10.0, yaw: 110.0, matrixScale: [1.0, 1.0, f32(2.797)] },
  ],
};


export const TOMB_OF_SARGERAS_SCENERY: StageScenery = {
  sky: STAGE_SKY_MODELS[7] ?? "",
  tint: [96, 144, 152],
  fog: { start: 5000.0, end: 11000.0, red: 0.25, green: 0.4375, blue: 0.46875 },

  heightFog: { start: 5000.0, end: 11000.0, density: 0.25, heightStart: -1800.0, heightEnd: -100.0, maxDensity: 0.375, drawOverSky: false },
  pieces: [
    // Delfino's continuous drowned shoreline, with the temple above the right third.
    { model: "Buildings\\Naga\\TempleOfTides\\TempleOfTides.mdx", x: 1250.0, y: 4000.0, z: -800.0, scale: 4.0, yaw: 250.0 },
    { model: "Doodads\\Ruins\\Structures\\SRuinArch\\SRuinArch.mdx", x: -4000.0, y: 3900.0, z: -1900.0, scale: 5.0, yaw: 90.0, matrixScale: [0.5, 2.0, 1.0] },
    { model: "Doodads\\Ruins\\Structures\\SRuinArch\\SRuinArch.mdx", x: 0.0, y: 4500.0, z: -2150.0, scale: 6.25, yaw: 270.0, matrixScale: [0.5, 2.0, 1.0] },
    { model: "Doodads\\Ruins\\Structures\\SRuinArch\\SRuinArch.mdx", x: 4000.0, y: 4500.0, z: -1400.0, scale: 4.0, yaw: 85.0, matrixScale: [0.5, 2.0, 1.0] },
    { model: "Doodads\\Ruins\\Rocks\\Ruins_Rock\\Ruins_Rock0.mdx", x: 1500.0, y: 4600.0, z: -5150.0, scale: 17.0, yaw: 287.0, matrixScale: [1.0, 1.0, 2.0] },
    // TS-c: the waterfall stays on the left; HD/DE imports replace only its misty model, keeping Classic stock.
    { model: "Doodads\\Terrain\\CliffDoodad\\Waterfall\\Waterfall.mdx", x: -2200.0, y: 3600.0, z: -2200.0, scale: 5.0, yaw: 270.0, matrixScale: [1.0, 1.0, 2.5] },
    { model: "Doodads\\Ruins\\Structures\\SRuinArch\\SRuinArch.mdx", x: -1800.0, y: 3500.0, z: -900.0, scale: 4.0, yaw: 15.0 },
    { model: "Doodads\\Ruins\\Rocks\\Ruins_Rock\\Ruins_Rock0.mdx", x: -3100.0, y: 3900.0, z: -5300.0, scale: 16.0, yaw: 52.0, matrixScale: [1.0, 1.0, 2.0] },
    { model: "Doodads\\Ruins\\Rocks\\Ruins_Rock\\Ruins_Rock0.mdx", x: -850.0, y: 4100.0, z: -5500.0, scale: 14.0, yaw: 145.0, matrixScale: [1.0, 1.0, 2.5] },
    // TS-1/TS-3: coral frames the outer edge rather than stacking another column beneath the waterfall.
    { model: "Doodads\\Ruins\\Water\\Coral\\Coral0.mdx", x: -2500.0, y: 2500.0, z: -2600.0, scale: 3.0, yaw: 300.0, matrixScale: [1.0, 1.0, 4.0] },
    { model: "Doodads\\Ruins\\Rocks\\Ruins_Spires\\Ruins_Spires0.mdx", x: 2400.0, y: 2700.0, z: -2800.0, scale: 3.0, yaw: 140.0, matrixScale: [1.0, 1.0, 3.0] },
    { model: "Doodads\\Ruins\\Rocks\\Ruins_Rock\\Ruins_Rock0.mdx", x: 3250.0, y: 3700.0, z: -5400.0, scale: 12.0, yaw: 205.0, matrixScale: [1.0, 1.0, 3.0] },
  ],
};
