// Raised platforms built from Warcraft's own models instead of the palette slab
// (smashcraft:docs/design/stock-platforms.md). Visual only: collision stays the
// deck's own (smashcraft:ts/src/game/sim/stage.ts).
import { f32 } from "wisp/src/sim/f32";
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

const ICE_FLOE = "Doodads\\Northrend\\Water\\North_IceFloe3\\North_IceFloe3.mdx";
const ICE_ROCK = "Doodads\\Icecrown\\Rocks\\Ice_Rock\\Ice_Rock0.mdx";
const SARONITE_RUBBLE = "Doodads\\Icecrown\\Structures\\Icecrown_Rubble\\Icecrown_Rubble0.mdx";

const part = (model: string, x: number, y: number, z: number, scale: readonly [number, number, number], yaw = 0.0): PlatformPart => ({ model, x, y, z, scale, yaw });

// Icecrown ice over saronite (stage-art rule 10): an alpha-cut ice floe on the
// walking line over rock and rubble hung upside down by a negative height scale.
// Classic and HD draw different floes at the same path: the HD one is a lumpy
// iceberg twice as tall, so the floe is squashed until both tops sit within 3
// units of the line, and only North_IceFloe3 at yaw 0 or 180 spans the deck in
// both modes. Under a side deck everything stays above a standing fighter's head.
const FLOE: readonly [number, number, number] = [f32(1.43), 0.5, f32(0.19)];
const FLOE_Z = f32(-8.7);
const FROZEN_THRONE_PLATFORMS: readonly (readonly PlatformPart[])[] = [
  [part(ICE_FLOE, f32(-1.5), 0, FLOE_Z, FLOE), part(SARONITE_RUBBLE, -40, 10, -6, [f32(2.2), f32(0.6), -f32(0.22)]), part(ICE_ROCK, 80, 0, -6, [1.0, 0.5, -f32(0.15)], 140)],
  [part(ICE_FLOE, f32(1.5), 0, FLOE_Z, FLOE, 180), part(ICE_ROCK, -60, 0, -6, [f32(1.4), f32(0.6), -f32(0.15)]), part(SARONITE_RUBBLE, 70, 10, -6, [f32(1.6), f32(0.6), -f32(0.22)], 200)],
  [part(ICE_FLOE, f32(-1.5), 0, FLOE_Z, FLOE), part(SARONITE_RUBBLE, 0, 10, -8, [2.0, f32(0.6), -f32(1.1)], 20), part(ICE_ROCK, -90, 0, -16, [f32(0.9), 0.5, -f32(0.9)], 260)],
];

/** The stock parts drawn for one raised deck of a stage, first part in place of the slab; empty keeps the slab. */
export function platformParts(stage: number, index: number): readonly PlatformPart[] {
  if (stage !== FROZEN_THRONE_STAGE || index === 0) return [];
  return FROZEN_THRONE_PLATFORMS[index - 1] ?? [];
}

/** Every stock model a stock-built platform draws. */
export const STOCK_PLATFORM_MODELS: readonly string[] = [...new Set(FROZEN_THRONE_PLATFORMS.flatMap((parts) => parts.map(({ model }) => model)))];
