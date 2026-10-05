// Wall and ceiling contacts: stopping against solid faces, tumble rebounds,
// and the wall and ceiling techs that recover from them.
import { max } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { SurfaceContact } from "./codes";
import { WALL_TECH_STARTUP_FRAMES, isTumbling } from "./conditions";
import { type Fighter, WALL_TECH_JUMP_INPUT_WINDOW_FRAMES } from "./fighter";
import { setWorldMotionValue, totalVelocityX, totalVelocityZ } from "./motion";
import type { Controls } from "./roster";
import {
  solidSurfaceCoordinate,
  solidSurfaceCount,
  solidSurfaceKind,
  solidSurfaceMaximum,
  solidSurfaceMinimum,
  solidSurfaceNormalX,
  solidSurfaceNormalZ,
} from "./stage";
import { clearDownState } from "./transitions";
import { melee } from "./tuning";

export const SURFACE_REFLECT_SPEED_THRESHOLD = melee(1.0);
export const SURFACE_REFLECT_ATTENUATION = 0.800000011920929;
export const SURFACE_REFLECT_COOLDOWN_FRAMES = 3;
export const SURFACE_TECH_WALL_COLLISION_GRACE_FRAMES = 14;

function surfaceSignedDistance(stage: number, index: number, x: number, z: number): number {
  if (solidSurfaceKind(stage, index) === SurfaceContact.wall) {
    return f32(f32(x - solidSurfaceCoordinate(stage, index)) * solidSurfaceNormalX(stage, index));
  }
  return f32(f32(z - solidSurfaceCoordinate(stage, index)) * solidSurfaceNormalZ(stage, index));
}

function contactInSolidSurfaceSpan(stage: number, index: number, x: number, z: number): boolean {
  const along = solidSurfaceKind(stage, index) === SurfaceContact.wall ? z : x;
  return along >= solidSurfaceMinimum(stage, index) && along <= solidSurfaceMaximum(stage, index);
}

function wallTechJumpInputIsRecent(f: Fighter, input: Readonly<Controls>): boolean {
  return f.jump.inputAge < WALL_TECH_JUMP_INPUT_WINDOW_FRAMES || input.jumpPressed || input.verticalDirection > 0;
}

function clearMotionForSurfaceTech(f: Fighter): void {
  f.motion.vx = 0.0;
  f.motion.vz = 0.0;
  f.launch.knockbackX = 0.0;
  f.launch.knockbackZ = 0.0;
  f.launch.groundKnockbackX = 0.0;
  f.shield.pushbackX = 0.0;
  f.shield.recoilX = 0.0;
  f.shield.recoilZ = 0.0;
}

/** Removes the self and launch velocity components pointing into the surface. */
function stopInwardMotion(f: Fighter, nx: number, nz: number): void {
  const { motion, launch } = f;
  const inwardSelfSpeed = f32(f32(motion.vx * nx) + f32(motion.vz * nz));
  const inwardKnockbackSpeed = f32(f32(launch.knockbackX * nx) + f32(launch.knockbackZ * nz));
  if (inwardSelfSpeed < 0) {
    motion.vx = f32(motion.vx - f32(inwardSelfSpeed * nx));
    motion.vz = f32(motion.vz - f32(inwardSelfSpeed * nz));
  }
  if (inwardKnockbackSpeed < 0) {
    launch.knockbackX = f32(launch.knockbackX - f32(inwardKnockbackSpeed * nx));
    launch.knockbackZ = f32(launch.knockbackZ - f32(inwardKnockbackSpeed * nz));
  }
}

