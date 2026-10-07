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
export const SpecialForm = { ground: 0, air: 1, free: 2, recall: 3, marked: 4, soul: 5 } as const;
export type SpecialForm = (typeof SpecialForm)[keyof typeof SpecialForm];
/**
 * A running follow-up records its base form plus this offset times one more
 * than its index in `followUps`, past every base form.
 */
export const FOLLOW_UP_FORM = 6;

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
  /**
   * Presentation only, never read by the simulation: the stock Warcraft
   * missile it draws, its own spell's (presentation/projectileArt.ts).
   */
  readonly model?: string | undefined;
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
  /** How far away a marked target may be for `Relocation.behindMark`; past it the fighter stays put. */
  readonly relocateReach?: number | undefined;
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
  /** Damage percent the release restores to the grabber, within the per-stock heal cap (Vampiric Pounce's bite). */
  readonly heal?: { readonly heal: number; readonly capPerStock: number } | undefined;
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
  /** Subtracted from the vertical velocity before each move: an arcing flask or spit. */
  readonly gravity?: number | undefined;
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
  /** Its body hits feed the owner's passive (Shadow Hunter's glaive and ward shots, sim/passives.ts). */
  readonly feedsPassive?: boolean | undefined;
  /** A returning projectile's hit on its way back (`returns`); its outbound `effect` when absent. */
  readonly returnEffect?: Readonly<HitEffect> | undefined;
  /** Damage percent a returning projectile restores when it reaches its owner, within the per-stock heal cap. */
  readonly catchHeal?: { readonly heal: number; readonly capPerStock: number } | undefined;
  /** Not placed when solid stage geometry lies between the owner's offsetZ height and the spawn point. */
  readonly needsLineOfSight?: boolean | undefined;
  /** Presentation only: a pool model's unscaled horizontal extent, including its particles. */
  readonly modelRadius?: number | undefined;
  /**
   * Presentation only, never read by the simulation: the stock Warcraft
   * missile it draws, its own spell's (presentation/projectileArt.ts).
   */
  readonly model?: string | undefined;
  /** Stock effect poses for a delayed projectile's warning and first damaging frame. Presentation only. */
  readonly modelAnimation?: { readonly sequence: string; readonly warningSeconds: number; readonly activeSeconds: number } | undefined;
  /**
   * From this age it flies back to its owner's body at `speed` a frame and
   * ends when it gets there (Storm Bolt's hammer); a hit on the way back
   * launches toward the owner. A recall form calls it back early.
   */
  readonly returns?: { readonly age: number; readonly speed: number } | undefined;
  /** A ground pool that lasts through its hits and grows on them (ProjectilePool). */
  readonly pool?: ProjectilePool | undefined;
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
 * A ground pool (the Lich King's Defile): it stays where it is placed for its
 * life instead of ending on its first hit, strikes a body inside it at most
 * once every `every` frames, and widens by `growth` each time it damages a
 * body, up to `maxRadius`. A shield takes a strike without widening it.
 */
interface ProjectilePool {
  readonly every: number;
  readonly growth: number;
  readonly maxRadius: number;
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
  /** Zero is the ordinary placed object; Beastmaster's 1 and 2 are Quilbeast and Hawk. */
  readonly slot?: number | undefined;
  readonly offsetZ?: number | undefined;
  /** Recovery may call a missing animal without repairing an existing one. */
  readonly keepExisting?: boolean | undefined;
  readonly model?: { readonly path: string; readonly height: number; readonly alpha: number } | undefined;
  /** The action frame the object appears on. */
  readonly frame: number;
  readonly offsetX: number;
  readonly radius: number;
  readonly height: number;
  readonly durability: number;
  readonly life: number;
  readonly fireAges: readonly number[];
  readonly shot?: SpecialProjectile | undefined;
  /** Makes the object a partner that follows its owner and attacks on command (Beastmaster's bear; sim/companions.ts). */
  readonly companion?: SpecialCompanion | undefined;
}

/**
 * A partner's rules: it walks on the deck it was placed on, never jumps,
 * stops at the deck's ends, never blocks bodies, and attacks only when its
 * owner orders it. Speeds and distances are per frame and in world units.
 */
export interface SpecialCompanion {
  /** A perched ranged companion holds its position; a flying one follows above the owner. */
  readonly behavior?: "sentry" | "flying" | undefined;
  readonly followHeight?: number | undefined;
  readonly lungeDrop?: number | undefined;
  /** Fires the placement's shot at these command frames instead of biting. */
  readonly volleyFrames?: readonly number[] | undefined;
  /** Following: it walks toward a point `followBehind` behind its owner at this speed. */
  readonly followSpeed: number;
  readonly followBehind: number;
  /** Returning on its owner's order: faster, until it is back within `followBehind`. */
  readonly returnSpeed: number;
  /** The lunge: frames before the bite, bite frames (travelling `lungeTravel` in all) and recovery. */
  readonly lungeStartup: number;
  readonly lungeActive: number;
  readonly lungeRecovery: number;
  readonly lungeTravel: number;
  /** The bite, facing-relative from its feet; each opponent once per lunge. */
  readonly bite: StrikeCapsule;
  readonly biteEffect: HitEffect;
  /** A hit during a lunge cancels it and stuns it this long. */
  readonly stunFrames: number;
  /** Farther than `leash` from its owner for `leashFrames` frames, it leaves. */
  readonly leash: number;
  readonly leashFrames: number;
}

/** What an owner's special orders its partner to do. */
export const CompanionOrder = { lunge: 1, return: 2 } as const;
export type CompanionOrder = (typeof CompanionOrder)[keyof typeof CompanionOrder];

/** A partner's state (PlacedObject.mode). */
export const CompanionMode = { follow: 0, lunge: 1, stunned: 2, returning: 3 } as const;
export type CompanionMode = (typeof CompanionMode)[keyof typeof CompanionMode];

/**
 * A guard: when an opponent's damaging strike or projectile overlaps the
 * fighter's body during the window, the action records one success and
 * restores `heal` damage percent, never more than `healCapPerStock` in a
 * stock. It protects nothing by itself; pair it with an intangible window.
 */
export interface SpecialGuard extends FrameWindow {
  readonly heal: number;
  readonly healCapPerStock: number;
  /** A success raises Divine Shield for this many frames (sim/transitions.ts `endDivineShield`). */
  readonly shieldFrames?: number | undefined;
}

export interface AuthoredSpecial {
  /**
   * The official name of a form the design names on its own (Backstab,
   * Hammerfall, Dark Ritual); a form without one goes by its kit's `name`.
   */
  readonly name?: string | undefined;
  /** Mana spent once, on entry. */
  readonly cost: number;
  /** The last frame of the action. */
  readonly endFrame: number;
  /** Minimum frames between entries of this special input, counted from entry; replayed with the fighter's cooldowns. */
  readonly cooldownFrames?: number | undefined;
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
  /** On `frame`, orders the fighter's partner; a lunge order refuses to start while the partner is lunging or stunned. */
  readonly command?: { readonly frame: number; readonly order: CompanionOrder; readonly slot?: number | undefined } | undefined;
  /** Entering it turns the fighter's returning projectiles back toward it at once. */
  readonly recallsProjectiles?: boolean | undefined;
  readonly commandGrab?: CommandGrab | undefined;
  /** Applied by each of its strikes that reaches a body, never through a shield (sim/heroStatus.ts). */
  readonly strikeStatus?: AppliedStatus | undefined;
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
  /** The special's official name; smashcraft:docs/move-list.md and the Moves page read it here. */
  readonly name: string;
  /** One line for players: what it does and its catch. */
  readonly description: string;
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
  /** The airborne up-special still recovers when a grounded companion command exists. */
  readonly recallGroundOnly?: boolean | undefined;
  /**
   * Chosen instead of the ground and air forms while an opponent within
   * `range` is marked: poisoned (Warden's Shadow Pursuit).
   */
  readonly marked?: { readonly special: AuthoredSpecial; readonly range: number } | undefined;
  /**
   * Chosen instead of the ground and air forms while the fighter holds a soul
   * (the Lich King's Frostmourne Hungers, sim/passives.ts); entering it spends
   * one. It never replaces a recall, a marked form or the free form.
   */
  readonly soul?: AuthoredSpecial | undefined;
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

/** The form a running special uses. */
export function specialForm(kit: Readonly<SpecialKit>, form: number): AuthoredSpecial {
  if (form >= FOLLOW_UP_FORM) {
    const base = specialForm(kit, imod(form, FOLLOW_UP_FORM));
    return base.followUps?.[idiv(form, FOLLOW_UP_FORM) - 1]?.special ?? base;
  }
  if (form === SpecialForm.free) return kit.free ?? kit.ground;
  if (form === SpecialForm.recall) return kit.recall ?? kit.ground;
  if (form === SpecialForm.marked) return kit.marked?.special ?? kit.ground;
  if (form === SpecialForm.soul) return kit.soul ?? kit.ground;
  return form === SpecialForm.air ? kit.air ?? kit.ground : kit.ground;
}

/** The form a choice starts. */
export function heroSpecialMove(specials: Readonly<FighterSpecials>, chosen: { readonly slot: number; readonly form: number }): AuthoredSpecial {
  return specialForm(specialKit(specials, chosen.slot), chosen.form);
}

/** A frame window in the brief's numbering. */
export const frames = (first: number, last: number): FrameWindow => ({ first, last });
