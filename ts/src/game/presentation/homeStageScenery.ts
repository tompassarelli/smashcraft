// Scenery for the stages added as fighters' homes (smashcraft:docs/design/home-stages.md).
import { STAGE_SKY_MODELS } from "../assets/stageSkyInfo";
import type { StageScenery } from "./stageScenery";

const TOWN_FIRE = "Doodads\\Cinematic\\TownBurningFireEmitter\\TownBurningFireEmitter.mdx";

/** The Culling: Stratholme burns at dusk. */
export const STRATHOLME_SCENERY: StageScenery = {
  sky: STAGE_SKY_MODELS[6] ?? "",
  fog: { start: 5000.0, end: 11000.0, red: 0.5, green: 0.28125, blue: 0.1875 },
  pieces: [
    // The ruined cathedral burns on the right third; the city gate and a gutted hall frame the left.
    { model: "Doodads\\Cityscape\\Structures\\CathedralRuined\\CathedralRuined.mdx", x: 1500.0, y: 6200.0, z: -1300.0, scale: 3.0, yaw: 250.0 },
    { model: TOWN_FIRE, x: 1250.0, y: 6000.0, z: -900.0, scale: 1.75, yaw: 0.0 },
    { model: "Doodads\\Cityscape\\Structures\\CityWallEntrance\\CityWallEntrance.mdx", x: -1900.0, y: 3800.0, z: -1300.0, scale: 2.0, yaw: 285.0 },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingLarge_45_Ruined\\CityBuildingLarge_45_Ruined.mdx", x: -2300.0, y: 2600.0, z: -1250.0, scale: 1.75, yaw: 20.0 },
    { model: TOWN_FIRE, x: -2250.0, y: 2650.0, z: -1000.0, scale: 1.25, yaw: 90.0 },
    { model: "Doodads\\Cityscape\\Structures\\CityBuildingSmall135_1_Ruined\\CityBuildingSmall135_1_Ruined.mdx", x: 2400.0, y: 3400.0, z: -1350.0, scale: 2.0, yaw: 160.0 },
  ],
};

/** The Broken Isles: the Naga's sunken ruins before the Tomb of Sargeras, a waterfall pouring off the left cliffs. */
export const TOMB_OF_SARGERAS_SCENERY: StageScenery = {
  sky: STAGE_SKY_MODELS[7] ?? "",
  fog: { start: 5000.0, end: 11000.0, red: 0.25, green: 0.4375, blue: 0.46875 },
  pieces: [
    { model: "Buildings\\Naga\\TempleOfTides\\TempleOfTides.mdx", x: 1600.0, y: 6400.0, z: -1400.0, scale: 1.25, yaw: 250.0 },
    // The waterfall stays between the left ledge and centre at both camera extremes, its pool hidden behind the deck body.
    { model: "Doodads\\Terrain\\CliffDoodad\\Waterfall\\Waterfall.mdx", x: -1500.0, y: 5600.0, z: -450.0, scale: 3.5, yaw: 270.0 },
    { model: "Doodads\\Ruins\\Structures\\SRuinArch\\SRuinArch.mdx", x: -1500.0, y: 3600.0, z: -1350.0, scale: 2.0, yaw: 15.0 },
    { model: "Doodads\\Ruins\\Water\\Coral\\Coral0.mdx", x: -1700.0, y: 2500.0, z: -1250.0, scale: 2.0, yaw: 300.0 },
    { model: "Doodads\\Ruins\\Rocks\\Ruins_Spires\\Ruins_Spires0.mdx", x: 2300.0, y: 2700.0, z: -1400.0, scale: 2.0, yaw: 140.0 },
    { model: "Doodads\\Ruins\\Rocks\\Ruins_Rock\\Ruins_Rock0.mdx", x: 1900.0, y: 4000.0, z: -1300.0, scale: 3.0, yaw: 205.0 },
  ],
};
