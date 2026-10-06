import { f32 } from "wisp/src/sim/f32";
// Fighter portrait frame sizes. The UI is 0.6 units tall at any resolution, so a
// unit is 3200 pixels on the owner's 2880x1920 display. The rendered portrait
// textures (tools/selection/render-fighters.ts) are drawn at those pixel sizes
// or smaller; a texture stretched past its own pixels shows blurred.

/** The display the portraits are sized for, in pixels tall. */
export const REFERENCE_HEIGHT_PX = 1920;
/** The rendered grid tile and card textures, square. */
export const TILE_TEXTURE_PX = 256;
export const CARD_TEXTURE_PX = 384;

/** UI units that cover `pixels` on the reference display. */
export const unitsForPixels = (pixels: number): number => (pixels * f32(0.6)) / REFERENCE_HEIGHT_PX;
/** Pixels that `units` cover on a display `height` pixels tall. */
export const pixelsForUnits = (units: number, height: number): number => (units * height) / f32(0.6);

/** The player card and HUD plate portraits: the card render at its own size. */
export const CARD_PORTRAIT = unitsForPixels(CARD_TEXTURE_PX);
export const HUD_PORTRAIT = unitsForPixels(CARD_TEXTURE_PX);
/** The off-screen bubble: the grid tile at half size. */
export const OFFSCREEN_PORTRAIT = unitsForPixels(TILE_TEXTURE_PX / 2);
/** The grid tile's portrait slot at full cell size. */
export const TILE_PORTRAIT_SLOT = f32(0.087);

/** A roster tile's portrait at cell `scale`: its slot, never past the tile render's own pixels. */
export function tilePortrait(scale: number): number {
  return Math.min(TILE_PORTRAIT_SLOT * scale, unitsForPixels(TILE_TEXTURE_PX));
}
