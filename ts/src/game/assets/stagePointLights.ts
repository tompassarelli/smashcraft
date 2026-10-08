// Backdrop omni lights, which tools/stage/package.ts writes into light-only
// models that the stage's scenery places (smashcraft:docs/design/visual-quality.md).
import { CANNON_TEST_STAGE } from "../sim/stage";

type Rgb = readonly [red: number, green: number, blue: number];

/**
 * A light-only model placed in a stage's backdrop: one omni light and no
 * geometry. HD modes draw model omni lights; Classic draws nothing for it, so
 * Classic keeps the stage as it was.
 */
export interface StagePointLight {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly color: Rgb;
  /** The light's mean intensity; it flickers by `flicker` of it either way. */
  readonly intensity: number;
  readonly flicker: number;
  /** Milliseconds per flicker loop. */
  readonly loopMs: number;
  /** Where the light reaches zero, in arena units. */
  readonly radius: number;
  readonly castsShadow: boolean;
}

/**
 * Blackrock's forge fires carry warm omni lights (visual-quality.md, "Levers
 * worth using, per stage": forge-fire omni lights, one shadow-casting). Each
 * sits on its fire piece in hazardStageScenery.ts and fades out thousands of
 * units behind the fight, so it lights the basalt round the fire and never
 * tints a fighter toward the ember ring, which already has the lowest fighter
 * contrast of any stage (#178, ΔE00 21.2).
 */
export const STAGE_POINT_LIGHTS: readonly { readonly stage: number; readonly theme: string; readonly lights: readonly StagePointLight[] }[] = [
  {
    stage: CANNON_TEST_STAGE, theme: "Blackrock", lights: [
      // The fire pillar on the left lights the near crag; its shadow gives the left band depth.
      { x: -2100.0, y: 4600.0, z: -1250.0, color: [255, 150, 70], intensity: 1.25, flicker: 0.125, loopMs: 1600, radius: 1100.0, castsShadow: true },
      // The fire trap at the foot of the right landmark crag.
      { x: 2050.0, y: 6000.0, z: -1300.0, color: [255, 132, 56], intensity: 0.875, flicker: 0.125, loopMs: 2100, radius: 900.0, castsShadow: false },
    ],
  },
];
