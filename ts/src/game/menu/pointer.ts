// The mouse pointer in UI frame coordinates: Warcraft draws frames in a 4:3
// area 0.6 high, centered on a screen of any shape. Menus read the pointer
// locally; only a finished choice crosses a sync event, so this is not
// synchronized arithmetic.

/** Frame x of a pixel column on a screen `width` by `height` pixels. */
export function pointerX(pixelX: number, width: number, height: number): number {
  return ((pixelX - (width - (height * 4) / 3) / 2) * 0.6000000238418579) / height;
}

/** Frame y of a pixel row counted from the top of the screen. */
export function pointerY(pixelY: number, height: number): number {
  return 0.6000000238418579 - (pixelY * 0.6000000238418579) / height;
}
