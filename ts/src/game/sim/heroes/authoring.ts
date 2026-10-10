import { f32 } from "wisp/src/sim/f32";
import type { HitElement } from "../codes";
import { type MoveRegion, type StrikeCapsule, heroHurtPose, heroRegion } from "../heroMoves";
import type { HitEffect } from "../hitRegions";
import { type HurtPart, hurtPart } from "../hurtboxes";

/** Launch directions by degrees from facing; literals so every runtime reads the same floats. */
export const ANGLES = {
  0: { x: 1.0, z: 0.0 },
  10: { x: f32(0.984807753), z: f32(0.173648178) },
  15: { x: f32(0.965925826), z: f32(0.258819045) },
  20: { x: f32(0.939692621), z: f32(0.342020143) },
  25: { x: f32(0.906307787), z: f32(0.422618262) },
  30: { x: f32(0.866025404), z: 0.5 },
  35: { x: f32(0.819152044), z: f32(0.573576436) },
  40: { x: f32(0.766044443), z: f32(0.642787610) },
  45: { x: f32(0.707106781), z: f32(0.707106781) },
  50: { x: f32(0.642787610), z: f32(0.766044443) },
  55: { x: f32(0.573576436), z: f32(0.819152044) },
  60: { x: 0.5, z: f32(0.866025404) },
  65: { x: f32(0.422618262), z: f32(0.906307787) },
  70: { x: f32(0.342020143), z: f32(0.939692621) },
  75: { x: f32(0.258819045), z: f32(0.965925826) },
  80: { x: f32(0.173648178), z: f32(0.984807753) },
  85: { x: f32(0.087155743), z: f32(0.996194698) },
  90: { x: 0.0, z: 1.0 },
  95: { x: f32(-0.087155743), z: f32(0.996194698) },
  100: { x: f32(-0.173648178), z: f32(0.984807753) },
  160: { x: f32(-0.939692621), z: f32(0.342020143) },
  180: { x: -1.0, z: 0.0 },
  200: { x: f32(-0.939692621), z: f32(-0.342020143) },
  225: { x: f32(-0.707106781), z: f32(-0.707106781) },
  250: { x: f32(-0.342020143), z: f32(-0.939692621) },
  270: { x: 0.0, z: -1.0 },
  290: { x: f32(0.342020143), z: f32(-0.939692621) },
  315: { x: f32(0.707106781), z: f32(-0.707106781) },
  340: { x: f32(0.939692621), z: f32(-0.342020143) },
} as const;
export type Angle = keyof typeof ANGLES;

interface LaunchStrength { readonly growth: number; readonly base: number }
type HitMaker<Kind extends string> = (damage: number, kind: Kind, angle: Angle, facing?: number, element?: HitElement) => Readonly<HitEffect>;

/** A hero's hit builder over its own launch classes; `facing` mirrors the launch. */
export function makeHit<Kind extends string>(classes: { readonly [kind in Kind]: LaunchStrength }, defaultElement: HitElement): HitMaker<Kind> {
  return (damage, kind, angle, facing = 1.0, element = defaultElement) => {
    const strength = classes[kind];
    const direction = ANGLES[angle];
    return { damage, growth: strength.growth, base: strength.base, launchX: f32(direction.x * facing), launchZ: direction.z, electric: false, element };
  };
}

type CapsuleMaker = (x1: number, z1: number, x2: number, z2: number, radius?: number) => StrikeCapsule;

export function capsuleOf(defaultRadius: number): CapsuleMaker {
  return (x1, z1, x2, z2, radius = defaultRadius) => ({ x1, z1, x2, z2, radius });
}

/** One strike capsule per frame from `first`. */
export function path(first: number, strikes: readonly StrikeCapsule[], effect: Readonly<HitEffect>, groundedEffect?: Readonly<HitEffect>): readonly MoveRegion[] {
  return strikes.map((strike, index) => heroRegion(first + index, first + index, strike, effect, groundedEffect));
}

type LimbMaker = (x1: number, z1: number, x2: number, z2: number, radius?: number) => readonly HurtPart[];

/** The body plus one reaching limb capsule. */
export function limbOf(body: HurtPart, defaultRadius: number): LimbMaker {
  return (x1, z1, x2, z2, radius = defaultRadius) => [body, hurtPart(x1, z1, x2, z2, radius)];
}

/** Holds `parts` from 2 frames before the active window to 1 frame after it. */
export const reaching = (first: number, active: number, parts: readonly HurtPart[]) => [heroHurtPose(first - 2, first + active + 1, parts)];
