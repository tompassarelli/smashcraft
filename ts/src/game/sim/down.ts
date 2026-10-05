// Landing, knockdowns, floor techs and getting up.
import { max, min } from "../../runtime/numbers";
import { roundToFloat32 } from "wisp/src/sim/binary32";
import { f32 } from "wisp/src/sim/f32";
import { idiv } from "wisp/src/sim/intMath";
import { Character, DamageLanding, DownState } from "./codes";
import { isFloorTeching, isTumbling } from "./conditions";
import { type Fighter } from "./fighter";
import { clearDash } from "./groundMovement";
import { MAX_GROUNDED_KNOCKBACK_ON_LANDING, airborneDamageLandingReaction, decayKnockback } from "./knockback";
import { attackLandingLag, isAerialAttack } from "./moves";
import { clearMotionValue, setWorldMotionValue, totalVelocityX } from "./motion";
import type { Controls } from "./roster";
import { surfaceCount, surfaceLeft, surfaceRight, surfaceZ } from "./stage";
import { rollTravel } from "../physics/rollTravel";
import { beginDownState, cancelAttack, clearDownState } from "./transitions";
import { WORLD_UNITS_PER_MELEE_UNIT } from "./tuning";
import { squareRoot } from "./warcraftMath";

export const AIR_DODGE_LANDING_LAG = 10;
const EMPTY_LANDING_LAG = 4;
export const GROUND_ROLL_SPEED = 8.0;
export const GROUND_ROLL_MOVE_START = 4;
export const GROUND_ROLL_MOVE_END = 19;
export const TECH_IN_PLACE_FRAMES = 26;
export const TECH_ROLL_FRAMES = 40;
export const DOWN_BOUND_FRAMES = 26;
export const DOWN_WAIT_FRAMES = 220;
export const DOWN_STAND_FRAMES = 30;
export const DOWN_ROLL_FRAMES = 35;
export const DOWN_DAMAGE_FRAMES = 13;
/** Weaker hits on a lying fighter jab-reset instead of launching. */
export const DOWN_DAMAGE_RESET_THRESHOLD = 7.0;

/** Moves a getup or tech roll along its recorded travel, kept on its deck. */
function applyDownRollTravel(f: Fighter, stage: number): void {
  const { down, motion } = f;
  if (down.state !== DownState.roll && down.state !== DownState.techRoll) return;
  let distance = 0.0;
  if (f.character === Character.demonHunter) {
    if (down.frame >= GROUND_ROLL_MOVE_START && down.frame <= GROUND_ROLL_MOVE_END) distance = GROUND_ROLL_SPEED;
  } else {
    const kind = down.state === DownState.techRoll ? "tech" : down.faceUp ? "faceUpGetup" : "faceDownGetup";
    distance = rollTravel(f.character, kind, down.direction === f.facing ? "forward" : "back", down.frame);
  }
  const deck = motion.surface ?? 0;
  motion.x = max(surfaceLeft(stage, deck), min(surfaceRight(stage, deck), f32(motion.x + f32(down.direction * distance))));
}

/** Airborne hitstun landings below the retail speed thresholds keep or end the stun instead of knocking down. */
function damageLandingReaction(f: Fighter): DamageLanding {
  const launchX = roundToFloat32(f32(f.launch.knockbackX / WORLD_UNITS_PER_MELEE_UNIT));
  const launchZ = roundToFloat32(f32(f.launch.knockbackZ / WORLD_UNITS_PER_MELEE_UNIT));
  const squaredSpeed = roundToFloat32(f32(roundToFloat32(f32(launchX * launchX)) + roundToFloat32(f32(launchZ * launchZ))));
  return airborneDamageLandingReaction(roundToFloat32(squareRoot(squaredSpeed)));
}

