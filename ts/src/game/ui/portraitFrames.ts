import { f32 } from "wisp/src/sim/f32";






export const REFERENCE_HEIGHT_PX = 1920;

export const TILE_TEXTURE_PX = 256;
export const CARD_TEXTURE_PX = 384;


export const unitsForPixels = (pixels: number): number => (pixels * f32(0.6)) / REFERENCE_HEIGHT_PX;

export const pixelsForUnits = (units: number, height: number): number => (units * height) / f32(0.6);



export const OFFSCREEN_PORTRAIT = unitsForPixels(TILE_TEXTURE_PX / 2);

export const TILE_PORTRAIT_SLOT = f32(0.087);


export function tilePortrait(scale: number): number {
  return Math.min(TILE_PORTRAIT_SLOT * scale, unitsForPixels(TILE_TEXTURE_PX));
}
