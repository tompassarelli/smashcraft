import { f32 } from "wisp/src/sim/f32";
import type { StageScenery } from "./stageScenery";
import { STAGE_SKY_MODELS } from "../assets/stageSkyInfo";
import { STAGE_LAVA_MODEL, STAGE_SEA_MODEL } from "../assets/terrainAssetInfo";

const MOUND = "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks2.mdx";
const SPIRE = "Doodads\\Felwood\\Rocks\\Felwood_Spires\\Felwood_Spires0.mdx";
const BACK = "Doodads\\Ruins\\Rocks\\Ruins_Spires\\Ruins_Spires0.mdx";
const ASHEN_MOUND = "Doodads\\Ashenvale\\Rocks\\AshenRock\\AshenRock2.mdx";
const SPIRE0 = "Doodads\\Ruins\\Rocks\\Ruins_Spires\\Ruins_Spires0.mdx";
const SPIRE2 = "Doodads\\Ruins\\Rocks\\Ruins_Spires\\Ruins_Spires2.mdx";
const GATE = "Doodads\\Ruins\\Structures\\RuinsArchway45_\\RuinsArchway45_0.mdx";
const OBELISK = "Doodads\\Ruins\\Props\\RuinsObelisk\\RuinsObelisk1.mdx";
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
  fog: { start: 5000.0, end: 5300.0, red: 0.375, green: 0.625, blue: 0.5 },
  heightFog: { start: 5500.0, end: 11000.0, density: 0.25, heightStart: -2600.0, heightEnd: -600.0, maxDensity: 0.5, drawOverSky: false },
  floor: { model: STAGE_SEA_MODEL, z: -1050.0, color: [56, 92, 92] },
  pieces: [
    { model: "Doodads\\Ashenvale\\Structures\\Worldtree\\Worldtree.mdx", x: 0.0, y: 4000.0, z: -1050.0, scale: f32(0.55), yaw: 300.0 },
    { model: SPIRE, x: -3890.0, y: 4300.0, z: -1508.0, scale: 3.25, yaw: 140.0, matrixScale: [2.75, 1.0, 1.5] },
    { model: SPIRE, x: -3390.0, y: 4650.0, z: -1631.0, scale: 4.5, yaw: 250.0, matrixScale: [2.5, 1.0, 1.25] },
    { model: SPIRE, x: -2690.0, y: 4350.0, z: -1634.0, scale: 3.5, yaw: 75.0, matrixScale: [2.75, 1.0, 1.5] },
    { model: SPIRE, x: -2190.0, y: 4600.0, z: -1551.0, scale: 4.25, yaw: 200.0, matrixScale: [2.5, 1.0, 1.25] },
    { model: SPIRE, x: -1490.0, y: 4400.0, z: -1694.0, scale: 3.0, yaw: 310.0, matrixScale: [2.75, 1.0, 1.75] },
    { model: SPIRE, x: -990.0, y: 4700.0, z: -1732.0, scale: 4.75, yaw: 30.0, matrixScale: [2.5, 1.0, 1.25] },
    { model: SPIRE, x: 1410.0, y: 4650.0, z: -1651.0, scale: 4.5, yaw: 225.0, matrixScale: [2.5, 1.0, 1.25] },
    { model: SPIRE, x: 2110.0, y: 4400.0, z: -1719.0, scale: 5.5, yaw: 50.0, matrixScale: [2.75, 1.0, 1.0] },
    { model: SPIRE, x: 2610.0, y: 4600.0, z: -1691.0, scale: 4.5, yaw: 330.0, matrixScale: [2.5, 1.0, 1.25] },
    { model: SPIRE, x: 3310.0, y: 4300.0, z: -1684.0, scale: 3.0, yaw: 95.0, matrixScale: [2.75, 1.0, 1.75] },
    { model: SPIRE, x: 3810.0, y: 4500.0, z: -1591.0, scale: 4.25, yaw: 260.0, matrixScale: [2.5, 1.0, 1.25] },
    { model: ASHEN_MOUND, x: -3420.0, y: 3850.0, z: -1536.0, scale: 10.5, yaw: 170.0, matrixScale: [3.0, 1.0, 1.25] },
    { model: ASHEN_MOUND, x: -2500.0, y: 4100.0, z: -1692.0, scale: 13.0, yaw: 185.0, matrixScale: [3.0, 1.0, 1.25] },
    { model: ASHEN_MOUND, x: -1420.0, y: 3900.0, z: -1548.0, scale: 11.0, yaw: 165.0, matrixScale: [3.0, 1.0, 1.25] },
    { model: ASHEN_MOUND, x: 1500.0, y: 4150.0, z: -1452.0, scale: 14.0, yaw: 190.0, matrixScale: [3.0, 1.0, 1.0] },
    { model: ASHEN_MOUND, x: 2580.0, y: 3900.0, z: -1476.0, scale: 10.25, yaw: 160.0, matrixScale: [3.0, 1.0, 1.25] },
    { model: ASHEN_MOUND, x: 3500.0, y: 4000.0, z: -1743.0, scale: 13.25, yaw: 205.0, matrixScale: [3.0, 1.0, 1.25] },
    { model: BACK, x: -3820.0, y: 4800.0, z: -1374.0, scale: 5.25, yaw: 190.0, matrixScale: [3.0, 1.0, 1.0] },
    { model: BACK, x: -3280.0, y: 4800.0, z: -1440.0, scale: 4.0, yaw: 300.0, matrixScale: [3.0, 1.0, 1.25] },
    { model: BACK, x: -2620.0, y: 4800.0, z: -1414.0, scale: 5.25, yaw: 120.0, matrixScale: [3.0, 1.0, 1.0] },
    { model: BACK, x: -2080.0, y: 4800.0, z: -1658.0, scale: 4.0, yaw: 250.0, matrixScale: [3.0, 1.0, 1.5] },
    { model: BACK, x: -1420.0, y: 4800.0, z: -1504.0, scale: 5.25, yaw: 10.0, matrixScale: [3.0, 1.0, 1.0] },
    { model: BACK, x: -880.0, y: 4800.0, z: -1808.0, scale: 4.0, yaw: 160.0, matrixScale: [3.0, 1.0, 1.5] },
    { model: BACK, x: 980.0, y: 4800.0, z: -1414.0, scale: 5.25, yaw: 300.0, matrixScale: [3.0, 1.0, 1.0] },
    { model: BACK, x: 1520.0, y: 4800.0, z: -1658.0, scale: 4.0, yaw: 120.0, matrixScale: [3.0, 1.0, 1.5] },
    { model: BACK, x: 2180.0, y: 4800.0, z: -1504.0, scale: 5.25, yaw: 250.0, matrixScale: [3.0, 1.0, 1.0] },
    { model: BACK, x: 2720.0, y: 4800.0, z: -1808.0, scale: 4.0, yaw: 10.0, matrixScale: [3.0, 1.0, 1.5] },
    { model: BACK, x: 3380.0, y: 4800.0, z: -1374.0, scale: 5.25, yaw: 160.0, matrixScale: [3.0, 1.0, 1.0] },
    { model: BACK, x: 3920.0, y: 4800.0, z: -1440.0, scale: 4.0, yaw: 40.0, matrixScale: [3.0, 1.0, 1.25] },
    { model: SPIRE, x: -4050.0, y: 4450.0, z: -1579.0, scale: 5.5, yaw: 200.0, matrixScale: [4.0, 1.0, 1.0] },
    { model: SPIRE, x: 4050.0, y: 4600.0, z: -1561.0, scale: 4.25, yaw: 20.0, matrixScale: [4.0, 1.0, 1.25] },
    { model: ASHEN_MOUND, x: -4050.0, y: 4000.0, z: -1711.0, scale: 13.0, yaw: 190.0, matrixScale: [4.5, 1.0, 1.5] },
    { model: ASHEN_MOUND, x: 4050.0, y: 3950.0, z: -1467.0, scale: 16.5, yaw: 175.0, matrixScale: [4.0, 1.0, 1.0] },
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
    { model: SPIRES8, x: -3450.0, y: 4250.0, z: -1491.0, scale: 3.25, yaw: 170.0, matrixScale: [1.75, 1.0, 1.5] },
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
  fog: { start: 8000.0, end: 16000.0, red: 0.75, green: 0.625, blue: 0.375 },
  floor: { model: STAGE_LAVA_MODEL, z: -1300.0, color: [100, 150, 255] },
  pieces: [
    { model: SPIRE0, x: -4000.0, y: 4450.0, z: -1808.0, scale: 4.0, yaw: 190.0, matrixScale: [2.5, 1.0, 1.5] },
    { model: SPIRE2, x: -3650.0, y: 4300.0, z: -1549.0, scale: 4.5, yaw: 170.0, matrixScale: [2.5, 1.0, 1.5] },
    { model: SPIRE0, x: -3000.0, y: 4600.0, z: -1815.0, scale: 4.25, yaw: 200.0, matrixScale: [2.5, 1.0, 1.5] },
    { model: SPIRE2, x: -2400.0, y: 4350.0, z: -1732.0, scale: 5.0, yaw: 175.0, matrixScale: [2.25, 1.0, 1.5] },
    { model: SPIRE0, x: -1700.0, y: 4650.0, z: -1451.0, scale: 3.75, yaw: 185.0, matrixScale: [2.5, 1.0, 1.5] },
    { model: SPIRE2, x: -1050.0, y: 4400.0, z: -1566.0, scale: 4.75, yaw: 160.0, matrixScale: [2.25, 1.0, 1.5] },
    { model: SPIRE0, x: -400.0, y: 4700.0, z: -1551.0, scale: 4.5, yaw: 195.0, matrixScale: [2.5, 1.0, 1.25] },
    { model: SPIRE2, x: 250.0, y: 4300.0, z: -1627.0, scale: 4.0, yaw: 180.0, matrixScale: [2.75, 1.0, 1.75] },
    { model: SPIRE0, x: 900.0, y: 4550.0, z: -1765.0, scale: 4.25, yaw: 205.0, matrixScale: [2.5, 1.0, 1.5] },
    { model: SPIRE2, x: 1550.0, y: 4400.0, z: -1632.0, scale: 5.0, yaw: 170.0, matrixScale: [2.25, 1.0, 1.5] },
    { model: SPIRE0, x: 2200.0, y: 4650.0, z: -1444.0, scale: 3.5, yaw: 165.0, matrixScale: [2.75, 1.0, 1.5] },
    { model: SPIRE2, x: 2850.0, y: 4350.0, z: -1713.0, scale: 4.25, yaw: 190.0, matrixScale: [2.5, 1.0, 1.75] },
    { model: SPIRE0, x: 3500.0, y: 4500.0, z: -1632.0, scale: 4.75, yaw: 175.0, matrixScale: [2.25, 1.0, 1.25] },
    { model: SPIRE2, x: 4000.0, y: 4500.0, z: -1585.0, scale: 5.75, yaw: 200.0, matrixScale: [2.5, 1.0, 1.25] },
    { model: SPIRE2, x: -2625.0, y: 5100.0, z: -1499.0, scale: 4.5, yaw: 205.0, matrixScale: [2.75, 1.0, 1.5] },
    { model: SPIRE0, x: -2000.0, y: 5100.0, z: -1849.0, scale: 5.5, yaw: 195.0, matrixScale: [2.75, 1.0, 1.0] },
    { model: SPIRE0, x: -1350.0, y: 5050.0, z: -1640.0, scale: 4.0, yaw: 200.0, matrixScale: [2.75, 1.0, 1.25] },
    { model: SPIRE2, x: -750.0, y: 4950.0, z: -1688.0, scale: 5.5, yaw: 185.0, matrixScale: [2.75, 1.0, 1.25] },
    { model: SPIRE0, x: -75.0, y: 5100.0, z: -1671.0, scale: 4.25, yaw: 185.0, matrixScale: [2.75, 1.0, 1.25] },
    { model: SPIRE0, x: 575.0, y: 5300.0, z: -1640.0, scale: 4.0, yaw: 200.0, matrixScale: [2.75, 1.0, 1.25] },
    { model: SPIRE0, x: 1175.0, y: 5100.0, z: -1799.0, scale: 5.5, yaw: 195.0, matrixScale: [2.75, 1.0, 1.0] },
    { model: SPIRE2, x: 1875.0, y: 5000.0, z: -1616.0, scale: 4.75, yaw: 180.0, matrixScale: [2.75, 1.0, 1.5] },
    { model: SPIRE0, x: 2575.0, y: 5000.0, z: -1801.0, scale: 4.5, yaw: 165.0, matrixScale: [2.75, 1.0, 1.25] },
    { model: GATE, x: -1900.0, y: 3900.0, z: -1551.0, scale: 2.25, yaw: 200.0, matrixScale: [1.0, 1.0, 1.25] },
    { model: OBELISK, x: 1500.0, y: 4000.0, z: -1451.0, scale: 3.0, yaw: 300.0, matrixScale: [1.0, 1.0, 3.0] },
    { model: OBELISK, x: 2150.0, y: 4100.0, z: -1579.0, scale: 2.5, yaw: 330.0, matrixScale: [1.0, 1.0, 3.5] },
  ],
};
