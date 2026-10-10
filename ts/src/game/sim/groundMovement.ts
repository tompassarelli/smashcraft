


import { max, min } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { chillScaled } from "./chill";
import { speedBuffed } from "./itemBuffs";
import { GroundAction } from "./codes";
import type { Fighter } from "./fighter";
import { floorTraction } from "./stage";
import { DASH_FLICK_SAMPLES, DASH_STICK_THRESHOLD, type GroundOption, GroundState, STICK_DEADZONE, StickZone, TAP_JUMP_WINDOW, groundOptionAllowed, runStickDirection, stickSpeedScale, stickZone } from "./stickZones";
import { stickZ } from "./stick";
import type { Controls } from "./roster";
import { INITIAL_DASH_FRAMES, WORLD_UNITS_PER_MELEE_UNIT, melee } from "./tuning";

const WALK_ACCEL_TAPER_GAIN = 0.5;
const RUN_ACCEL_TAPER_GAIN = 0.4000000059604645;
const RUN_DASH_TURN_FRICTION_MULTIPLIER = 1.0;

const TURN_RUN_ZERO_VELOCITY_THRESHOLD = melee(0.009999999776482582);
/** NTSC common +0x4c; only the Dash-to-Guard branch uses this early/late split. */
export const DASH_GUARD_EARLY_FRAMES = 20;

export function groundState(f: Readonly<Fighter>): GroundState {
  if (f.motion.crouching) return GroundState.crouch;
  switch (f.ground.action) {
    case GroundAction.dash: return GroundState.dash;
    case GroundAction.run: return GroundState.run;
    case GroundAction.runBrake: return GroundState.runBrake;
    case GroundAction.turnRun: return GroundState.turnRun;
    default: return f.ground.dashFrame > 0 ? GroundState.dash : f.motion.vx !== 0 ? GroundState.walk : GroundState.stand;
  }
}

export function groundOptionOpen(f: Readonly<Fighter>, option: GroundOption): boolean {
  return groundOptionAllowed(groundState(f), f.ground.actionFrame, option, f.tuning.ground.runBrakeTurnCommandEndFrame);
}

export function wantsCrouch(f: Readonly<Fighter>, input: Readonly<Controls>, horizontalStick: number): boolean {
  const z = stickZ(input);
  return stickZone(horizontalStick, z < 0 ? z : -1.0, f.motion.stickSideAge, TAP_JUMP_WINDOW, f.facing, groundState(f)) === StickZone.crouch;
}

export function clearDash(f: Fighter): void {
  const { ground } = f;
  ground.dashFrame = 0;
  ground.dashDirection = 0;
  ground.action = GroundAction.none;
  ground.actionFrame = 0;
  ground.runBrakeFramesRemaining = 0;
  ground.turnRunEntryFacing = 0;
  ground.turnRunFacingCommandLatched = false;
  ground.turnRunPausePending = false;
  ground.pivotEligible = false;
}

function actionClockLimit(f: Fighter): number {
  const rules = f.tuning.ground;
  return max(max(rules.dashRunEnableFrame, rules.turnRunAnimationEndFrame), max(rules.runBrakeTurnCommandEndFrame, rules.runBrakeAnimationEndFrame));
}

function runBrakeHasRecordedEndRules(f: Fighter): boolean {
  return f.tuning.ground.runBrakeAnimationEndFrame > 0 && f.tuning.ground.runBrakeMaximumFrames > 0;
}

function startRunBrake(f: Fighter): void {
  f.ground.pivotEligible = false;
  f.ground.action = GroundAction.runBrake;
  f.ground.actionFrame = 0;
  f.ground.runBrakeFramesRemaining = f.tuning.ground.runBrakeMaximumFrames;
}

function startTurnRun(f: Fighter, animationFrame: number): void {
  const { ground } = f;
  ground.pivotEligible = ground.action === GroundAction.run;
  ground.action = GroundAction.turnRun;
  ground.actionFrame = animationFrame;
  ground.turnRunEntryFacing = f.facing;


  ground.turnRunFacingCommandLatched = animationFrame >= f.tuning.ground.turnRunFacingCommandFrame;
  ground.turnRunPausePending = ground.turnRunFacingCommandLatched;
  ground.runBrakeFramesRemaining = 0;
}

