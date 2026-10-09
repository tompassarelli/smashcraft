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
  /**
   * Scales key and fill together, 1 when absent. Under 1 over a backdrop
   * brighter than the fighters, which the full light lifts toward it.
   */
  readonly intensity?: number;
}

/** Each selectable stage's light; the first is the neutral one, the classic midday light. */
export const STAGE_LIGHTS: readonly { readonly stage: number; readonly theme: string; readonly light: StageLight }[] = [
  { stage: 0, theme: "Sky", light: { key: [255, 255, 255], ambient: [214, 214, 250] } },
  // Pale glacier daylight, blue fill, at 0.8: at full strength fighters rose
  // 12 L* toward the bright glacier backdrop (#265).
  { stage: FROZEN_THRONE_STAGE, theme: "Icecrown", light: { key: [226, 240, 255], ambient: [150, 172, 220], intensity: 0.800000011920929 } },
  // Moonlit silver key, moonwell-teal fill.
  { stage: WIND_TEST_STAGE, theme: "Nordrassil", light: { key: [236, 246, 232], ambient: [136, 178, 172] } },
  // High mountain sun, sky-blue fill, at 0.2: at full strength fighters rose
  // to the bright sky (abs ΔL 7.7 → 2.4); at 0.2 they hold stock (15.0 → 15.0, #295).
  { stage: CARRIED_TEST_STAGE, theme: "Aerie", light: { key: [255, 248, 226], ambient: [164, 182, 220], intensity: 0.20000000298023224 } },
  // Low desert sun, red-earth fill, at 0.3 below the bright mesa skyline: at 0.65
  // Reforged still lifted fighters 5.7 L* toward it (#266).
  { stage: DRIFTING_DECK_STAGE, theme: "Durotar", light: { key: [255, 226, 180], ambient: [190, 152, 134], intensity: 0.30000001192092896 } },
  // Cold necropolis light, plague-violet fill.
  { stage: PATTERNED_DECKS_STAGE, theme: "Scourge", light: { key: [255, 255, 255], ambient: [180, 156, 196], intensity: 2.0 } },
  // Burning sky key, bright fel-green fill, at 1.25: at 1 the far fighters
  // sat only 5 L* above the red haze (#293).
  { stage: HELLFIRE_STAGE, theme: "Fel", light: { key: [255, 222, 224], ambient: [192, 240, 160], intensity: 1.25 } },
  // A warm ivory key separates fighters from the orange forge backdrop (#292).
  { stage: CANNON_TEST_STAGE, theme: "Blackrock", light: { key: [255, 248, 232], ambient: [170, 124, 112], intensity: 1.2000000476837158 } },
  // Firelit dusk key, smoky mauve fill.
  { stage: STRATHOLME_STAGE, theme: "Stratholme", light: { key: [255, 214, 180], ambient: [170, 140, 150], intensity: 1.2000000476837158 } },
  // Cool sea light, tide-teal fill.
  { stage: TOMB_OF_SARGERAS_STAGE, theme: "Sargeras", light: { key: [226, 244, 255], ambient: [130, 176, 180] } },
  { stage: TIMED_TEST_STAGE, theme: "Qiraji", light: { key: [230, 236, 255], ambient: [150, 162, 204], intensity: 0.30000001192092896 } },
];
