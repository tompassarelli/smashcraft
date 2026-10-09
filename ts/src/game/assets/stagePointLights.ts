

import { CANNON_TEST_STAGE, HELLFIRE_STAGE, PATTERNED_DECKS_STAGE, STRATHOLME_STAGE } from "../sim/stage";

type Rgb = readonly [red: number, green: number, blue: number];






export interface StagePointLight {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly color: Rgb;

  readonly intensity: number;
  readonly flicker: number;

  readonly loopMs: number;

  readonly radius: number;
  readonly castsShadow: boolean;
}









export const STAGE_POINT_LIGHTS: readonly { readonly stage: number; readonly theme: string; readonly lights: readonly StagePointLight[] }[] = [
  {
    stage: PATTERNED_DECKS_STAGE, theme: "Naxxramas", lights: [

      { x: 1900.0, y: 4800.0, z: 500.0, color: [96, 220, 168], intensity: 0.875, flicker: 0.0, loopMs: 2400, radius: 1400.0, castsShadow: true },
    ],
  },
  {

    stage: HELLFIRE_STAGE, theme: "Hellfire", lights: [
      { x: -1850.0, y: 4500.0, z: -1100.0, color: [96, 255, 40], intensity: 0.875, flicker: 0.125, loopMs: 2400, radius: 950.0, castsShadow: true },
      { x: 2150.0, y: 3700.0, z: -1450.0, color: [80, 255, 32], intensity: 0.625, flicker: 0.125, loopMs: 2800, radius: 450.0, castsShadow: false },
    ],
  },
  {
    stage: CANNON_TEST_STAGE, theme: "Blackrock", lights: [

      { x: -2100.0, y: 4600.0, z: -1250.0, color: [255, 150, 70], intensity: 1.25, flicker: 0.125, loopMs: 1600, radius: 1100.0, castsShadow: true },

      { x: 2050.0, y: 6000.0, z: -1300.0, color: [255, 132, 56], intensity: 0.875, flicker: 0.125, loopMs: 2100, radius: 900.0, castsShadow: false },
    ],
  },
  {
    stage: STRATHOLME_STAGE, theme: "Stratholme", lights: [

      { x: 1250.0, y: 6000.0, z: -900.0, color: [255, 150, 70], intensity: 1.25, flicker: 0.125, loopMs: 1600, radius: 1100.0, castsShadow: true },
      { x: -2250.0, y: 2650.0, z: -1000.0, color: [255, 132, 56], intensity: 0.875, flicker: 0.125, loopMs: 2100, radius: 900.0, castsShadow: false },
    ],
  },
];