function advanceActionClock(f: Fighter, direction: number): void {
  const { ground } = f;
  const rules = f.tuning.ground;
  if (ground.action === GroundAction.run) {
    ground.actionFrame = min(actionClockLimit(f), ground.actionFrame + 1);
  } else if (ground.action === GroundAction.runBrake) {
    if (runBrakeHasRecordedEndRules(f)) {
      if (ground.runBrakeFramesRemaining <= 0) ground.runBrakeFramesRemaining = rules.runBrakeMaximumFrames;
      ground.runBrakeFramesRemaining = max(0, ground.runBrakeFramesRemaining - 1);
    }
    ground.actionFrame = min(actionClockLimit(f), ground.actionFrame + 1);
    if (runBrakeHasRecordedEndRules(f) && (ground.actionFrame >= rules.runBrakeAnimationEndFrame || ground.runBrakeFramesRemaining <= 0)) clearDash(f);
  } else if (ground.action === GroundAction.turnRun) {
    if (ground.turnRunPausePending) {
      ground.actionFrame = min(rules.turnRunAnimationEndFrame, ground.actionFrame + 1);
      ground.turnRunPausePending = false;
      return;
    }
    if (ground.turnRunFacingCommandLatched && f.facing === ground.turnRunEntryFacing) {


      if (f32(f.motion.vx * ground.turnRunEntryFacing) <= TURN_RUN_ZERO_VELOCITY_THRESHOLD) {
        f.facing = -ground.turnRunEntryFacing;
        ground.dashDirection = f.facing;
      }
      return;
    }
    if (ground.actionFrame < rules.turnRunAnimationEndFrame) {
      const previousFrame = ground.actionFrame;
      ground.actionFrame = min(rules.turnRunAnimationEndFrame, ground.actionFrame + 1);
      if (previousFrame < rules.turnRunFacingCommandFrame && ground.actionFrame >= rules.turnRunFacingCommandFrame) {
        ground.turnRunFacingCommandLatched = true;
      }
      if (ground.actionFrame >= rules.turnRunAnimationEndFrame) {
        if (direction === f.facing) {
          ground.action = GroundAction.run;
          ground.actionFrame = 0;
          ground.turnRunEntryFacing = 0;
          ground.turnRunFacingCommandLatched = false;
          ground.pivotEligible = false;
        } else {
          clearDash(f);
        }
      }
    }
  }
}


function groundMovementVelocity(velocity: number, acceleration: number, targetVelocity: number, friction: number, speedCap: number): number {
  const targetDirection = targetVelocity > 0 ? 1 : targetVelocity < 0 ? -1 : 0;
  const currentDirection = velocity > 0 ? 1 : velocity < 0 ? -1 : 0;
  if (currentDirection === targetDirection && Math.abs(velocity) >= Math.abs(targetVelocity)) {
    const frictionLimitedSpeed = max(Math.abs(targetVelocity), f32(Math.abs(velocity) - friction));
    return f32(targetDirection * min(speedCap, frictionLimitedSpeed));
  }
  const acceleratedVelocity = f32(velocity + acceleration);
  const sameDirection = f32(acceleratedVelocity * targetVelocity) > 0;
  const crossedTarget = Math.abs(targetVelocity) > Math.abs(velocity) && Math.abs(acceleratedVelocity) > Math.abs(targetVelocity);
  if (sameDirection && crossedTarget) return targetVelocity;
  return max(-speedCap, min(speedCap, acceleratedVelocity));
}


function taperedAcceleration(f: Fighter, multiplier: number, base: number, direction: number, targetSpeed: number, gain: number, taper: boolean): number {
  const acceleration = f32(f32(f32(multiplier + base) * WORLD_UNITS_PER_MELEE_UNIT) * direction);
  const alongTarget = f32(f.motion.vx * direction);
  if (!taper || !(alongTarget > 0 && alongTarget < targetSpeed)) return acceleration;
  return f32(acceleration * f32(f32(1.0 - f32(alongTarget / targetSpeed)) * gain));
}






