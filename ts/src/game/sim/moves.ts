// Attack timing, damage and reach for every action ID. Frame counts are
// provisional authored values unless a constant names its Melee source.
import { max, min } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { idiv } from "wisp/src/sim/intMath";
import { AttackStyle, Character, GrabAction } from "./codes";
import type { AuthoredFall, FighterMoves } from "./heroMoves";

export const SMASH_MAX_CHARGE_FRAMES = 60;
export const SMASH_MAX_DAMAGE_MULTIPLIER = 1.3671000003814697;
export const LEDGE_ATTACK_FRAMES = 40;
export const DOWN_ATTACK_FRAMES = 49;
export const DOWN_ATTACK_STARTUP_FRAMES = 16;
export const DOWN_ATTACK_ACTIVE_FRAMES = 3;
export const DOWN_ATTACK_DAMAGE = 7.0;
// Provisional get-up attack tuning: let the attacker regain control before
// the opponent's first active wake-up attack. See smashcraft:docs/physics.md.
export const DOWN_ATTACK_BASE_KNOCKBACK = 75.0;
const ARCHER_DOWN_ACTIVE_FRAMES = 20;
/**
 * Rifleman's blaster (neutral special), after Melee Falco's laser and a little
 * less oppressive. Shot frames count special frames from the press (frame 1).
 * A grounded shot leaves sooner and hits harder but holds him longer; an
 * aerial shot leaves later, and landing ends it with its landing lag, before
 * the shot if it has not left. Values and their ramifications are in #117.
 */
export const RIFLEMAN_BLASTER_GROUND_SHOT_FRAME = 9;
export const RIFLEMAN_BLASTER_GROUND_FRAMES = 38;
export const RIFLEMAN_BLASTER_AIR_SHOT_FRAME = 14;
export const RIFLEMAN_BLASTER_AIR_FRAMES = 40;
export const RIFLEMAN_BLASTER_LANDING_LAG = 8;
/** A grounded shot deals 4 to an aerial shot's 3; f32(4/3) * 3 rounds to exactly 4. */
export const RIFLEMAN_BLASTER_GROUND_DAMAGE_MULTIPLIER = 1.3333333730697632;
/**
 * Each aerial's authored landing lag before Melee's L-cancel would halve it
 * (PlCo +0x0E8 = 2, melee:src/melee/ft/kinds/ftCommon/ftCo_LandingAir.c).
 * Smashcraft omits L-cancelling: every aerial lands with the halved lag
 * (smashcraft:docs/gameplay-design.md).
 */
const UNCANCELLED_AERIAL_LANDING_LAG = {
  [AttackStyle.neutralAir]: 10,
  [AttackStyle.forwardAir]: 14,
  [AttackStyle.backAir]: 16,
  [AttackStyle.upAir]: 15,
  [AttackStyle.downAir]: 18,
} as const;

export function isAerialAttack(style: AttackStyle | undefined): boolean {
  return style !== undefined && style >= AttackStyle.neutralAir && style <= AttackStyle.downAir;
}

/** The descent an authored drill holds on this attack frame, if any. */
export function attackFall(style: AttackStyle | undefined, frame: number, moves?: FighterMoves): AuthoredFall | undefined {
  const phases = style === undefined ? undefined : moves?.normals[style]?.fall;
  if (phases === undefined) return undefined;
  for (const phase of phases) if (frame >= phase.firstFrame && frame <= phase.lastFrame) return phase;
  return undefined;
}

/** Whether landing on this attack frame continues into the aerial's landing hit: only during its active frames. */
export function landsIntoAttack(style: AttackStyle | undefined, frame: number, moves?: FighterMoves): boolean {
  const move = style === undefined ? undefined : moves?.normals[style];
  return move?.landingHit !== undefined && frame >= move.startupFrames && frame < move.startupFrames + move.activeFrames;
}

export function isSmashAttack(style: AttackStyle | undefined): boolean {
  return style !== undefined && style >= AttackStyle.upSmash && style <= AttackStyle.forwardSmash;
}

/** An aerial's landing lag before Melee's L-cancel would halve it; zero for other actions. */
export function uncancelledLandingLag(style: AttackStyle | undefined): number {
  switch (style) {
    case AttackStyle.neutralAir:
    case AttackStyle.forwardAir:
    case AttackStyle.backAir:
    case AttackStyle.upAir:
    case AttackStyle.downAir:
      return UNCANCELLED_AERIAL_LANDING_LAG[style];
    default:
      return 0;
  }
}