/** Lands on a deck: landing lag, L-cancels, floor techs and knockdowns. ASDI landings end hitstun without lag. */
export function finishLanding(f: Fighter, stage: number, input: Readonly<Controls>, landing: number, fromAsdi: boolean): void {
  const { motion, launch, landing: landingState, dodge } = f;
  motion.fastFalling = false;
  const wasGrounded = motion.grounded;
  const damageLanding = !wasGrounded && !fromAsdi && launch.hitstun > 0 && !isTumbling(f) ? damageLandingReaction(f) : undefined;
  if (!motion.grounded) clearDash(f);
  if (!motion.grounded && !dodge.airDodging && !isAerialAttack(f.attack.style) && f.down.state === DownState.none && launch.hitstun <= 0 && !fromAsdi) {
    landingState.lag = max(landingState.lag, EMPTY_LANDING_LAG);
  }
  if (dodge.airDodging) {
    landingState.lag = AIR_DODGE_LANDING_LAG;
    dodge.airDodging = false;
    dodge.airFrame = 0;
  }
  if (isAerialAttack(f.attack.style)) {
    let recovery = attackLandingLag(f.attack.style);
    if (landingState.lCancelWindow > 0) {
      recovery = idiv(recovery, 2);
      landingState.lCancelSerial++;
    }
    landingState.lag = max(landingState.lag, recovery);
    cancelAttack(f);
  }
  landingState.lCancelWindow = 0;
  motion.grounded = true;
  motion.surface = landing;
  motion.z = surfaceZ(stage, landing);
  motion.vz = 0.0;
  setWorldMotionValue(motion.meleeZ, motion.z);
  clearMotionValue(motion.meleeVelocityZ);
  launch.knockbackZ = 0.0;
  if (!wasGrounded && launch.groundKnockbackX === 0) {
    launch.groundKnockbackX = max(-MAX_GROUNDED_KNOCKBACK_ON_LANDING, min(MAX_GROUNDED_KNOCKBACK_ON_LANDING, launch.knockbackX));
    launch.knockbackX = launch.groundKnockbackX;
  }
  f.special.fall = false;
  motion.lastAerialTapDirection = 0;
  if (f.jump.squat <= 0) f.jump.remaining = 2;
  if (isTumbling(f)) {
    const launchDirection = totalVelocityX(f) < 0 ? -1 : 1;
    launch.hitstun = 0;
    if (f.tech.window > 0) {
      const techDirection = input.direction === 0 ? 0 : input.direction < 0 ? -1 : 1;
      f.tech.window = 0;
      beginDownState(f, techDirection === 0 ? DownState.tech : DownState.techRoll, techDirection);
      applyDownRollTravel(f, stage);
    } else {
      beginDownState(f, DownState.bound, launchDirection);
    }
  } else if (damageLanding === DamageLanding.knockdown) {
    launch.hitstun = 0;
    beginDownState(f, DownState.bound, totalVelocityX(f) < 0 ? -1 : 1);
  } else if (damageLanding === DamageLanding.normal) {
    launch.hitstun = 0;
    landingState.lag = max(landingState.lag, EMPTY_LANDING_LAG);
  } else if (fromAsdi) {
    launch.hitstun = 0;
  }
}

function startDownWait(f: Fighter, remainingFrames: number): void {
  const { down } = f;
  down.state = DownState.wait;
  down.frame = 0;
  down.direction = 0;
  down.waitRemaining = max(0, remainingFrames);
}

function startDownStand(f: Fighter): void {
  beginDownState(f, DownState.stand, 0);
}

