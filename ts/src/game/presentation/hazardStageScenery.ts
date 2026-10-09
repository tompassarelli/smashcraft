import { f32 } from "wisp/src/sim/f32";
import type { StageScenery } from "./stageScenery";
import { STAGE_SKY_MODELS } from "../assets/stageSkyInfo";
import { STAGE_LAVA_MODEL, STAGE_SEA_MODEL } from "../assets/terrainAssetInfo";

const MOUND = "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks2.mdx";
const SPIRES0 = "Doodads\\Outland\\Rocks\\Outland_Spires\\Outland_Spires0.mdx";
const SPIRES2 = "Doodads\\Outland\\Rocks\\Outland_Spires\\Outland_Spires2.mdx";
const SPIRES7 = "Doodads\\Outland\\Rocks\\Outland_Spires\\Outland_Spires7.mdx";
const SPIRES8 = "Doodads\\Outland\\Rocks\\Outland_Spires\\Outland_Spires8.mdx";
const BASALT = "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx";
const MAGMA = "Doodads\\Outland\\Rocks\\Outland_MagmaRock\\Outland_MagmaRock0.mdx";
const TRAP = "Doodads\\Cinematic\\FireTrapUp\\FireTrapUp.mdx";
const PILLAR = "Doodads\\Cinematic\\FirePillarMedium\\FirePillarMedium.mdx";

