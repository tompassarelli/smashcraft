// Moves through pass-through platforms (smashcraft:docs/gameplay-design.md,
// "Platforms"): rising into one plays an ascent, a fresh down on one plays a
// descent, and a half-circle at airborne contact wraps around its edge onto
// or under it. Each lasts the fighter's jump squat, with its ordinary
// hurtbox. Positions are kept from the platform's left end and top, so a
// moving platform carries the fighter through the move.
import { max, min } from "../../runtime/numbers";
import { addFloat32, divideFloat32, multiplyFloat32, subtractFloat32 } from "wisp/src/sim/binary32";
import { AttackPhase, PlatformMove } from "./codes";
import { attackPhase } from "./conditions";
import { finishLanding } from "./down";
import { type Fighter, PLATFORM_DROP_INPUT_WINDOW } from "./fighter";
import { beginAirDodge } from "./jumpsAndDodges";
import { setWorldMotionValue, totalVelocityZ } from "./motion";
import { type Controls, copyControls, neutralControls } from "./roster";
import { surfaceCount, surfaceLeft, surfacePass, surfaceRight, surfaceZ } from "./stage";
import { stickZ } from "./stick";
import { bodyTop } from "./surfaces";
import { cancelAttack, cancelSpecialState, clearDownState, clearPlatformMove } from "./transitions";
import { clearDash } from "./groundMovement";
import { aerialJumps } from "./itemBuffs";
import { melee } from "./tuning";

/** Melee's stick-up jump threshold, 0.6625 (companion/README.md, ftCo_800DF910): holding up past it sustains an ascent. */
const TAP_JUMP_STICK_Z = 0.6625000238418579;
/** How far a wrap carries the fighter along the platform: about one body width. */
export const PLATFORM_WRAP_REACH = melee(8.0);
/** Half-circle steps: away from the side, then down, then toward it. */
const WRAP_COMPLETE = 3;
/** An air dodge that meets a platform keeps its helpless fall but not its intangibility, which ends after frame 29 (conditions.ts). */
const AIR_DODGE_VULNERABLE_FRAME = 30;

/** Every platform move lasts the fighter's jump squat. */
export function platformMoveFrames(f: Readonly<Fighter>): number {
  return max(1, f.tuning.physics.jumpSquatFrames);
}

function lerp(from: number, to: number, frame: number, duration: number): number {
  return addFloat32(from, multiplyFloat32(subtractFloat32(to, from), divideFloat32(frame, duration)));
}

/** Places the fighter at the move's current frame on its platform. */
function place(f: Fighter, stage: number, matchFrame: number): void {
  const p = f.platform;
  const deck = p.deck ?? 0;
  const { motion } = f;
  motion.x = addFloat32(surfaceLeft(stage, deck, matchFrame), lerp(p.fromX, p.toX, p.frame, p.duration));
  motion.z = addFloat32(surfaceZ(stage, deck, matchFrame), lerp(p.fromZ, p.toZ, p.frame, p.duration));
  setWorldMotionValue(motion.meleeX, motion.x);
  setWorldMotionValue(motion.meleeZ, motion.z);
}

function beginMove(f: Fighter, move: PlatformMove, deck: number, stage: number, matchFrame: number, toX: number, toZ: number): void {
  const p = f.platform;
  const { motion } = f;
  const left = surfaceLeft(stage, deck, matchFrame);
  p.move = move;
  p.frame = 0;
  p.duration = platformMoveFrames(f);
  p.deck = deck;
  p.fromX = subtractFloat32(motion.x, left);
  p.fromZ = subtractFloat32(motion.z, surfaceZ(stage, deck, matchFrame));
  p.toX = subtractFloat32(toX, left);
  p.toZ = toZ;
  motion.grounded = false;
  motion.surface = undefined;
  motion.crouching = false;
  motion.fastFalling = false;
  clearDash(f);
}

function bodyHeight(f: Readonly<Fighter>): number {
  return melee(bodyTop(f.character));
}

