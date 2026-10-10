

import { max, min } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { idiv } from "wisp/src/sim/intMath";
import { AttackStyle, Character, GrabAction } from "./codes";
import type { AuthoredFall, AuthoredMove, FighterMoves } from "./heroMoves";
import { MoveField, MoveFlag, hasMoveFlag, hasNormal, moveField, startupTravelOf, throwMove } from "./moveTable";

export const SMASH_MAX_CHARGE_FRAMES = 60;
export const SMASH_MAX_DAMAGE_MULTIPLIER = 1.3671000003814697;
export const LEDGE_ATTACK_FRAMES = 40;
export const DOWN_ATTACK_FRAMES = 49;
export const DOWN_ATTACK_STARTUP_FRAMES = 16;
export const DOWN_ATTACK_ACTIVE_FRAMES = 3;
export const DOWN_ATTACK_DAMAGE = 7.0;


export const DOWN_ATTACK_BASE_KNOCKBACK = 75.0;

export const DEMON_HUNTER_FORWARD_AIR_ACTIVE = 6;
export const DEMON_HUNTER_DOWN_SMASH_ACTIVE = 9;
export const DEMON_HUNTER_FORWARD_SMASH_ACTIVE = 3;

export const FEL_LUNGE_BASE = 40.0;
export const FEL_LUNGE_CHARGE = 30.0;
export const FEL_LUNGE_FIRST = 6;
export const FEL_LUNGE_FRAMES = 4;

export function felLungeStep(character: Character, style: AttackStyle | undefined, frame: number, charging: boolean, chargeFrames: number): number {
  if (character !== Character.demonHunter || style !== AttackStyle.forwardSmash || charging || frame < FEL_LUNGE_FIRST || frame >= FEL_LUNGE_FIRST + FEL_LUNGE_FRAMES) return 0.0;
  const charge = f32(f32(FEL_LUNGE_CHARGE * min(chargeFrames, SMASH_MAX_CHARGE_FRAMES)) / SMASH_MAX_CHARGE_FRAMES);
  return f32(f32(FEL_LUNGE_BASE + charge) / FEL_LUNGE_FRAMES);
}







export const RIFLEMAN_BLASTER_GROUND_SHOT_FRAME = 9;
export const RIFLEMAN_BLASTER_GROUND_FRAMES = 38;
export const RIFLEMAN_BLASTER_AIR_SHOT_FRAME = 14;
export const RIFLEMAN_BLASTER_AIR_FRAMES = 40;
export const RIFLEMAN_BLASTER_LANDING_LAG = 8;
/** A grounded shot deals 4 to an aerial shot's 3; f32(4/3) * 3 rounds to exactly 4. */
export const RIFLEMAN_BLASTER_GROUND_DAMAGE_MULTIPLIER = 1.3333333730697632;






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


export function attackFall(style: AttackStyle | undefined, frame: number, moves?: FighterMoves): AuthoredFall | undefined {
  if (moves?.table !== undefined) return undefined;
  const phases = style === undefined ? undefined : moves?.normals[style]?.fall;
  if (phases === undefined) return undefined;
  for (const phase of phases) if (frame >= phase.firstFrame && frame <= phase.lastFrame) return phase;
  return undefined;
}


export function attackStartupTravelOf(style: AttackStyle | undefined, moves?: FighterMoves): Pick<AuthoredMove, "startupTravelX" | "startupFrames" | "startupStopsAtBody"> | undefined {
  if (style === undefined) return undefined;
  const table = moves?.table;
  if (table === undefined) return moves?.normals[style];
  return startupTravelOf(table, style);
}


export function hasStartupTravel(style: AttackStyle, moves?: FighterMoves): boolean {
  const table = moves?.table;
  if (table !== undefined) return hasNormal(table, style) && hasMoveFlag(table, style, MoveFlag.startupTravel);
  return moves?.normals[style]?.startupTravelX !== undefined;
}


export function authoredGrabFrames(moves: FighterMoves | undefined, total: boolean): number {
  const table = moves?.table;
  if (table !== undefined) return hasNormal(table, AttackStyle.grab) ? moveField(table, AttackStyle.grab, total ? MoveField.total : MoveField.startup) : -1;
  const grab = moves?.normals[AttackStyle.grab];
  return grab === undefined ? -1 : total ? grab.totalFrames : grab.startupFrames;
}


export function authoredLandingHit(style: AttackStyle | undefined, moves?: FighterMoves): AuthoredMove["landingHit"] {
  if (style === undefined || moves?.table !== undefined) return undefined;
  return moves?.normals[style]?.landingHit;
}


export function landsIntoAttack(style: AttackStyle | undefined, frame: number, moves?: FighterMoves): boolean {
  if (moves?.table !== undefined) return false;
  const move = style === undefined ? undefined : moves?.normals[style];
  return move?.landingHit !== undefined && frame >= move.startupFrames && frame < move.startupFrames + move.activeFrames;
}


export function nextJab(style: AttackStyle | undefined): AttackStyle | undefined {
  return style === AttackStyle.jab ? AttackStyle.jab2 : style === AttackStyle.jab2 ? AttackStyle.jab3 : undefined;
}

export function isJab(style: AttackStyle | undefined): boolean {
  return style === AttackStyle.jab || style === AttackStyle.jab2 || style === AttackStyle.jab3;
}







export function jabChainFrom(character: Character, style: AttackStyle, moves?: FighterMoves): number | undefined {
  const next = nextJab(style);
  if (next === undefined) return undefined;
  const shared = attackStartupFrames(style) + attackActiveFrames(style) + 1;
  const table = moves?.table;
  if (table !== undefined) {
    if (!hasNormal(table, next)) return undefined;
    if (!hasNormal(table, style)) return shared;
    const chain = moveField(table, style, MoveField.chainsFrom);
    return chain < 0 ? undefined : chain;
  }
  if (moves !== undefined) return moves.normals[next] === undefined ? undefined : moves.normals[style]?.chainsFrom ?? (moves.normals[style] === undefined ? shared : undefined);
  return character === Character.demonHunter ? shared : undefined;
}

