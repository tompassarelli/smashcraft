




import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { meleeCos, meleeSin } from "../../sim/meleeScalarMath";
import { DownState, LedgeState } from "./codes";
import { inGrabContext } from "./conditions";
import type { Fighter } from "./fighter";
import { contactKnockback, installDamageLaunch, ordinaryHitstunFrames } from "./knockback";
import { setWorldMotionValue } from "./motion";
import { type Controls, type Roster, fighterAt, isActive } from "./roster";
import { CANNON_TEST_STAGE, TOMB_OF_SARGERAS_STAGE, WIND_TEST_STAGE, mainDeckLeft, mainDeckRight, mainDeckZ, stageAtRest } from "./stage";
import { stageBounds } from "./stageBounds";
import { cancelAttack, cancelSpecialState, clearDownState, clearGrabLinks, interruptJumpOrDodge } from "./transitions";
import { melee } from "./tuning";
import { knockbackWeight } from "./itemBuffs";




export const WindPhase = { calm: 0, cue: 1, blowing: 2 } as const;
export type WindPhase = (typeof WindPhase)[keyof typeof WindPhase];

/** GrOp.dat yakumono_param +0x08: Whispy's shortest wait between gusts. */
export const WIND_CALM_FRAMES = 600;
/** Whispy's blow animation runs this long before the wind starts, its sound on the last of them (groldpupupu.c grOldPupupu_802113E0). */
export const WIND_CUE_FRAMES = 45;

export const WIND_BLOW_FRAMES = 274;
export const WIND_CYCLE_FRAMES = WIND_CALM_FRAMES + WIND_CUE_FRAMES + WIND_BLOW_FRAMES;
/** GrOp.dat +0x10: Melee units a gust moves a fighter each frame. */
export const WIND_SPEED = melee(0.20000000298023224);
// Whispy gust bounds use GrOp.dat +0x14..+0x28 and Dream Land ledges at ±77.2713.




const WIND_INNER_EDGE_RIGHT = melee(17.0);
const WIND_INNER_EDGE_LEFT = melee(18.0);
const WIND_OUTER_INSET_RIGHT = melee(1.2713000774383545);
const WIND_OUTER_INSET_LEFT = melee(3.2713000774383545);
const WIND_BOTTOM = melee(-10.0);
const WIND_TOP = melee(40.0);

const windCycle = (frame: number) => floorMod(frame - 1, WIND_CYCLE_FRAMES);


export function windPhase(frame: number): WindPhase {
  const cycle = windCycle(frame);
  if (cycle < WIND_CALM_FRAMES) return WindPhase.calm;
  return cycle < WIND_CALM_FRAMES + WIND_CUE_FRAMES ? WindPhase.cue : WindPhase.blowing;
}


export function windDirection(frame: number): -1 | 1 {
  return floorMod(floorDiv(frame - 1, WIND_CYCLE_FRAMES), 2) === 0 ? 1 : -1;
}


export function framesUntilWind(frame: number): number {
  const cycle = windCycle(frame);
  return cycle >= WIND_CALM_FRAMES + WIND_CUE_FRAMES ? 0 : WIND_CALM_FRAMES + WIND_CUE_FRAMES - cycle;
}

const stageCenter = (stage: number) => f32(f32(mainDeckLeft(stage) + mainDeckRight(stage)) / 2);


export function windLeft(stage: number, direction: -1 | 1): number {
  return direction > 0 ? f32(stageCenter(stage) - WIND_INNER_EDGE_RIGHT) : f32(mainDeckLeft(stage) + WIND_OUTER_INSET_LEFT);
}

export function windRight(stage: number, direction: -1 | 1): number {
  return direction > 0 ? f32(mainDeckRight(stage) - WIND_OUTER_INSET_RIGHT) : f32(stageCenter(stage) + WIND_INNER_EDGE_LEFT);
}

const windBottom = (stage: number): number => f32(mainDeckZ(stage) + WIND_BOTTOM);
const windTop = (stage: number): number => f32(mainDeckZ(stage) + WIND_TOP);

export const hasWind = (stage: number): boolean => stage === WIND_TEST_STAGE;


export const windOn = (stage: number, frame: number): boolean => hasWind(stage) && !stageAtRest(frame);


export function windPush(stage: number, frame: number, x: number, z: number): number {
  if (!windOn(stage, frame) || windPhase(frame) !== WindPhase.blowing) return 0.0;
  const direction = windDirection(frame);
  if (!(x > windLeft(stage, direction) && x < windRight(stage, direction) && z > windBottom(stage) && z < windTop(stage))) return 0.0;
  return direction > 0 ? WIND_SPEED : -WIND_SPEED;
}




