import { f32 } from "wisp/src/sim/f32";

/** Melee ftCommonData (PlCo.dat, GALE01 rev 2) stick thresholds; cited per field in smashcraft:docs/gameplay-design.md, "Ground states and the stick map". */
export const STICK_DEADZONE = f32(0.28);
const WALK_MIDDLE_STICK_THRESHOLD = f32(0.4);
const WALK_FAST_STICK_THRESHOLD = f32(0.8);
const TURN_STICK_THRESHOLD = -0.25;
const TURN_RUN_STICK_THRESHOLD = -0.375;
export const DASH_STICK_THRESHOLD = f32(0.8);
/** Melee's dash_smash_window is 2 frames; #188 widened it to three samples for keyboard and pad flicks. */
export const DASH_FLICK_SAMPLES = 3;
const RUN_HOLD_STICK_THRESHOLD = 0.625;
export const TAP_JUMP_STICK_THRESHOLD = f32(0.6625);
const RELAXED_TAP_JUMP_STICK_THRESHOLD = 0.5625;
export const TAP_JUMP_WINDOW = 4;
export const CROUCH_STICK_THRESHOLD = 0.6875;
const CROUCH_RELEASE_STICK_THRESHOLD = 0.625;
const DASH_SMASH_LAST_FRAME = 4;
const DASH_ATTACK_LAST_FRAME = 20;

export const StickZone = {
  deadzone: 0,
  tiltTurn: 1,
  smashTurn: 2,
  walkSlow: 3,
  walkMiddle: 4,
  walkFast: 5,
  dashSlow: 6,
  dashFast: 7,
  dashJump: 8,
  jump: 9,
  crouch: 10,
} as const;
export type StickZone = (typeof StickZone)[keyof typeof StickZone];

export const GroundState = { stand: 0, walk: 1, dash: 2, run: 3, runBrake: 4, turnRun: 5, crouch: 6 } as const;
export type GroundState = (typeof GroundState)[keyof typeof GroundState];

export const GroundOption = {
  jab: 0,
  tilt: 1,
  forwardSmash: 2,
  upDownSmash: 3,
  dashAttack: 4,
  grab: 5,
  shield: 6,
  jump: 7,
  crouch: 8,
  dash: 9,
  walk: 10,
  turnRun: 11,
} as const;
export type GroundOption = (typeof GroundOption)[keyof typeof GroundOption];

const movingFast = (state: GroundState): boolean =>
  state === GroundState.dash || state === GroundState.run || state === GroundState.runBrake || state === GroundState.turnRun;

/** Which zone of Melee's stick map a sample selects, in the priority order of `ftCo_Wait_IASA` (jump, dash, crouch, turn, walk). */
export function stickZone(x: number, z: number, sideAge: number, upAge: number, facing: number, state: GroundState): StickZone {
  const horizontal = Math.abs(x);
  const freshUp = upAge < TAP_JUMP_WINDOW;
  if (freshUp && z >= (movingFast(state) ? RELAXED_TAP_JUMP_STICK_THRESHOLD : TAP_JUMP_STICK_THRESHOLD)) return StickZone.jump;
  if (horizontal >= DASH_STICK_THRESHOLD && sideAge < DASH_FLICK_SAMPLES) {
    if (freshUp && z >= RELAXED_TAP_JUMP_STICK_THRESHOLD) return StickZone.dashJump;
    if (f32(x * facing) < 0 && state !== GroundState.dash) return StickZone.smashTurn;
    return horizontal >= 1.0 ? StickZone.dashFast : StickZone.dashSlow;
  }
  if (z < -CROUCH_STICK_THRESHOLD || (state === GroundState.crouch && z <= -CROUCH_RELEASE_STICK_THRESHOLD)) return StickZone.crouch;
  if (horizontal < STICK_DEADZONE) return StickZone.deadzone;
  if (f32(x * facing) <= TURN_STICK_THRESHOLD) return StickZone.tiltTurn;
  if (horizontal < WALK_MIDDLE_STICK_THRESHOLD) return StickZone.walkSlow;
  return horizontal < WALK_FAST_STICK_THRESHOLD ? StickZone.walkMiddle : StickZone.walkFast;
}

/** Melee's per-state interrupt lists (`ftCo_*_IASA`), reduced to the options Smashcraft gates; `frame` is the state's action frame. */
export function groundOptionAllowed(state: GroundState, frame: number, option: GroundOption, turnCommandEndFrame: number): boolean {
  switch (state) {
    case GroundState.stand:
    case GroundState.walk:
      return option !== GroundOption.dashAttack && option !== GroundOption.turnRun;
    case GroundState.crouch:
      return option !== GroundOption.dashAttack && option !== GroundOption.turnRun && option !== GroundOption.walk;
    case GroundState.dash:
      if (option === GroundOption.forwardSmash) return frame <= DASH_SMASH_LAST_FRAME;
      if (option === GroundOption.dashAttack) return frame <= DASH_ATTACK_LAST_FRAME;
      return option === GroundOption.grab || option === GroundOption.shield || option === GroundOption.jump || option === GroundOption.dash;
    case GroundState.run:
      return option === GroundOption.dashAttack || option === GroundOption.grab || option === GroundOption.shield
        || option === GroundOption.jump || option === GroundOption.turnRun;
    case GroundState.runBrake:
      return option === GroundOption.jump || option === GroundOption.crouch || (option === GroundOption.turnRun && frame < turnCommandEndFrame);
    case GroundState.turnRun:
      return option === GroundOption.jump;
    default:
      return false;
  }
}

/** Run holds while the stick stays this far forward (`ftCo_RunBrake_CheckInput`) and turns at this far back (`fn_800C9D40`); otherwise it brakes. */
export function runStickDirection(x: number, facing: number): number {
  const forward = f32(x * facing);
  if (forward >= RUN_HOLD_STICK_THRESHOLD) return facing;
  if (forward <= TURN_RUN_STICK_THRESHOLD) return -facing;
  return 0;
}

/** Walk and run targets scale with the stick (`ftWalkCommon_800E0060`, `getAccelAndTarget`); the walk modifier is one full-speed walk. */
export function stickSpeedScale(x: number, walkModifier: boolean): number {
  if (walkModifier) return 1.0;
  const horizontal = Math.abs(x);
  return horizontal >= 1.0 ? 1.0 : horizontal;
}
