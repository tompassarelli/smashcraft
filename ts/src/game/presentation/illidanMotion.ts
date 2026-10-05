import { f32 } from "../../sim/f32";
import { Character, DownState, GrabAction, LedgeState, SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { canAttack } from "../sim/conditions";
import { INITIAL_DASH_FRAMES } from "../sim/tuning";
import type { Controls, Roster } from "../sim/roster";
import {
  DEMON_HUNTER_COMBAT_IDLE_INDEX, DEMON_HUNTER_WALK_FORWARD_INDEX, DEMON_HUNTER_RUN_FORWARD_INDEX,
  DEMON_HUNTER_DASH_START_INDEX, DEMON_HUNTER_TURNAROUND_INDEX, DEMON_HUNTER_STOP_INDEX,
  DEMON_HUNTER_CROUCH_INDEX, DEMON_HUNTER_FAST_FALL_INDEX, DEMON_HUNTER_FALL_INDEX,
  DEMON_HUNTER_DASH_START_SECONDS, DEMON_HUNTER_TURNAROUND_SECONDS, DEMON_HUNTER_STOP_SECONDS,
  DEMON_HUNTER_CROUCH_SECONDS,
} from "./demonHunterAssetInfo";

export const ILLIDAN_IDLE = 0;
export const ILLIDAN_WALK = 1;
export const ILLIDAN_RUN = 2;
export const ILLIDAN_DASH = 3;
export const ILLIDAN_TURN = 4;
export const ILLIDAN_STOP = 5;
export const ILLIDAN_CROUCH = 6;
export const ILLIDAN_FALL = 7;
export const ILLIDAN_FAST_FALL = 8;

export interface IllidanMotion {
  motion: number;
  transitionRemaining: number;
  respawnRemaining: number;
  escapeRemaining: number;
  ledgeCatchRemaining: number;
  ledgeJump: boolean;
  previousFacing: number;
  previousLedge: number;
  previousJump: number;
  previousOut: boolean;
  previousGrabOwner: number | undefined;
  previouslyMoving: boolean;
}

export function createIllidanMotion(): IllidanMotion {
  return {
    motion: ILLIDAN_IDLE, transitionRemaining: 0, respawnRemaining: 0, escapeRemaining: 0,
    ledgeCatchRemaining: 0, ledgeJump: false, previousFacing: 0, previousLedge: LedgeState.none,
    previousJump: 0, previousOut: false, previousGrabOwner: undefined, previouslyMoving: false,
  };
}

export function copyIllidanMotion(source: Readonly<IllidanMotion>): IllidanMotion {
  return { ...source };
}

export function copyIllidanMotionInto(target: IllidanMotion, source: Readonly<IllidanMotion>): void {
  target.motion = source.motion;
  target.transitionRemaining = source.transitionRemaining;
  target.respawnRemaining = source.respawnRemaining;
  target.escapeRemaining = source.escapeRemaining;
  target.ledgeCatchRemaining = source.ledgeCatchRemaining;
  target.ledgeJump = source.ledgeJump;
  target.previousFacing = source.previousFacing;
  target.previousLedge = source.previousLedge;
  target.previousJump = source.previousJump;
  target.previousOut = source.previousOut;
  target.previousGrabOwner = source.previousGrabOwner;
  target.previouslyMoving = source.previouslyMoving;
}

export function firstIllidanMotionDifference(expected: Readonly<IllidanMotion>, actual: Readonly<IllidanMotion>): string | undefined {
  if (expected.motion !== actual.motion) return "motion";
  if (expected.transitionRemaining !== actual.transitionRemaining) return "transitionRemaining";
  if (expected.respawnRemaining !== actual.respawnRemaining) return "respawnRemaining";
  if (expected.escapeRemaining !== actual.escapeRemaining) return "escapeRemaining";
  if (expected.ledgeCatchRemaining !== actual.ledgeCatchRemaining) return "ledgeCatchRemaining";
  if (expected.ledgeJump !== actual.ledgeJump) return "ledgeJump";
  if (expected.previousFacing !== actual.previousFacing) return "previousFacing";
  if (expected.previousLedge !== actual.previousLedge) return "previousLedge";
  if (expected.previousJump !== actual.previousJump) return "previousJump";
  if (expected.previousOut !== actual.previousOut) return "previousOut";
  if (expected.previouslyMoving !== actual.previouslyMoving) return "previouslyMoving";
  if (expected.previousGrabOwner !== actual.previousGrabOwner) return "previousGrabOwner";
  return undefined;
}

export function advanceIllidanMotion(history: IllidanMotion, fighter: Readonly<Fighter>, controls: Readonly<Controls>, roster: Readonly<Roster>): void {
  const { launch, motion: body, special, shield, jump, ground, grab, status, ledge } = fighter;
  if (launch.hitlag > 0 || status.frozenFrames > 0) return;
  history.respawnRemaining = Math.max(0, history.respawnRemaining - 1);
  history.escapeRemaining = Math.max(0, history.escapeRemaining - 1);
  history.ledgeCatchRemaining = Math.max(0, history.ledgeCatchRemaining - 1);
  if (history.previousOut && !status.out) history.respawnRemaining = 24;
  const priorOwner = history.previousGrabOwner === undefined ? undefined : roster.fighters[history.previousGrabOwner];
  if (priorOwner !== undefined && grab.owner === undefined && priorOwner.grab.action === GrabAction.escape) history.escapeRemaining = 10;
  if (history.previousLedge === LedgeState.none && ledge.state === LedgeState.hang) history.ledgeCatchRemaining = 6;
  if (jump.serial !== history.previousJump) history.ledgeJump = history.previousLedge === LedgeState.hang;
  if (body.grounded || launch.hitstun > 0 || special.action !== SpecialAction.none) history.ledgeJump = false;
  const moving = body.grounded && Math.abs(body.vx) > f32(0.1);
  const available = body.grounded && canAttack(fighter) && !shield.raised && shield.releaseLag === 0 && jump.squat === 0;
  if (!available) {
    history.transitionRemaining = 0;
    history.motion = body.fastFalling ? ILLIDAN_FAST_FALL : ILLIDAN_FALL;
  } else if (controls.direction !== 0 && history.previousFacing !== 0
    && (fighter.facing !== history.previousFacing || f32(body.vx * controls.direction) < 0)) {
    history.motion = ILLIDAN_TURN;
    history.transitionRemaining = 8;
  } else if (controls.direction === 0 && history.previouslyMoving
    && (history.motion === ILLIDAN_RUN || history.motion === ILLIDAN_DASH || history.motion === ILLIDAN_WALK)) {
    history.motion = ILLIDAN_STOP;
    history.transitionRemaining = 8;
  } else if (history.transitionRemaining > 0) history.transitionRemaining--;
  else if (controls.down && controls.direction === 0) history.motion = ILLIDAN_CROUCH;
  else if (ground.dashFrame > 0 && ground.dashFrame <= INITIAL_DASH_FRAMES && controls.direction !== 0) history.motion = ILLIDAN_DASH;
  else if (moving) history.motion = controls.walking ? ILLIDAN_WALK : ILLIDAN_RUN;
  else history.motion = ILLIDAN_IDLE;
  if (launch.hitstun > 0 || body.grounded || controls.direction !== 0 || controls.jumpPressed || controls.attackRequested || special.action !== SpecialAction.none) history.respawnRemaining = 0;
  if (launch.hitstun === 0 || grab.owner !== undefined) history.escapeRemaining = 0;
  history.previousFacing = fighter.facing;
  history.previousLedge = ledge.state;
  history.previousJump = jump.serial;
  history.previousOut = status.out;
  history.previousGrabOwner = grab.owner;
  history.previouslyMoving = moving;
}

export function illidanMotionIndex(motion: number): number {
  if (motion === ILLIDAN_WALK) return DEMON_HUNTER_WALK_FORWARD_INDEX;
  if (motion === ILLIDAN_RUN) return DEMON_HUNTER_RUN_FORWARD_INDEX;
  if (motion === ILLIDAN_DASH) return DEMON_HUNTER_DASH_START_INDEX;
  if (motion === ILLIDAN_TURN) return DEMON_HUNTER_TURNAROUND_INDEX;
  if (motion === ILLIDAN_STOP) return DEMON_HUNTER_STOP_INDEX;
  if (motion === ILLIDAN_CROUCH) return DEMON_HUNTER_CROUCH_INDEX;
  if (motion === ILLIDAN_FAST_FALL) return DEMON_HUNTER_FAST_FALL_INDEX;
  if (motion === ILLIDAN_FALL) return DEMON_HUNTER_FALL_INDEX;
  return DEMON_HUNTER_COMBAT_IDLE_INDEX;
}

export function illidanMotionRate(fighter: Readonly<Fighter>, history: Readonly<IllidanMotion>): number {
  const frameSeconds = f32(0.016666667);
  if (history.motion === ILLIDAN_DASH) return f32(DEMON_HUNTER_DASH_START_SECONDS / f32(INITIAL_DASH_FRAMES * frameSeconds));
  if (history.motion === ILLIDAN_TURN) return f32(DEMON_HUNTER_TURNAROUND_SECONDS / f32(8 * frameSeconds));
  if (history.motion === ILLIDAN_STOP) return f32(DEMON_HUNTER_STOP_SECONDS / f32(8 * frameSeconds));
  if (history.motion === ILLIDAN_CROUCH) return f32(DEMON_HUNTER_CROUCH_SECONDS / f32(24 * frameSeconds));
  if (history.motion === ILLIDAN_FALL || history.motion === ILLIDAN_FAST_FALL) return 0.0;
  if (history.motion === ILLIDAN_WALK) return Math.max(f32(0.2), f32(Math.abs(fighter.motion.vx) / fighter.tuning.physics.walkSpeed));
  if (history.motion === ILLIDAN_RUN) return Math.max(f32(0.2), f32(Math.abs(fighter.motion.vx) / fighter.tuning.physics.runSpeed));
  return 1.0;
}
