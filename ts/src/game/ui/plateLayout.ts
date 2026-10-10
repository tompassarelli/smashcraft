import { f32 } from "wisp/src/sim/f32";
import { toInt } from "wisp/src/sim/binary32";
import { idiv, imod } from "wisp/src/sim/intMath";
import { unitsForPixels } from "./portraitFrames";




export const PLATE_WIDTH_PX = 544;
export const PLATE_HEIGHT_PX = 192;

const PLATE_BOTTOM = f32(0.012);
export const PLATE_TOP = PLATE_BOTTOM + unitsForPixels(PLATE_HEIGHT_PX);

export interface PlateBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}


export const BUST_BOX: PlateBox = { x: -12, y: -96, width: 256, height: 256 };
// Warcraft wraps oversized frame text onto a hidden second line; reserve enough width for damage digits.




export const DAMAGE_BOX: PlateBox = { x: 150, y: -4, width: 284, height: 124 };
export const TENTHS_BOX: PlateBox = { x: 450, y: 34, width: 86, height: 70 };

export const MANA_BOX: PlateBox = { x: 256, y: 120, width: 270, height: 16 };

export const MANA_BAR_HEIGHT_PX = 12;

export const NAME_BOX: PlateBox = { x: 244, y: 148, width: 228, height: 30 };
export const SLOT_BOX: PlateBox = { x: 472, y: 148, width: 40, height: 30 };

export const STOCK_ICON_PX = 64;
export const STOCK_STEP_PX = 56;
export const STOCK_ROW: PlateBox = { x: 244, y: -88, width: STOCK_ICON_PX, height: STOCK_ICON_PX };

export const STOCK_ICONS_SHOWN = 5;


export function plateLeft(position: number, count: number): number {
  const spacing = f32(0.76) / count;
  return f32(0.02) + spacing * (position + 0.5) - unitsForPixels(PLATE_WIDTH_PX) / 2;
}


export const boxLeft = (left: number, box: PlateBox): number => left + unitsForPixels(box.x);
export const boxTop = (box: PlateBox): number => PLATE_TOP - unitsForPixels(box.y);


const RAMP_DAMAGE = [0, 40, 80, 125, 200] as const;
const RAMP_COLOUR = [0xffffff, 0xfff27a, 0xffa53a, 0xf2382b, 0x9a0f12] as const;

const channel = (colour: number, shift: number) => imod(idiv(colour, shift), 256);
const lerp = (from: number, to: number, step: number, steps: number) => from + idiv((to - from) * step, steps);


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

export const damageWhole = (damage: number): string => `${colourCode(damage)}${toInt(damage)}|r`;

export const damageTenths = (damage: number): string => `${colourCode(damage)}.${imod(toInt(damage * 10), 10)}%|r`;


export const SHAKE_FRAMES = 14;

export const SHAKE_MAX_PX = 14;
const SHAKE_X = [1, -1, 0.75, -0.5, 1, -0.75, 0.5, -1, 0.25, -0.5, 0.5, -0.25, 0.25, 0] as const;
const SHAKE_Y = [-0.5, 0.75, -1, 0.5, -0.25, 1, -0.75, 0.25, -0.5, 0.75, -0.25, 0.5, -0.25, 0] as const;


export const shakeStrength = (damageAdded: number): number => Math.min(SHAKE_MAX_PX, 4 + damageAdded * f32(0.5));

const shake = (pattern: readonly number[], strength: number, frame: number): number =>
  frame < 0 || frame >= SHAKE_FRAMES ? 0.0 : (strength * (SHAKE_FRAMES - frame) * (pattern[frame] ?? 0)) / SHAKE_FRAMES;

export const shakeX = (strength: number, frame: number): number => shake(SHAKE_X, strength, frame);
export const shakeY = (strength: number, frame: number): number => shake(SHAKE_Y, strength, frame);
