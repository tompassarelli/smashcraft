import { f32 } from "wisp/src/sim/f32";
import type { HitEffect } from "./hitRegions";


export function downSmashHit(effect: Readonly<HitEffect>): Readonly<HitEffect> {
  return { ...effect, growth: 40.0, base: 75.0, launchX: effect.launchX < 0 ? -f32(0.906307787) : f32(0.906307787), launchZ: f32(0.422618262) };
}