const TidePhase = { flood: 0, slackToEbb: 1, ebb: 2, slackToFlood: 3 } as const;
type TidePhase = (typeof TidePhase)[keyof typeof TidePhase];


const TIDE_FLOW_FRAMES = 540;
const TIDE_SLACK_FRAMES = 60;

const TIDE_CYCLE_FRAMES = 2 * (TIDE_FLOW_FRAMES + TIDE_SLACK_FRAMES);

export const TIDE_SPEED = melee(0.800000011920929);

export const SEA_SURFACE_Z = -360.0;

export const hasTide = (stage: number): boolean => stage === TOMB_OF_SARGERAS_STAGE;

const tideCycle = (frame: number) => floorMod(frame - 1, TIDE_CYCLE_FRAMES);


function tidePhase(frame: number): TidePhase {
  const cycle = tideCycle(frame);
  if (cycle < TIDE_FLOW_FRAMES) return TidePhase.flood;
  if (cycle < TIDE_FLOW_FRAMES + TIDE_SLACK_FRAMES) return TidePhase.slackToEbb;
  return cycle < TIDE_CYCLE_FRAMES - TIDE_SLACK_FRAMES ? TidePhase.ebb : TidePhase.slackToFlood;
}


export function tideDirection(frame: number): -1 | 0 | 1 {
  const phase = tidePhase(frame);
  return phase === TidePhase.flood ? 1 : phase === TidePhase.ebb ? -1 : 0;
}


export function tideNextDirection(frame: number): -1 | 1 {
  const phase = tidePhase(frame);
  return phase === TidePhase.flood || phase === TidePhase.slackToFlood ? 1 : -1;
}


export function framesUntilTideTurns(frame: number): number {
  const phase = tidePhase(frame);
  if (phase === TidePhase.flood || phase === TidePhase.ebb) return 0;
  const cycle = tideCycle(frame);
  return (phase === TidePhase.slackToEbb ? TIDE_FLOW_FRAMES + TIDE_SLACK_FRAMES : TIDE_CYCLE_FRAMES) - cycle;
}


const seaLeft = (stage: number): number => stageBounds(stage).blast.left;
const seaRight = (stage: number): number => stageBounds(stage).blast.right;


export function inSea(stage: number, x: number, z: number): boolean {
  return hasTide(stage) && z <= SEA_SURFACE_Z && x >= seaLeft(stage) && x <= seaRight(stage);
}


export function tidePush(stage: number, frame: number, x: number, z: number): number {
  if (!inSea(stage, x, z)) return 0.0;
  const direction = tideDirection(frame);
  return direction === 0 ? 0.0 : direction > 0 ? TIDE_SPEED : -TIDE_SPEED;
}




const CANNON_SWING_HALF_WIDTH = 760.0;
const CANNON_SWING_SPEED = 5.0;

const CANNON_SWING_FRAMES = 304;

export const CANNON_Z = -390.0;

const CANNON_LEAN = 0.2617993950843811;
/** GrOk.dat rframe_barrel_in: a fighter whose position comes this close to the cannon's center is caught. */
const CANNON_CATCH_RADIUS = melee(15.0);
/** GrOk.dat rframe_barrel_shoot_a 479, truncated to a whole frame and counted down through zero: the cannon fires by itself after this long. */
export const CANNON_HOLD_FRAMES = 480;
/** The shot leaves this many frames after it begins, its animation the warning (groldkongo.c stageGObj1_GObjProc, hit_timer > 0xA). */
export const CANNON_SHOT_FRAMES = 11;
/** GrOk.dat rradd_barrel_attack: base knockback, with no damage, growth or fixed knockback. */
export const CANNON_BASE_KNOCKBACK = 180.0;
/** PlCo.dat common +0x5E0 bury_timer_unk2: frames after a shot before a cannon catches the fighter again. */
export const CANNON_RECATCH_FRAMES = 16;


export function cannonX(frame: number): number {
  const step = floorMod(frame - 1, 2 * CANNON_SWING_FRAMES);
  const travelled = step < CANNON_SWING_FRAMES ? step : 2 * CANNON_SWING_FRAMES - step;
  return f32(-CANNON_SWING_HALF_WIDTH + f32(travelled * CANNON_SWING_SPEED));
}


export function cannonAim(frame: number): number {
  return f32(f32(-cannonX(frame) / CANNON_SWING_HALF_WIDTH) * CANNON_LEAN);
}

