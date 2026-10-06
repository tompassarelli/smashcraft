import { f32 } from "wisp/src/sim/f32";
import { toInt } from "wisp/src/sim/binary32";
import { idiv, imod } from "wisp/src/sim/intMath";
import { unitsForPixels } from "./portraitFrames";
// The match HUD plate's layout and its damage readout. Every box is in pixels
// of the plate art (tools/selection/art/HudPlate.svg, 544x192) from its top
// left, y down, and is drawn 1:1 on the 1920-tall reference display.

export const PLATE_WIDTH_PX = 544;
export const PLATE_HEIGHT_PX = 192;
/** The plate's bottom edge, above the bottom of the screen. */
const PLATE_BOTTOM = f32(0.012);
export const PLATE_TOP = PLATE_BOTTOM + unitsForPixels(PLATE_HEIGHT_PX);

export interface PlateBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The fighter's head-and-shoulders render, breaking out of the plate's top. */
export const BUST_BOX: PlateBox = { x: -12, y: -96, width: 256, height: 256 };
/** The whole percent, right-aligned against the tenths and percent sign, which are smaller (Ultimate). */
export const DAMAGE_BOX: PlateBox = { x: 236, y: -4, width: 214, height: 124 };
export const TENTHS_BOX: PlateBox = { x: 450, y: 34, width: 86, height: 70 };
/** The mana bar's track in the plate art (the mana bar is drawn by ui/manaBar). */
export const MANA_BOX: PlateBox = { x: 256, y: 120, width: 270, height: 16 };
/** The bar inside the track, leaving room for an edge above and below. */
export const MANA_BAR_HEIGHT_PX = 12;
export const NAME_BOX: PlateBox = { x: 244, y: 148, width: 200, height: 30 };
export const SLOT_BOX: PlateBox = { x: 448, y: 148, width: 60, height: 30 };
/** Stock icons sit in a row above the plate's right half. */
export const STOCK_ICON_PX = 64;
export const STOCK_STEP_PX = 56;
export const STOCK_ROW: PlateBox = { x: 244, y: -70, width: STOCK_ICON_PX, height: STOCK_ICON_PX };
/** Past this many stocks the row shows one icon and the count. */
export const STOCK_ICONS_SHOWN = 5;

/** The left edge of plate `position` of `count`, evenly spaced across the screen. */
export function plateLeft(position: number, count: number): number {
  const spacing = f32(0.76) / count;
  return f32(0.02) + spacing * (position + 0.5) - unitsForPixels(PLATE_WIDTH_PX) / 2;
}

/** A box's top left in UI units, for a plate whose left edge is `left`. */
export const boxLeft = (left: number, box: PlateBox): number => left + unitsForPixels(box.x);
export const boxTop = (box: PlateBox): number => PLATE_TOP - unitsForPixels(box.y);

/** Damage colour stops: white, yellow, orange, red, dark red, as Melee and Ultimate ramp it. */
const RAMP_DAMAGE = [0, 40, 80, 125, 200] as const;
const RAMP_COLOUR = [0xffffff, 0xfff27a, 0xffa53a, 0xf2382b, 0x9a0f12] as const;

const channel = (colour: number, shift: number) => imod(idiv(colour, shift), 256);
const lerp = (from: number, to: number, step: number, steps: number) => from + idiv((to - from) * step, steps);

/** The damage readout's colour at `damage`, as 0xRRGGBB. */
export function damageColour(damage: number): number {
  const whole = toInt(damage);
  for (let index = 1; index < RAMP_DAMAGE.length; index++) {
    const high = RAMP_DAMAGE[index] ?? 0;
    if (whole < high) {
      const low = RAMP_DAMAGE[index - 1] ?? 0;
      const from = RAMP_COLOUR[index - 1] ?? 0;
      const to = RAMP_COLOUR[index] ?? 0;
      const step = whole - low;
      const steps = high - low;
      return lerp(channel(from, 65536), channel(to, 65536), step, steps) * 65536
        + lerp(channel(from, 256), channel(to, 256), step, steps) * 256
        + lerp(channel(from, 1), channel(to, 1), step, steps);
    }
  }
  return RAMP_COLOUR[RAMP_COLOUR.length - 1] ?? 0;
}

const HEX = "0123456789abcdef";
const hexByte = (value: number) => `${HEX.charAt(idiv(value, 16))}${HEX.charAt(imod(value, 16))}`;

const colourCode = (damage: number) => {
  const colour = damageColour(damage);
  return `|cff${hexByte(channel(colour, 65536))}${hexByte(channel(colour, 256))}${hexByte(channel(colour, 1))}`;
};
/** The damage readout's whole percent, in its ramp colour. */
export const damageWhole = (damage: number): string => `${colourCode(damage)}${toInt(damage)}|r`;
/** Its truncated tenth and percent sign, drawn smaller beside it. */
export const damageTenths = (damage: number): string => `${colourCode(damage)}.${imod(toInt(damage * 10), 10)}%|r`;

/** Rendered frames a hit shakes the readout for. */
export const SHAKE_FRAMES = 14;
/** The largest shake, in plate pixels; a hit's damage sets its size up to this. */
export const SHAKE_MAX_PX = 14;
const SHAKE_X = [1, -1, 0.75, -0.5, 1, -0.75, 0.5, -1, 0.25, -0.5, 0.5, -0.25, 0.25, 0] as const;
const SHAKE_Y = [-0.5, 0.75, -1, 0.5, -0.25, 1, -0.75, 0.25, -0.5, 0.75, -0.25, 0.5, -0.25, 0] as const;

/** A hit's shake strength in plate pixels: bigger hits shake harder. */
export const shakeStrength = (damageAdded: number): number => Math.min(SHAKE_MAX_PX, 4 + damageAdded * f32(0.5));

const shake = (pattern: readonly number[], strength: number, frame: number): number =>
  frame < 0 || frame >= SHAKE_FRAMES ? 0.0 : (strength * (SHAKE_FRAMES - frame) * (pattern[frame] ?? 0)) / SHAKE_FRAMES;
/** The readout's offset in plate pixels `frame` rendered frames into a shake of `strength`; zero once it ends. */
export const shakeX = (strength: number, frame: number): number => shake(SHAKE_X, strength, frame);
export const shakeY = (strength: number, frame: number): number => shake(SHAKE_Y, strength, frame);
