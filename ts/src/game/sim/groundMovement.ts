// Grounded steering: walk, dash, run, turn-run and run-brake, with the actor's
// command timeline in tuning.ground. Coefficients come from the locally
// identified NTSC 1.02 PlCo.dat.
import { max, min } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { chillScaled } from "./chill";
import { GroundAction } from "./codes";
import type { Fighter } from "./fighter";
import { INITIAL_DASH_FRAMES, WORLD_UNITS_PER_MELEE_UNIT, melee } from "./tuning";

const WALK_ACCEL_TAPER_GAIN = 0.5;
const RUN_ACCEL_TAPER_GAIN = 0.4000000059604645;
const RUN_DASH_TURN_FRICTION_MULTIPLIER = 1.0;
// TurnRun's velocity test is encoded in Melee units; world velocity is scaled.
const TURN_RUN_ZERO_VELOCITY_THRESHOLD = melee(0.009999999776482582);
/** NTSC common +0x4c; only the Dash-to-Guard branch uses this early/late split. */
export const DASH_GUARD_EARLY_FRAMES = 20;

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
}

function actionClockLimit(f: Fighter): number {
  const rules = f.tuning.ground;
  return max(max(rules.dashRunEnableFrame, rules.turnRunAnimationEndFrame), max(rules.runBrakeTurnCommandEndFrame, rules.runBrakeAnimationEndFrame));
}

function runBrakeHasRecordedEndRules(f: Fighter): boolean {
  return f.tuning.ground.runBrakeAnimationEndFrame > 0 && f.tuning.ground.runBrakeMaximumFrames > 0;
}

function startRunBrake(f: Fighter): void {
  f.ground.action = GroundAction.runBrake;
  f.ground.actionFrame = 0;
  f.ground.runBrakeFramesRemaining = f.tuning.ground.runBrakeMaximumFrames;
}

function startTurnRun(f: Fighter, animationFrame: number): void {
  const { ground } = f;
  ground.action = GroundAction.turnRun;
  ground.actionFrame = animationFrame;
  ground.turnRunEntryFacing = f.facing;
  // A nonzero animation start at/past frame 9 enters with the facing command
  // phase active; the paused animation still waits for its velocity condition.
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
      // The command pauses TurnRun; a later animation update changes facing
      // only after ground velocity crosses zero.
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
        } else {
          clearDash(f);
        }
      }
    }
  }
}

/** Ground velocity toward a target: friction above it, acceleration below it, capped either way. */
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

/** Acceleration toward the target, tapering as the velocity along it approaches the target speed. */
function taperedAcceleration(f: Fighter, multiplier: number, base: number, direction: number, targetSpeed: number, gain: number, taper: boolean): number {
  const acceleration = f32(f32(f32(multiplier + base) * WORLD_UNITS_PER_MELEE_UNIT) * direction);
  const alongTarget = f32(f.motion.vx * direction);
  if (!taper || !(alongTarget > 0 && alongTarget < targetSpeed)) return acceleration;
  return f32(acceleration * f32(f32(1.0 - f32(alongTarget / targetSpeed)) * gain));
}

/** One grounded steering frame; true when it starts a dash, whose entry velocity applies after this frame's displacement. */
export function advanceGroundMovement(f: Fighter, direction: number, walking: boolean): boolean {
  const { ground, motion } = f;
  const physics = f.tuning.physics;
  if (walking) {
    clearDash(f);
    if (direction !== 0) {
      f.facing = direction;
      const walkTargetVelocity = f32(chillScaled(f, physics.walkSpeed) * direction);
      const walkTargetSpeed = Math.abs(walkTargetVelocity);
      const acceleration = taperedAcceleration(f, physics.walkAccelerationMultiplier, physics.walkAccelerationBase, direction, walkTargetSpeed, WALK_ACCEL_TAPER_GAIN, walkTargetSpeed > 0);
      motion.vx = groundMovementVelocity(motion.vx, acceleration, walkTargetVelocity, physics.traction, physics.groundSpeedCap);
    }
    return false;
  }
  const previousAction = ground.action;
  advanceActionClock(f, direction);
  if ((previousAction === GroundAction.runBrake || previousAction === GroundAction.turnRun) && ground.action === GroundAction.none) return false;
  if (direction !== 0 && ground.action === GroundAction.runBrake) {
    if (direction * f.facing < 0 && ground.actionFrame < f.tuning.ground.runBrakeTurnCommandEndFrame) {
      // Retail RunBrake starts TurnRun at the current animation frame.
      startTurnRun(f, ground.actionFrame);
    } else {
      // RunBrake's actor-owned command window has closed. Neutral braking
      // continues until the action ends or the fighter reaches rest.
      motion.vx = motion.vx > 0 ? max(0.0, f32(motion.vx - physics.traction)) : min(0.0, f32(motion.vx + physics.traction));
      if (Math.abs(motion.vx) <= physics.traction && !runBrakeHasRecordedEndRules(f)) clearDash(f);
      return false;
    }
  }
  if (direction === 0) {
    if (ground.action === GroundAction.run) startRunBrake(f);
    if (Math.abs(motion.vx) <= f32(physics.traction * RUN_DASH_TURN_FRICTION_MULTIPLIER)
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
      // Run turning uses the ordinary dash acceleration toward the new target.
      // The retail command at frame 9 delays facing until the velocity has
      // crossed zero; the timing is per actor.
      if (ground.action !== GroundAction.turnRun) startTurnRun(f, 0);
    } else {
      ground.dashFrame = 1;
      ground.dashDirection = direction;
      ground.action = GroundAction.dash;
      // Dash entry explicitly advances its animation once before physics.
      ground.actionFrame = 1;
      f.facing = direction;
      motion.vx = f32(direction * min(chillScaled(f, physics.dashSpeed), physics.groundSpeedCap));
      return true;
    }
  } else {
    ground.dashFrame = min(INITIAL_DASH_FRAMES + 1, ground.dashFrame + 1);
    if (ground.action === GroundAction.dash) ground.actionFrame = min(actionClockLimit(f), ground.actionFrame + 1);
  }
  if (ground.action === GroundAction.dash && direction === ground.dashDirection) {
    if (ground.actionFrame >= f.tuning.ground.dashRunEnableFrame) {
      ground.action = GroundAction.run;
      ground.actionFrame = 0;
    }
  }
  const runTarget = chillScaled(f, physics.runSpeed);
  const targetVelocity = f32(direction * runTarget);
  const acceleration = taperedAcceleration(
    f, physics.groundAccelerationMultiplier, physics.groundAccelerationBase, direction, runTarget, RUN_ACCEL_TAPER_GAIN,
    ground.action === GroundAction.run && targetVelocity !== 0,
  );
  motion.vx = groundMovementVelocity(motion.vx, acceleration, targetVelocity, f32(physics.traction * RUN_DASH_TURN_FRICTION_MULTIPLIER), physics.groundSpeedCap);
  if (ground.action !== GroundAction.turnRun && f32(motion.vx * direction) > 0) {
    f.facing = direction;
    ground.dashDirection = direction;
  }
  return false;
}
