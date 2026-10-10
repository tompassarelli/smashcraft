import { f32 } from "wisp/src/sim/f32";
import type { HitEffect } from "./hitRegions";

const WEAK_HIT_DAMAGE_SCALE = f32(0.7);
const WEAK_HIT_KNOCKBACK_SCALE = f32(0.85);

export function strongHit(effect: Readonly<HitEffect>): Readonly<HitEffect> {
  return { ...effect, strong: true };
}

export function weakHit(effect: Readonly<HitEffect>): Readonly<HitEffect> {
  return {
    ...effect,
    strong: false,
    damage: f32(effect.damage * WEAK_HIT_DAMAGE_SCALE),
    growth: f32(effect.growth * WEAK_HIT_KNOCKBACK_SCALE),
    base: f32(effect.base * WEAK_HIT_KNOCKBACK_SCALE),
  };
}