/** Advances one side's half-circle: a fresh flick away, then down, then toward the side without down. */
function wrapStep(progress: number, side: number, stickSide: number, fresh: boolean, down: boolean): number {
  if (progress === 0) return stickSide === -side && fresh && !down ? 1 : 0;
  if (progress === 1) return down ? 2 : 1;
  if (progress === 2) return stickSide === side && !down ? WRAP_COMPLETE : 2;
  return progress;
}

/**
 * Tracks the half-circle toward each side while airborne; its first step must
 * fall within the fighter's jump squat of now. Standing clears it: a wrap needs
 * airborne contact with a platform.
 */
export function trackWrapMotion(f: Fighter, stickSide: number, freshStickSide: boolean, down: boolean): void {
  const p = f.platform;
  if (f.motion.grounded) {
    p.wrapLeft = 0;
    p.wrapLeftAge = 0;
    p.wrapRight = 0;
    p.wrapRightAge = 0;
    return;
  }
  const window = platformMoveFrames(f);
  if (p.wrapLeft > 0 && ++p.wrapLeftAge > window) p.wrapLeft = 0;
  if (p.wrapRight > 0 && ++p.wrapRightAge > window) p.wrapRight = 0;
  const left = wrapStep(p.wrapLeft, -1, stickSide, freshStickSide, down);
  if (p.wrapLeft === 0 && left > 0) p.wrapLeftAge = 0;
  p.wrapLeft = left;
  const right = wrapStep(p.wrapRight, 1, stickSide, freshStickSide, down);
  if (p.wrapRight === 0 && right > 0) p.wrapRightAge = 0;
  p.wrapRight = right;
}

/** The side a completed half-circle wraps toward on deck, if the platform continues that way from x; 0 for none. */
function wrapSide(f: Readonly<Fighter>, stage: number, matchFrame: number, deck: number): number {
  const p = f.platform;
  const { x } = f.motion;
  if (p.wrapRight === WRAP_COMPLETE && x < surfaceRight(stage, deck, matchFrame)) return 1;
  if (p.wrapLeft === WRAP_COMPLETE && x > surfaceLeft(stage, deck, matchFrame)) return -1;
  return 0;
}

function wrapX(f: Readonly<Fighter>, stage: number, matchFrame: number, deck: number, side: number): number {
  const { x } = f.motion;
  return side > 0
    ? min(surfaceRight(stage, deck, matchFrame), addFloat32(x, PLATFORM_WRAP_REACH))
    : max(surfaceLeft(stage, deck, matchFrame), subtractFloat32(x, PLATFORM_WRAP_REACH));
}

/** The lowest platform the fighter's body straddles: its top at or above the platform, its feet below. */
function ascentDeck(f: Readonly<Fighter>, stage: number, matchFrame: number): number | undefined {
  const { motion } = f;
  const top = addFloat32(motion.z, bodyHeight(f));
  let found: number | undefined;
  let foundZ = 0.0;
  for (let i = 0; i < surfaceCount(stage); i++) {
    if (!surfacePass(stage, i)) continue;
    const deckZ = surfaceZ(stage, i, matchFrame);
    if (!(motion.z < deckZ && top >= deckZ)) continue;
    if (motion.x < surfaceLeft(stage, i, matchFrame) || motion.x > surfaceRight(stage, i, matchFrame)) continue;
    if (found === undefined || deckZ < foundZ) {
      found = i;
      foundZ = deckZ;
    }
  }
  return found;
}

/**
 * Enters an ascent while a rising fighter's body straddles a platform from
 * below. An attack in its startup or active frames carries on through the
 * platform, so it still reaches a fighter standing there; the ascent begins
 * once those frames end, if the body still straddles the platform. The
 * attack's remaining recovery, or a special, ends with it: a lag cancel. A
 * helpless fighter stays helpless.
 */
