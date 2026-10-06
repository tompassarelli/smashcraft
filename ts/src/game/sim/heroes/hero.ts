// What one expansion hero registers: identity text, its authored kit and its
// Warcraft presentation. Body multipliers live in heroBodies.ts. Plain data:
// the simulation, selection and presentation all read the same record.
import type { Character } from "../codes";
import type { FighterGameplan } from "../gameplan";
import type { FighterMoves } from "../heroMoves";
import type { FighterSpecials } from "../heroSpecials";

/** A model sequence: its index in the model and its authored length. */
export interface HeroClip {
  readonly index: number;
  readonly seconds: number;
}

/**
 * States with no shared clip: a table that leaves one out keeps the original
 * fighters' pose for that state instead of playing its fallback.
 */
export type HeroStatePose = "dash" | "run" | "crouch" | "fall" | "landing" | "shield" | "airDodge" | "smashCharge" | "ko" | "dizzy";

/**
 * A special's follow-up (AuthoredSpecial.followUp) while it runs; a table that
 * leaves one out plays the special's own clip.
 */
export type HeroFollowUpPose =
  | "neutralSpecialFollowUp" | "sideSpecialFollowUp" | "upSpecialFollowUp" | "downSpecialFollowUp"
  | "neutralSpecialFollowUpAir" | "sideSpecialFollowUpAir" | "upSpecialFollowUpAir" | "downSpecialFollowUpAir";

/**
 * Every pose that selects a clip by table (presentation/fighterClips.ts); the
 * original fighters fill the same table. Poses a hero leaves unmapped play its
 * `fallback` clip, except HeroStatePose. `idle` and `walk` play by index where
 * a table maps them, and as the model's named stand and walk otherwise.
 */
export type HeroPose =
  | "idle" | "walk"
  | HeroStatePose
  | "jab" | "grab" | "forwardTilt" | "upTilt" | "downTilt" | "forwardTiltUp" | "forwardTiltDown"
  | "forwardSmash" | "upSmash" | "downSmash" | "dashAttack"
  | "neutralAir" | "forwardAir" | "backAir" | "upAir" | "downAir" | "getUpAttack"
  | "ledgeHang" | "ledgeClimb" | "ledgeRoll" | "ledgeAttack"
  | "knockdown" | "getUp" | "downDamage" | "rollForward" | "rollBackward" | "spotDodge"
  | "jump" | "doubleJump" | "fallSpecial"
  | "damageGround" | "damageAir" | "damageTumble" | "damageShield"
  | "grabHold" | "grabbed"
  | "pummel" | "throwForward" | "throwBack" | "throwUp" | "throwDown"
  | "victimPummel" | "victimThrowForward" | "victimThrowBack" | "victimThrowUp" | "victimThrowDown"
  | "neutralSpecial" | "sideSpecial" | "upSpecial" | "downSpecial"
  | "neutralSpecialAir" | "sideSpecialAir" | "upSpecialAir" | "downSpecialAir"
  | HeroFollowUpPose;

/** Pose to clip: a hero's presentation, or an original fighter's packaged clips. */
export type HeroClipTable = { readonly [pose in HeroPose]?: HeroClip | undefined };

export interface HeroPresentation {
  /** The Warcraft model; stock paths need no import. */
  readonly model: string;
  readonly scale: number;
  /** The fighter object's own four-character code; every fighter derives from a plain unit (objectData.ts). */
  readonly objectId: number;
  /** Selection, HUD and off-screen portrait texture. */
  readonly portrait: string;
  /** The model its placed object shows, and that model's standing height; Serpent Ward when absent. */
  readonly placedModel?: { readonly path: string; readonly height: number; readonly alpha: number } | undefined;
  /**
   * The fighter's unit plays each clip by sequence index, which selects that
   * exact sequence where an animation name picks at random among same-named
   * variants ("Attack - 1", "Attack - 2").
   */
  readonly clips: HeroClipTable;
  readonly fallback: HeroClip;
}

export interface HeroDefinition {
  readonly character: Character;
  /** The product name shown to players. */
  readonly name: string;
  readonly purpose: string;
  readonly weakness: string;
  /**
   * Selectable only when true: set it once the whole base kit (normals, grabs
   * and throws, four specials with a free up special) and presentation work.
   */
  readonly complete: boolean;
  readonly moves: FighterMoves;
  readonly specials?: FighterSpecials | undefined;
  readonly presentation: HeroPresentation;
  /** How its computer plays (sim/gameplan.ts); without one it plays the general computer. */
  readonly gameplan?: FighterGameplan | undefined;
}

/** The stock-model default: sequence zero for a second, until a hero maps its poses. */
export const STOCK_FALLBACK_CLIP: HeroClip = { index: 0, seconds: 1.0 };
