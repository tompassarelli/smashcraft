// Each stage's light: one directional key light and its ambient fill, which
// tools/stage/package.ts writes into the stage's day/night lighting model.
// Fighters and scenery effects take this light; the decks are unshaded.
// Rules and measurements: smashcraft:docs/design/visual-quality.md.
import { CANNON_TEST_STAGE, CARRIED_TEST_STAGE, DRIFTING_DECK_STAGE, FROZEN_THRONE_STAGE, HELLFIRE_STAGE, PATTERNED_DECKS_STAGE, STRATHOLME_STAGE, TIMED_TEST_STAGE, TOMB_OF_SARGERAS_STAGE, WIND_TEST_STAGE } from "../sim/stage";

type Rgb = readonly [red: number, green: number, blue: number];

/** A stage's light colours, 0 to 255 per channel. */
export interface StageLight {
  /** The directional key light, from the front left and above as the classic sun shines. */
  readonly key: Rgb;
  /** The fill every surface gets, which sets how dark a fighter's shaded side reads. */
  readonly ambient: Rgb;
}

/** Each selectable stage's light; the first is the neutral one, the classic midday light. */
export const STAGE_LIGHTS: readonly { readonly stage: number; readonly theme: string; readonly light: StageLight }[] = [
  { stage: 0, theme: "Sky", light: { key: [255, 255, 255], ambient: [214, 214, 250] } },
  // Pale glacier daylight, blue fill.
  { stage: FROZEN_THRONE_STAGE, theme: "Icecrown", light: { key: [226, 240, 255], ambient: [150, 172, 220] } },
  // Moonlit silver key, moonwell-teal fill.
  { stage: WIND_TEST_STAGE, theme: "Nordrassil", light: { key: [236, 246, 232], ambient: [136, 178, 172] } },
  // High mountain sun, sky-blue fill.
  { stage: CARRIED_TEST_STAGE, theme: "Aerie", light: { key: [255, 248, 226], ambient: [164, 182, 220] } },
  // Low desert sun, red-earth fill.
  { stage: DRIFTING_DECK_STAGE, theme: "Durotar", light: { key: [255, 226, 180], ambient: [190, 152, 134] } },
  // Cold necropolis light, plague-violet fill.
  { stage: PATTERNED_DECKS_STAGE, theme: "Scourge", light: { key: [222, 230, 255], ambient: [150, 136, 196] } },
  // Burning sky key, fel-green fill.
  { stage: HELLFIRE_STAGE, theme: "Fel", light: { key: [255, 222, 196], ambient: [140, 172, 120] } },
  // Forge-orange key, ember fill.
  { stage: CANNON_TEST_STAGE, theme: "Blackrock", light: { key: [255, 216, 176], ambient: [170, 124, 112] } },
  // Bleached sandstone sun, warm sand fill.
  // Firelit dusk key, smoky mauve fill.
  { stage: STRATHOLME_STAGE, theme: "Stratholme", light: { key: [255, 214, 180], ambient: [170, 140, 150] } },
  // Cool sea light, tide-teal fill.
  { stage: TOMB_OF_SARGERAS_STAGE, theme: "Sargeras", light: { key: [226, 244, 255], ambient: [130, 176, 180] } },
  { stage: TIMED_TEST_STAGE, theme: "Qiraji", light: { key: [255, 240, 204], ambient: [192, 170, 136] } },
];
