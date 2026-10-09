import { f32 } from "wisp/src/sim/f32";
import { STAGE_SKY_MODELS } from "../assets/stageSkyInfo";
import type { StageScenery } from "./stageScenery";
import { STAGE_SEA_MODEL } from "../assets/terrainAssetInfo";

const SPIRES = "Doodads\\Outland\\Rocks\\Outland_Spires\\Outland_Spires7.mdx";
const MOUND = "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks2.mdx";

export const DUROTAR_SCENERY: StageScenery = {
  sky: STAGE_SKY_MODELS[3] ?? "",
  fog: { start: 5000.0, end: 11000.0, red: 0.75, green: 0.5, blue: 0.25 },
  floor: { model: STAGE_SEA_MODEL, z: -1300.0, color: [168, 140, 120] },
  pieces: [

    { model: MOUND, x: -4000.0, y: 4500.0, z: -1608.0, scale: 12.0, yaw: 195.0, matrixScale: [2.5, 1.0, 1.75] },
    { model: MOUND, x: -3150.0, y: 4300.0, z: -1708.0, scale: 10.5, yaw: 170.0, matrixScale: [2.75, 1.0, 2.0] },
    { model: MOUND, x: -2300.0, y: 4600.0, z: -1730.0, scale: 13.0, yaw: 185.0, matrixScale: [2.5, 1.0, 1.75] },
    { model: MOUND, x: -1400.0, y: 4350.0, z: -1486.0, scale: 11.0, yaw: 165.0, matrixScale: [2.75, 1.0, 1.75] },
    { model: MOUND, x: -500.0, y: 4650.0, z: -1694.0, scale: 12.5, yaw: 200.0, matrixScale: [2.5, 1.0, 1.75] },
    { model: MOUND, x: 400.0, y: 4400.0, z: -1610.0, scale: 10.0, yaw: 175.0, matrixScale: [3.0, 1.0, 2.0] },
    { model: MOUND, x: 1150.0, y: 4700.0, z: -1558.0, scale: 14.0, yaw: 190.0, matrixScale: [2.5, 1.0, 1.5] },
    { model: MOUND, x: 2050.0, y: 4300.0, z: -1609.0, scale: 10.25, yaw: 160.0, matrixScale: [3.0, 1.0, 2.0] },
    { model: MOUND, x: 3000.0, y: 4550.0, z: -1498.0, scale: 13.25, yaw: 205.0, matrixScale: [2.5, 1.0, 1.5] },
    { model: MOUND, x: 3950.0, y: 4350.0, z: -1682.0, scale: 8.5, yaw: 180.0, matrixScale: [3.5, 1.0, 2.5] },
    { model: SPIRES, x: -3500.0, y: 4100.0, z: -1459.0, scale: 1.75, yaw: 30.0, matrixScale: [1.5, 1.0, 2.75] },
    { model: SPIRES, x: 3600.0, y: 4200.0, z: -1524.0, scale: 2.25, yaw: 330.0, matrixScale: [1.5, 1.0, 2.25] },
    { model: "buildings\\orc\\WatchTower\\WatchTower.mdx", x: -2300.0, y: 4600.0, z: 350.0, scale: 3.0, yaw: 300.0 },
    { model: "buildings\\orc\\TrollBurrow\\TrollBurrow.mdl", x: 1150.0, y: 4700.0, z: 450.0, scale: 3.25, yaw: 230.0 },
  ],
};

export const NAXXRAMAS_SCENERY: StageScenery = {
  sky: STAGE_SKY_MODELS[4] ?? "",

  fog: { start: 5000.0, end: 11000.0, red: 0.25, green: 0.5, blue: 0.625 },
  pieces: [

    { model: "buildings\\undead\\Necropolis\\Necropolis.mdx", x: 1900.0, y: 4600.0, z: 350.0, scale: 1.5, yaw: 250.0 },

    { model: "Doodads\\Undercity\\Props\\NaxxDeco\\NaxxDeco0.mdx", x: 1700.0, y: 5900.0, z: -900.0, scale: 0.5, yaw: 250.0 },
    { model: "Doodads\\Icecrown\\Rocks\\Glacier\\Glacier5.mdx", x: 1940.0, y: 4400.0, z: -8000.0, scale: f32(7.1), yaw: 287.0, matrixScale: [1.0, 1.0, f32(4.938627)] },
    { model: "buildings\\undead\\Ziggurat\\Ziggurat.mdx", x: -1800.0, y: 3900.0, z: -1150.0, scale: 0.75, yaw: 25.0 },
    { model: "Doodads\\Icecrown\\Rocks\\Glacier\\Glacier5.mdx", x: -2085.0, y: 3900.0, z: -7500.0, scale: f32(3.3), yaw: 62.0, matrixScale: [1.0, 1.0, f32(8.155981)] },
    { model: "Doodads\\Icecrown\\Props\\IceCrownObelisk\\IceCrownObelisk1.mdx", x: -2300.0, y: 2500.0, z: -5500.0, scale: 2, yaw: 285.0, matrixScale: [1.0, 1.0, f32(12.919268)] },
    { model: "Doodads\\Icecrown\\Rocks\\Glacier\\Glacier5.mdx", x: 2650.0, y: 3200.0, z: -6500.0, scale: 1.5, yaw: 155.0, matrixScale: [1.0, 1.0, f32(16.483323)] },
  ],
};

export const HELLFIRE_SCENERY: StageScenery = {

  sky: "Environment\\Sky\\Outland_Sky\\Outland_Sky.mdl",
  fog: { start: 5000.0, end: 11000.0, red: 0.25, green: 0.5, blue: 0.125 },
  pieces: [

    { model: "buildings\\demon\\DemonGate\\DemonGate.mdx", x: -1850.0, y: 4500.0, z: -50.0, scale: 1.5, yaw: 280.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: -1770.0, y: 4500.0, z: -7200.0, scale: 9.0, yaw: 317.0, matrixScale: [1.0, 1.0, f32(9.20577)] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: -2250.0, y: 2600.0, z: -5500.0, scale: 2.75, yaw: 80.0, matrixScale: [1.0, 1.0, f32(20.26058)] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 2150.0, y: 3700.0, z: -6500.0, scale: f32(2.7), yaw: 205.0, matrixScale: [1.0, 1.0, f32(24.68099)] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 1750.0, y: 5400.0, z: -8500.0, scale: f32(3.15), yaw: 330.0, matrixScale: [1.0, 1.0, f32(30.778105)] },

    { model: "Abilities\\Spells\\NightElf\\Immolation\\ImmolationTarget.mdx", x: -1850.0, y: 4500.0, z: -1100.0, scale: 0.75, yaw: 0.0 },
    { model: "Abilities\\Spells\\NightElf\\Immolation\\ImmolationTarget.mdx", x: 2150.0, y: 3700.0, z: -1450.0, scale: 0.5, yaw: 0.0 },
  ],
};
