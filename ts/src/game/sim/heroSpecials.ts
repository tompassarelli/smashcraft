// Authored special kits for the expansion heroes: plain immutable data, like
// FighterMoves, executed by heroSpecialRules.ts. Frame numbers follow the
// roster brief (smashcraft:docs/design/roster.md): the entry tick is frame 1,
// windows are inclusive, and "end fN" means the fighter acts again on N+1.
import type { MoveRegion } from "./heroMoves";
import type { HitEffect } from "./hitRegions";
import type { AppliedStatus } from "./heroStatus";
import type { HurtPose } from "./hurtboxes";

/** The four special inputs, in SpecialAction.heroNeutral order. */
export const SpecialSlot = { neutral: 0, side: 1, up: 2, down: 3 } as const;
export type SpecialSlot = (typeof SpecialSlot)[keyof typeof SpecialSlot];

/** Which authored form of a special is running; captured on entry. */
export const SpecialForm = { ground: 0, air: 1, free: 2, recall: 3 } as const;
export type SpecialForm = (typeof SpecialForm)[keyof typeof SpecialForm];

/** Brief frames, inclusive. */
export interface FrameWindow {
  readonly first: number;
  readonly last: number;
}

/**
 * Velocity the special sets on every frame of its window, in world units per
 * frame, facing-relative. The next frame moves by exactly that velocity:
 * no steering, drag, gravity or fall-speed cap, but stage collision still
 * stops it. With `aimedSpeed`, a stick held on entry (one of eight directions)
 * replaces the authored direction at that speed; a neutral stick keeps it.
 * With `aimedTilt`, an up or down aim instead turns the authored horizontal
 * heading to that facing-relative unit direction (z for up, mirrored for
 * down) at the same speed.
 */
export interface SpecialMotion extends FrameWindow {
  readonly velocityX: number;
  readonly velocityZ: number;
  readonly aimedSpeed?: number | undefined;
  readonly aimedTilt?: { readonly x: number; readonly z: number } | undefined;
  /**
   * Horizontal steering: the live stick's world-relative x, scaled to this
   * many units per frame, is added to the authored velocity on each frame.
   */
  readonly driftSpeed?: number | undefined;
  /**
   * Forward travel ends just short of a raised shield or another fighter's body
   * instead of carrying into or through it (the roster's dash specials).
   */
  readonly stopsAtBody?: boolean | undefined;
}

/**
 * A projectile, marker or zone the special emits. Offsets and velocities are
 * facing-relative; `upVelocity*` replace the velocity when up is held on entry.
 * It hits once and disappears on a body, shield or reflector; it may hit once
 * its age reaches `activeFrom`.
 */
export interface SpecialProjectile {
  readonly spawnFrame: number;
  readonly offsetX: number;
  readonly offsetZ: number;
  readonly velocityX: number;
  readonly velocityZ: number;
  readonly upVelocityX?: number | undefined;
  readonly upVelocityZ?: number | undefined;
  readonly life: number;
  readonly radius: number;
  readonly activeFrom?: number | undefined;
  readonly effect: Readonly<HitEffect>;
  readonly reflectable: boolean;
  /** Owned at once; a cast beyond it fails before spending mana. */
  readonly limit: number;
  /** Applied by a body hit, never through a shield (sim/heroStatus.ts). */
  readonly status?: AppliedStatus | undefined;
  /** Removed when the owner's special is interrupted before it becomes active (Frost Nova's marker). */
  readonly cancelOnInterrupt?: boolean | undefined;
  /**
   * The offset used when the special was pressed toward the fighter's back;
   * the fighter then keeps its facing instead of turning (Frost Nova's near placement).
   */
  readonly backOffsetX?: number | undefined;
  /** Not placed when solid stage geometry lies between the owner's offsetZ height and the spawn point. */
  readonly needsLineOfSight?: boolean | undefined;
}

export interface SpecialArmor extends FrameWindow {
  /** A hit of at most this damage applies its damage without its reaction; any hit consumes the armor. */
  readonly maxDamage: number;
  /**
   * A shell armed once on `first` that lasts through `last` even after the
   * action ends; one hit consumes it, and the special cannot start while the
   * fighter still has armor (Frost Armor).
   */
  readonly shell?: boolean | undefined;
}

