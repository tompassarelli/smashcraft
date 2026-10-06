// Wall and ceiling contacts: stopping against solid faces, tumble rebounds,
// and the wall and ceiling techs that recover from them.
import { max, min } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { SurfaceContact } from "./codes";
import { WALL_TECH_STARTUP_FRAMES, isTumbling } from "./conditions";
import { type Fighter, WALL_TECH_JUMP_INPUT_WINDOW_FRAMES } from "./fighter";
import { setWorldMotionValue, totalVelocityX, totalVelocityZ } from "./motion";
import type { Controls } from "./roster";
import { MAIN_DECK_BODY_SURFACES, type SolidSurface, solidSurfaceAt, solidSurfaceCount, surfaceZ } from "./stage";
import { clearDownState } from "./transitions";
import { melee } from "./tuning";

export const SURFACE_REFLECT_SPEED_THRESHOLD = melee(1.0);
export const SURFACE_REFLECT_ATTENUATION = 0.800000011920929;
export const SURFACE_REFLECT_COOLDOWN_FRAMES = 3;
export const SURFACE_TECH_WALL_COLLISION_GRACE_FRAMES = 14;

/**
 * Melee's airborne collision box is never narrower than 2 units a side
 * (mpColl_LoadECB_JObj). Fighters meet walls with that flank and reach for
 * ledges past it; this is the half-width in Melee units.
 */
export const BODY_HALF_WIDTH = 2.0;
const BODY_REACH = melee(BODY_HALF_WIDTH);

/** How far a fighter's body moves a surface sideways: a sideways-facing surface meets its flank, a level underside its feet. */
function bodyShift(surface: SolidSurface): number {
  return surface.normalX > 0 ? BODY_REACH : surface.normalX < 0 ? -BODY_REACH : 0.0;
}

function signedDistance(surface: SolidSurface, shift: number, x: number, z: number): number {
  return f32(f32(f32(x - f32(surface.startX + shift)) * surface.normalX) + f32(f32(z - surface.startZ) * surface.normalZ));
}

/**
 * Whether a point on the shifted surface's line lies within it, along its
 * longer axis. A level underside reaches a body's half-width further at each
 * end, so it still meets its shifted neighbours.
 */
