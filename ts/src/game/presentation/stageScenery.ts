// Stage scenery is presentation only: arena coordinates never become collision.
import { STAGE_SNOW_MODEL } from "../assets/stageAssetInfo";
import { FROZEN_THRONE_STAGE } from "../sim/stage";

export interface SceneryPiece {
  readonly model: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly scale: number;
}

export interface StageScenery {
  readonly sky: string;
  readonly pieces: readonly SceneryPiece[];
  readonly fog?: { readonly start: number; readonly end: number; readonly red: number; readonly green: number; readonly blue: number };
}

const SUMMER: StageScenery = {
  sky: "Environment\\Sky\\LordaeronSummerSky\\LordaeronSummerSky.mdl",
  pieces: [],
};

const FROZEN_THRONE: StageScenery = {
  sky: "Environment\\Sky\\LordaeronWinterSky\\LordaeronWinterSky.mdl",
  // Fog begins beyond the fighting plane; the deck and fighters retain their contrast.
  fog: { start: 5000.0, end: 11000.0, red: 0.375, green: 0.625, blue: 0.875 },
  pieces: [
    { model: "Doodads\\Cinematic\\FrozenThrone\\FrozenThrone.mdx", x: 0.0, y: 6500.0, z: -1600.0, scale: 1.0 },
    { model: "Doodads\\Icecrown\\Rocks\\Glacier\\Glacier0.mdx", x: -1800.0, y: 3200.0, z: -1200.0, scale: 3.0 },
    { model: "Doodads\\Icecrown\\Rocks\\Glacier\\Glacier5.mdx", x: 1800.0, y: 3600.0, z: -1200.0, scale: 3.0 },
    { model: "Doodads\\Icecrown\\Rocks\\Icecrown_Crystal\\Icecrown_Crystal0.mdx", x: -900.0, y: 2400.0, z: -500.0, scale: 2.0 },
    { model: "Doodads\\Icecrown\\Rocks\\Icecrown_Crystal\\Icecrown_Crystal3.mdx", x: 950.0, y: 2500.0, z: -500.0, scale: 2.0 },
    { model: "Doodads\\Icecrown\\Props\\IceTorch\\IceTorch.mdx", x: -1200.0, y: 2000.0, z: -100.0, scale: 2.0 },
    { model: "Doodads\\Icecrown\\Props\\IceTorch\\IceTorch.mdx", x: 1200.0, y: 2000.0, z: -100.0, scale: 2.0 },
    { model: STAGE_SNOW_MODEL, x: 0.0, y: 4000.0, z: 0.0, scale: 1.0 },
  ],
};

export const stageScenery = (stage: number): StageScenery => stage === FROZEN_THRONE_STAGE ? FROZEN_THRONE : SUMMER;
