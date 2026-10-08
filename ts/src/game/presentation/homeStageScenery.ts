// Scenery for the stages added as fighters' homes (smashcraft:docs/design/home-stages.md).
import { f32 } from "wisp/src/sim/f32";
import { STAGE_SKY_MODELS } from "../assets/stageSkyInfo";
import type { StageScenery } from "./stageScenery";

const TOWN_FIRE = "Doodads\\Cinematic\\TownBurningFireEmitter\\TownBurningFireEmitter.mdx";

/** The Culling: Stratholme burns at dusk. */
export const STRATHOLME_SCENERY: StageScenery = {
  sky: "Environment\\Sky\\LordaeronFallSky\\LordaeronFallSky.mdx",
  fog: { start: 5000.0, end: 11000.0, red: 0.5, green: 0.28125, blue: 0.1875 },
  pieces: [
    // ST-3: a second skyline band; this stock HD ruin draws nothing in Classic.
    { model: "Doodads\\LordaeronFall\\Structures\\AndrohalClockTower_Destroyed\\AndrohalClockTower_Destroyed.mdx", x: -1600.0, y: 7600.0, z: -1800.0, scale: 2.0, yaw: 270.0 },
    // The ruined cathedral burns on the right third; the city gate and a gutted hall frame the left.
    { model: "Doodads\\Cityscape\\Structures\\CathedralRuined\\CathedralRuined.mdx", x: 1500.0, y: 6200.0, z: -1300.0, scale: 3.0, yaw: 250.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 1730.0, y: 6195.0, z: -3790.0, scale: f32(12.4), yaw: 287.0, matrixScale: [1.0, 1.0, f32(2.487)] },
    { model: TOWN_FIRE, x: 1250.0, y: 6000.0, z: -900.0, scale: 1.75, yaw: 0.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 1215.0, y: 6000.0, z: -3980.0, scale: f32(6.05), yaw: 37.0, matrixScale: [1.0, 1.0, f32(6.398)] },
    { model: "Doodads\\Cityscape\\Structures\\CityWallEntrance\\CityWallEntrance.mdx", x: -1900.0, y: 3800.0, z: -1300.0, scale: 2.0, yaw: 285.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: -1875.0, y: 3800.0, z: -2875.0, scale: f32(3.65), yaw: 322.0, matrixScale: [1.0, 1.0, f32(5.626)] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingLarge_45_Ruined\\CityBuildingLarge_45_Ruined.mdx", x: -2300.0, y: 2600.0, z: -1250.0, scale: 1.75, yaw: 20.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: -2375.0, y: 2590.0, z: -2085.0, scale: f32(6.15), yaw: 57.0, matrixScale: [1.0, 1.0, f32(1.758)] },
    { model: TOWN_FIRE, x: -2250.0, y: 2650.0, z: -1000.0, scale: 1.25, yaw: 90.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: -2275.0, y: 2650.0, z: -2290.0, scale: f32(2.55), yaw: 127.0, matrixScale: [1.0, 1.0, f32(6.441)] },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingSmall135_1_Ruined\\CityBuildingSmall135_1_Ruined.mdx", x: 2400.0, y: 3400.0, z: -1350.0, scale: 2.0, yaw: 160.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 2395.0, y: 3400.0, z: -2585.0, scale: f32(5.1), yaw: 197.0, matrixScale: [1.0, 1.0, f32(3.092)] },
  ],
};

/** The Broken Isles: the Naga's sunken ruins before the Tomb of Sargeras, a waterfall pouring off the left cliffs. */
export const TOMB_OF_SARGERAS_SCENERY: StageScenery = {
  sky: STAGE_SKY_MODELS[7] ?? "",
  fog: { start: 5000.0, end: 11000.0, red: 0.25, green: 0.4375, blue: 0.46875 },
  // TS-1/TS-2: teal haze below the bright tide floor leaves the fighting plane clear.
  heightFog: { start: 5000.0, end: 11000.0, density: 0.25, heightStart: -1800.0, heightEnd: -100.0, maxDensity: 0.375, drawOverSky: false },
  pieces: [
    { model: "Buildings\\Naga\\TempleOfTides\\TempleOfTides.mdx", x: 1600.0, y: 5600.0, z: -800.0, scale: 1.25, yaw: 250.0 },
    { model: "Doodads\\Ruins\\Rocks\\Ruins_Rock\\Ruins_Rock0.mdx", x: 1760.0, y: 5600.0, z: -3480.0, scale: f32(9.05), yaw: 287.0, matrixScale: [1.0, 1.0, f32(1.55)] },
    // TS-c: the waterfall stays on the left; HD/DE imports replace only its misty model, keeping Classic stock.
    { model: "Doodads\\Terrain\\CliffDoodad\\Waterfall\\Waterfall.mdx", x: -1500.0, y: 5600.0, z: -1515.0, scale: 3.5, yaw: 270.0, matrixScale: [1.0, 1.0, f32(2.498)] },
    { model: "Doodads\\Ruins\\Structures\\SRuinArch\\SRuinArch.mdx", x: -1500.0, y: 3600.0, z: -1350.0, scale: 2.0, yaw: 15.0 },
    { model: "Doodads\\Ruins\\Rocks\\Ruins_Rock\\Ruins_Rock0.mdx", x: -1510.0, y: 3180.0, z: -2435.0, scale: f32(5.9), yaw: 52.0, matrixScale: [1.0, 1.0, f32(1.294)] },
    { model: "Doodads\\Ruins\\Water\\Coral\\Coral0.mdx", x: -1700.0, y: 2500.0, z: -2140.0, scale: 2, yaw: 300.0, matrixScale: [1.0, 1.0, f32(2.844)] },
    { model: "Doodads\\Ruins\\Rocks\\Ruins_Spires\\Ruins_Spires0.mdx", x: 2300.0, y: 2700.0, z: -2110.0, scale: 2, yaw: 140.0, matrixScale: [1.0, 1.0, f32(1.848)] },
    { model: "Doodads\\Ruins\\Rocks\\Ruins_Rock\\Ruins_Rock0.mdx", x: 1900.0, y: 4000.0, z: -2985.0, scale: 3, yaw: 205.0, matrixScale: [1.0, 1.0, 4.75] },
  ],
};