function withinSurface(surface: SolidSurface, shift: number, x: number, z: number): boolean {
  const { startX, startZ, endX, endZ } = surface;
  if (Math.abs(f32(endZ - startZ)) > Math.abs(f32(endX - startX))) return z >= min(startZ, endZ) && z <= max(startZ, endZ);
  const reach = surface.normalX === 0 ? BODY_REACH : 0.0;
  return x >= f32(f32(min(startX, endX) + shift) - reach) && x <= f32(f32(max(startX, endX) + shift) + reach);
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

/** Removes the launch velocity component pointing into the surface, and the fighter's own when `own`. */
function stopInwardMotion(f: Fighter, nx: number, nz: number, own: boolean): void {
  const { motion, launch } = f;
  const inwardSelfSpeed = f32(f32(motion.vx * nx) + f32(motion.vz * nz));
  const inwardKnockbackSpeed = f32(f32(launch.knockbackX * nx) + f32(launch.knockbackZ * nz));
  if (own && inwardSelfSpeed < 0) {
    motion.vx = f32(motion.vx - f32(inwardSelfSpeed * nx));
    motion.vz = f32(motion.vz - f32(inwardSelfSpeed * nz));
  }
  if (inwardKnockbackSpeed < 0) {
    launch.knockbackX = f32(launch.knockbackX - f32(inwardKnockbackSpeed * nx));
    launch.knockbackZ = f32(launch.knockbackZ - f32(inwardKnockbackSpeed * nz));
  }
}

/** Puts a point that crossed the shifted surface back onto its line. */
function placeOnSurface(f: Fighter, surface: SolidSurface, shift: number, distance: number): void {
  const { motion } = f;
  if (surface.normalZ === 0) {
    motion.x = f32(surface.startX + shift);
    setWorldMotionValue(motion.meleeX, motion.x);
  } else if (surface.normalX === 0) {
    motion.z = surface.startZ;
    setWorldMotionValue(motion.meleeZ, motion.z);
  } else {
    motion.x = f32(motion.x - f32(distance * surface.normalX));
    motion.z = f32(motion.z - f32(distance * surface.normalZ));
    setWorldMotionValue(motion.meleeX, motion.x);
    setWorldMotionValue(motion.meleeZ, motion.z);
  }
}

function resolveSolidSurfaceContact(f: Fighter, stage: number, index: number, oldX: number, oldZ: number, input: Readonly<Controls>): boolean {
  const surface = solidSurfaceAt(stage, index);
  const { kind, normalX: nx, normalZ: nz } = surface;
  const { motion, launch, surfaceRecovery: recovery } = f;
  const shift = bodyShift(surface);
  const oldDistance = signedDistance(surface, shift, oldX, oldZ);
  const newDistance = signedDistance(surface, shift, motion.x, motion.z);
  if (oldDistance < 0 || newDistance >= 0) return false;
  const fraction = f32(oldDistance / f32(oldDistance - newDistance));
  const contactX = f32(oldX + f32(f32(motion.x - oldX) * fraction));
  const contactZ = f32(oldZ + f32(f32(motion.z - oldZ) * fraction));
  if (!withinSurface(surface, shift, contactX, contactZ)) return false;
  placeOnSurface(f, surface, shift, newDistance);
  recovery.contactSerial++;
  recovery.contactX = f32(contactX - shift);
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
  if (eventKind === SurfaceContact.techWall || eventKind === SurfaceContact.techCeiling) {
    stopInwardMotion(f, nx, nz, true);
  } else if (isTumbling(f) && recovery.reflectCooldown === 0 && index !== recovery.lastReflectedSurface && inwardKnockback > SURFACE_REFLECT_SPEED_THRESHOLD) {
    // A tumbling launch rebounds off the surface, attenuated.
    const combinedX = f32(motion.vx + launch.knockbackX);
    const combinedZ = f32(motion.vz + launch.knockbackZ);
    const inwardSpeed = f32(f32(combinedX * nx) + f32(combinedZ * nz));
    launch.knockbackX = f32(f32(combinedX - f32(f32(2 * inwardSpeed) * nx)) * SURFACE_REFLECT_ATTENUATION);
    launch.knockbackZ = f32(f32(combinedZ - f32(f32(2 * inwardSpeed) * nz)) * SURFACE_REFLECT_ATTENUATION);
    motion.vx = 0.0;
    motion.vz = 0.0;
    f.facing = launch.knockbackX < 0 ? -1 : 1;
    recovery.lastReflectedSurface = index;
    recovery.reflectCooldown = SURFACE_REFLECT_COOLDOWN_FRAMES;
  } else {
    // Airborne collision moves a fighter off a wall without changing its own
    // velocity (melee:src/melee/ft/ft_081B.c ft_800835B0), so a fighter that
    // rises past a wall's top carries on over it. An underside stops a rise.
    stopInwardMotion(f, nx, nz, kind === SurfaceContact.ceiling);
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

/**
 * Where the main deck's `side` meets a fighter's flank at height z, if its
 * side reaches that low. Each height crosses the body in one span, so its
 * sides are the body's whole extent there.
 */
function mainDeckSideX(stage: number, side: number, z: number): number | undefined {
  for (let i = 0; i < MAIN_DECK_BODY_SURFACES; i++) {
    const surface = solidSurfaceAt(stage, i);
    const { startX, startZ, endX, endZ } = surface;
    const facesSide = side > 0 ? surface.normalX > 0 : surface.normalX < 0;
    if (!facesSide || z < min(startZ, endZ) || z > max(startZ, endZ)) continue;
    const alongZ = f32(endZ - startZ);
    const x = alongZ === 0 ? startX : f32(startX + f32(f32(f32(endX - startX) * f32(z - startZ)) / alongZ));
    return f32(x + bodyShift(surface));
  }
  return undefined;
}

/**
 * Moves a fighter whose feet ended a frame inside the main deck's body out
 * sideways to the nearer flank, as Melee's collision box slides off a ledge's
 * corner: a fighter running off a ledge drops within its half-width of the
 * wall without crossing it. Callers skip it on a frame that lands on a deck.
 */
export function leaveMainDeckBody(f: Fighter, stage: number): void {
  const { motion } = f;
  if (solidSurfaceCount(stage) === 0 || motion.z >= surfaceZ(stage, 0)) return;
  const right = mainDeckSideX(stage, 1, motion.z);
  const left = mainDeckSideX(stage, -1, motion.z);
  if (right === undefined || left === undefined || motion.x <= left || motion.x >= right) return;
  motion.x = f32(right - motion.x) <= f32(motion.x - left) ? right : left;
  setWorldMotionValue(motion.meleeX, motion.x);
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
  // Melee pushes off along the facing it turned to, away from even a sloped wall (ftCo_PassiveWall.c ftCo_PassiveWall_Anim).
  const away = recovery.contactNormalX > 0 ? 1.0 : -1.0;
  if (recovery.wallJumpQueued) {
    motion.vx = f32(away * physics.wallJumpHorizontalSpeed);
    motion.vz = physics.wallJumpVerticalSpeed;
    f.facing = away > 0 ? 1 : -1;
    f.jump.serial++;
    f.jump.isDouble = false;
  } else {
    motion.vx = f32(away * physics.passiveWallSpeed);
  }
  recovery.velocityApplied = true;
  return recovery.wallJumpQueued;
}
