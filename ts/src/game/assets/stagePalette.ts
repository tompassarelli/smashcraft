// The stage decks' palettes: one texel per material of the deck models that
// tools/stage/package.ts authors. The frame probe looks for these colours.
// Themes and value rules: smashcraft:docs/design/stage-art.md, rule 10.
import { CANNON_TEST_STAGE, CARRIED_TEST_STAGE, DRIFTING_DECK_STAGE, FROZEN_THRONE_STAGE, HELLFIRE_STAGE, PATTERNED_DECKS_STAGE, TIMED_TEST_STAGE, WIND_TEST_STAGE } from "../sim/stage";

type Rgb = readonly [red: number, green: number, blue: number];

/** Sky Deck's neutral palette, which every other theme departs from. */
export const STAGE_PALETTE = {
  slate: [136, 151, 157],
  brass: [153, 129, 78],
  charcoal: [48, 58, 68],
  steel: [77, 91, 103],
} as const satisfies Record<string, Rgb>;

/** A deck's materials: walking surface, lip, body and recessed underside. */
export interface DeckPalette {
  readonly top: Rgb;
  readonly lip: Rgb;
  readonly body: Rgb;
  readonly underside: Rgb;
}

/** Sky Deck's deck materials. */
export const NEUTRAL_DECK_PALETTE: DeckPalette = { top: STAGE_PALETTE.slate, lip: STAGE_PALETTE.brass, body: STAGE_PALETTE.charcoal, underside: STAGE_PALETTE.steel };

/** Each selectable stage's deck palette; the first is the neutral one. */
export const STAGE_DECK_PALETTES: readonly { readonly stage: number; readonly theme: string; readonly palette: DeckPalette }[] = [
  { stage: 0, theme: "Sky", palette: NEUTRAL_DECK_PALETTE },
  // Icecrown ice over dark saronite.
  { stage: FROZEN_THRONE_STAGE, theme: "Icecrown", palette: { top: [200, 226, 240], lip: [92, 132, 168], body: [38, 48, 66], underside: [58, 72, 92] } },
  // Silvered Night Elf bark with a moonwell-teal lip.
  { stage: WIND_TEST_STAGE, theme: "Nordrassil", palette: { top: [168, 150, 124], lip: [110, 170, 160], body: [58, 44, 40], underside: [80, 66, 60] } },
  // Dwarven granite, Alliance gold and blue.
  { stage: CARRIED_TEST_STAGE, theme: "Aerie", palette: { top: [120, 118, 112], lip: [176, 142, 62], body: [44, 54, 76], underside: [70, 80, 100] } },
  // Orc hide planks over dark wood, rust-iron lip.
  { stage: DRIFTING_DECK_STAGE, theme: "Durotar", palette: { top: [214, 180, 130], lip: [140, 62, 40], body: [70, 46, 34], underside: [96, 66, 46] } },
  // Scourge stone over black iron, plague-green lip.
  { stage: PATTERNED_DECKS_STAGE, theme: "Scourge", palette: { top: [160, 168, 176], lip: [100, 170, 110], body: [34, 38, 48], underside: [60, 66, 80] } },
  // Red fel stone, charred body, fel-green lip.
  { stage: HELLFIRE_STAGE, theme: "Fel", palette: { top: [176, 140, 124], lip: [120, 190, 60], body: [54, 34, 32], underside: [84, 52, 46] } },
  // Basalt over black rock, molten lip.
  { stage: CANNON_TEST_STAGE, theme: "Blackrock", palette: { top: [132, 126, 122], lip: [210, 112, 40], body: [36, 32, 32], underside: [64, 56, 52] } },
  // Pale sandstone, scarab-gold lip.
  { stage: TIMED_TEST_STAGE, theme: "Qiraji", palette: { top: [224, 204, 160], lip: [170, 130, 50], body: [110, 84, 56], underside: [138, 108, 74] } },
];

/** Rec. 601 luma, 0 to 255, in integers so the emitted Lua agrees. */
export const luma = ([red, green, blue]: Rgb): number => (299 * red + 587 * green + 114 * blue) / 1000;
