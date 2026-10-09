



import { idiv, imod } from "wisp/src/sim/intMath";
import { f32 } from "wisp/src/sim/f32";
import type { MoveRegion, StrikeCapsule } from "./heroMoves";
import type { HitEffect } from "./hitRegions";
import type { AppliedStatus } from "./heroStatus";
import type { HurtPose } from "./hurtboxes";


export const SpecialSlot = { neutral: 0, side: 1, up: 2, down: 3 } as const;
export type SpecialSlot = (typeof SpecialSlot)[keyof typeof SpecialSlot];


export const SpecialForm = { ground: 0, air: 1, recall: 3, marked: 4 } as const;
export type SpecialForm = (typeof SpecialForm)[keyof typeof SpecialForm];




export const FOLLOW_UP_FORM = 6;


export const FollowUpInput = { special: 0, attack: 1, shield: 2 } as const;
export type FollowUpInput = (typeof FollowUpInput)[keyof typeof FollowUpInput];


export const Relocation = { placed: 1, behindMark: 2 } as const;
export type Relocation = (typeof Relocation)[keyof typeof Relocation];


export interface FrameWindow {
  readonly first: number;
  readonly last: number;
}











export interface SpecialMotion extends FrameWindow {
  readonly velocityX: number;
  readonly velocityZ: number;
  readonly aimedSpeed?: number | undefined;




  readonly model?: string | undefined;
  readonly aimedTilt?: { readonly x: number; readonly z: number } | undefined;




  readonly driftSpeed?: number | undefined;
  readonly liftSpeed?: number | undefined;




  readonly stopsAtBody?: boolean | undefined;

  readonly stopsAtShield?: boolean | undefined;




  readonly relocate?: Relocation | undefined;

  readonly relocateReach?: number | undefined;

  readonly throughEdge?: boolean | undefined;
}









export interface CommandGrab extends FrameWindow {
  readonly strike: StrikeCapsule;
  readonly holdFrames: number;
  readonly effect: Readonly<HitEffect>;
  readonly recovery: number;

  readonly heal?: { readonly heal: number } | undefined;

  readonly status?: AppliedStatus | undefined;
}







export interface SpecialProjectile {
  readonly spawnFrame: number;
  readonly offsetX: number;
  readonly offsetZ: number;
  readonly velocityX: number;
  readonly velocityZ: number;
  readonly upVelocityX?: number | undefined;
  readonly upVelocityZ?: number | undefined;

  readonly gravity?: number | undefined;
  readonly life: number;
  readonly radius: number;
  readonly activeFrom?: number | undefined;
  readonly effect: Readonly<HitEffect>;
  readonly reflectable: boolean;

  readonly limit: number;

  readonly status?: AppliedStatus | undefined;

  readonly cancelOnInterrupt?: boolean | undefined;

  readonly returnEffect?: Readonly<HitEffect> | undefined;

  readonly catchHeal?: { readonly heal: number } | undefined;

  readonly needsLineOfSight?: boolean | undefined;

  readonly modelRadius?: number | undefined;




  readonly model?: string | undefined;

  readonly modelAnimation?: { readonly sequence: string; readonly warningSeconds: number; readonly activeSeconds: number } | undefined;





  readonly returns?: { readonly age: number; readonly speed: number } | undefined;

  readonly pool?: ProjectilePool | undefined;

  /** Spawns under the nearest opponent instead of at the owner's offset. */
  readonly atFoe?: boolean | undefined;

  /** What this becomes where it ends when its life runs out or it strikes. */
  readonly expiresInto?: SpecialProjectile | undefined;

  /** Each frame its vertical speed turns by at most `turn` toward the nearest opponent ahead, up to `maxRise`. */
  readonly homing?: { readonly turn: number; readonly maxRise: number } | undefined;
  /** On body or shield contact it becomes this projectile where it is, which deals the hit and then only shows. */
  readonly burstInto?: SpecialProjectile | undefined;
}

export interface SpecialArmor extends FrameWindow {

  readonly maxDamage: number;





  readonly shell?: boolean | undefined;

  readonly chillsStriker?: boolean | undefined;
}







interface ProjectilePool {
  readonly every: number;
  readonly growth: number;
  readonly maxRadius: number;
}









export interface SpecialPlacement {

  readonly slot?: number | undefined;
  readonly offsetZ?: number | undefined;

  readonly keepExisting?: boolean | undefined;
  readonly model?: { readonly path: string; readonly height: number; readonly alpha: number } | undefined;

  readonly frame: number;
  readonly offsetX: number;
  readonly radius: number;
  readonly height: number;
  readonly durability: number;
  readonly life: number;
  readonly fireAges: readonly number[];
  readonly shot?: SpecialProjectile | undefined;

  readonly companion?: SpecialCompanion | undefined;
}






export interface SpecialCompanion {

  readonly behavior?: "sentry" | "flying" | undefined;
  readonly followHeight?: number | undefined;
  readonly lungeDrop?: number | undefined;

  readonly volleyFrames?: readonly number[] | undefined;

  readonly followSpeed: number;
  readonly followBehind: number;

  readonly returnSpeed: number;

  readonly lungeStartup: number;
  readonly lungeActive: number;
  readonly lungeRecovery: number;
  readonly lungeTravel: number;

  readonly bite: StrikeCapsule;
  readonly biteEffect: HitEffect;

  readonly stunFrames: number;