/** The landing lag an aerial lands with, always Melee's L-cancelled lag: half, at least one; zero for other actions. */
export function attackLandingLag(style: AttackStyle | undefined, moves?: FighterMoves): number {
  if (style !== undefined && moves?.normals[style] !== undefined) return moves.normals[style].landingLag;
  const lag = uncancelledLandingLag(style);
  return lag > 0 ? max(1, idiv(lag, 2)) : 0;
}

export function attackDamage(style: AttackStyle): number {
  switch (style) {
    case AttackStyle.dashAttack:
    case AttackStyle.demonHunterDashAttack:
    case AttackStyle.downAir:
      return 9.0;
    case AttackStyle.ledgeAttack:
    case AttackStyle.neutralAir:
      return 7.0;
    case AttackStyle.getupAttack:
      return DOWN_ATTACK_DAMAGE;
    case AttackStyle.forwardAir:
    case AttackStyle.backAir:
    case AttackStyle.upAir:
    case AttackStyle.upTilt:
    case AttackStyle.downTilt:
      return 8.0;
    case AttackStyle.shot:
      return 3.0;
    case AttackStyle.upSmash:
    case AttackStyle.downSmash:
      return 16.0;
    case AttackStyle.forwardSmash:
      return 18.0;
    case AttackStyle.grab:
      return 0.0;
    case AttackStyle.forwardTilt:
    case AttackStyle.forwardTiltUp:
    case AttackStyle.forwardTiltDown:
      return 10.0;
    case AttackStyle.jab:
      return 5.0;
  }
}

/** Damage scale of a smash charged for chargeFrames, linear up to SMASH_MAX_CHARGE_FRAMES. */
export function smashDamageMultiplier(chargeFrames: number, moves?: FighterMoves): number {
  const frames = moves?.smashMaxChargeFrames ?? SMASH_MAX_CHARGE_FRAMES;
  const multiplier = moves?.smashMaxDamageMultiplier ?? SMASH_MAX_DAMAGE_MULTIPLIER;
  const charge = max(0, min(frames, chargeFrames));
  return f32(1.0 + f32(f32(f32(multiplier - 1.0) * charge) / frames));
}

export function attackReach(style: AttackStyle): number {
  switch (style) {
    case AttackStyle.demonHunterDashAttack:
      return 155.0;
    case AttackStyle.shot:
      return 600.0;
    case AttackStyle.upSmash:
    case AttackStyle.downSmash:
      return 125.0;
    case AttackStyle.grab:
      return 100.0;
    default:
      return 145.0;
  }
}

/** Frames before the first active frame; attackFrame zero is the start tick (reference frame one). */
export function attackStartupFrames(style: AttackStyle, moves?: FighterMoves): number {
  const authored = moves?.normals[style];
  if (authored !== undefined) return authored.startupFrames;
  switch (style) {
    case AttackStyle.ledgeAttack:
      return 16;
    case AttackStyle.demonHunterDashAttack:
    case AttackStyle.dashAttack:
    case AttackStyle.jab:
      return 4;
    case AttackStyle.neutralAir:
    case AttackStyle.backAir:
      return 3;
    case AttackStyle.forwardAir:
    case AttackStyle.upAir:
    case AttackStyle.grab:
    case AttackStyle.forwardTilt:
    case AttackStyle.downTilt:
    case AttackStyle.forwardTiltUp:
    case AttackStyle.forwardTiltDown:
      return 5;
    case AttackStyle.downAir:
      return 7;
    case AttackStyle.getupAttack:
      return DOWN_ATTACK_STARTUP_FRAMES;
    case AttackStyle.shot:
      return 2;
    case AttackStyle.upSmash:
    case AttackStyle.downSmash:
      return 8;
    case AttackStyle.forwardSmash:
    case AttackStyle.upTilt:
      return 6;
  }
}

export function attackActiveFrames(style: AttackStyle): number {
  switch (style) {
    case AttackStyle.ledgeAttack:
    case AttackStyle.upAir:
    case AttackStyle.downAir:
    case AttackStyle.upSmash:
    case AttackStyle.downSmash:
    case AttackStyle.forwardSmash:
      return 3;
    case AttackStyle.neutralAir:
      return 28;
    case AttackStyle.backAir:
      return 16;
    case AttackStyle.getupAttack:
      return DOWN_ATTACK_ACTIVE_FRAMES;
    case AttackStyle.shot:
      return 1;
    default:
      return 2;
  }
}

