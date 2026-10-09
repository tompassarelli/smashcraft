




import { f32 } from "wisp/src/sim/f32";
import { HitElement } from "../codes";
import { type AuthoredMove, type MoveRegion, type StrikeCapsule, heroRegion } from "../heroMoves";
import type { HitEffect } from "../hitRegions";






function linkHit(damage: number, base: number, x: number, z: number, element: HitElement = HitElement.slash): Readonly<HitEffect> {
  return { damage, growth: 0.0, base, launchX: f32(x), launchZ: f32(z), electric: false, element, carry: true };
}


const DIRECTION = {
  0: { x: 1.0, z: 0.0 },
  20: { x: f32(0.939692621), z: f32(0.342020143) },
  45: { x: f32(0.707106781), z: f32(0.707106781) },
  50: { x: f32(0.642787610), z: f32(0.766044443) },
  70: { x: f32(0.342020143), z: f32(0.939692621) },
  80: { x: f32(0.173648178), z: f32(0.984807753) },
  85: { x: f32(0.087155743), z: f32(0.996194698) },
  90: { x: 0.0, z: 1.0 },
  95: { x: f32(-0.087155743), z: f32(0.996194698) },
  100: { x: f32(-0.173648178), z: f32(0.984807753) },
  160: { x: f32(-0.939692621), z: f32(0.342020143) },
  200: { x: f32(-0.939692621), z: f32(-0.342020143) },
  225: { x: f32(-0.707106781), z: f32(-0.707106781) },
  250: { x: f32(-0.342020143), z: f32(-0.939692621) },
  270: { x: 0.0, z: -1.0 },
  290: { x: f32(0.342020143), z: f32(-0.939692621) },
  315: { x: f32(0.707106781), z: f32(-0.707106781) },
  340: { x: f32(0.939692621), z: f32(-0.342020143) },
} as const;
type Degrees = keyof typeof DIRECTION;


export function linkAt(damage: number, base: number, degrees: Degrees, element: HitElement = HitElement.slash): Readonly<HitEffect> {
  const d = DIRECTION[degrees];
  return linkHit(damage, base, d.x, d.z, element);
}


interface MultiHitStep {
  readonly first: number;
  readonly last: number;
  readonly strikes: readonly Strike[];
}


export type Strike = readonly [StrikeCapsule, Readonly<HitEffect>, (Readonly<HitEffect> | undefined)?];


export function multiHit(steps: readonly MultiHitStep[]): readonly MoveRegion[] {
  const regions: MoveRegion[] = [];
  steps.forEach((step, index) => {
    for (const [strike, effect, grounded] of step.strikes) regions.push(heroRegion(step.first, step.last, strike, effect, grounded, index + 1));
  });
  return regions;
}


interface DrillEffects {
  readonly centre: Readonly<HitEffect>;
  readonly front: Readonly<HitEffect>;
  readonly back: Readonly<HitEffect>;
}






export function drillStrikes(topZ: number, bottomZ: number, halfWidth: number, air: DrillEffects, ground?: DrillEffects): readonly Strike[] {
  const radius = f32(f32(topZ - bottomZ) * 0.5);
  const z = f32(bottomZ + radius);
  const inner = f32(halfWidth * f32(0.3));
  const outer = f32(halfWidth - radius);
  const band = (x1: number, x2: number): StrikeCapsule => ({ x1, z1: z, x2, z2: z, radius });
  return [
    [band(-inner, inner), air.centre, ground?.centre],
    [band(inner, outer), air.front, ground?.front],
    [band(-inner, -outer), air.back, ground?.back],
  ];
}


export function isMultiHit(move: AuthoredMove | undefined): boolean {
  return move?.regions.some(region => region.hit.window > 1) === true;
}