/**
 * An owned object the special places on the ground (Serpent Ward): an upright
 * capsule `offsetX` ahead of the caster's feet, facing the caster's way.
 * Opponents' attacks and projectiles spend its durability (sim/placedObjects.ts);
 * it ends at zero durability, after `life` frames, on recall or on its owner's
 * stock loss. At each age in `fireAges` it emits `shot` straight along its
 * facing, never aimed, unless its owner is held or in hitstun.
 */
export interface SpecialPlacement {
  /** The action frame the object appears on. */
  readonly frame: number;
  readonly offsetX: number;
  readonly radius: number;
  readonly height: number;
  readonly durability: number;
  readonly life: number;
  readonly fireAges: readonly number[];
  readonly shot: SpecialProjectile;
}

export interface AuthoredSpecial {
  /** Mana spent once, on entry. */
  readonly cost: number;
  /** The last frame of the action. */
  readonly endFrame: number;
  /** Strike paths in brief frames (heroRegion); each target is struck once per action. */
  readonly regions?: readonly MoveRegion[] | undefined;
  readonly motion?: readonly SpecialMotion[] | undefined;
  readonly projectiles?: readonly SpecialProjectile[] | undefined;
  readonly intangible?: FrameWindow | undefined;
  readonly armor?: SpecialArmor | undefined;
  /** Does not start in the air and spends nothing there. */
  readonly groundOnly?: boolean | undefined;
  /** Once per airtime; landing or a new stock restores it, a ledge catch does not. */
  readonly oncePerAirtime?: boolean | undefined;
  /** Ends in a helpless fall when it ends airborne. */
  readonly helpless?: boolean | undefined;
  /** Landing during the action ends it with this landing lag; otherwise it continues on the ground. */
  readonly landingLag?: number | undefined;
  /** Through this frame a held stick re-chooses the aim (eight directions); a neutral stick keeps the entry aim. */
  readonly aimFrames?: number | undefined;
  /**
   * Bodies over brief frames (hurtPose(first, last, parts) with 1-based
   * frames); frames no pose covers use the standing body. Weapons stay out.
   */
  readonly hurt?: readonly HurtPose[] | undefined;
  /** Places the fighter's one owned object. */
  readonly placement?: SpecialPlacement | undefined;
  /** Completing the action removes the fighter's placed object. */
  readonly recall?: boolean | undefined;
}

/** One special input: its grounded form, its airborne form and its zero-mana form. */
export interface SpecialKit {
  readonly ground: AuthoredSpecial;
  /** The airborne form; the grounded form when absent. */
  readonly air?: AuthoredSpecial | undefined;
  /**
   * Chosen instead of failing when mana is below the full form's cost. Every up
   * special has one (the roster's weaker zero-mana recovery); it costs nothing.
   */
  readonly free?: AuthoredSpecial | undefined;
  /** Chosen instead of every other form while the fighter's placed object stands. */
  readonly recall?: AuthoredSpecial | undefined;
}

export interface ManaProfile {
  readonly max: number;
  /** Frames since the last spend before regeneration starts. */
  readonly regenDelayFrames: number;
  /** Eligible frames per regenerated point. */
  readonly framesPerPoint: number;
}

/** The adopted roster resource: 100 mana, 6 per second on the ground after 120 frames without spending. */
export const ROSTER_MANA: ManaProfile = { max: 100, regenDelayFrames: 120, framesPerPoint: 10 };

export interface FighterSpecials {
  readonly mana: ManaProfile;
  readonly neutral: SpecialKit;
  readonly side: SpecialKit;
  readonly up: SpecialKit;
  readonly down: SpecialKit;
}

export function specialKit(specials: Readonly<FighterSpecials>, slot: number): SpecialKit {
  return slot === SpecialSlot.side ? specials.side : slot === SpecialSlot.up ? specials.up : slot === SpecialSlot.down ? specials.down : specials.neutral;
}

/** The form a running special uses. */
export function specialForm(kit: Readonly<SpecialKit>, form: number): AuthoredSpecial {
  if (form === SpecialForm.free) return kit.free ?? kit.ground;
  if (form === SpecialForm.recall) return kit.recall ?? kit.ground;
  return form === SpecialForm.air ? kit.air ?? kit.ground : kit.ground;
}

/** The form a choice starts. */
export function heroSpecialMove(specials: Readonly<FighterSpecials>, chosen: { readonly slot: number; readonly form: number }): AuthoredSpecial {
  return specialForm(specialKit(specials, chosen.slot), chosen.form);
}

/** A frame window in the brief's numbering. */
export const frames = (first: number, last: number): FrameWindow => ({ first, last });
