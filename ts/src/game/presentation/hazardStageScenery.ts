import { f32 } from "wisp/src/sim/f32";
import type { StageScenery } from "./stageScenery";
import { STAGE_SKY_MODELS } from "../assets/stageSkyInfo";

export const NORDRASSIL_SCENERY: StageScenery = {
  sky: "Environment\\Sky\\FelwoodSky\\FelwoodSky.mdl",
  fog: { start: 5500.0, end: 11000.0, red: 0.25, green: 0.5, blue: 0.375 },
  // NO-3 softens distant tree roots; NO-4 keeps the animated aurora above the mist.
  heightFog: { start: 5500.0, end: 11000.0, density: 0.25, heightStart: -2600.0, heightEnd: -600.0, maxDensity: 0.5, drawOverSky: false },
  pieces: [
    // Dream Land tree silhouette with cool low moon wells; the aurora sky is preserved.
    { model: "Doodads\\Ashenvale\\Structures\\Worldtree\\Worldtree.mdx", x: -1900.0, y: 5800.0, z: -2650.0, scale: 0.625, yaw: 300.0, matrixScale: [1.0, 1.0, f32(1.512)] },
    { model: "Buildings\\NightElf\\MoonWell\\MoonWell.mdx", x: 1600.0, y: 2900.0, z: -900.0, scale: 1.0, yaw: 250.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 1715.0, y: 2900.0, z: -2295.0, scale: f32(5.35), yaw: 287.0, matrixScale: [1.0, 1.0, f32(2.605)] },
    { model: "Buildings\\NightElf\\MoonWell\\MoonWell.mdx", x: -2300.0, y: 4400.0, z: -1200.0, scale: 0.625, yaw: 20.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: -2410.0, y: 4400.0, z: -3210.0, scale: f32(3.55), yaw: 57.0, matrixScale: [1.0, 1.0, f32(6.407)] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 2000.0, y: 3600.0, z: -2710.0, scale: f32(3.55), yaw: 150.0, matrixScale: [1.0, 1.0, f32(6.052)] },
  ],
};

export const GRYPHON_SCENERY: StageScenery = {
  sky: STAGE_SKY_MODELS[11] ?? "",
  fog: { start: 5500.0, end: 11500.0, red: 0.625, green: 0.75, blue: 0.875 },
  pieces: [
    // The aviary sits on the right third; Aerie Peak's crag answers it on the left, a far peak between.
    { model: "Buildings\\Human\\GryphonAviary\\GryphonAviary.mdx", x: 2100.0, y: 5700.0, z: -1350.0, scale: 1.5, yaw: 215.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 2415.0, y: 5700.0, z: -3620.0, scale: f32(10.2), yaw: 252.0, matrixScale: [1.0, 1.0, f32(2.079)] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: -2050.0, y: 3200.0, z: -2475.0, scale: 3.5, yaw: 35.0, matrixScale: [1.0, 1.0, f32(5.138)] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: -550.0, y: 5200.0, z: -3505.0, scale: f32(5.05), yaw: 110.0, matrixScale: [1.0, 1.0, f32(6.005)] },
  ],
};

export const BLACKROCK_SCENERY: StageScenery = {
  sky: STAGE_SKY_MODELS[12] ?? "",
  fog: { start: 5000.0, end: 10000.0, red: 0.5, green: 0.125, blue: 0.0625 },
  pieces: [
    // Brinstar's quiet upper cavern and luminous basin: basalt reads above low forge glow.
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 2000.0, y: 6100.0, z: -4040.0, scale: f32(5.2), yaw: 210.0, matrixScale: [1.0, 1.0, f32(6.994)] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: -2300.0, y: 3800.0, z: -2845.0, scale: f32(3.15), yaw: 35.0, matrixScale: [1.0, 1.0, f32(6.202)] },
    // Both fires carry warm omni lights (stagePointLights.ts, #292).
    { model: "Doodads\\Cinematic\\FireTrapUp\\FireTrapUp.mdx", x: 2050.0, y: 6000.0, z: -1500.0, scale: 1.5, yaw: 0.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 2055.0, y: 6000.0, z: -4030.0, scale: f32(4.95), yaw: 37.0, matrixScale: [1.0, 1.0, f32(6.414)] },
    { model: "Doodads\\Cinematic\\FirePillarMedium\\FirePillarMedium.mdx", x: -2100.0, y: 4600.0, z: -1500.0, scale: 1.25, yaw: 0.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: -2095.0, y: 4600.0, z: -3320.0, scale: f32(3.55), yaw: 37.0, matrixScale: [1.0, 1.0, f32(6.392)] },
    { model: "Doodads\\Dungeon\\Props\\MineCart\\MineCart.mdx", x: -1750.0, y: 2600.0, z: -1150.0, scale: 1.5, yaw: 25.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: -1750.0, y: 2600.0, z: -2275.0, scale: f32(2.2), yaw: 62.0, matrixScale: [1.0, 1.0, f32(6.497)] },
  ],
};

export const AHNQIRAJ_SCENERY: StageScenery = {
  sky: STAGE_SKY_MODELS[13] ?? "",
  fog: { start: 5000.0, end: 10000.0, red: 0.75, green: 0.625, blue: 0.375 },
  pieces: [
    // A colossal obelisk on the left third; a broken arch, a fallen wall and stone on the right.
    { model: "Doodads\\Ruins\\Props\\RuinsObelisk\\RuinsObelisk1.mdx", x: -2100.0, y: 5700.0, z: -3835.0, scale: 4.5, yaw: 300.0, matrixScale: [1.0, 1.0, f32(3.027)] },
    { model: "Doodads\\Barrens\\Structures\\RuinedArch\\RuinedArch2.mdx", x: 2200.0, y: 4100.0, z: -1200.0, scale: 4.0, yaw: 220.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 2235.0, y: 4100.0, z: -2935.0, scale: f32(5.85), yaw: 257.0, matrixScale: [1.0, 1.0, f32(3.62)] },
    { model: "Doodads\\Barrens\\Structures\\RuinedCurvedWall\\RuinedCurvedWall.mdx", x: 800.0, y: 5000.0, z: -1350.0, scale: 4.0, yaw: 160.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 810.0, y: 5000.0, z: -3455.0, scale: f32(5.4), yaw: 197.0, matrixScale: [1.0, 1.0, f32(4.835)] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 2000.0, y: 2400.0, z: -2025.0, scale: 3.5, yaw: 45.0, matrixScale: [1.0, 1.0, f32(3.56)] },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: -2200.0, y: 3000.0, z: -2310.0, scale: 4.5, yaw: 300.0, matrixScale: [1.0, 1.0, f32(3.486)] },
  ],
};