export function isSmashAttack(style: AttackStyle | undefined): boolean {
  return style !== undefined && style >= AttackStyle.upSmash && style <= AttackStyle.forwardSmash;
}


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


export function attackLandingLag(style: AttackStyle | undefined, moves?: FighterMoves): number {
  const table = moves?.table;
  if (table !== undefined) {
    if (style !== undefined && hasNormal(table, style)) return moveField(table, style, MoveField.landingLag);
  } else if (style !== undefined && moves?.normals[style] !== undefined) return moves.normals[style].landingLag;
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
    case AttackStyle.forwardAir:
      return 7.0;
    case AttackStyle.getupAttack:
      return DOWN_ATTACK_DAMAGE;
    case AttackStyle.backAir:
    case AttackStyle.upAir:
    case AttackStyle.upTilt:
    case AttackStyle.downTilt:
      return 8.0;
    case AttackStyle.shot:
      return 2.7900002002716064;
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
    case AttackStyle.jab2:
      return 4.0;
    case AttackStyle.jab3:
      return 6.0;
  }
}


export function smashDamageMultiplier(chargeFrames: number, moves?: FighterMoves): number {
  const frames = moves?.smashMaxChargeFrames ?? SMASH_MAX_CHARGE_FRAMES;
  const multiplier = moves?.smashMaxDamageMultiplier ?? SMASH_MAX_DAMAGE_MULTIPLIER;
  const charge = max(0, min(frames, chargeFrames));
  return f32(1.0 + f32(f32(f32(multiplier - 1.0) * charge) / frames));
}

export function attackReach(style: AttackStyle): number {
  switch (style) {

    case AttackStyle.jab:
      return 120.0;
    case AttackStyle.demonHunterDashAttack:
      return 155.0;
    case AttackStyle.shot:
      return 600.0;
    case AttackStyle.upSmash:
    case AttackStyle.downSmash:
      return 125.0;
    case AttackStyle.grab:
      return 96.0;
    default:
      return 145.0;
  }
}


export function attackStartupFrames(style: AttackStyle, moves?: FighterMoves): number {
  const table = moves?.table;
  if (table !== undefined) {
    if (hasNormal(table, style)) return moveField(table, style, MoveField.startup);
  } else {
    const authored = moves?.normals[style];
    if (authored !== undefined) return authored.startupFrames;
  }
  switch (style) {
    case AttackStyle.ledgeAttack:
      return 16;
    case AttackStyle.demonHunterDashAttack:
    case AttackStyle.dashAttack:
    case AttackStyle.jab:
    case AttackStyle.jab2:
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
    case AttackStyle.jab3:
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
    case AttackStyle.jab3:
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
  if (style === AttackStyle.grab) return 3;
  const table = moves?.table;
  if (table !== undefined) {
    if (hasNormal(table, style)) return moveField(table, style, MoveField.active);
  } else {
    const authored = moves?.normals[style];
    if (authored !== undefined) return authored.activeFrames;
  }

  if (character === Character.demonHunter) {
    if (style === AttackStyle.forwardAir) return DEMON_HUNTER_FORWARD_AIR_ACTIVE;
    if (style === AttackStyle.downSmash) return DEMON_HUNTER_DOWN_SMASH_ACTIVE;
    if (style === AttackStyle.forwardSmash) return DEMON_HUNTER_FORWARD_SMASH_ACTIVE;
  }
  return attackActiveFrames(style);
}



export function attackDurationFramesForGrounding(style: AttackStyle, grounded: boolean, moves?: FighterMoves): number {
  const table = moves?.table;
  if (table !== undefined) {
    if (hasNormal(table, style)) return moveField(table, style, MoveField.total);
  } else {
    const authored = moves?.normals[style];
    if (authored !== undefined) return authored.totalFrames;
  }
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
    case AttackStyle.jab2:
      return 22;
    case AttackStyle.jab3:
      return 28;
    default:
      return 36;
  }
}







export const EARLY_ASCENT_GRAB_FRAMES = 7;


export const GRAB_HOLD_FRAMES = 120;

export const GRAB_HOLD_MINIMUM_FRAMES = 30;

export const PUMMEL_CONTACT_FRAME = 60;
export const PUMMEL_TOTAL_FRAMES = 68;

export const PUMMEL_DAMAGE = 3.0;
export const GRAB_HOLD_DISTANCE = 50.0;


export function pummelLimit(moves?: FighterMoves): number {
  return min(1, moves?.maxPummels ?? 1);
}


export function grabContactFrame(action: GrabAction, moves?: FighterMoves): number {
  if (action === GrabAction.pummel) return PUMMEL_CONTACT_FRAME;
  const table = moves?.table;
  if (table !== undefined) {
    const id = throwMove(table, action);
    if (id >= 0) return moveField(table, id, MoveField.contactFrame);
  } else {
    const authored = moves?.throws[action];
    if (authored !== undefined) return authored.contactFrame;
  }
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
  const table = moves?.table;
  if (table !== undefined) {
    const id = throwMove(table, action);
    if (id >= 0) return moveField(table, id, MoveField.total);
  } else {
    const authored = moves?.throws[action];
    if (authored !== undefined) return authored.totalFrames;
  }
  switch (action) {
    case GrabAction.throwForward:
      return 30;
    case GrabAction.throwBack:
      return 34;
    case GrabAction.throwUp:

      return 24;
    case GrabAction.throwDown:
      return 36;
    default:
      return 10;
  }
}