export function advanceGroundMovement(f: Fighter, direction: number, walking: boolean, horizontalStick = direction, friction = 1.0): boolean {
  const { ground, motion } = f;
  const physics = f.tuning.physics;
  const traction = floorTraction(physics.traction, friction);
  const changingDirection = direction !== 0 && direction !== ground.dashDirection;


  if (direction !== 0 && (ground.action === GroundAction.run || ground.action === GroundAction.turnRun || ground.action === GroundAction.runBrake)) {
    direction = runStickDirection(horizontalStick === 0 ? direction : horizontalStick, f.facing);
  }
  const strongStick = Math.abs(horizontalStick) >= DASH_STICK_THRESHOLD;
  const freshFlick = motion.stickSideAge < DASH_FLICK_SAMPLES || (ground.action !== GroundAction.dash && Math.abs(horizontalStick) >= 1.0);
  const speedScale = stickSpeedScale(horizontalStick === 0 ? direction : horizontalStick, walking);

  const pivotWindow = ground.action === GroundAction.turnRun ? ground.actionFrame < 2
    : ground.action === GroundAction.dash && ground.actionFrame <= 2;
  if (!pivotWindow) ground.pivotEligible = false;
  if (Math.abs(horizontalStick) < STICK_DEADZONE && direction === 0 && pivotWindow && ground.pivotEligible) {
    const entryFacing = ground.turnRunEntryFacing;
    f.facing = -entryFacing;
    motion.vx = f32(entryFacing * min(Math.abs(motion.vx), f32(traction * 2.0)));
    clearDash(f);
    return false;
  }

  const travelInWindow = ground.actionFrame - motion.stickSideAge < f.tuning.ground.dashRunEnableFrame;
  if (!walking && changingDirection && ground.action !== GroundAction.run && ground.action !== GroundAction.turnRun && ground.action !== GroundAction.runBrake) {
    if (ground.action === GroundAction.dash && motion.stickSideAge < DASH_FLICK_SAMPLES - 1 && !strongStick && travelInWindow) {


      direction = 0;
    } else if (!strongStick || (!freshFlick && (ground.action !== GroundAction.dash || direction !== f.facing))) {
      walking = true;
    }
  }
  if (walking) {
    clearDash(f);
    if (direction !== 0) {
      f.facing = direction;
      const walkTargetVelocity = f32(f32(speedBuffed(f, chillScaled(f, physics.walkSpeed)) * speedScale) * direction);
      const walkTargetSpeed = Math.abs(walkTargetVelocity);
      const acceleration = taperedAcceleration(f, f32(physics.walkAccelerationMultiplier * speedScale), physics.walkAccelerationBase, direction, walkTargetSpeed, WALK_ACCEL_TAPER_GAIN, walkTargetSpeed > 0);
      motion.vx = groundMovementVelocity(motion.vx, acceleration, walkTargetVelocity, traction, speedBuffed(f, physics.groundSpeedCap));

    }
    return false;
  }
  const previousAction = ground.action;
  advanceActionClock(f, direction);
  if ((previousAction === GroundAction.runBrake || previousAction === GroundAction.turnRun) && ground.action === GroundAction.none) return false;
  if (direction !== 0 && ground.action === GroundAction.runBrake) {
    if (direction * f.facing < 0 && ground.actionFrame < f.tuning.ground.runBrakeTurnCommandEndFrame) {

      startTurnRun(f, ground.actionFrame);
    } else {


      motion.vx = motion.vx > 0 ? max(0.0, f32(motion.vx - traction)) : min(0.0, f32(motion.vx + traction));
      if (Math.abs(motion.vx) <= traction && !runBrakeHasRecordedEndRules(f)) clearDash(f);
      return false;
    }
  }
  if (direction === 0) {
    if (ground.action === GroundAction.run) startRunBrake(f);
    if (Math.abs(motion.vx) <= f32(traction * RUN_DASH_TURN_FRICTION_MULTIPLIER)
      && (ground.action !== GroundAction.runBrake || !runBrakeHasRecordedEndRules(f))) {
      clearDash(f);
    } else if (ground.dashFrame > 0) {
      ground.dashFrame = min(INITIAL_DASH_FRAMES + 1, ground.dashFrame + 1);
      if (ground.action === GroundAction.dash) ground.actionFrame = min(actionClockLimit(f), ground.actionFrame + 1);
    }
    return false;
  }
  if (ground.dashFrame === 0 || direction !== ground.dashDirection) {


    if (ground.action === GroundAction.run || ground.action === GroundAction.turnRun) {



      if (ground.action !== GroundAction.turnRun) startTurnRun(f, 0);
    } else {
      const entryFacing = f.facing;
      const reversingDash = ground.action === GroundAction.dash && direction !== ground.dashDirection;
      ground.dashFrame = 1;
      ground.dashDirection = direction;
      ground.action = GroundAction.dash;

      ground.actionFrame = 1;
      ground.turnRunEntryFacing = reversingDash ? entryFacing : 0;
      ground.pivotEligible = reversingDash;
      f.facing = direction;
      motion.vx = f32(direction * min(speedBuffed(f, chillScaled(f, physics.dashSpeed)), speedBuffed(f, physics.groundSpeedCap)));
      return true;
    }
  } else {
    ground.dashFrame = min(INITIAL_DASH_FRAMES + 1, ground.dashFrame + 1);
    if (ground.action === GroundAction.dash) ground.actionFrame = min(actionClockLimit(f), ground.actionFrame + 1);
  }
  if (ground.action === GroundAction.dash && direction === ground.dashDirection) {
    if (ground.actionFrame >= f.tuning.ground.dashRunEnableFrame && runStickDirection(horizontalStick === 0 ? direction : horizontalStick, f.facing) === f.facing) {
      ground.action = GroundAction.run;
      ground.actionFrame = 0;
      ground.pivotEligible = false;
      ground.turnRunEntryFacing = 0;
    }
  }
  const runTarget = f32(speedBuffed(f, chillScaled(f, physics.runSpeed)) * speedScale);
  const targetVelocity = f32(direction * runTarget);
  const acceleration = taperedAcceleration(
    f, f32(physics.groundAccelerationMultiplier * speedScale), physics.groundAccelerationBase, direction, runTarget, RUN_ACCEL_TAPER_GAIN,
    ground.action === GroundAction.run && targetVelocity !== 0,
  );
  motion.vx = groundMovementVelocity(motion.vx, acceleration, targetVelocity, f32(traction * RUN_DASH_TURN_FRICTION_MULTIPLIER), speedBuffed(f, physics.groundSpeedCap));

  if (ground.action !== GroundAction.turnRun && f32(motion.vx * direction) > 0) {
    f.facing = direction;
    ground.dashDirection = direction;
  }
  return false;
}
