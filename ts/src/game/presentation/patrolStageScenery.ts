import type { StageScenery } from "./stageScenery";

export const DUROTAR_SCENERY: StageScenery = {
  sky: "Environment\\Sky\\LordaeronSummerSky\\LordaeronSummerSky.mdx",
  fog: { start: 5000.0, end: 11000.0, red: 0.75, green: 0.5, blue: 0.25 },
  pieces: [
    { model: "units\\creeps\\GoblinZeppelin\\GoblinZeppelin.mdx", x: -950.0, y: 3400.0, z: 100.0, scale: 2.5 },
    { model: "units\\creeps\\GoblinZeppelin\\GoblinZeppelin.mdx", x: 1100.0, y: 4400.0, z: -250.0, scale: 2.0 },
    { model: "buildings\\orc\\WatchTower\\WatchTower.mdx", x: -1600.0, y: 3000.0, z: -1000.0, scale: 3.0 },
    { model: "buildings\\orc\\WatchTower\\WatchTower.mdx", x: 1600.0, y: 3400.0, z: -1000.0, scale: 3.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: -1800.0, y: 2400.0, z: -1200.0, scale: 4.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 1800.0, y: 2800.0, z: -1200.0, scale: 4.0 },
  ],
};

export const NAXXRAMAS_SCENERY: StageScenery = {
  sky: "Environment\\Sky\\LordaeronWinterSky\\LordaeronWinterSky.mdx",
  fog: { start: 5000.0, end: 11000.0, red: 0.25, green: 0.5, blue: 0.625 },
  pieces: [
    { model: "buildings\\undead\\Necropolis\\Necropolis.mdx", x: 0.0, y: 4600.0, z: -900.0, scale: 3.5 },
    { model: "buildings\\undead\\Ziggurat\\Ziggurat.mdx", x: -1600.0, y: 2800.0, z: -1000.0, scale: 3.0 },
    { model: "buildings\\undead\\Ziggurat\\Ziggurat.mdx", x: 1600.0, y: 3200.0, z: -1000.0, scale: 3.0 },
    { model: "units\\undead\\FrostWyrm\\FrostWyrm.mdx", x: -1100.0, y: 3800.0, z: 100.0, scale: 2.0 },
  ],
};

export const HELLFIRE_SCENERY: StageScenery = {
  sky: "Environment\\Sky\\FelwoodSky\\FelwoodSky.mdx",
  fog: { start: 5000.0, end: 11000.0, red: 0.25, green: 0.5, blue: 0.125 },
  pieces: [
    { model: "buildings\\demon\\DemonGate\\DemonGate.mdx", x: 0.0, y: 4600.0, z: -900.0, scale: 4.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: -1500.0, y: 2600.0, z: -100.0, scale: 3.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 1600.0, y: 3200.0, z: 150.0, scale: 2.5 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: -1000.0, y: 3800.0, z: -1100.0, scale: 4.0 },
    { model: "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx", x: 1100.0, y: 4200.0, z: -1000.0, scale: 4.0 },
  ],
};