export const hasCannon = (stage: number): boolean => stage === CANNON_TEST_STAGE;


export const cannonOn = (stage: number, frame: number): boolean => hasCannon(stage) && !stageAtRest(frame);

export const inStageCannon = (f: Readonly<Fighter>): boolean => f.cannon.held !== undefined;


export function endCannonPass(f: Fighter, stage: number): void {
  if (f.cannon.passing && (f.motion.grounded || f.motion.z > mainDeckZ(stage))) f.cannon.passing = false;
}

function holdAtCannon(f: Fighter, frame: number): void {
  const { motion, launch } = f;
  motion.x = cannonX(frame);
  motion.z = CANNON_Z;
  setWorldMotionValue(motion.meleeX, motion.x);
  setWorldMotionValue(motion.meleeZ, motion.z);
  motion.vx = 0.0;
  motion.vz = 0.0;
  setWorldMotionValue(motion.meleeVelocityZ, 0.0);
  launch.knockbackX = 0.0;
  launch.knockbackZ = 0.0;
  launch.groundKnockbackX = 0.0;
  f.shield.pushbackX = 0.0;
  f.shield.recoilX = 0.0;
  f.shield.recoilZ = 0.0;
}

function catchFighter(world: Roster, slot: number, frame: number): void {
  const f = fighterAt(world, slot);
  clearGrabLinks(world, slot);
  interruptJumpOrDodge(f);
  clearDownState(f);
  cancelAttack(f);
  cancelSpecialState(f);
  const { motion, launch } = f;
  motion.grounded = false;
  motion.surface = undefined;
  motion.fastFalling = false;
  motion.crouching = false;
  launch.hitstun = 0;
  launch.throwHitstun = false;
  launch.diPending = false;
  launch.diLaunchSpeed = 0.0;
  f.shield.raised = false;
  f.cannon.held = 0;
  f.cannon.firing = undefined;
  f.cannon.passing = false;
  holdAtCannon(f, frame);
}


function fire(f: Fighter, frame: number): void {
  holdAtCannon(f, frame);
  f.cannon.held = undefined;
  f.cannon.firing = undefined;
  f.cannon.cooldown = CANNON_RECATCH_FRAMES;

  f.cannon.passing = true;
  const aim = cannonAim(frame);
  const knockback = contactKnockback(f.status.damage, 0.0, knockbackWeight(f), 0.0, CANNON_BASE_KNOCKBACK, 1.0);
  const { launch } = f;
  launch.hitstun = ordinaryHitstunFrames(knockback);
  launch.throwHitstun = false;
  installDamageLaunch(f, knockback, meleeSin(aim), meleeCos(aim), false);
  if (launch.damageLevel === 3) {
    f.down.state = DownState.tumble;
    f.down.frame = 0;
    f.down.direction = 0;
    f.down.faceUp = launch.knockbackZ >= 0;
  }
}

function canBeCaught(f: Readonly<Fighter>, frame: number): boolean {
  if (f.status.out || f.cannon.cooldown > 0 || inGrabContext(f) || f.ledge.state !== LedgeState.none) return false;
  const dx = f32(f.motion.x - cannonX(frame));
  const dz = f32(f.motion.z - CANNON_Z);
  return f32(f32(dx * dx) + f32(dz * dz)) < f32(CANNON_CATCH_RADIUS * CANNON_CATCH_RADIUS);
}







export function advanceStageCannon(world: Roster, stage: number, frame: number, inputs: readonly Readonly<Controls>[]): void {
  if (!cannonOn(stage, frame)) return;
  let occupied = false;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const f = fighterAt(world, slot);
    const { cannon } = f;
    if (cannon.held === undefined) {
      if (cannon.cooldown > 0 && f.launch.hitlag <= 0) cannon.cooldown--;
      continue;
    }
    occupied = true;
    cannon.held++;
    const input = inputs[slot];
    if (cannon.firing === undefined && (cannon.held >= CANNON_HOLD_FRAMES || input?.attackPressed === true || input?.specialPressed === true)) cannon.firing = 0;
    if (cannon.firing !== undefined) cannon.firing++;
    if (cannon.firing !== undefined && cannon.firing >= CANNON_SHOT_FRAMES) fire(f, frame);
    else holdAtCannon(f, frame);
  }
  if (occupied) return;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot) || !canBeCaught(fighterAt(world, slot), frame)) continue;
    catchFighter(world, slot, frame);
    return;
  }
}
