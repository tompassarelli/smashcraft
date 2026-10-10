




import { f32 } from "wisp/src/sim/f32";
import { HitElement } from "../codes";
import { type AuthoredMove, type MoveRegion, type StrikeCapsule, heroRegion } from "../heroMoves";
import type { HitEffect } from "../hitRegions";
import { ANGLES, type Angle } from "./authoring";






function linkHit(damage: number, base: number, x: number, z: number, element: HitElement = HitElement.slash): Readonly<HitEffect> {
  return { damage, growth: 0.0, base, launchX: f32(x), launchZ: f32(z), electric: false, element, carry: true };
}




export function linkAt(damage: number, base: number, degrees: Angle, element: HitElement = HitElement.slash): Readonly<HitEffect> {
  const d = ANGLES[degrees];
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


