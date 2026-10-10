import { max, min } from "../../runtime/numbers";
import { addFloat32, divideFloat32, multiplyFloat32, subtractFloat32 } from "wisp/src/sim/binary32";
import { AttackPhase, DownState, PlatformMove, SpecialAction } from "./codes";
import { attackPhase } from "./conditions";
import { finishLanding } from "./down";
import { type Fighter, PLATFORM_DROP_INPUT_WINDOW, PLATFORM_INTENT_FRAMES } from "./fighter";
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
import { CROUCH_STICK_THRESHOLD, STICK_DEADZONE, TAP_JUMP_STICK_THRESHOLD } from "./stickZones";

const AIR_DODGE_VULNERABLE_FRAME = 30;


function platformMoveFrames(f: Readonly<Fighter>): number {
  return max(1, f.tuning.physics.jumpSquatFrames);
}

function lerp(from: number, to: number, frame: number, duration: number): number {
  return addFloat32(from, multiplyFloat32(subtractFloat32(to, from), divideFloat32(frame, duration)));
}


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


export const PlatformIntent = { none: 0, stand: 1, drop: 2 } as const;
export type PlatformIntent = (typeof PlatformIntent)[keyof typeof PlatformIntent];

/** Rising: down past the deadzone stands. */
export function risingIntent(z: number): PlatformIntent {
  return z > -STICK_DEADZONE ? PlatformIntent.none : PlatformIntent.stand;
}

/** Falling: down past the crouch threshold drops; the tilt modifier keeps a digital down for landing. */
export function fallingIntent(z: number, walking: boolean): PlatformIntent {
  return !walking && z < -CROUCH_STICK_THRESHOLD ? PlatformIntent.drop : PlatformIntent.none;
}

export function trackPlatformInput(f: Fighter): void {
  const p = f.platform;
  p.landedFrames = min(PLATFORM_INTENT_FRAMES + 1, p.landedFrames + 1);
}



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









export function beginPlatformAscent(f: Fighter, stage: number, matchFrame: number, input: Readonly<Controls>): boolean {
  const { motion, launch, dodge } = f;
  if (motion.grounded || launch.hitstun > 0 || launch.hitlag > 0 || totalVelocityZ(f) <= 0) return false;
  const deck = ascentDeck(f, stage, matchFrame);
  if (deck === undefined) return false;
  const helpless = f.special.fall;
  const phase = attackPhase(f);
  if (phase !== AttackPhase.startup && phase !== AttackPhase.active) cancelAttack(f);
  cancelSpecialState(f);
  f.special.fall = helpless;
  clearDownState(f);
  dodge.airMotionFrames = 0;
  if (dodge.airDodging) dodge.airFrame = max(dodge.airFrame, AIR_DODGE_VULNERABLE_FRAME);
  const p = f.platform;
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
  readRisingIntent(f, input);
  return true;
}

function readRisingIntent(f: Fighter, input: Readonly<Controls>): void {
  const p = f.platform;
  if (p.frame <= PLATFORM_INTENT_FRAMES && risingIntent(stickZ(input)) === PlatformIntent.stand) p.stand = true;
}

export function beginPlatformDescent(f: Fighter, stage: number, matchFrame: number, deck: number): void {
  f.jump.remaining = min(f.jump.remaining, aerialJumps(f));
  f.motion.vx = 0.0;
  f.motion.vz = 0.0;
  beginMove(f, PlatformMove.descent, deck, stage, matchFrame, f.motion.x, -bodyHeight(f));
  f.platform.dodgeQueued = false;
  f.platform.specialQueued = false;
}

function intentOpen(f: Readonly<Fighter>, stage: number, deck: number): boolean {
  return surfacePass(stage, deck) && f.launch.hitstun <= 0 && f.launch.hitlag <= 0 && f.down.state === DownState.none && !f.dodge.airDodging;
}

/** On the frame a falling fighter would land on a platform, full down drops through it, ending the aerial with no landing lag. */
export function beginPlatformContact(f: Fighter, stage: number, matchFrame: number, input: Readonly<Controls>, deck: number): boolean {
  if (!intentOpen(f, stage, deck) || fallingIntent(stickZ(input), input.walking) !== PlatformIntent.drop) return false;
  cancelAttack(f);
  f.landing.lag = 0;
  f.motion.z = surfaceZ(stage, deck, matchFrame);
  beginPlatformDescent(f, stage, matchFrame, deck);
  return true;
}

export function markPlatformLanding(f: Fighter, stage: number, deck: number, airDodged: boolean): void {
  if (surfacePass(stage, deck) && !airDodged) f.platform.landedFrames = 0;
}

/** A few frames after landing on a platform, full down still drops through it, ending the landing lag. */
export function dropAfterPlatformLanding(f: Fighter, stage: number, matchFrame: number, input: Readonly<Controls>): boolean {
  const { motion } = f;
  const deck = motion.surface;
  if (f.platform.landedFrames > PLATFORM_INTENT_FRAMES || !motion.grounded || deck === undefined || !intentOpen(f, stage, deck)) return false;
  if (f.attack.style !== undefined || f.special.action !== SpecialAction.none || f.jump.squat > 0 || f.shield.raised) return false;
  if (fallingIntent(stickZ(input), input.walking) !== PlatformIntent.drop) return false;
  f.landing.lag = 0;
  f.platform.landedFrames = PLATFORM_INTENT_FRAMES + 1;
  beginPlatformDescent(f, stage, matchFrame, deck);
  return true;
}

function standOn(f: Fighter, stage: number, matchFrame: number, input: Readonly<Controls>, deck: number): void {
  finishLanding(f, stage, matchFrame, input, deck, false);
  f.landing.lag = 0;
  f.motion.vx = 0.0;

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

  f.platform.specialQueued = specialQueued;
  f.platform.specialX = specialX;
  f.platform.specialZ = specialZ;
  if (dodgeQueued) beginAirDodge(f, dodgeX, dodgeZ, false);
}


export function advancePlatformMove(f: Fighter, stage: number, matchFrame: number, input: Readonly<Controls>): void {
  const p = f.platform;
  p.frame++;
  if (p.frame === 1) cancelAttack(f);
  const { physics } = f.tuning;
  switch (p.move) {
    case PlatformMove.ascent: {
      if (input.shield || input.shieldPressed) p.shield = true;
      const sustained = input.jumpHeld || stickZ(input) >= TAP_JUMP_STICK_THRESHOLD;
      if (!sustained) p.rise = max(-physics.terminalSpeed, subtractFloat32(p.rise, physics.gravity));
      place(f, stage, matchFrame);
      readRisingIntent(f, input);
      if (p.frame >= p.duration) finishAscent(f, stage, matchFrame, input);
      return;
    }
    case PlatformMove.descent:
      place(f, stage, matchFrame);
      if (input.airDodgePressed) {
        p.dodgeQueued = true;
        p.dodgeX = input.dodgeX;
        p.dodgeZ = input.dodgeZ;
      }

      if (p.frame >= p.duration) {
        finishDescent(f);
      } else if (input.specialPressed) {
        p.specialQueued = true;
        p.specialX = input.specialX;
        p.specialZ = input.specialZ;
      }
      return;
    default:
      return;
  }
}


const queuedSpecialInput = neutralControls();


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
