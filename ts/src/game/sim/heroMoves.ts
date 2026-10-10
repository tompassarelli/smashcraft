import { f32 } from "wisp/src/sim/f32";
import type { AttackStyle } from "./codes";
import type { HitEffect, HitRegion } from "./hitRegions";
import { strongHit, weakHit } from "./strongHits";
import { hurtCapsule } from "../physics/contactGeometry";
import { Character } from "./codes";
import { type FighterHurtboxes, type HurtPart, type HurtPose, hurtPose } from "./hurtboxes";
import type { MoveTable } from "./moveTable";

const referenceBody = { radius: 24.0, z1: 4.0, z2: 88.0 };
export const HERO_REFERENCE_HEIGHT = f32(f32(referenceBody.z2 - referenceBody.z1) + f32(2.0 * referenceBody.radius));


export interface StrikeCapsule {
  readonly x1: number;
  readonly z1: number;
  readonly x2: number;
  readonly z2: number;
  readonly radius: number;
}

export interface MoveRegion {

  readonly firstFrame: number;
  readonly lastFrame: number;
  readonly hit: Readonly<HitRegion>;
}

export interface AuthoredMove {




  readonly inspiredBy?: string | undefined;
  readonly startupFrames: number;
  readonly activeFrames: number;
  readonly totalFrames: number;

  readonly landingLag: number;
  readonly regions: readonly MoveRegion[];

  readonly startupTravelX?: number | undefined;
  readonly startupStopsAtBody?: boolean | undefined;





  readonly chainsFrom?: number | undefined;

  readonly fall?: readonly AuthoredFall[] | undefined;

  readonly landingHit?: AuthoredLandingHit | undefined;
}






export interface AuthoredFall {
  readonly firstFrame: number;
  readonly lastFrame: number;
  readonly speedZ?: number | undefined;
}


interface AuthoredLandingHit {
  readonly firstFrame: number;
  readonly totalFrames: number;
}

export interface AuthoredThrow {

  readonly inspiredBy?: string | undefined;

  readonly contactFrame: number;
  readonly totalFrames: number;
  readonly effect: Readonly<HitEffect>;
}


export interface FighterMoves {
  readonly normals: { readonly [style: number]: AuthoredMove | undefined };

  readonly throws: { readonly [action: number]: AuthoredThrow | undefined };
  readonly dashAttack: AttackStyle;
  readonly smashMaxChargeFrames: number;
  readonly smashMaxDamageMultiplier: number;

  readonly maxPummels?: number | undefined;

  readonly hurtboxes?: FighterHurtboxes | undefined;

  readonly table?: MoveTable | undefined;
}


export function heroMove(firstActive: number, active: number, recovery: number, landingLag: number, regions: readonly MoveRegion[], startupTravelX?: number, startupStopsAtBody?: boolean): AuthoredMove {
  return { startupFrames: firstActive - 1, activeFrames: active, totalFrames: firstActive - 1 + active + recovery, landingLag, regions, startupTravelX, startupStopsAtBody };
}


export function jabStep(move: AuthoredMove): AuthoredMove {
  return { ...move, chainsFrom: move.startupFrames + move.activeFrames + 1 };
}


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


export function strongRegion(region: MoveRegion): MoveRegion {
  const { effect, groundedEffect } = region.hit;
  return { ...region, hit: { ...region.hit, effect: strongHit(effect), groundedEffect: groundedEffect === undefined ? undefined : strongHit(groundedEffect) } };
}


export function tipper(regions: readonly MoveRegion[], tipFraction: number): readonly MoveRegion[] {
  const split: MoveRegion[] = [];
  for (const region of regions) {
    const { strike, effect, groundedEffect, window } = region.hit;
    if (strike === undefined) {
      split.push(region);
      continue;
    }
    const x = f32(strike.x2 - f32(f32(strike.x2 - strike.x1) * tipFraction));
    const z = f32(strike.z2 - f32(f32(strike.z2 - strike.z1) * tipFraction));
    split.push(heroRegion(region.firstFrame + 1, region.lastFrame + 1, { ...strike, x1: x, z1: z }, strongHit(effect),
      groundedEffect === undefined ? undefined : strongHit(groundedEffect), window));
    split.push(heroRegion(region.firstFrame + 1, region.lastFrame + 1, { ...strike, x2: x, z2: z }, weakHit(effect),
      groundedEffect === undefined ? undefined : weakHit(groundedEffect), window));
  }
  return split;
}


function cleanLate(regions: readonly MoveRegion[], cleanFrames: number): readonly MoveRegion[] {
  let first = regions[0]?.firstFrame ?? 0;
  for (const region of regions) first = Math.min(first, region.firstFrame);
  const lastClean = first + cleanFrames - 1;
  const split: MoveRegion[] = [];
  for (const region of regions) {
    const { effect, groundedEffect } = region.hit;
    if (region.firstFrame <= lastClean) split.push({ firstFrame: region.firstFrame, lastFrame: Math.min(region.lastFrame, lastClean),
      hit: { ...region.hit, effect: strongHit(effect), groundedEffect: groundedEffect === undefined ? undefined : strongHit(groundedEffect) } });
    if (region.lastFrame > lastClean) split.push({ firstFrame: Math.max(region.firstFrame, lastClean + 1), lastFrame: region.lastFrame,
      hit: { ...region.hit, effect: weakHit(effect), groundedEffect: groundedEffect === undefined ? undefined : weakHit(groundedEffect) } });
  }
  return split;
}


export function tipperMove(move: AuthoredMove, tipFraction: number): AuthoredMove {
  return { ...move, regions: tipper(move.regions, tipFraction) };
}


export function cleanLateMove(move: AuthoredMove, cleanFrames: number): AuthoredMove {
  return { ...move, regions: cleanLate(move.regions, cleanFrames) };
}


export function heroHurtPose(first: number, last: number, parts: readonly HurtPart[]): HurtPose {
  return hurtPose(first - 1, last - 1, parts);
}