function resolveSolidSurfaceContact(f: Fighter, stage: number, index: number, oldX: number, oldZ: number, input: Readonly<Controls>): boolean {
  const kind = solidSurfaceKind(stage, index);
  if (kind === SurfaceContact.none) return false;
  const { motion, launch, surfaceRecovery: recovery } = f;
  const nx = solidSurfaceNormalX(stage, index);
  const nz = solidSurfaceNormalZ(stage, index);
  const oldDistance = surfaceSignedDistance(stage, index, oldX, oldZ);
  const newDistance = surfaceSignedDistance(stage, index, motion.x, motion.z);
  if (oldDistance < 0 || newDistance >= 0) return false;
  const fraction = f32(oldDistance / f32(oldDistance - newDistance));
  const contactX = f32(oldX + f32(f32(motion.x - oldX) * fraction));
  const contactZ = f32(oldZ + f32(f32(motion.z - oldZ) * fraction));
  if (!contactInSolidSurfaceSpan(stage, index, contactX, contactZ)) return false;
  const coordinate = solidSurfaceCoordinate(stage, index);
  if (kind === SurfaceContact.wall) {
    motion.x = coordinate;
    setWorldMotionValue(motion.meleeX, motion.x);
  } else {
    motion.z = coordinate;
    setWorldMotionValue(motion.meleeZ, motion.z);
  }
  recovery.contactSerial++;
  recovery.contactX = contactX;
  recovery.contactZ = contactZ;
  recovery.contactNormalX = nx;
  recovery.contactNormalZ = nz;
  recovery.contactApproachSpeed = max(0.0, -f32(f32(totalVelocityX(f) * nx) + f32(totalVelocityZ(f) * nz)));
  let eventKind: SurfaceContact = kind;
  recovery.state = SurfaceContact.none;
  recovery.frame = 0;
  recovery.velocityApplied = false;
  recovery.wallJumpQueued = false;
  if (recovery.reflectCooldown === 0 && f.tech.window > 0 && isTumbling(f)) {
    eventKind = kind === SurfaceContact.wall ? SurfaceContact.techWall : SurfaceContact.techCeiling;
    f.tech.window = 0;
    launch.hitstun = 0;
    clearDownState(f);
    recovery.state = eventKind;
    recovery.frame = 0;
    recovery.velocityApplied = false;
    if (eventKind === SurfaceContact.techWall) recovery.wallJumpQueued = wallTechJumpInputIsRecent(f, input);
    clearMotionForSurfaceTech(f);
    if (eventKind === SurfaceContact.techWall) f.status.invincible = max(f.status.invincible, SURFACE_TECH_WALL_COLLISION_GRACE_FRAMES);
    f.facing = nx < 0 ? -1 : nx > 0 ? 1 : f.facing;
  }
  recovery.contactKind = eventKind;
  const inwardKnockback = -f32(f32(launch.knockbackX * nx) + f32(launch.knockbackZ * nz));
  const surfaceKey = stage * 4 + index;
  if (eventKind === SurfaceContact.techWall || eventKind === SurfaceContact.techCeiling) {
    stopInwardMotion(f, nx, nz);
  } else if (isTumbling(f) && recovery.reflectCooldown === 0 && surfaceKey !== recovery.lastReflectedSurface && inwardKnockback > SURFACE_REFLECT_SPEED_THRESHOLD) {
    // A tumbling launch rebounds off the surface, attenuated.
    const combinedX = f32(motion.vx + launch.knockbackX);
    const combinedZ = f32(motion.vz + launch.knockbackZ);
    const inwardSpeed = f32(f32(combinedX * nx) + f32(combinedZ * nz));
    launch.knockbackX = f32(f32(combinedX - f32(f32(2 * inwardSpeed) * nx)) * SURFACE_REFLECT_ATTENUATION);
    launch.knockbackZ = f32(f32(combinedZ - f32(f32(2 * inwardSpeed) * nz)) * SURFACE_REFLECT_ATTENUATION);
    motion.vx = 0.0;
    motion.vz = 0.0;
    f.facing = launch.knockbackX < 0 ? -1 : 1;
    recovery.lastReflectedSurface = surfaceKey;
    recovery.reflectCooldown = SURFACE_REFLECT_COOLDOWN_FRAMES;
  } else {
    stopInwardMotion(f, nx, nz);
  }
  return true;
}

/** Resolves the step from (old) against every solid face. */
export function resolveSolidSurfaceContacts(f: Fighter, stage: number, oldX: number, oldZ: number, input: Readonly<Controls>): void {
  let touched = false;
  for (let i = 0; i < solidSurfaceCount(stage); i++) {
    if (resolveSolidSurfaceContact(f, stage, i, oldX, oldZ, input)) touched = true;
  }
  if (!touched) f.surfaceRecovery.lastReflectedSurface = undefined;
}

/** Advances a wall or ceiling tech; true on the frame a queued wall jump launches. */
export function advanceSurfaceRecovery(f: Fighter, input: Readonly<Controls>): boolean {
  if (f.launch.hitlag > 0) return false;
  const { surfaceRecovery: recovery, motion } = f;
  const physics = f.tuning.surface;
  const timing = f.tuning.tech;
  if (recovery.state === SurfaceContact.techCeiling) {
    recovery.frame++;
    if (recovery.frame === timing.ceilingImpulseFrame && !recovery.velocityApplied) {
      motion.vx = f32(input.direction * physics.passiveCeilingSpeed);
      recovery.velocityApplied = true;
    }
    if (recovery.frame >= timing.ceilingAnimationEndFrame) {
      recovery.state = SurfaceContact.none;
      recovery.frame = 0;
    }
    return false;
  }
  if (recovery.state !== SurfaceContact.techWall) return false;
  if (recovery.frame >= WALL_TECH_STARTUP_FRAMES) {
    recovery.frame++;
    const animationEnd = recovery.wallJumpQueued ? timing.wallJumpAnimationEndFrame : timing.wallAnimationEndFrame;
    if (recovery.frame >= WALL_TECH_STARTUP_FRAMES + animationEnd) {
      recovery.state = SurfaceContact.none;
      recovery.frame = 0;
    }
    return false;
  }
  recovery.wallJumpQueued = recovery.wallJumpQueued || wallTechJumpInputIsRecent(f, input);
  recovery.frame++;
  if (recovery.frame !== WALL_TECH_STARTUP_FRAMES) return false;
  if (recovery.wallJumpQueued) {
    motion.vx = f32(recovery.contactNormalX * physics.wallJumpHorizontalSpeed);
    motion.vz = physics.wallJumpVerticalSpeed;
    f.facing = recovery.contactNormalX > 0 ? 1 : -1;
    f.jump.serial++;
    f.jump.isDouble = false;
  } else {
    motion.vx = f32(recovery.contactNormalX * physics.passiveWallSpeed);
  }
  recovery.velocityApplied = true;
  return recovery.wallJumpQueued;
}
