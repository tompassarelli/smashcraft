// Raised platforms built from Warcraft's own models instead of the palette slab
// (smashcraft:docs/design/stock-platforms.md). Visual only: collision stays the
// deck's own (smashcraft:ts/src/game/sim/stage.ts).
import { FROZEN_THRONE_STAGE } from "../sim/stage";

/** One stock model placed relative to a raised deck's centre on its walking line. */
export interface PlatformPart {
  readonly model: string;
  /** Offset from the deck's centre: x across the screen, y in depth, z up. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Per-axis scale in the model's own axes, before the turn. */
  readonly scale: readonly [x: number, y: number, z: number];
  /** Turn about the vertical axis, in degrees. */
  readonly yaw: number;
}

const ICE_FLOE = "Doodads\\Northrend\\Water\\North_IceFloe2\\North_IceFloe2.mdx";
const ICE_FLOE_ROUND = "Doodads\\Northrend\\Water\\North_IceFloe3\\North_IceFloe3.mdx";
const ICE_ROCK = "Doodads\\Icecrown\\Rocks\\Ice_Rock\\Ice_Rock0.mdx";
const SARONITE_RUBBLE = "Doodads\\Icecrown\\Structures\\Icecrown_Rubble\\Icecrown_Rubble0.mdx";

const part = (model: string, x: number, y: number, z: number, scale: readonly [number, number, number], yaw = 0.0): PlatformPart => ({ model, x, y, z, scale, yaw });

// Icecrown ice over saronite (stage-art rule 10): an alpha-cut ice floe, its top
// (z 31.7 in the model) on the walking line, over rock and rubble hung upside down
// by a negative height scale. The floes are 218-282 units wide; each deck is 330.
const FROZEN_THRONE_PLATFORMS: readonly (readonly PlatformPart[])[] = [
  [part(ICE_FLOE, 0, 0, -25, [1.17, 0.45, 0.8]), part(SARONITE_RUBBLE, -40, 10, -8, [2.2, 0.6, -0.9]), part(ICE_ROCK, 80, 0, -8, [1.0, 0.5, -1.1], 140)],
  [part(ICE_FLOE, 0, 0, -25, [1.17, 0.45, 0.8], 180), part(ICE_ROCK, -60, 0, -8, [1.4, 0.6, -1.2]), part(SARONITE_RUBBLE, 70, 10, -8, [1.6, 0.6, -0.7], 200)],
  [part(ICE_FLOE_ROUND, 0, 0, -25, [0.5, 1.45, 0.8], 90), part(SARONITE_RUBBLE, 20, 10, -8, [2.6, 0.6, -1.1], 20), part(ICE_ROCK, -90, 0, -8, [0.9, 0.5, -0.9], 260)],
];

/** The stock parts drawn for one raised deck of a stage, first part in place of the slab; empty keeps the slab. */
export function platformParts(stage: number, index: number): readonly PlatformPart[] {
  if (stage !== FROZEN_THRONE_STAGE || index === 0) return [];
  return FROZEN_THRONE_PLATFORMS[index - 1] ?? [];
}

/** Every stock model a stock-built platform draws. */
export const STOCK_PLATFORM_MODELS: readonly string[] = [...new Set(FROZEN_THRONE_PLATFORMS.flatMap((parts) => parts.map(({ model }) => model)))];