  readonly leash: number;
  readonly leashFrames: number;
}


export const CompanionOrder = { lunge: 1, return: 2 } as const;
export type CompanionOrder = (typeof CompanionOrder)[keyof typeof CompanionOrder];


export const CompanionMode = { follow: 0, lunge: 1, stunned: 2, returning: 3 } as const;
export type CompanionMode = (typeof CompanionMode)[keyof typeof CompanionMode];






export interface SpecialGuard extends FrameWindow {
  readonly heal: number;

  readonly shieldFrames?: number | undefined;

  /** A guarded strike starts the move's first follow-up at once. */
  readonly counter?: boolean | undefined;
}

export interface AuthoredSpecial {

  readonly ex?: AuthoredSpecial | undefined;




  readonly name?: string | undefined;

  readonly endFrame: number;

  readonly cooldownFrames?: number | undefined;

  readonly regions?: readonly MoveRegion[] | undefined;
  readonly motion?: readonly SpecialMotion[] | undefined;
  readonly projectiles?: readonly SpecialProjectile[] | undefined;
  readonly intangible?: FrameWindow | undefined;
  readonly armor?: SpecialArmor | undefined;
  readonly guard?: SpecialGuard | undefined;

  readonly defensiveUse?: boolean | undefined;

  readonly groundOnly?: boolean | undefined;

  readonly oncePerAirtime?: boolean | undefined;

  readonly helpless?: boolean | undefined;

  readonly landingLag?: number | undefined;

  readonly aimFrames?: number | undefined;

  readonly facesStick?: boolean | undefined;




  readonly hurt?: readonly HurtPose[] | undefined;

  readonly placement?: SpecialPlacement | undefined;

  readonly recall?: boolean | undefined;

  readonly command?: { readonly frame: number; readonly order: CompanionOrder; readonly slot?: number | undefined } | undefined;

  readonly recallsProjectiles?: boolean | undefined;
  readonly commandGrab?: CommandGrab | undefined;

  readonly strikeStatus?: AppliedStatus | undefined;

  readonly cleanseFrame?: number | undefined;






  readonly followUps?: readonly SpecialFollowUp[] | undefined;





  readonly burst?: { readonly frame: number; readonly from: SpecialProjectile; readonly into: SpecialProjectile } | undefined;

  readonly ritual?: { readonly frame: number; readonly mana: number } | undefined;

  /** Frames on which each target may be struck again. */
  readonly rehits?: readonly number[] | undefined;

  /** A timed movement buff granted on a frame (Metamorphosis, Avatar). */
  readonly buff?: { readonly frame: number; readonly kind: number; readonly frames: number } | undefined;
}

export interface SpecialFollowUp {
  readonly window: FrameWindow;
  readonly special: AuthoredSpecial;

  readonly input?: FollowUpInput | undefined;

  readonly facesStick?: boolean | undefined;
}


export interface SpecialKit {

  readonly name: string;

  readonly description: string;
  readonly ground: AuthoredSpecial;

  readonly air?: AuthoredSpecial | undefined;

  readonly recall?: AuthoredSpecial | undefined;





  readonly recallWhile?: "projectile" | "armor" | undefined;

  readonly recallGroundOnly?: boolean | undefined;




  readonly marked?: { readonly special: AuthoredSpecial; readonly range: number } | undefined;
}

export interface FighterSpecials {
  readonly neutral: SpecialKit;
  readonly side: SpecialKit;
  readonly up: SpecialKit;
  readonly down: SpecialKit;
}

export function specialKit(specials: Readonly<FighterSpecials>, slot: number): SpecialKit {
  return slot === SpecialSlot.side ? specials.side : slot === SpecialSlot.up ? specials.up : slot === SpecialSlot.down ? specials.down : specials.neutral;
}


export function specialForm(kit: Readonly<SpecialKit>, form: number, ex = false): AuthoredSpecial {
  if (form >= FOLLOW_UP_FORM) {
    const base = specialForm(kit, imod(form, FOLLOW_UP_FORM), ex);
    return base.followUps?.[idiv(form, FOLLOW_UP_FORM) - 1]?.special ?? base;
  }
  const move = form === SpecialForm.recall ? kit.recall ?? kit.ground
    : form === SpecialForm.marked ? kit.marked?.special ?? kit.ground
    : form === SpecialForm.air ? kit.air ?? kit.ground : kit.ground;
  return ex ? move.ex ?? move : move;
}


export function heroSpecialMove(specials: Readonly<FighterSpecials>, chosen: { readonly slot: number; readonly form: number }): AuthoredSpecial {
  return specialForm(specialKit(specials, chosen.slot), chosen.form);
}


export const frames = (first: number, last: number): FrameWindow => ({ first, last });


export const CHARGED_AIM_FRAMES = 8;










export function chargedAngleMotion(distance: number, travelFrames: number): readonly SpecialMotion[] {
  const speed = f32(distance / travelFrames);
  const launch = CHARGED_AIM_FRAMES + 1;
  const stop = CHARGED_AIM_FRAMES + travelFrames + 1;
  return [
    { ...frames(1, CHARGED_AIM_FRAMES), velocityX: 0.0, velocityZ: 0.0 },
    { ...frames(launch, stop - 1), velocityX: 0.0, velocityZ: speed, aimedSpeed: speed },
    { ...frames(stop, stop), velocityX: 0.0, velocityZ: 0.0 },
  ];
}
