import type { StageScenery } from "./stageScenery";

export const NORDRASSIL_SCENERY: StageScenery = {
  sky: "Environment\\Sky\\FelwoodSky\\FelwoodSky.mdl",
  fog: { start: 5500.0, end: 11000.0, red: 0.25, green: 0.5, blue: 0.375 },
  pieces: [
    // The World Tree rises on the left third; a near moon well and a crag answer it on the right.
    { model: "Doodads\\Ashenvale\\Structures\\Worldtree\\Worldtree.mdx", x: -1400.0, y: 6800.0, z: -1300.0, scale: 2.0, yaw: 300.0 },
    { model: "Buildings\\NightElf\\MoonWell\\MoonWell.mdx", x: 1000.0, y: 2400.0, z: -1000.0, scale: 2.5, yaw: 250.0 },
    { model: "Buildings\\NightElf\\MoonWell\\MoonWell.mdx", x: -2100.0, y: 3900.0, z: -1100.0, scale: 1.5, yaw: 20.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 2000.0, y: 3400.0, z: -1450.0, scale: 4.0, yaw: 150.0 },
  ],
};

export const GRYPHON_SCENERY: StageScenery = {
  sky: "Environment\\Sky\\LordaeronSummerSky\\LordaeronSummerSky.mdl",
  fog: { start: 5500.0, end: 11500.0, red: 0.625, green: 0.75, blue: 0.875 },
  pieces: [
    // The aviary sits on the right third; Aerie Peak's crag answers it on the left, a far peak between.
    { model: "Buildings\\Human\\GryphonAviary\\GryphonAviary.mdx", x: 1500.0, y: 4100.0, z: -1050.0, scale: 3.5, yaw: 215.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: -1900.0, y: 3100.0, z: -1500.0, scale: 5.0, yaw: 35.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: -300.0, y: 5600.0, z: -1800.0, scale: 6.0, yaw: 110.0 },
  ],
};

export const BLACKROCK_SCENERY: StageScenery = {
  sky: "Environment\\Sky\\LordaeronWinterSkyRed\\LordaeronWinterSkyRed.mdl",
  fog: { start: 5000.0, end: 10000.0, red: 0.5, green: 0.125, blue: 0.0625 },
  pieces: [
    // The burning mountain on the right third; a fire pillar and the mine cart weigh the left.
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 1300.0, y: 5200.0, z: -1900.0, scale: 7.0, yaw: 200.0 },
    { model: "Doodads\\Cinematic\\FireTrapUp\\FireTrapUp.mdx", x: 1250.0, y: 5200.0, z: -1350.0, scale: 3.5, yaw: 0.0 },
    { model: "Doodads\\Cinematic\\FirePillarMedium\\FirePillarMedium.mdx", x: -1800.0, y: 3300.0, z: -1250.0, scale: 4.25, yaw: 0.0 },
    { model: "Units\\Other\\DwarfCar\\DwarfCar.mdx", x: -1500.0, y: 2200.0, z: -950.0, scale: 2.0, yaw: 20.0 },
  ],
};

export const AHNQIRAJ_SCENERY: StageScenery = {
  sky: "Environment\\Sky\\LordaeronSummerSky\\LordaeronSummerSky.mdl",
  fog: { start: 5000.0, end: 10000.0, red: 0.75, green: 0.625, blue: 0.375 },
  pieces: [
    // A colossal obelisk on the left third; a broken arch, a fallen wall and stone on the right.
    { model: "Doodads\\Ruins\\Props\\RuinsObelisk\\RuinsObelisk1.mdx", x: -1300.0, y: 5300.0, z: -1300.0, scale: 11.0, yaw: 300.0 },
    { model: "Doodads\\Barrens\\Structures\\RuinedArch\\RuinedArch2.mdx", x: 2400.0, y: 3600.0, z: -1100.0, scale: 9.0, yaw: 220.0 },
    { model: "Doodads\\Barrens\\Structures\\RuinedCurvedWall\\RuinedCurvedWall.mdx", x: 1500.0, y: 4600.0, z: -1300.0, scale: 6.0, yaw: 160.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 2000.0, y: 2400.0, z: -1300.0, scale: 3.5, yaw: 45.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: -2200.0, y: 3000.0, z: -1400.0, scale: 4.5, yaw: 300.0 },
  ],
};
