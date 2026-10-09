


import { f32 } from "wisp/src/sim/f32";
import { FROZEN_THRONE_STAGE } from "../sim/stage";


export interface PlatformPart {
  readonly model: string;

  readonly x: number;
  readonly y: number;
  readonly z: number;

  readonly scale: readonly [x: number, y: number, z: number];

  readonly yaw: number;
}

const ICE_FLOE = "Doodads\\Northrend\\Water\\North_IceFloe3\\North_IceFloe3.mdx";
const ICE_ROCK = "Doodads\\Icecrown\\Rocks\\Ice_Rock\\Ice_Rock0.mdx";
const SARONITE_RUBBLE = "Doodads\\Icecrown\\Structures\\Icecrown_Rubble\\Icecrown_Rubble0.mdx";

const part = (model: string, x: number, y: number, z: number, scale: readonly [number, number, number], yaw = 0.0): PlatformPart => ({ model, x, y, z, scale, yaw });







const FLOE: readonly [number, number, number] = [f32(1.43), 0.5, f32(0.19)];
const FLOE_Z = f32(-8.7);
const FROZEN_THRONE_PLATFORMS: readonly (readonly PlatformPart[])[] = [
  [part(ICE_FLOE, f32(-1.5), 0, FLOE_Z, FLOE), part(SARONITE_RUBBLE, -40, 10, -6, [f32(2.2), f32(0.6), -f32(0.22)]), part(ICE_ROCK, 80, 0, -6, [1.0, 0.5, -f32(0.15)], 140)],
  [part(ICE_FLOE, f32(1.5), 0, FLOE_Z, FLOE, 180), part(ICE_ROCK, -60, 0, -6, [f32(1.4), f32(0.6), -f32(0.15)]), part(SARONITE_RUBBLE, 70, 10, -6, [f32(1.6), f32(0.6), -f32(0.22)], 200)],
  [part(ICE_FLOE, f32(-1.5), 0, FLOE_Z, FLOE), part(SARONITE_RUBBLE, 0, 10, -8, [2.0, f32(0.6), -f32(1.1)], 20), part(ICE_ROCK, -90, 0, -16, [f32(0.9), 0.5, -f32(0.9)], 260)],
];


export function platformParts(stage: number, index: number): readonly PlatformPart[] {
  if (stage !== FROZEN_THRONE_STAGE || index === 0) return [];
  return FROZEN_THRONE_PLATFORMS[index - 1] ?? [];
}


export const STOCK_PLATFORM_MODELS: readonly string[] = [...new Set(FROZEN_THRONE_PLATFORMS.flatMap((parts) => parts.map(({ model }) => model)))];
