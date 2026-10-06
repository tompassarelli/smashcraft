// Starting jumps, air dodges and ground dodges.
import { max } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { Character, DownState, LedgeState, PlatformMove, ShieldBreak, SurfaceContact } from "./codes";
import { inGrabContext, inSurfaceTechStartup, isGroundDodging, isTumbling } from "./conditions";
import type { Fighter } from "./fighter";
import { clearDash } from "./groundMovement";
import { DIAGONAL_UNIT } from "./knockback";
import { observeActionDecision, observeActionStart } from "./observations";
import { clearDownState } from "./transitions";
import { melee } from "./tuning";

const AIR_DODGE_SPEED = melee(3.0999999046325684);
export const AIR_DODGE_DECAY = 0.8999999761581421;
// EscapeAir processes animation frame one before entry physics; frame 30 resumes air physics.
const AIR_DODGE_DECAY_FRAMES = 29;
export const AIR_DODGE_ANIMATION_FRAMES = 49;
// Cos and Sin of 18 * bj_DEGTORAD, as the Wurst interpreter evaluates them in binary32.
const SHALLOW_DODGE_COS = 0.9510565996170044;
const SHALLOW_DODGE_SIN = 0.30901676416397095;
/** Action bits in decision observations. */
const JUMP_BIT = 16;
const DODGE_BITS = 768;

const sign = (value: number) => (value === 0 ? 0 : value > 0 ? 1 : -1);

/** Whether an ongoing state blocks jumps and air dodges alike. */
function lockedOut(f: Fighter): boolean {
  return inSurfaceTechStartup(f) || inGrabContext(f) || f.ledge.state !== LedgeState.none || f.status.out || f.special.fall
    || f.shield.breakState !== ShieldBreak.none || (f.down.state !== DownState.none && !isTumbling(f))
    || f.launch.hitlag > 0 || f.launch.hitstun > 0 || f.shield.stun > 0 || f.landing.lag > 0 || f.attack.cooldown > 0
    || f.platform.move !== PlatformMove.none;
}

/** Starts jump squat on the ground or a double jump in the air. */
export function beginJump(f: Fighter, horizontal: number): void {
  const { motion, jump, shield } = f;
  if (lockedOut(f) || (shield.releaseLag > 0 && !motion.grounded) || f.dodge.airDodging || isGroundDodging(f) || jump.squat > 0 || jump.remaining <= 0) return;
  observeActionDecision(JUMP_BIT);
  f.surfaceRecovery.state = SurfaceContact.none;
  f.surfaceRecovery.frame = 0;
  motion.fastFalling = false;
  if (motion.grounded) {
    motion.crouching = false;
    clearDash(f);
    shield.raised = false;
    shield.heldFrames = 0;
    shield.releaseLag = 0;
    jump.squat = f.tuning.physics.jumpSquatFrames;
    jump.held = true;
  } else {
    // Illidan keeps horizontal momentum on his aerial jump.
    if (f.character !== Character.demonHunter) motion.vx = f32(horizontal * f.tuning.physics.aerialJumpHorizontalSpeed);
    motion.vz = f.tuning.physics.aerialJumpSpeed;
    jump.serial++;
    jump.isDouble = true;
    clearDownState(f);
  }
  jump.remaining--;
  observeActionStart(JUMP_BIT);
}

/** An air dodge in a digital direction; horizontal dodges angle shallowly downward, explicit vertical input stays directional. */
export function beginAirDodge(f: Fighter, horizontal: number, vertical: number): void {
  const { motion, launch, dodge } = f;
  if (lockedOut(f) || motion.grounded || dodge.airDodging || dodge.airMotionFrames > 0) return;
  observeActionDecision(DODGE_BITS);
  motion.fastFalling = false;
  const dx = sign(horizontal);
  const dz = sign(vertical);
  if (dx !== 0 && dz === 0) {
    motion.vx = f32(f32(dx * AIR_DODGE_SPEED) * SHALLOW_DODGE_COS);
    motion.vz = -f32(AIR_DODGE_SPEED * SHALLOW_DODGE_SIN);
  } else {
    const scale = dx !== 0 && dz !== 0 ? DIAGONAL_UNIT : 1.0;
    motion.vx = f32(f32(dx * AIR_DODGE_SPEED) * scale);
    motion.vz = f32(f32(dz * AIR_DODGE_SPEED) * scale);
  }
  launch.knockbackX = 0.0;
  launch.groundKnockbackX = 0.0;
  launch.knockbackZ = 0.0;
  dodge.airMotionFrames = AIR_DODGE_DECAY_FRAMES;
  dodge.airDodging = true;
  observeActionStart(DODGE_BITS);
  motion.crouching = false;
  dodge.airFrame = 0;
  motion.grounded = false;
  f.jump.remaining = max(0, f.jump.remaining - 1);
  clearDownState(f);
  const recovery = f.surfaceRecovery;
  recovery.lastReflectedSurface = undefined;
  recovery.reflectCooldown = 0;
  recovery.contactKind = SurfaceContact.none;
  recovery.contactApproachSpeed = 0.0;
  recovery.contactX = 0.0;
  recovery.contactZ = 0.0;
  recovery.contactNormalX = 0.0;
  recovery.contactNormalZ = 0.0;
}

export function canBeginGroundDodge(f: Fighter): boolean {
  if (inGrabContext(f)) return false;
  const { shield } = f;
  return !f.status.out && f.down.state === DownState.none && f.motion.grounded && f.launch.hitlag <= 0 && f.launch.hitstun <= 0
    && shield.stun <= 0 && shield.releaseLag <= 0 && f.landing.lag <= 0 && f.attack.cooldown <= 0 && f.jump.squat <= 0
    && f.grab.grabbedFrames <= 0 && !f.dodge.airDodging && !isGroundDodging(f) && (shield.raised || shield.energy > 0);
}

/** A roll toward direction, or a spot dodge for zero; the roll keeps its entry facing until it ends. */
export function beginGroundDodge(f: Fighter, direction: number): void {
  const { dodge } = f;
  f.motion.crouching = false;
  dodge.groundEntryFacing = f.facing;
  clearDash(f);
  dodge.groundDirection = sign(direction);
  f.motion.vx = 0.0;
  dodge.groundFrame = 1;
  f.shield.raised = false;
  f.shield.heldFrames = 0;
}
