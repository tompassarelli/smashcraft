import { f32 } from "wisp/src/sim/f32";
import type { AttackStyle } from "./codes";
import type { HitEffect, HitRegion } from "./hitRegions";
import { hurtCapsule } from "../physics/contactGeometry";
import { Character } from "./codes";

const referenceBody = hurtCapsule(Character.archer);
export const HERO_REFERENCE_HEIGHT = f32(f32(referenceBody.z2 - referenceBody.z1) + f32(2.0 * referenceBody.radius));

/** Authored facing-relative strike path; only the weapon can extend beyond the body. */
export interface StrikeCapsule {
  readonly x1: number;
  readonly z1: number;
  readonly x2: number;
  readonly z2: number;
  readonly radius: number;
}

export interface MoveRegion {
  /** Zero-based attack frames, inclusive. */
  readonly firstFrame: number;
  readonly lastFrame: number;
  readonly hit: Readonly<HitRegion>;
}

export interface AuthoredMove {
  readonly startupFrames: number;
  readonly activeFrames: number;
  readonly totalFrames: number;
  /** Final landing lag; new kits do not ask the player to cancel it. */
  readonly landingLag: number;
  readonly regions: readonly MoveRegion[];
  /** Facing-relative displacement distributed across startup frames. */
  readonly startupTravelX?: number | undefined;
}

export interface AuthoredThrow {
  /** Grab timelines, unlike attacks, count entry as frame one. */
  readonly contactFrame: number;
  readonly totalFrames: number;
  readonly effect: Readonly<HitEffect>;
}

/** Plain immutable values so moment exports and rollback retain the same authored kit. */
export interface FighterMoves {
  readonly normals: { readonly [style: number]: AuthoredMove | undefined };
  readonly throws: { readonly [action: number]: AuthoredThrow | undefined };
  readonly dashAttack: AttackStyle;
  readonly smashMaxChargeFrames: number;
  readonly smashMaxDamageMultiplier: number;
  readonly maxPummels?: number | undefined;
}

/** The roster brief counts the entry tick as frame one; the simulation counts it as zero. */
export function heroMove(firstActive: number, active: number, recovery: number, landingLag: number, regions: readonly MoveRegion[], startupTravelX?: number): AuthoredMove {
  return { startupFrames: firstActive - 1, activeFrames: active, totalFrames: firstActive - 1 + active + recovery, landingLag, regions, startupTravelX };
}

export function heroRegion(firstActive: number, lastActive: number, strike: StrikeCapsule, effect: Readonly<HitEffect>, groundedEffect?: Readonly<HitEffect>): MoveRegion {
  return {
    firstFrame: firstActive - 1,
    lastFrame: lastActive - 1,
    hit: {
      minX: f32(Math.min(strike.x1, strike.x2) - strike.radius),
      maxX: f32(Math.max(strike.x1, strike.x2) + strike.radius),
      minZ: f32(Math.min(strike.z1, strike.z2) - strike.radius),
      maxZ: f32(Math.max(strike.z1, strike.z2) + strike.radius),
      effect, window: 1, strike, groundedEffect,
    },
  };
}
