// Each stage's mood light: a key and its ambient fill. Every stage draws with
// the stock light; sceneryColor (presentation/stageScenery.ts) carries this
// light's ratio to the stock one on the scenery only, never on the fighters.
// Rules and measurements: smashcraft:docs/design/visual-quality.md.
import { CANNON_TEST_STAGE, CARRIED_TEST_STAGE, DRIFTING_DECK_STAGE, FROZEN_THRONE_STAGE, HELLFIRE_STAGE, PATTERNED_DECKS_STAGE, STRATHOLME_STAGE, TIMED_TEST_STAGE, TOMB_OF_SARGERAS_STAGE, WIND_TEST_STAGE } from "../sim/stage";

type Rgb = readonly [red: number, green: number, blue: number];


export interface StageLight {

  readonly key: Rgb;

  readonly ambient: Rgb;




  readonly intensity?: number;
}


export const STAGE_LIGHTS: readonly { readonly stage: number; readonly theme: string; readonly light: StageLight }[] = [
  { stage: 0, theme: "Sky", light: { key: [255, 255, 255], ambient: [214, 214, 250] } },


  { stage: FROZEN_THRONE_STAGE, theme: "Icecrown", light: { key: [226, 240, 255], ambient: [150, 172, 220], intensity: 0.800000011920929 } },

  { stage: WIND_TEST_STAGE, theme: "Nordrassil", light: { key: [236, 246, 232], ambient: [136, 178, 172] } },


  { stage: CARRIED_TEST_STAGE, theme: "Aerie", light: { key: [255, 248, 226], ambient: [164, 182, 220], intensity: 1.25 } },


  { stage: DRIFTING_DECK_STAGE, theme: "Durotar", light: { key: [255, 236, 214], ambient: [214, 196, 190], intensity: 1.25 } },

  { stage: PATTERNED_DECKS_STAGE, theme: "Scourge", light: { key: [255, 255, 255], ambient: [180, 156, 196], intensity: 2.0 } },


  { stage: HELLFIRE_STAGE, theme: "Fel", light: { key: [255, 222, 224], ambient: [192, 240, 180], intensity: 1.25 } },

  { stage: CANNON_TEST_STAGE, theme: "Blackrock", light: { key: [255, 248, 236], ambient: [176, 160, 170], intensity: 1.25 } },

  { stage: STRATHOLME_STAGE, theme: "Stratholme", light: { key: [255, 214, 180], ambient: [170, 140, 150], intensity: 1.2000000476837158 } },

  { stage: TOMB_OF_SARGERAS_STAGE, theme: "Sargeras", light: { key: [226, 244, 255], ambient: [130, 176, 180] } },
  { stage: TIMED_TEST_STAGE, theme: "Qiraji", light: { key: [230, 236, 255], ambient: [150, 162, 204], intensity: 0.30000001192092896 } },
];
