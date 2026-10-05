import { max } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { GrabAction, LedgeState, SpecialAction } from "../sim/codes";
import { canAttack } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { type Controls, type Roster, isActive } from "../sim/roster";
import { INITIAL_DASH_FRAMES } from "../sim/tuning";

/** Illidan's locomotion clip; the numbers are the Wurst codes pose keys record. */
export const IllidanLocomotion = { idle: 0, walk: 1, run: 2, dash: 3, turn: 4, stop: 5, crouch: 6, fall: 7, fastFall: 8 } as const;
export type IllidanLocomotion = (typeof IllidanLocomotion)[keyof typeof IllidanLocomotion];

/** How long each transient clip plays; its pose stretches the clip over these frames. */
export const TRANSITION_FRAMES = 8;
export const RESPAWN_FRAMES = 24;
export const ESCAPE_FRAMES = 10;
export const LEDGE_CATCH_FRAMES = 6;

/** Completed-frame presentation history; the simulation never reads it. */
export interface IllidanMotion {
  motion: IllidanLocomotion;
  transitionRemaining: number;
  respawnRemaining: number;
  escapeRemaining: number;
  ledgeCatchRemaining: number;
  ledgeJump: boolean;
  previousFacing: number;
  previousLedge: LedgeState;
  previousJump: number;
  previousOut: boolean;
  /** The slot that held this fighter on the previous executed frame. */
  previousGrabOwner: number | undefined;
  previouslyMoving: boolean;
}

export function createIllidanMotion(): IllidanMotion {
  return {
    motion: IllidanLocomotion.idle, transitionRemaining: 0, respawnRemaining: 0, escapeRemaining: 0,
    ledgeCatchRemaining: 0, ledgeJump: false, previousFacing: 0, previousLedge: LedgeState.none,
    previousJump: 0, previousOut: false, previousGrabOwner: undefined, previouslyMoving: false,
  };
}

export function clearIllidanMotion(history: IllidanMotion): void {
  history.motion = IllidanLocomotion.idle;
  history.transitionRemaining = 0;
  history.respawnRemaining = 0;
  history.escapeRemaining = 0;
  history.ledgeCatchRemaining = 0;
  history.ledgeJump = false;
  history.previousFacing = 0;
  history.previousLedge = LedgeState.none;
  history.previousJump = 0;
  history.previousOut = false;
  history.previousGrabOwner = undefined;
  history.previouslyMoving = false;
}

/** A holder outside the source world's participants is not carried into the copy. */
export function copyIllidanMotion(target: IllidanMotion, source: Readonly<IllidanMotion>, sourceWorld: Readonly<Roster>): void {
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
  target.previouslyMoving = source.previouslyMoving;
  const owner = source.previousGrabOwner;
  target.previousGrabOwner = owner !== undefined && isActive(sourceWorld, owner) ? owner : undefined;
}

/** The first differing field; a holder reference outside its world never matches. */
export function firstIllidanMotionDifference(
  expected: Readonly<IllidanMotion>, actual: Readonly<IllidanMotion>, world: Readonly<Roster>, actualWorld: Readonly<Roster>,
): string | undefined {
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
  const owner = expected.previousGrabOwner;
  const sameOwner = owner === actual.previousGrabOwner && (owner === undefined || (isActive(world, owner) && isActive(actualWorld, owner)));
  if (!sameOwner) return "previousGrabOwner";
  return undefined;
}

/** Advances one executed frame; the frame's hitlag and freezes hold every countdown. */
export function advanceIllidanMotion(history: IllidanMotion, fighter: Readonly<Fighter>, controls: Readonly<Controls>, world: Readonly<Roster>): void {
  const { launch, motion, special, shield, jump, ground, grab, status, ledge } = fighter;
  if (launch.hitlag > 0 || status.frozenFrames > 0) return;
  history.respawnRemaining = max(0, history.respawnRemaining - 1);
  history.escapeRemaining = max(0, history.escapeRemaining - 1);
  history.ledgeCatchRemaining = max(0, history.ledgeCatchRemaining - 1);
  if (history.previousOut && !status.out) history.respawnRemaining = RESPAWN_FRAMES;
  // The previous holder's current action tells an escape from a throw.
  const previousOwner = history.previousGrabOwner === undefined ? undefined : world.fighters[history.previousGrabOwner];
  if (previousOwner !== undefined && grab.owner === undefined && previousOwner.grab.action === GrabAction.escape) history.escapeRemaining = ESCAPE_FRAMES;
  if (history.previousLedge === LedgeState.none && ledge.state === LedgeState.hang) history.ledgeCatchRemaining = LEDGE_CATCH_FRAMES;
  if (jump.serial !== history.previousJump) history.ledgeJump = history.previousLedge === LedgeState.hang;
  if (motion.grounded || launch.hitstun > 0 || special.action !== SpecialAction.none) history.ledgeJump = false;
  const moving = motion.grounded && Math.abs(motion.vx) > f32(0.1);
  const available = motion.grounded && canAttack(fighter) && !shield.raised && shield.releaseLag === 0 && jump.squat === 0;
  if (!available) {
    history.transitionRemaining = 0;
    history.motion = motion.fastFalling ? IllidanLocomotion.fastFall : IllidanLocomotion.fall;
  } else if (controls.direction !== 0 && history.previousFacing !== 0
    && (fighter.facing !== history.previousFacing || f32(motion.vx * controls.direction) < 0)) {
    history.motion = IllidanLocomotion.turn;
    history.transitionRemaining = TRANSITION_FRAMES;
  } else if (controls.direction === 0 && history.previouslyMoving
    && (history.motion === IllidanLocomotion.run || history.motion === IllidanLocomotion.dash || history.motion === IllidanLocomotion.walk)) {
    history.motion = IllidanLocomotion.stop;
    history.transitionRemaining = TRANSITION_FRAMES;
  } else if (history.transitionRemaining > 0) history.transitionRemaining--;
  else if (controls.down && controls.direction === 0) history.motion = IllidanLocomotion.crouch;
  else if (ground.dashFrame > 0 && ground.dashFrame <= INITIAL_DASH_FRAMES && controls.direction !== 0) history.motion = IllidanLocomotion.dash;
  else if (moving) history.motion = controls.walking ? IllidanLocomotion.walk : IllidanLocomotion.run;
  else history.motion = IllidanLocomotion.idle;
  if (launch.hitstun > 0 || motion.grounded || controls.direction !== 0 || controls.jumpPressed || controls.attackRequested || special.action !== SpecialAction.none) {
    history.respawnRemaining = 0;
  }
  if (launch.hitstun === 0 || grab.owner !== undefined) history.escapeRemaining = 0;
  history.previousFacing = fighter.facing;
  history.previousLedge = ledge.state;
  history.previousJump = jump.serial;
  history.previousOut = status.out;
  history.previousGrabOwner = grab.owner;
  history.previouslyMoving = moving;
}
