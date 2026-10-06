// Authored special kits for the expansion heroes: plain immutable data, like
// FighterMoves, executed by heroSpecialRules.ts. Frame numbers follow the
// roster brief (smashcraft:docs/design/roster.md): the entry tick is frame 1,
// windows are inclusive, and "end fN" means the fighter acts again on N+1.
import { idiv, imod } from "wisp/src/sim/intMath";
import type { MoveRegion, StrikeCapsule } from "./heroMoves";
import type { HitEffect } from "./hitRegions";
import type { AppliedStatus } from "./heroStatus";
import type { HurtPose } from "./hurtboxes";

/** The four special inputs, in SpecialAction.heroNeutral order. */
export const SpecialSlot = { neutral: 0, side: 1, up: 2, down: 3 } as const;
export type SpecialSlot = (typeof SpecialSlot)[keyof typeof SpecialSlot];

/** Which authored form of a special is running; captured on entry. */
export const SpecialForm = { ground: 0, air: 1, free: 2, recall: 3 } as const;
export type SpecialForm = (typeof SpecialForm)[keyof typeof SpecialForm];
/**
 * A running follow-up records its base form plus this offset times one more
 * than its index in `followUps`, past every base form.
 */
export const FOLLOW_UP_FORM = 4;

/** The fresh press that takes a follow-up branch. */
export const FollowUpInput = { special: 0, attack: 1, shield: 2 } as const;
export type FollowUpInput = (typeof FollowUpInput)[keyof typeof FollowUpInput];

/** A one-frame move of the fighter on a motion window's first frame, instead of a velocity. */
export const Relocation = { placed: 1, behindMark: 2 } as const;
export type Relocation = (typeof Relocation)[keyof typeof Relocation];

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
  /** Forward travel passes bodies but ends just short of a raised shield. */
  readonly stopsAtShield?: boolean | undefined;
  /**
   * On the window's first frame the fighter moves at once: onto its placed
   * object (which is spent), or just behind its marked target.
   */
  readonly relocate?: Relocation | undefined;
}

/**
 * A command grab: in its window (brief frames) the strike path latches the
 * nearest grabbable body, shield or not, through the shared grab link, so
 * external hits break it and #85's throw-hitstun rule refuses a regrab. The
 * held target is released `holdFrames` after the catch with `effect` as a
 * throw, and the action then ends `recovery` frames later instead of at its
 * whiff `endFrame`.
 */
export interface CommandGrab extends FrameWindow {
  readonly strike: StrikeCapsule;
  readonly holdFrames: number;
  readonly effect: Readonly<HitEffect>;
  readonly recovery: number;
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
  /**
   * From this age it flies back to its owner's body at `speed` a frame and
   * ends when it gets there (Storm Bolt's hammer); a hit on the way back
   * launches toward the owner. A recall form calls it back early.
   */
  readonly returns?: { readonly age: number; readonly speed: number } | undefined;
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
  /** The melee striker whose hit the shell absorbs is chilled (Lich's Frost Armor, sim/chill.ts). */
  readonly chillsStriker?: boolean | undefined;
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
  readonly shot?: SpecialProjectile | undefined;
}

/**
 * A guard: when an opponent's damaging strike or projectile overlaps the
 * fighter's body during the window, the action records one success and
 * restores `heal` damage percent, never more than `healCapPerStock` in a
 * stock. It protects nothing by itself; pair it with an intangible window.
 */
export interface SpecialGuard extends FrameWindow {
  readonly heal: number;
  readonly healCapPerStock: number;
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
  readonly guard?: SpecialGuard | undefined;
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
  /** A stick held left or right on entry turns the fighter that way first, so a recovery drifts where it is steered. */
  readonly facesStick?: boolean | undefined;
  /**
   * Bodies over brief frames (hurtPose(first, last, parts) with 1-based
   * frames); frames no pose covers use the standing body. Weapons stay out.
   */
  readonly hurt?: readonly HurtPose[] | undefined;
  /** Places the fighter's one owned object. */
  readonly placement?: SpecialPlacement | undefined;
  /** Completing the action removes the fighter's placed object. */
  readonly recall?: boolean | undefined;
  /** Entering it turns the fighter's returning projectiles back toward it at once. */
  readonly recallsProjectiles?: boolean | undefined;
  readonly commandGrab?: CommandGrab | undefined;
  /**
   * Branches after the press: the first whose `window` (brief frames) holds
   * the next frame and whose input was freshly pressed replaces the rest of
   * this action with its `special`, whose frame 1 is the press tick. It
   * spends `special.cost` and is captured once; it cannot itself branch.
   */
  readonly followUps?: readonly SpecialFollowUp[] | undefined;
  /**
   * On action frame `frame`, each of the fighter's live `from` projectiles
   * stops where it is and becomes `into`, its age starting again (Lich's
   * Frost Nova burst).
   */
  readonly burst?: { readonly frame: number; readonly from: SpecialProjectile; readonly into: SpecialProjectile } | undefined;
  /** On action frame `frame`, the fighter's armor shell ends and `mana` is restored (Lich's Dark Ritual). */
  readonly ritual?: { readonly frame: number; readonly mana: number } | undefined;
}

export interface SpecialFollowUp {
  readonly window: FrameWindow;
  readonly special: AuthoredSpecial;
  /** The press that takes it; a special press when absent. */
  readonly input?: FollowUpInput | undefined;
  /** A stick held left or right at the press turns the fighter that way first. */
  readonly facesStick?: boolean | undefined;
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
  /** Chosen instead of every other form while `recallWhile` holds. */
  readonly recall?: AuthoredSpecial | undefined;
  /**
   * What chooses `recall`: the fighter's placed object standing (the
   * default), a live projectile of the grounded form's first projectile
   * (Frost Nova's burst), or the fighter's armor shell holding (Dark Ritual).
   */
  readonly recallWhile?: "projectile" | "armor" | undefined;
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
  if (form >= FOLLOW_UP_FORM) {
    const base = specialForm(kit, imod(form, FOLLOW_UP_FORM));
    return base.followUps?.[idiv(form, FOLLOW_UP_FORM) - 1]?.special ?? base;
  }
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