export function characterAttackActiveFrames(character: Character, style: AttackStyle, moves?: FighterMoves): number {
  const authored = moves?.normals[style];
  if (authored !== undefined) return authored.activeFrames;
  return character === Character.archer && style === AttackStyle.downAir ? ARCHER_DOWN_ACTIVE_FRAMES : attackActiveFrames(style);
}

export function attackDurationFrames(style: AttackStyle): number {
  return attackDurationFramesForGrounding(style, true);
}

/** Total frames; only the shot is shorter in the air. */
export function attackDurationFramesForGrounding(style: AttackStyle, grounded: boolean, moves?: FighterMoves): number {
  const authored = moves?.normals[style];
  if (authored !== undefined) return authored.totalFrames;
  switch (style) {
    case AttackStyle.ledgeAttack:
      return LEDGE_ATTACK_FRAMES;
    case AttackStyle.demonHunterDashAttack:
    case AttackStyle.dashAttack:
      return 32;
    case AttackStyle.neutralAir:
      return 41;
    case AttackStyle.forwardAir:
      return 31;
    case AttackStyle.backAir:
      return 37;
    case AttackStyle.upAir:
      return 34;
    case AttackStyle.downAir:
      return 38;
    case AttackStyle.getupAttack:
      return DOWN_ATTACK_FRAMES;
    case AttackStyle.shot:
      return grounded ? 32 : 20;
    case AttackStyle.upSmash:
    case AttackStyle.downSmash:
      return 42;
    case AttackStyle.forwardTilt:
    case AttackStyle.downTilt:
    case AttackStyle.forwardTiltUp:
    case AttackStyle.forwardTiltDown:
      return 28;
    case AttackStyle.upTilt:
      return 29;
    case AttackStyle.jab:
      return 21;
    default:
      return 36;
  }
}

export function attackRecoveryFrames(character: Character, style: AttackStyle, grounded: boolean, moves?: FighterMoves): number {
  return attackDurationFramesForGrounding(style, grounded, moves) - attackStartupFrames(style, moves) - characterAttackActiveFrames(character, style, moves);
}

/**
 * A grab catches a fighter this many frames into a ground jump's ascent as if it
 * were still on the deck it left (#107): the slowest standing grab's first
 * active frame (Lich, frame 10) less the fastest jump squat (3).
 */
export const EARLY_ASCENT_GRAB_FRAMES = 7;

/** Frames every grab holds when the victim doesn't mash, at any percent (#101). */
export const GRAB_HOLD_FRAMES = 120;
/** However fast the victim mashes, a hold lasts this long, so a prompt throw always starts. */
export const GRAB_HOLD_MINIMUM_FRAMES = 30;
/** Every fighter's one pummel connects this late, so mashing from the catch escapes it. */
export const PUMMEL_CONTACT_FRAME = 60;
export const PUMMEL_TOTAL_FRAMES = 68;
/** Every fighter's pummel deals this much, whatever its look (owner decision, #101). */
export const PUMMEL_DAMAGE = 3.0;
export const GRAB_HOLD_DISTANCE = 50.0;

/** At most one pummel per grab; a kit may allow none. */
export function pummelLimit(moves?: FighterMoves): number {
  return min(1, moves?.maxPummels ?? 1);
}

/** The one-based action frame, counting entry, on which a pummel or throw connects. */
export function grabContactFrame(action: GrabAction, moves?: FighterMoves): number {
  if (action === GrabAction.pummel) return PUMMEL_CONTACT_FRAME;
  const authored = moves?.throws[action];
  if (authored !== undefined) return authored.contactFrame;
  switch (action) {
    case GrabAction.throwForward:
      return 12;
    case GrabAction.throwUp:
      return 14;
    default:
      return 16;
  }
}

export function grabActionDuration(action: GrabAction, moves?: FighterMoves): number {
  if (action === GrabAction.pummel) return PUMMEL_TOTAL_FRAMES;
  const authored = moves?.throws[action];
  if (authored !== undefined) return authored.totalFrames;
  switch (action) {
    case GrabAction.throwForward:
      return 30;
    case GrabAction.throwBack:
      return 34;
    case GrabAction.throwUp:
      // Throw roles (#107): the thrower recovers in time for a guaranteed juggle.
      return 24;
    case GrabAction.throwDown:
      return 36;
    default:
      return 10;
  }
}
