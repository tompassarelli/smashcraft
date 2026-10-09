import { f32 } from "wisp/src/sim/f32";
import { STAGE_SKY_MODELS } from "../assets/stageSkyInfo";
import type { StageScenery } from "./stageScenery";
import { STAGE_SEA_MODEL } from "../assets/terrainAssetInfo";

const SPIRES = "Doodads\\Outland\\Rocks\\Outland_Spires\\Outland_Spires7.mdx";
const GLACIER = "Doodads\\Icecrown\\Rocks\\Glacier\\Glacier0.mdx";
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
  fog: { start: 5000.0, end: 5500.0, red: f32(0.3), green: f32(0.6), blue: f32(0.7) },
  floor: { model: STAGE_SEA_MODEL, z: -1300.0, color: [64, 104, 104] },
  pieces: [
    { model: "buildings\\undead\\Necropolis\\Necropolis.mdx", x: 1900.0, y: 4600.0, z: 250.0, scale: 2.0, yaw: 250.0 },
    { model: GLACIER, x: 1900.0, y: 4650.0, z: -1800.0, scale: 4.5, yaw: 180.0, matrixScale: [1.5, 1.0, 1.0] },
    { model: GLACIER, x: -3850.0, y: 4500.0, z: -1635.0, scale: 5.0, yaw: 175.0, matrixScale: [2.25, 1.0, 1.0] },
    { model: GLACIER, x: -2950.0, y: 4350.0, z: -1406.0, scale: 4.5, yaw: 195.0, matrixScale: [2.5, 1.0, 1.0] },
    { model: GLACIER, x: -2100.0, y: 4400.0, z: -1485.0, scale: 5.5, yaw: 165.0, matrixScale: [2.0, 1.0, 0.75] },
    { model: GLACIER, x: -1250.0, y: 4650.0, z: -1471.0, scale: 4.75, yaw: 205.0, matrixScale: [2.25, 1.0, 1.0] },
    { model: GLACIER, x: -350.0, y: 4450.0, z: -1799.0, scale: 5.25, yaw: 185.0, matrixScale: [2.25, 1.0, 1.0] },
    { model: GLACIER, x: 550.0, y: 4700.0, z: -1785.0, scale: 4.0, yaw: 160.0, matrixScale: [2.5, 1.0, 1.25] },
    { model: GLACIER, x: 1400.0, y: 4300.0, z: -1878.0, scale: 6.5, yaw: 200.0, matrixScale: [1.75, 1.0, 0.75] },
    { model: GLACIER, x: 1900.0, y: 4250.0, z: -1385.0, scale: 4.0, yaw: 185.0, matrixScale: [2.75, 1.0, 1.25] },
    { model: GLACIER, x: 2700.0, y: 4500.0, z: -1536.0, scale: 6.0, yaw: 170.0, matrixScale: [2.0, 1.0, 0.75] },
    { model: GLACIER, x: 3500.0, y: 4650.0, z: -1828.0, scale: 6.5, yaw: 190.0, matrixScale: [2.0, 1.0, 0.75] },
    { model: GLACIER, x: 4000.0, y: 4350.0, z: -1728.0, scale: 6.5, yaw: 180.0, matrixScale: [1.75, 1.0, 0.75] },
    { model: GLACIER, x: -3700.0, y: 5300.0, z: -1599.0, scale: 7.0, yaw: 180.0, matrixScale: [2.0, 1.0, 0.75] },
    { model: GLACIER, x: -2300.0, y: 5400.0, z: -1842.0, scale: 8.0, yaw: 170.0, matrixScale: [1.75, 1.0, 0.75] },
    { model: GLACIER, x: -900.0, y: 5250.0, z: -1478.0, scale: 6.5, yaw: 190.0, matrixScale: [2.25, 1.0, 0.75] },
    { model: GLACIER, x: 700.0, y: 5450.0, z: -1963.0, scale: 8.5, yaw: 175.0, matrixScale: [1.75, 1.0, 0.75] },
    { model: GLACIER, x: 2200.0, y: 5300.0, z: -1692.0, scale: 6.0, yaw: 200.0, matrixScale: [2.25, 1.0, 1.0] },
    { model: GLACIER, x: 3600.0, y: 5400.0, z: -1321.0, scale: 9.5, yaw: 165.0, matrixScale: [2.0, 1.0, 0.5] },
    { model: GLACIER, x: -3950.0, y: 4700.0, z: -2156.0, scale: 5.0, yaw: 185.0, matrixScale: [1.5, 1.0, 1.25] },
    { model: GLACIER, x: -650.0, y: 4900.0, z: -1922.0, scale: 6.0, yaw: 175.0, matrixScale: [1.75, 1.0, 1.0] },
    { model: GLACIER, x: 3300.0, y: 4000.0, z: -2400.0, scale: 5.5, yaw: 175.0, matrixScale: [1.75, 1.0, 1.25] },
    { model: GLACIER, x: 3950.0, y: 4050.0, z: -2522.0, scale: 5.5, yaw: 170.0, matrixScale: [1.5, 1.0, 1.25] },
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
