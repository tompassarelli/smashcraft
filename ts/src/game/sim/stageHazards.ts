// Stage hazards on fixed timetables of the match frame, so a player can learn
// them: Dream Land's wind and Kongo Jungle's barrel cannon. Nothing here is
// random or reacts to the fighters' positions when it chooses what to do.
// smashcraft:docs/stage-hazards.md cites the Melee code and data each follows.
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
import { CANNON_TEST_STAGE, WIND_TEST_STAGE, mainDeckLeft, mainDeckRight, mainDeckZ } from "./stage";
import { cancelAttack, cancelSpecialState, clearDownState, clearGrabLinks, interruptJumpOrDodge } from "./transitions";
import { melee } from "./tuning";

// ---------------------------------------------------------------- wind

/** What the wind is doing on a frame. */
export const WindPhase = { calm: 0, cue: 1, blowing: 2 } as const;
export type WindPhase = (typeof WindPhase)[keyof typeof WindPhase];

/** GrOp.dat yakumono_param +0x08: Whispy's shortest wait between gusts. */
export const WIND_CALM_FRAMES = 600;
/** Whispy's blow animation runs this long before the wind starts, its sound on the last of them (groldpupupu.c grOldPupupu_802113E0). */
export const WIND_CUE_FRAMES = 45;
/** The wind blows from the blow's frame 46 through 319 (0x2D < xD0 < 0x140). */
export const WIND_BLOW_FRAMES = 274;
export const WIND_CYCLE_FRAMES = WIND_CALM_FRAMES + WIND_CUE_FRAMES + WIND_BLOW_FRAMES;
/** GrOp.dat +0x10: Melee units a gust moves a fighter each frame. */
export const WIND_SPEED = melee(0.20000000298023224);
/**
 * GrOp.dat +0x14..+0x28, with Dream Land's ledges at ±77.2713: a gust's box,
 * its inner edge measured from the stage center and its outer edge from the
 * ledge it blows toward, its height from the floor.
 */
const WIND_INNER_EDGE_RIGHT = melee(17.0);
const WIND_INNER_EDGE_LEFT = melee(18.0);
const WIND_OUTER_INSET_RIGHT = melee(1.2713000774383545);
const WIND_OUTER_INSET_LEFT = melee(3.2713000774383545);
const WIND_BOTTOM = melee(-10.0);
const WIND_TOP = melee(40.0);

const windCycle = (frame: number) => floorMod(frame - 1, WIND_CYCLE_FRAMES);

/** What the wind does on match frame `frame` (the first is 1). */
export function windPhase(frame: number): WindPhase {
  const cycle = windCycle(frame);
  if (cycle < WIND_CALM_FRAMES) return WindPhase.calm;
  return cycle < WIND_CALM_FRAMES + WIND_CUE_FRAMES ? WindPhase.cue : WindPhase.blowing;
}

/** The way the frame's gust blows, or the next one will: gusts alternate, the first to the right. */
export function windDirection(frame: number): -1 | 1 {
  return floorMod(floorDiv(frame - 1, WIND_CYCLE_FRAMES), 2) === 0 ? 1 : -1;
}

/** Frames until the next gust's wind starts, or zero while it blows. */
export function framesUntilWind(frame: number): number {
  const cycle = windCycle(frame);
  return cycle >= WIND_CALM_FRAMES + WIND_CUE_FRAMES ? 0 : WIND_CALM_FRAMES + WIND_CUE_FRAMES - cycle;
}

const stageCenter = (stage: number) => f32(f32(mainDeckLeft(stage) + mainDeckRight(stage)) / 2);

/** The lower x bound of a gust blowing `direction`; positions strictly inside the box are pushed. */
export function windLeft(stage: number, direction: -1 | 1): number {
  return direction > 0 ? f32(stageCenter(stage) - WIND_INNER_EDGE_RIGHT) : f32(mainDeckLeft(stage) + WIND_OUTER_INSET_LEFT);
}

export function windRight(stage: number, direction: -1 | 1): number {
  return direction > 0 ? f32(mainDeckRight(stage) - WIND_OUTER_INSET_RIGHT) : f32(stageCenter(stage) + WIND_INNER_EDGE_LEFT);
}

export const windBottom = (stage: number): number => f32(mainDeckZ(stage) + WIND_BOTTOM);
export const windTop = (stage: number): number => f32(mainDeckZ(stage) + WIND_TOP);

