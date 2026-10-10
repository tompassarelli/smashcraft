import { f32 } from "wisp/src/sim/f32";






const REFERENCE_HEIGHT_PX = 1920;

export const TILE_TEXTURE_PX = 256;
export const CARD_TEXTURE_PX = 384;


export const unitsForPixels = (pixels: number): number => (pixels * f32(0.6)) / REFERENCE_HEIGHT_PX;

export const pixelsForUnits = (units: number, height: number): number => (units * height) / f32(0.6);



export const OFFSCREEN_PORTRAIT = unitsForPixels(TILE_TEXTURE_PX / 2);

export const TILE_PORTRAIT_SLOT = f32(0.087);


export function tilePortrait(scale: number): number {
  return Math.min(TILE_PORTRAIT_SLOT * scale, unitsForPixels(TILE_TEXTURE_PX));
}

/** A player card's preview area: below its tag, above its name box, and above the CPU summary on a computer's card. */
export const CARD_PREVIEW = { top: f32(0.245), bottom: f32(0.103), computerBottom: f32(0.139) } as const;

/** The card portrait's square, centred in its card's preview area and as large as the area and the card render allow. */
export function cardPortrait(computer: boolean): { readonly top: number; readonly size: number } {
  const bottom = computer ? CARD_PREVIEW.computerBottom : CARD_PREVIEW.bottom;
  const size = Math.min(CARD_PREVIEW.top - bottom, unitsForPixels(CARD_TEXTURE_PX));
  return { top: (CARD_PREVIEW.top + bottom + size) / 2, size };
}
