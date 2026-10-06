import type { StageScenery } from "./stageScenery";

export const NORDRASSIL_SCENERY: StageScenery = {
  sky: "Environment\\Sky\\FelwoodSky\\FelwoodSky.mdl",
  fog: { start: 5500.0, end: 11000.0, red: 0.25, green: 0.5, blue: 0.375 },
  pieces: [
    { model: "Doodads\\Ashenvale\\Structures\\Worldtree\\Worldtree.mdx", x: 0.0, y: 6500.0, z: -1200.0, scale: 2.0 },
    { model: "Buildings\\NightElf\\AncientOfWind\\AncientOfWind.mdx", x: -1500.0, y: 3000.0, z: -800.0, scale: 3.0 },
    { model: "Buildings\\NightElf\\AncientOfWind\\AncientOfWind.mdx", x: 1500.0, y: 3400.0, z: -900.0, scale: 2.5 },
    { model: "Buildings\\NightElf\\MoonWell\\MoonWell.mdx", x: -850.0, y: 2200.0, z: -700.0, scale: 2.5 },
    { model: "Buildings\\NightElf\\MoonWell\\MoonWell.mdx", x: 850.0, y: 2300.0, z: -700.0, scale: 2.5 },
    { model: "Units\\NightElf\\Wisp\\Wisp.mdx", x: -650.0, y: 2600.0, z: 200.0, scale: 1.5 },
    { model: "Units\\NightElf\\Wisp\\Wisp.mdx", x: 650.0, y: 2900.0, z: 450.0, scale: 1.5 },
  ],
};

export const GRYPHON_SCENERY: StageScenery = {
  sky: "Environment\\Sky\\LordaeronSummerSky\\LordaeronSummerSky.mdl",
  fog: { start: 5500.0, end: 11500.0, red: 0.625, green: 0.75, blue: 0.875 },
  pieces: [
    { model: "Buildings\\Human\\GryphonAviary\\GryphonAviary.mdx", x: -1450.0, y: 3400.0, z: -1000.0, scale: 4.0 },
    { model: "Buildings\\Human\\GryphonAviary\\GryphonAviary.mdx", x: 1450.0, y: 3800.0, z: -1000.0, scale: 3.5 },
    { model: "Units\\Human\\GryphonRider\\GryphonRider.mdx", x: -1000.0, y: 2700.0, z: 200.0, scale: 2.5 },
    { model: "Units\\Human\\GryphonRider\\GryphonRider.mdx", x: 900.0, y: 3200.0, z: 450.0, scale: 2.0 },
    { model: "Units\\Creeps\\WarEagle\\WarEagle.mdx", x: -350.0, y: 4000.0, z: 650.0, scale: 2.5 },
    { model: "Units\\Creeps\\WarEagle\\WarEagle.mdx", x: 600.0, y: 4500.0, z: 850.0, scale: 2.0 },
  ],
};

export const BLACKROCK_SCENERY: StageScenery = {
  sky: "Environment\\Sky\\LordaeronWinterSkyRed\\LordaeronWinterSkyRed.mdl",
  fog: { start: 5000.0, end: 10000.0, red: 0.5, green: 0.125, blue: 0.0625 },
  pieces: [
    { model: "Units\\Creeps\\HeroFlameLord\\HeroFlameLord.mdx", x: 0.0, y: 4700.0, z: -900.0, scale: 8.0 },
    { model: "Doodads\\Cinematic\\FirePillarMedium\\FirePillarMedium.mdx", x: -1700.0, y: 3000.0, z: -1200.0, scale: 4.0 },
    { model: "Doodads\\Cinematic\\FirePillarMedium\\FirePillarMedium.mdx", x: 1700.0, y: 3300.0, z: -1200.0, scale: 4.0 },
    { model: "Doodads\\Cinematic\\FireTrapUp\\FireTrapUp.mdx", x: -1100.0, y: 2200.0, z: -1000.0, scale: 3.0 },
    { model: "Doodads\\Cinematic\\FireTrapUp\\FireTrapUp.mdx", x: 1100.0, y: 2400.0, z: -1000.0, scale: 3.0 },
    { model: "Units\\Creeps\\LavaSpawn\\LavaSpawn.mdx", x: -850.0, y: 3200.0, z: -800.0, scale: 3.0 },
    { model: "Units\\Creeps\\BlackDragon\\BlackDragon.mdx", x: 1300.0, y: 5000.0, z: 600.0, scale: 2.5 },
    { model: "Units\\Other\\DwarfCar\\DwarfCar.mdx", x: 1200.0, y: 2200.0, z: -900.0, scale: 2.0 },
  ],
};

export const AHNQIRAJ_SCENERY: StageScenery = {
  sky: "Environment\\Sky\\LordaeronSummerSky\\LordaeronSummerSky.mdl",
  fog: { start: 5000.0, end: 10000.0, red: 0.75, green: 0.625, blue: 0.375 },
  pieces: [
    { model: "Units\\Undead\\ObsidianStatue\\ObsidianStatue.mdx", x: -1500.0, y: 3500.0, z: -900.0, scale: 5.0 },
    { model: "Units\\Undead\\ObsidianStatue\\ObsidianStatue.mdx", x: 1500.0, y: 3800.0, z: -900.0, scale: 5.0 },
    { model: "Units\\Undead\\HeroCryptLord\\HeroCryptLord.mdx", x: 0.0, y: 4700.0, z: -1000.0, scale: 6.0 },
    { model: "Units\\Creeps\\FacelessOne\\FacelessOne.mdx", x: -900.0, y: 2500.0, z: -800.0, scale: 3.0 },
    { model: "Units\\Creeps\\FacelessOne\\FacelessOne.mdx", x: 900.0, y: 2800.0, z: -800.0, scale: 3.0 },
  ],
};
