import { f32 } from "wisp/src/sim/f32";
import { STAGE_SKY_MODELS } from "../assets/stageSkyInfo";
import type { StageScenery } from "./stageScenery";

export const DUROTAR_SCENERY: StageScenery = {
  sky: STAGE_SKY_MODELS[3] ?? "",
  fog: { start: 5000.0, end: 11000.0, red: 0.75, green: 0.5, blue: 0.25 },
  pieces: [
    // A distant watchpost crowns the left mesa; lower shelves open toward the right.
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: -2150.0, y: 2600.0, z: -2205.0, scale: 3, yaw: 15.0, matrixScale: [1.0, 1.0, f32(5.33)] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 2450.0, y: 3300.0, z: -2635.0, scale: f32(2.45), yaw: 135.0, matrixScale: [1.0, 1.0, f32(7.269)] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: -1550.0, y: 5400.0, z: -3700.0, scale: f32(4.35), yaw: 65.0, matrixScale: [1.0, 1.0, f32(7.463)] },
    { model: "buildings\\orc\\WatchTower\\WatchTower.mdx", x: -1525.0, y: 5450.0, z: -1075.0, scale: 1.25, yaw: 300.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: -1565.0, y: 5450.0, z: -3730.0, scale: f32(4.9), yaw: 337.0, matrixScale: [1.0, 1.0, f32(6.417)] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 1100.0, y: 6200.0, z: -4240.0, scale: f32(3.65), yaw: 205.0, matrixScale: [1.0, 1.0, f32(9.859)] },
  ],
};

export const NAXXRAMAS_SCENERY: StageScenery = {
  sky: STAGE_SKY_MODELS[4] ?? "",
  fog: { start: 5000.0, end: 11000.0, red: 0.25, green: 0.5, blue: 0.625 },
  pieces: [
    // One floating citadel above a low ruined approach; the central sky stays open.
    { model: "buildings\\undead\\Necropolis\\Necropolis.mdx", x: 1450.0, y: 6200.0, z: -1050.0, scale: 1.5, yaw: 250.0 },
    { model: "Doodads\\Icecrown\\Rocks\\Glacier\\Glacier5.mdx", x: 1490.0, y: 6200.0, z: -3665.0, scale: f32(7.1), yaw: 287.0, matrixScale: [1.0, 1.0, f32(1.317)] },
    { model: "buildings\\undead\\Ziggurat\\Ziggurat.mdx", x: -1800.0, y: 3900.0, z: -1150.0, scale: 0.75, yaw: 25.0 },
    { model: "Doodads\\Icecrown\\Rocks\\Glacier\\Glacier5.mdx", x: -2085.0, y: 3900.0, z: -2770.0, scale: f32(3.3), yaw: 62.0, matrixScale: [1.0, 1.0, f32(1.69)] },
    { model: "Doodads\\Icecrown\\Props\\IceCrownObelisk\\IceCrownObelisk1.mdx", x: -2300.0, y: 2500.0, z: -2245.0, scale: 2, yaw: 285.0, matrixScale: [1.0, 1.0, f32(4.201)] },
    { model: "Doodads\\Icecrown\\Rocks\\Glacier\\Glacier5.mdx", x: 2650.0, y: 3200.0, z: -2555.0, scale: 1.5, yaw: 155.0, matrixScale: [1.0, 1.0, f32(4.619)] },
  ],
};

export const HELLFIRE_SCENERY: StageScenery = {
  sky: STAGE_SKY_MODELS[14] ?? "",
  fog: { start: 5000.0, end: 11000.0, red: 0.25, green: 0.5, blue: 0.125 },
  pieces: [
    // A remote portal on its rock faces a broken shelf; thin spires rise only on the far right.
    { model: "buildings\\demon\\DemonGate\\DemonGate.mdx", x: -1450.0, y: 6500.0, z: -1350.0, scale: 1.25, yaw: 280.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: -1370.0, y: 6500.0, z: -4175.0, scale: f32(7.8), yaw: 317.0, matrixScale: [1.0, 1.0, f32(3.792)] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: -2250.0, y: 2600.0, z: -2220.0, scale: 2.75, yaw: 80.0, matrixScale: [1.0, 1.0, f32(5.572)] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 2150.0, y: 3700.0, z: -2870.0, scale: f32(2.7), yaw: 205.0, matrixScale: [1.0, 1.0, f32(8.124)] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 1750.0, y: 5400.0, z: -3835.0, scale: f32(3.15), yaw: 330.0, matrixScale: [1.0, 1.0, f32(12.54)] },
  ],
};