export function beginPlatformAscent(f: Fighter, stage: number, matchFrame: number): boolean {
  const { motion, launch, dodge } = f;
  if (motion.grounded || launch.hitstun > 0 || launch.hitlag > 0 || totalVelocityZ(f) <= 0) return false;
  const phase = attackPhase(f);
  if (phase === AttackPhase.startup || phase === AttackPhase.active) return false;
  const deck = ascentDeck(f, stage, matchFrame);
  if (deck === undefined) return false;
  const helpless = f.special.fall;
  cancelAttack(f);
  cancelSpecialState(f);
  f.special.fall = helpless;
  clearDownState(f);
  dodge.airMotionFrames = 0;
  if (dodge.airDodging) dodge.airFrame = max(dodge.airFrame, AIR_DODGE_VULNERABLE_FRAME);
  const p = f.platform;
  // The half-circle counts only from the ascent's first frame.
  if (p.wrapLeftAge > 0) p.wrapLeft = 0;
  if (p.wrapRightAge > 0) p.wrapRight = 0;
  const width = subtractFloat32(surfaceRight(stage, deck, matchFrame), surfaceLeft(stage, deck, matchFrame));
  const travel = multiplyFloat32(motion.vx, platformMoveFrames(f));
  const left = surfaceLeft(stage, deck, matchFrame);
  const toX = addFloat32(left, max(0.0, min(width, addFloat32(subtractFloat32(motion.x, left), travel))));
  p.rise = motion.vz;
  p.stand = false;
  p.shield = false;
  beginMove(f, PlatformMove.ascent, deck, stage, matchFrame, toX, 0.0);
  p.fromZ = min(p.fromZ, 0.0);
  place(f, stage, matchFrame);
  return true;
}

/** Enters a descent from the platform the fighter stands on. */
export function beginPlatformDescent(f: Fighter, stage: number, matchFrame: number): void {
  const deck = f.motion.surface ?? 0;
  f.jump.remaining = min(f.jump.remaining, aerialJumps(f));
  f.motion.vx = 0.0;
  f.motion.vz = 0.0;
  beginMove(f, PlatformMove.descent, deck, stage, matchFrame, f.motion.x, -bodyHeight(f));
  f.platform.dodgeQueued = false;
  f.platform.specialQueued = false;
}

/**
 * On the frame a falling fighter would land on a platform, a completed
 * half-circle toward a side the platform continues to wraps it around the
 * edge to underneath instead, still airborne.
 */
export function beginPlatformWrapUnder(f: Fighter, stage: number, matchFrame: number, deck: number): boolean {
  if (!surfacePass(stage, deck) || f.launch.hitstun > 0) return false;
  const side = wrapSide(f, stage, matchFrame, deck);
  if (side === 0) return false;
  const toX = wrapX(f, stage, matchFrame, deck, side);
  cancelAttack(f);
  f.motion.z = surfaceZ(stage, deck, matchFrame);
  f.motion.vx = 0.0;
  f.motion.vz = 0.0;
  beginMove(f, PlatformMove.wrapUnder, deck, stage, matchFrame, toX, -bodyHeight(f));
  return true;
}

function beginWrapOver(f: Fighter, stage: number, matchFrame: number, side: number): void {
  const deck = f.platform.deck ?? 0;
  beginMove(f, PlatformMove.wrapOver, deck, stage, matchFrame, wrapX(f, stage, matchFrame, deck, side), 0.0);
}

function standOn(f: Fighter, stage: number, matchFrame: number, input: Readonly<Controls>, deck: number): void {
  finishLanding(f, stage, matchFrame, input, deck, false);
  f.landing.lag = 0;
  f.motion.vx = 0.0;
  // Down held from the move is not a fresh press: it crouches rather than descends.
  f.motion.fastFallInputAge = PLATFORM_DROP_INPUT_WINDOW;
}

