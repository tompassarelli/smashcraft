// The stage deck's palette: one texel per material of the deck model that
// tools/stage/package.ts authors. The frame probe looks for these colours.
export type Rgb = readonly [red: number, green: number, blue: number];

export const STAGE_PALETTE = {
  slate: [136, 151, 157],
  brass: [153, 129, 78],
  charcoal: [48, 58, 68],
  steel: [77, 91, 103],
} as const satisfies Record<string, Rgb>;