export const NORDRASSIL_SCENERY: StageScenery = {
  sky: "Environment\\Sky\\FelwoodSky\\FelwoodSky.mdl",
  fog: { start: 5500.0, end: 11000.0, red: 0.25, green: 0.5, blue: 0.375 },

  heightFog: { start: 5500.0, end: 11000.0, density: 0.25, heightStart: -2600.0, heightEnd: -600.0, maxDensity: 0.5, drawOverSky: false },
  pieces: [

    { model: "Doodads\\Ashenvale\\Structures\\Worldtree\\Worldtree.mdx", x: -1900.0, y: 4800.0, z: -2650.0, scale: 0.625, yaw: 300.0, matrixScale: [1.0, 1.0, f32(1.512)] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks2.mdx", x: -1900.0, y: 4800.0, z: -3588.0, scale: 12.0, yaw: 140.0 },
    { model: "Buildings\\NightElf\\MoonWell\\MoonWell.mdx", x: 1600.0, y: 2900.0, z: -900.0, scale: 1.0, yaw: 250.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks2.mdx", x: 1715.0, y: 2900.0, z: -2295.0, scale: f32(7.22), yaw: 287.0, matrixScale: [1.0, 1.0, f32(2.462)] },
    { model: "Buildings\\NightElf\\MoonWell\\MoonWell.mdx", x: -2850.0, y: 4400.0, z: -1200.0, scale: 0.625, yaw: 20.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks2.mdx", x: -2960.0, y: 4400.0, z: -3210.0, scale: f32(4.79), yaw: 57.0, matrixScale: [1.0, 1.0, f32(5.335)] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 2000.0, y: 3600.0, z: -2710.0, scale: f32(3.55), yaw: 150.0, matrixScale: [1.0, 1.0, f32(6.052)] },
  ],
};

export const GRYPHON_SCENERY: StageScenery = {
  sky: STAGE_SKY_MODELS[11] ?? "",

  fog: { start: 5000.0, end: 9000.0, red: 0.5, green: 0.625, blue: 0.75 },
  heightFog: { start: 5000.0, end: 9000.0, density: 0.25, heightStart: -1800.0, heightEnd: -500.0, maxDensity: 0.5, drawOverSky: true },
  floor: { model: STAGE_SEA_MODEL, z: -1300.0, color: [96, 128, 136] },
  pieces: [

    { model: "Buildings\\Human\\GryphonAviary\\GryphonAviary.mdx", x: 2300.0, y: 4500.0, z: -150.0, scale: 1.25, yaw: 215.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks2.mdx", x: 2550.0, y: 4500.0, z: -3650.0, scale: f32(10.8), yaw: 252.0, matrixScale: [1.0, 1.0, f32(4.114)] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: -2050.0, y: 3200.0, z: -2475.0, scale: 3.5, yaw: 35.0, matrixScale: [1.0, 1.0, f32(5.138)] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: -550.0, y: 5200.0, z: -3505.0, scale: f32(5.05), yaw: 110.0, matrixScale: [1.0, 1.0, f32(6.005)] },
    { model: MOUND, x: -4000.0, y: 5000.0, z: -1500.0, scale: 13.0, yaw: 200.0, matrixScale: [2.5, 1.0, 1.25] },
    { model: MOUND, x: -3100.0, y: 5300.0, z: -1350.0, scale: 14.0, yaw: 175.0, matrixScale: [2.5, 1.0, 1.25] },
    { model: MOUND, x: -2150.0, y: 5100.0, z: -1450.0, scale: 12.5, yaw: 190.0, matrixScale: [2.5, 1.0, 1.25] },
    { model: MOUND, x: -1250.0, y: 5400.0, z: -1250.0, scale: 14.5, yaw: 165.0, matrixScale: [2.5, 1.0, 1.25] },
    { model: MOUND, x: -300.0, y: 5150.0, z: -1350.0, scale: 11.0, yaw: 205.0, matrixScale: [2.5, 1.0, 1.25] },
    { model: MOUND, x: 650.0, y: 5450.0, z: -1300.0, scale: 14.0, yaw: 180.0, matrixScale: [2.5, 1.0, 1.25] },
    { model: MOUND, x: 1500.0, y: 5200.0, z: -1400.0, scale: 11.5, yaw: 195.0, matrixScale: [2.5, 1.0, 1.25] },
    { model: MOUND, x: 3300.0, y: 5300.0, z: -1250.0, scale: 11.0, yaw: 170.0, matrixScale: [2.5, 1.0, 1.25] },
    { model: MOUND, x: 4000.0, y: 5000.0, z: -1550.0, scale: 10.0, yaw: 185.0, matrixScale: [2.5, 1.0, 1.25] },
  ],
};

export const BLACKROCK_SCENERY: StageScenery = {
  sky: STAGE_SKY_MODELS[12] ?? "",
  fog: { start: 8000.0, end: 16000.0, red: 0.5, green: 0.125, blue: 0.0625 },
  floor: { model: STAGE_LAVA_MODEL, z: -1300.0, color: [118, 73, 64] },
  pieces: [
    { model: SPIRES0, x: -4000.0, y: 4400.0, z: -1599.0, scale: 3.5, yaw: 190.0, matrixScale: [1.75, 1.0, 1.5] },
    { model: SPIRES8, x: -3600.0, y: 4250.0, z: -1491.0, scale: 3.25, yaw: 170.0, matrixScale: [1.75, 1.0, 1.5] },
    { model: SPIRES7, x: -2800.0, y: 4550.0, z: -1632.0, scale: 3.75, yaw: 200.0, matrixScale: [1.75, 1.0, 1.5] },
    { model: SPIRES2, x: -2000.0, y: 4300.0, z: -1744.0, scale: 3.0, yaw: 165.0, matrixScale: [2.0, 1.0, 2.0] },
    { model: SPIRES0, x: -1200.0, y: 4600.0, z: -1599.0, scale: 3.25, yaw: 185.0, matrixScale: [1.75, 1.0, 1.75] },
    { model: SPIRES8, x: -400.0, y: 4350.0, z: -1552.0, scale: 3.5, yaw: 205.0, matrixScale: [1.75, 1.0, 1.5] },
    { model: SPIRES7, x: 400.0, y: 4500.0, z: -1560.0, scale: 3.0, yaw: 175.0, matrixScale: [2.0, 1.0, 1.75] },
    { model: SPIRES2, x: 1200.0, y: 4250.0, z: -1694.0, scale: 3.75, yaw: 160.0, matrixScale: [1.75, 1.0, 1.5] },
    { model: SPIRES0, x: 2000.0, y: 4550.0, z: -1499.0, scale: 3.0, yaw: 195.0, matrixScale: [2.0, 1.0, 1.75] },
    { model: SPIRES8, x: 2800.0, y: 4300.0, z: -1441.0, scale: 3.25, yaw: 180.0, matrixScale: [1.75, 1.0, 1.5] },
    { model: SPIRES7, x: 3600.0, y: 4600.0, z: -1410.0, scale: 3.5, yaw: 190.0, matrixScale: [1.75, 1.0, 1.5] },
    { model: SPIRES2, x: 4000.0, y: 4350.0, z: -1694.0, scale: 3.0, yaw: 170.0, matrixScale: [2.0, 1.0, 2.0] },
    { model: SPIRES7, x: -3250.0, y: 5300.0, z: -1488.0, scale: 3.25, yaw: 165.0, matrixScale: [2.25, 1.0, 1.5] },
    { model: SPIRES0, x: -2400.0, y: 5000.0, z: -1506.0, scale: 4.5, yaw: 175.0, matrixScale: [2.25, 1.0, 1.0] },
    { model: SPIRES0, x: -1550.0, y: 5300.0, z: -1678.0, scale: 3.25, yaw: 175.0, matrixScale: [2.25, 1.0, 1.5] },
    { model: SPIRES8, x: -875.0, y: 5000.0, z: -1702.0, scale: 3.5, yaw: 205.0, matrixScale: [2.25, 1.0, 1.5] },
    { model: SPIRES8, x: -75.0, y: 5100.0, z: -1541.0, scale: 3.25, yaw: 200.0, matrixScale: [2.25, 1.0, 1.5] },
    { model: SPIRES7, x: 850.0, y: 5100.0, z: -1832.0, scale: 4.5, yaw: 165.0, matrixScale: [2.25, 1.0, 1.25] },
    { model: SPIRES7, x: 1675.0, y: 5100.0, z: -1488.0, scale: 3.25, yaw: 205.0, matrixScale: [2.25, 1.0, 1.5] },
    { model: SPIRES2, x: 2400.0, y: 5000.0, z: -1494.0, scale: 4.5, yaw: 165.0, matrixScale: [2.25, 1.0, 1.25] },
    { model: SPIRES0, x: 3275.0, y: 5100.0, z: -1635.0, scale: 4.0, yaw: 200.0, matrixScale: [2.25, 1.0, 1.25] },
    { model: BASALT, x: -2500.0, y: 4800.0, z: -1600.0, scale: 7.0, yaw: 190.0, matrixScale: [1.75, 1.0, 5.5], color: [30, 28, 30] },
    { model: TRAP, x: 2000.0, y: 4550.0, z: 880.0, scale: 2.0, yaw: 0.0 },
    { model: PILLAR, x: -2800.0, y: 4550.0, z: 930.0, scale: 1.25, yaw: 0.0 },
    { model: MAGMA, x: -3900.0, y: 3650.0, z: -1650.0, scale: 4.0, yaw: 185.0, matrixScale: [2.5, 1.0, 3.0] },
    { model: MAGMA, x: -2650.0, y: 3500.0, z: -1569.0, scale: 4.5, yaw: 170.0, matrixScale: [2.25, 1.0, 2.25] },
    { model: MAGMA, x: -1350.0, y: 3700.0, z: -1578.0, scale: 3.75, yaw: 200.0, matrixScale: [2.5, 1.0, 3.25] },
    { model: MAGMA, x: 800.0, y: 3550.0, z: -1594.0, scale: 4.25, yaw: 165.0, matrixScale: [2.5, 1.0, 2.5] },
    { model: MAGMA, x: 2050.0, y: 3700.0, z: -1600.0, scale: 4.0, yaw: 195.0, matrixScale: [2.25, 1.0, 3.0] },
    { model: MAGMA, x: 4000.0, y: 3500.0, z: -1638.0, scale: 5.0, yaw: 175.0, matrixScale: [2.5, 1.0, 2.25] },
  ],
};

export const AHNQIRAJ_SCENERY: StageScenery = {
  sky: STAGE_SKY_MODELS[13] ?? "",
  fog: { start: 5000.0, end: 10000.0, red: 0.75, green: 0.625, blue: 0.375 },
  pieces: [

    { model: "Doodads\\Ruins\\Props\\RuinsObelisk\\RuinsObelisk1.mdx", x: -2100.0, y: 5700.0, z: -3835.0, scale: 4.5, yaw: 300.0, matrixScale: [1.0, 1.0, f32(3.027)] },
    { model: "Doodads\\Barrens\\Structures\\RuinedArch\\RuinedArch2.mdx", x: 2200.0, y: 4100.0, z: -1200.0, scale: 4.0, yaw: 220.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks2.mdx", x: 2235.0, y: 4100.0, z: -2935.0, scale: f32(7.9), yaw: 257.0, matrixScale: [1.0, 1.0, f32(2.797)] },
    { model: "Doodads\\Barrens\\Structures\\RuinedCurvedWall\\RuinedCurvedWall.mdx", x: 800.0, y: 5000.0, z: -1350.0, scale: 4.0, yaw: 160.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks2.mdx", x: 810.0, y: 5000.0, z: -3455.0, scale: f32(7.29), yaw: 197.0, matrixScale: [1.0, 1.0, f32(3.672)] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 2000.0, y: 2400.0, z: -2025.0, scale: 3.5, yaw: 45.0, matrixScale: [1.0, 1.0, f32(3.56)] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: -2200.0, y: 3000.0, z: -2310.0, scale: 4.5, yaw: 300.0, matrixScale: [1.0, 1.0, f32(3.486)] },
  ],
};
