import type { StageScenery } from "./stageScenery";

export const DUROTAR_SCENERY: StageScenery = {
  sky: "Environment\\Sky\\LordaeronSummerSky\\LordaeronSummerSky.mdx",
  fog: { start: 5000.0, end: 11000.0, red: 0.75, green: 0.5, blue: 0.25 },
  pieces: [
    // A watchtower on the near left spire; a lower spire and a distant mesa with an outpost on the right.
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: -1900.0, y: 2900.0, z: -1300.0, scale: 4.5, yaw: 10.0 },
    { model: "buildings\\orc\\WatchTower\\WatchTower.mdx", x: -1850.0, y: 2950.0, z: -900.0, scale: 2.25, yaw: 300.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 2100.0, y: 3600.0, z: -1500.0, scale: 3.0, yaw: 120.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 900.0, y: 5300.0, z: -1800.0, scale: 6.0, yaw: 60.0 },
    { model: "buildings\\orc\\WatchTower\\WatchTower.mdx", x: 1000.0, y: 5300.0, z: -1300.0, scale: 1.5, yaw: 240.0 },
  ],
};

export const NAXXRAMAS_SCENERY: StageScenery = {
  sky: "Environment\\Sky\\LordaeronWinterSky\\LordaeronWinterSky.mdx",
  fog: { start: 5000.0, end: 11000.0, red: 0.25, green: 0.5, blue: 0.625 },
  pieces: [
    // The necropolis on the right third; a near ziggurat and a Scourge obelisk weigh the left.
    { model: "buildings\\undead\\Necropolis\\Necropolis.mdx", x: 1200.0, y: 5800.0, z: -1100.0, scale: 3.0, yaw: 250.0 },
    { model: "buildings\\undead\\Ziggurat\\Ziggurat.mdx", x: -1700.0, y: 3000.0, z: -1050.0, scale: 3.25, yaw: 20.0 },
    { model: "buildings\\undead\\Ziggurat\\Ziggurat.mdx", x: 2600.0, y: 3700.0, z: -1150.0, scale: 2.25, yaw: 160.0 },
    { model: "Doodads\\Icecrown\\Props\\IceCrownObelisk\\IceCrownObelisk1.mdx", x: -950.0, y: 2300.0, z: -1000.0, scale: 5.0, yaw: 290.0 },
  ],
};

export const HELLFIRE_SCENERY: StageScenery = {
  sky: "Environment\\Sky\\FelwoodSky\\FelwoodSky.mdx",
  fog: { start: 5000.0, end: 11000.0, red: 0.25, green: 0.5, blue: 0.125 },
  pieces: [
    // The demon gate on the left third; floating rocks of uneven size drift on the right.
    { model: "buildings\\demon\\DemonGate\\DemonGate.mdx", x: -1100.0, y: 6800.0, z: -1100.0, scale: 2.75, yaw: 280.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 1700.0, y: 3000.0, z: 150.0, scale: 3.0, yaw: 200.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: -1900.0, y: 3600.0, z: 550.0, scale: 2.0, yaw: 80.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 900.0, y: 4600.0, z: -1200.0, scale: 4.5, yaw: 330.0 },
    { model: "Doodads\\Cinematic\\FireTrapUp\\FireTrapUp.mdx", x: 1300.0, y: 2400.0, z: -1050.0, scale: 2.5, yaw: 0.0 },
  ],
};