/** Keeps a downed fighter on its deck; running off the edge ends the down state airborne. */
export function resolveDownGroundContact(f: Fighter, stage: number): void {
  const { motion, down } = f;
  let deck = motion.surface;
  if (deck === undefined || deck >= surfaceCount(stage)) {
    for (let i = 0; i < surfaceCount(stage); i++) {
      if (motion.z === surfaceZ(stage, i) && motion.x >= surfaceLeft(stage, i) && motion.x <= surfaceRight(stage, i)) deck = i;
    }
  }
  if (deck !== undefined && deck < surfaceCount(stage)) {
    if (down.state === DownState.roll || down.state === DownState.techRoll || down.state === DownState.attack) {
      motion.x = max(surfaceLeft(stage, deck), min(surfaceRight(stage, deck), motion.x));
    }
    if (motion.x >= surfaceLeft(stage, deck) && motion.x <= surfaceRight(stage, deck)) {
      motion.surface = deck;
      motion.z = surfaceZ(stage, deck);
      return;
    }
  }
  if (down.state === DownState.attack) cancelAttack(f);
  clearDownState(f);
  motion.grounded = false;
  motion.surface = undefined;
  f.jump.remaining = min(f.jump.remaining, 1);
  const { airSpeed } = f.tuning.physics;
  motion.vx = max(-airSpeed, min(airSpeed, motion.vx));
  f.launch.groundKnockbackX = 0.0;
  clearDash(f);
}

function standOnDeck(f: Fighter, stage: number): void {
  f.motion.grounded = true;
  f.motion.z = surfaceZ(stage, f.motion.surface ?? 0);
}

/** One frame of a down state; true when it consumed the fighter's movement for the frame. */
export function advanceDownState(f: Fighter, stage: number, input: Readonly<Controls>): boolean {
  const { down, motion, launch } = f;
  const leavingBound = down.state === DownState.bound && down.frame >= DOWN_BOUND_FRAMES;
  const leavingDamage = down.state === DownState.damage && down.frame >= DOWN_DAMAGE_FRAMES;
  if (down.state === DownState.none) return false;
  if (down.state === DownState.tumble) {
    down.frame++;
    return false;
  }
  if (isFloorTeching(f) || down.state === DownState.bound) {
    decayKnockback(f);
    motion.x = f32(motion.x + launch.knockbackX);
  }
  if (isFloorTeching(f)) {
    down.frame++;
    applyDownRollTravel(f, stage);
    return true;
  }
  // Bound and damage fall through into the wait they start.
  if (down.state === DownState.bound) {
    if (down.frame >= DOWN_BOUND_FRAMES) {
      startDownWait(f, DOWN_WAIT_FRAMES);
    } else {
      down.frame++;
      standOnDeck(f, stage);
      return true;
    }
  }
  if (down.state === DownState.damage) {
    standOnDeck(f, stage);
    motion.vz = 0.0;
    launch.knockbackZ = 0.0;
    if (down.frame >= DOWN_DAMAGE_FRAMES) {
      if (launch.hitstun <= 0) {
        startDownStand(f);
        return true;
      }
      startDownWait(f, launch.hitstun);
    } else {
      down.frame++;
      return true;
    }
  }
  if (down.state === DownState.wait) {
    standOnDeck(f, stage);
    if (!leavingBound && !leavingDamage) {
      down.waitRemaining = max(0, down.waitRemaining - 1);
      down.frame++;
      if (down.waitRemaining === 0) {
        startDownStand(f);
        return true;
      }
    }
    if (input.getupAttackPressed) beginDownState(f, DownState.attack, 0);
    else if (input.getupDirectionPressed && input.getupDirection !== 0) beginDownState(f, DownState.roll, input.getupDirection);
    else if (input.direction !== 0) beginDownState(f, DownState.roll, input.direction < 0 ? -1 : 1);
    else if (input.getupStandPressed || input.verticalDirection > 0) startDownStand(f);
    applyDownRollTravel(f, stage);
    return true;
  }
  if (down.state === DownState.stand || down.state === DownState.attack) {
    standOnDeck(f, stage);
    down.frame++;
    return true;
  }
  if (down.state === DownState.roll) {
    standOnDeck(f, stage);
    down.frame++;
    applyDownRollTravel(f, stage);
    standOnDeck(f, stage);
    return true;
  }
  return false;
}