function finishAscent(f: Fighter, stage: number, matchFrame: number, input: Readonly<Controls>): void {
  const p = f.platform;
  const deck = p.deck ?? 0;
  const { stand, rise } = p;
  const shield = p.shield && f.shield.energy > 0;
  clearPlatformMove(f);
  if (shield || stand) {
    standOn(f, stage, matchFrame, input, deck);
    if (shield) {
      f.shield.raised = true;
      f.shield.heldFrames = 1;
    } else {
      f.motion.crouching = input.down && input.direction === 0;
    }
    return;
  }
  f.motion.vz = rise;
  setWorldMotionValue(f.motion.meleeVelocityZ, rise);
}

function finishDescent(f: Fighter): void {
  const { dodgeQueued, dodgeX, dodgeZ, specialQueued, specialX, specialZ } = f.platform;
  clearPlatformMove(f);
  f.motion.vz = 0.0;
  setWorldMotionValue(f.motion.meleeVelocityZ, 0.0);
  // A special pressed during the descent starts in this frame's special phase.
  f.platform.specialQueued = specialQueued;
  f.platform.specialX = specialX;
  f.platform.specialZ = specialZ;
  if (dodgeQueued) beginAirDodge(f, dodgeX, dodgeZ);
}

/** One frame of the move in progress. */
export function advancePlatformMove(f: Fighter, stage: number, matchFrame: number, input: Readonly<Controls>): void {
  const p = f.platform;
  p.frame++;
  const { physics } = f.tuning;
  switch (p.move) {
    case PlatformMove.ascent: {
      if (input.shield || input.shieldPressed) p.shield = true;
      if (input.down) p.stand = true;
      const sustained = input.jumpHeld || stickZ(input) >= TAP_JUMP_STICK_Z;
      if (!sustained) p.rise = max(-physics.terminalSpeed, subtractFloat32(p.rise, physics.gravity));
      place(f, stage, matchFrame);
      const side = wrapSide(f, stage, matchFrame, p.deck ?? 0);
      if (side !== 0) beginWrapOver(f, stage, matchFrame, side);
      else if (p.frame >= p.duration) finishAscent(f, stage, matchFrame, input);
      return;
    }
    case PlatformMove.descent:
      place(f, stage, matchFrame);
      if (input.airDodgePressed) {
        p.dodgeQueued = true;
        p.dodgeX = input.dodgeX;
        p.dodgeZ = input.dodgeZ;
      }
      // A special pressed on the last frame reaches this frame's special phase itself.
      if (p.frame >= p.duration) {
        finishDescent(f);
      } else if (input.specialPressed) {
        p.specialQueued = true;
        p.specialX = input.specialX;
        p.specialZ = input.specialZ;
      }
      return;
    case PlatformMove.wrapOver:
    case PlatformMove.wrapUnder: {
      place(f, stage, matchFrame);
      if (p.frame < p.duration) return;
      const deck = p.deck ?? 0;
      const over = p.move === PlatformMove.wrapOver;
      clearPlatformMove(f);
      f.facing = -f.facing;
      if (over) {
        standOn(f, stage, matchFrame, input, deck);
      } else {
        f.motion.vz = 0.0;
        setWorldMotionValue(f.motion.meleeVelocityZ, 0.0);
      }
      return;
    }
    default:
      return;
  }
}

// Reused frame scratch: a queued special replays its press on the descent's first free frame.
const queuedSpecialInput = neutralControls();

/** The input a fighter's special phase reads: a special queued during a descent presses it now, once. */
export function platformSpecialInput(f: Fighter, input: Readonly<Controls>): Readonly<Controls> {
  const p = f.platform;
  if (!p.specialQueued || p.move !== PlatformMove.none) return input;
  p.specialQueued = false;
  copyControls(queuedSpecialInput, input);
  queuedSpecialInput.specialPressed = true;
  queuedSpecialInput.specialX = p.specialX;
  queuedSpecialInput.specialZ = p.specialZ;
  p.specialX = 0;
  p.specialZ = 0;
  return queuedSpecialInput;
}