export const hasWind = (stage: number): boolean => stage === WIND_TEST_STAGE;

/** The world distance the wind moves a fighter at (x, z) along x on match frame `frame`. */
export function windPush(stage: number, frame: number, x: number, z: number): number {
  if (!hasWind(stage) || windPhase(frame) !== WindPhase.blowing) return 0.0;
  const direction = windDirection(frame);
  if (!(x > windLeft(stage, direction) && x < windRight(stage, direction) && z > windBottom(stage) && z < windTop(stage))) return 0.0;
  return direction > 0 ? WIND_SPEED : -WIND_SPEED;
}

// ---------------------------------------------------------------- cannon

/** The cannon swings beneath the main deck between these x, at a constant speed. */
export const CANNON_SWING_HALF_WIDTH = 760.0;
const CANNON_SWING_SPEED = 5.0;
/** Frames from one end of the swing to the other. */
export const CANNON_SWING_FRAMES = 304;
/** Its height: 30 above the bottom blast zone, its catch reaching up past the deck's underside. */
export const CANNON_Z = -390.0;
/** At each end the cannon leans this far (15 degrees) from upright, toward the stage. */
const CANNON_LEAN = 0.2617993950843811;
/** GrOk.dat rframe_barrel_in: a fighter whose position comes this close to the cannon's center is caught. */
export const CANNON_CATCH_RADIUS = melee(15.0);
/** GrOk.dat rframe_barrel_shoot_a 479, truncated to a whole frame and counted down through zero: the cannon fires by itself after this long. */
export const CANNON_HOLD_FRAMES = 480;
/** The shot leaves this many frames after it begins, its animation the warning (groldkongo.c stageGObj1_GObjProc, hit_timer > 0xA). */
export const CANNON_SHOT_FRAMES = 11;
/** GrOk.dat rradd_barrel_attack: base knockback, with no damage, growth or fixed knockback. */
export const CANNON_BASE_KNOCKBACK = 180.0;
/** PlCo.dat common +0x5E0 bury_timer_unk2: frames after a shot before a cannon catches the fighter again. */
export const CANNON_RECATCH_FRAMES = 16;

/** The cannon's center x on match frame `frame`: from the left end, right and back. */
export function cannonX(frame: number): number {
  const step = floorMod(frame - 1, 2 * CANNON_SWING_FRAMES);
  const travelled = step < CANNON_SWING_FRAMES ? step : 2 * CANNON_SWING_FRAMES - step;
  return f32(-CANNON_SWING_HALF_WIDTH + f32(travelled * CANNON_SWING_SPEED));
}

/** The cannon's aim, in radians from upright, positive toward +x: it leans toward the stage center in proportion to its distance from it. */
export function cannonAim(frame: number): number {
  return f32(f32(-cannonX(frame) / CANNON_SWING_HALF_WIDTH) * CANNON_LEAN);
}

export const hasCannon = (stage: number): boolean => stage === CANNON_TEST_STAGE;

export const inStageCannon = (f: Readonly<Fighter>): boolean => f.cannon.held !== undefined;

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
  launch.diPending = false;
  launch.diLaunchSpeed = 0.0;
  f.shield.raised = false;
  f.cannon.held = 0;
  f.cannon.firing = undefined;
  holdAtCannon(f, frame);
}

/** Melee's barrel shot (ftCo_8009EC70): a launch along the aim from the cannon's center, then catch immunity. */
function fire(f: Fighter, frame: number): void {
  holdAtCannon(f, frame);
  f.cannon.held = undefined;
  f.cannon.firing = undefined;
  f.cannon.cooldown = CANNON_RECATCH_FRAMES;
  const aim = cannonAim(frame);
  const knockback = contactKnockback(f.status.damage, 0.0, f.tuning.physics.weight, 0.0, CANNON_BASE_KNOCKBACK, 1.0);
  const { launch } = f;
  launch.hitstun = ordinaryHitstunFrames(knockback);
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

/**
 * The cannon's frame, after the fighters have moved: a held fighter follows
 * it, a press of Attack or Special (Melee's A or B) or the end of the hold
 * begins the shot, which leaves CANNON_SHOT_FRAMES later; then an empty
 * cannon catches the first fighter in slot order within its reach.
 */
export function advanceStageCannon(world: Roster, stage: number, frame: number, inputs: readonly Readonly<Controls>[]): void {
  if (!hasCannon(stage)) return;
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
