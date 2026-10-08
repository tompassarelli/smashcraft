import { f32 } from "wisp/src/sim/f32";
import type { AttackStyle } from "./codes";
import type { HitEffect, HitRegion } from "./hitRegions";
import { hurtCapsule } from "../physics/contactGeometry";
import { Character } from "./codes";
import { type FighterHurtboxes, type HurtPart, type HurtPose, hurtPose } from "./hurtboxes";

const referenceBody = { radius: 24.0, z1: 4.0, z2: 88.0 };
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
  /**
   * Docs only: what the normal draws on ("Shear, from the Black Temple
   * encounter"). Normals have no official name; players see the input.
   */
  readonly inspiredBy?: string | undefined;
  readonly startupFrames: number;
  readonly activeFrames: number;
  readonly totalFrames: number;
  /** Final landing lag; new kits do not ask the player to cancel it. */
  readonly landingLag: number;
  readonly regions: readonly MoveRegion[];
  /** Facing-relative displacement distributed across startup frames. */
  readonly startupTravelX?: number | undefined;
  readonly startupStopsAtBody?: boolean | undefined;
  /**
   * A jab chain step (#163): from this attack frame (counting entry as frame
   * one) to its last, a fresh jab press starts the chain's next jab, as
   * Melee's Attack11 continues to Attack12 (melee:src/melee/ft/kinds/ftCommon/ftCo_Attack1.c).
   */
  readonly chainsFrom?: number | undefined;
  /** A drill's motion in phases: each specified speed replaces its ordinary drift or gravity. */
  readonly fall?: readonly AuthoredFall[] | undefined;
  /** Landing during the active frames continues into this grounded hit instead of landing lag. */
  readonly landingHit?: AuthoredLandingHit | undefined;
}

/**
 * Zero-based attack frames, inclusive, and the speeds held on them in world
 * units per frame: optional vertical (negative falls) and facing-relative
 * horizontal. An omitted speed keeps ordinary motion on that axis.
 */
export interface AuthoredFall {
  readonly firstFrame: number;
  readonly lastFrame: number;
  readonly speedZ?: number | undefined;
  readonly speedX?: number | undefined;
}

/** The landing attack's frames follow the aerial's: it starts at firstFrame and ends at totalFrames. */
interface AuthoredLandingHit {
  readonly firstFrame: number;
  readonly totalFrames: number;
}

export interface AuthoredThrow {
  /** Docs only, as AuthoredMove.inspiredBy. */
  readonly inspiredBy?: string | undefined;
  /** Grab timelines, unlike attacks, count entry as frame one. */
  readonly contactFrame: number;
  readonly totalFrames: number;
  readonly effect: Readonly<HitEffect>;
}

/** Plain immutable values so moment exports and rollback retain the same authored kit. */
export interface FighterMoves {
  readonly normals: { readonly [style: number]: AuthoredMove | undefined };
  /** A pummel entry supplies only its effect; every pummel shares one timing (smashcraft:docs/gameplay-design.md, "Grab holds and pummels"). */
  readonly throws: { readonly [action: number]: AuthoredThrow | undefined };
  readonly dashAttack: AttackStyle;
  readonly smashMaxChargeFrames: number;
  readonly smashMaxDamageMultiplier: number;
  /** 0 disables the pummel; the shared rule allows at most one. */
  readonly maxPummels?: number | undefined;
  /** Bodies that follow the kit's animation (smashcraft:docs/hurtboxes.md); absent, the character's standing body. */
  readonly hurtboxes?: FighterHurtboxes | undefined;
}

/** The roster brief counts the entry tick as frame one; the simulation counts it as zero. */
export function heroMove(firstActive: number, active: number, recovery: number, landingLag: number, regions: readonly MoveRegion[], startupTravelX?: number, startupStopsAtBody?: boolean): AuthoredMove {
  return { startupFrames: firstActive - 1, activeFrames: active, totalFrames: firstActive - 1 + active + recovery, landingLag, regions, startupTravelX, startupStopsAtBody };
}

/** A jab chain step: a fresh jab press from the frame after its last active frame continues the chain. */
export function jabStep(move: AuthoredMove): AuthoredMove {
  return { ...move, chainsFrom: move.startupFrames + move.activeFrames + 1 };
}

/** A contact over the brief's attack frames; a multi-hit gives each later hit a higher window so it may strike again. */
export function heroRegion(firstActive: number, lastActive: number, strike: StrikeCapsule, effect: Readonly<HitEffect>, groundedEffect?: Readonly<HitEffect>, window = 1): MoveRegion {
  return {
    firstFrame: firstActive - 1,
    lastFrame: lastActive - 1,
    hit: {
      minX: f32(Math.min(strike.x1, strike.x2) - strike.radius),
      maxX: f32(Math.max(strike.x1, strike.x2) + strike.radius),
      minZ: f32(Math.min(strike.z1, strike.z2) - strike.radius),
      maxZ: f32(Math.max(strike.z1, strike.z2) + strike.radius),
      effect, window, strike, groundedEffect,
    },
  };
}

/** A body pose over the brief's attack frames, counting the entry tick as frame one like heroRegion. */
export function heroHurtPose(first: number, last: number, parts: readonly HurtPart[]): HurtPose {
  return hurtPose(first - 1, last - 1, parts);
}
