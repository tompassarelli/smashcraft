// Wall and ceiling contacts: stopping against solid faces, tumble rebounds,
// the wall and ceiling techs that recover from them, and wall jumps.
import { max, min } from "../../runtime/numbers";
import { at } from "wisp/src/runtime/lookup";
import { f32 } from "wisp/src/sim/f32";
import { Character, DownState, SpecialAction, SurfaceContact } from "./codes";
import { WALL_TECH_STARTUP_FRAMES, inGrabContext, isTumbling } from "./conditions";
import { type Fighter, WALL_JUMP_FLICK_FRAMES, WALL_TECH_JUMP_INPUT_WINDOW_FRAMES } from "./fighter";
import { setWorldMotionValue, totalVelocityX, totalVelocityZ } from "./motion";
import type { Controls } from "./roster";
import { MAIN_DECK_BODY_SURFACES, type SolidSurface, mainDeckZ, solidSurfaceAt, solidSurfaceCount, solidSurfacesOf } from "./stage";
import { stickX } from "./stick";
import { clearDownState } from "./transitions";
import { melee } from "./tuning";

export const SURFACE_REFLECT_SPEED_THRESHOLD = melee(1.0);
export const SURFACE_REFLECT_ATTENUATION = 0.800000011920929;
export const SURFACE_REFLECT_COOLDOWN_FRAMES = 3;
export const SURFACE_TECH_WALL_COLLISION_GRACE_FRAMES = 14;
/** PlCo +0x768: frames after meeting a wall fast enough in which a flick away wall jumps. */
export const WALL_JUMP_INPUT_WINDOW_FRAMES = 130;
/** PlCo +0x76C: how far from the wall the flick must push the stick. */
export const WALL_JUMP_STICK_X = 0.800000011920929;
/** PlCo +0x778: each earlier wall jump since landing scales a wall jump's rise by this. */
export const WALL_JUMP_REPEAT_RISE_SCALE = 0.9750000238418579;
/** Melee's wall-jump input timer saturates here and then rechecks the approach (ftwalljump.c max_input_frames). */
const WALL_JUMP_AGE_LIMIT = 254;
const WALL_JUMPS_USED_LIMIT = 255;

/**
 * Melee's airborne collision box is never narrower than 2 units a side
 * (mpColl_LoadECB_JObj). Fighters meet walls with that flank and reach for
 * ledges past it; this is the half-width in Melee units.
 */
export const BODY_HALF_WIDTH = 2.0;
const BODY_REACH = melee(BODY_HALF_WIDTH);

/**
 * How far above its position a fighter's top is, in Melee units: Melee's
 * airborne ECB top, the highest of its six ECB bones (ftData x44;
 * melee:src/melee/mp/mpcoll.c mpColl_LoadECB_JObj, with no 2-unit pad, as
 * falls and jumps load it), in its model's bind pose (PlFxNr.dat,
 * PlFcNr.dat, PlCaNr.dat) times its model_scaling (+0x8C): Fox's head 11.625
 * x 0.96, Falco's 12.5 x 1.1, Captain Falcon's 19.3585 x 0.97.
 */
export function bodyTop(character: Character): number {
  switch (character) {
    default:
    case Character.rifleman:
      return 13.75;
    case Character.demonHunter:
      return 18.777746200561523;
  }
}

/** How far a fighter's body moves a surface sideways: a sideways-facing surface meets its flank. */
function bodyShift(surface: SolidSurface): number {
  return surface.normalX > 0 ? BODY_REACH : surface.normalX < 0 ? -BODY_REACH : 0.0;
}

/** How far a fighter's body moves a surface down: a ceiling meets its top, other surfaces its position. */
function bodyLift(f: Fighter, surface: SolidSurface): number {
  return surface.kind === SurfaceContact.ceiling ? ceilingLift(f.character) : 0.0;
}

// Each character's ceiling lift, found on first ask: every solid face asks it every frame.
const CEILING_LIFTS: Record<number, number | undefined> = {};

function ceilingLift(character: Character): number {
  const cached = CEILING_LIFTS[character];
  if (cached !== undefined) return cached;
  const lift = -melee(bodyTop(character));
  CEILING_LIFTS[character] = lift;
  return lift;
}

function signedDistance(surface: SolidSurface, shift: number, lift: number, x: number, z: number): number {
  return f32(f32(f32(x - f32(surface.startX + shift)) * surface.normalX) + f32(f32(z - f32(surface.startZ + lift)) * surface.normalZ));
}

/**
 * signedDistance in raw arithmetic: binary64 on the host, Warcraft's own
 * rounding in Lua. It is within a few ulps of signedDistance, so beyond ±1 its
 * sign is signedDistance's in both, without the exact operations (about 1 µs
 * each in Lua) that every fighter would pay for every surface on every frame.
 */
function roughDistance(surface: SolidSurface, shift: number, lift: number, x: number, z: number): number {
  return (x - (surface.startX + shift)) * surface.normalX + (z - (surface.startZ + lift)) * surface.normalZ;
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

/** A wall jump's rise: each earlier wall jump since landing scales it by PlCo +0x778 (ftCo_PassiveWall_Anim's powf). */
function wallJumpRise(speed: number, repeat: number): number {
  if (repeat === 0) return speed;
  let scale = 1.0;
  for (let i = 0; i < repeat; i++) scale = f32(scale * WALL_JUMP_REPEAT_RISE_SCALE);
  return f32(speed * scale);
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

/**
 * Enters Melee's wall recovery, which wall techs and wall jumps share
 * (melee:src/melee/ft/kinds/ftCommon/ftCo_PassiveWall.c ftCo_800C1E64): motion
 * stops, the fighter turns `away` from the wall, and its push-off or jump
 * comes when the five-frame hang ends.
 */
function beginWallRecovery(f: Fighter, away: number, jumpQueued: boolean, repeat: number): void {
  clearDownState(f);
  const recovery = f.surfaceRecovery;
  recovery.state = SurfaceContact.techWall;
  recovery.frame = 0;
  recovery.velocityApplied = false;
  recovery.wallJumpQueued = jumpQueued;
  recovery.wallJumpRepeat = repeat;
  clearMotionForSurfaceTech(f);
  f.motion.fastFalling = false;
  f.status.invincible = max(f.status.invincible, SURFACE_TECH_WALL_COLLISION_GRACE_FRAMES);
  f.facing = away;
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
function placeOnSurface(f: Fighter, surface: SolidSurface, shift: number, lift: number, distance: number): void {
  const { motion } = f;
  if (surface.normalZ === 0) {
    motion.x = f32(surface.startX + shift);
    setWorldMotionValue(motion.meleeX, motion.x);
  } else if (surface.normalX === 0) {
    motion.z = f32(surface.startZ + lift);
    setWorldMotionValue(motion.meleeZ, motion.z);
  } else {
    motion.x = f32(motion.x - f32(distance * surface.normalX));
    motion.z = f32(motion.z - f32(distance * surface.normalZ));
    setWorldMotionValue(motion.meleeX, motion.x);
    setWorldMotionValue(motion.meleeZ, motion.z);
  }
}

function resolveSolidSurfaceContact(f: Fighter, surface: SolidSurface, index: number, oldX: number, oldZ: number, input: Readonly<Controls>): boolean {
  const { kind, normalX: nx, normalZ: nz } = surface;
  const { motion, launch, surfaceRecovery: recovery } = f;
  const shift = bodyShift(surface);
  const lift = bodyLift(f, surface);
  if (roughDistance(surface, shift, lift, oldX, oldZ) < -1 || roughDistance(surface, shift, lift, motion.x, motion.z) > 1) return false;
  const oldDistance = signedDistance(surface, shift, lift, oldX, oldZ);
  const newDistance = signedDistance(surface, shift, lift, motion.x, motion.z);
  if (oldDistance < 0 || newDistance >= 0) return false;
  const fraction = f32(oldDistance / f32(oldDistance - newDistance));
  const contactX = f32(oldX + f32(f32(motion.x - oldX) * fraction));
  const contactZ = f32(oldZ + f32(f32(motion.z - oldZ) * fraction));
  if (!withinSurface(surface, shift, contactX, contactZ)) return false;
  placeOnSurface(f, surface, shift, lift, newDistance);
  recovery.contactSerial++;
  recovery.contactX = f32(contactX - shift);
  recovery.contactZ = f32(contactZ - lift);
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
    launch.throwHitstun = false;
    if (eventKind === SurfaceContact.techWall) {
      beginWallRecovery(f, nx > 0 ? 1 : -1, wallTechJumpInputIsRecent(f, input), 0);
    } else {
      clearDownState(f);
      recovery.state = eventKind;
      clearMotionForSurfaceTech(f);
      f.facing = nx < 0 ? -1 : nx > 0 ? 1 : f.facing;
    }
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

/** Resolves the step from (old) against every solid face; returns the side of the fighter a wall met (-1 left, 1 right), or 0. */
export function resolveSolidSurfaceContacts(f: Fighter, stage: number, oldX: number, oldZ: number, input: Readonly<Controls>): number {
  let touched = false;
  let wallSide = 0;
  const surfaces = solidSurfacesOf(stage);
  // Every main-deck face is at or below its walking plane, and ceiling
  // contact lowers it by the fighter's height. A step wholly above that
  // plane cannot cross one; retain a unit of room for contact rounding.
  // A cannon shot passes the main deck's body (stageHazards.ts, endCannonPass).
  const first = f.cannon.passing || (oldZ > mainDeckZ(stage) + 1 && f.motion.z > mainDeckZ(stage) + 1) ? MAIN_DECK_BODY_SURFACES : 0;
  for (let i = first; i < surfaces.length; i++) {
    const surface = at(surfaces, i);
    if (!resolveSolidSurfaceContact(f, surface, i, oldX, oldZ, input)) continue;
    touched = true;
    if (surface.kind === SurfaceContact.wall) wallSide = surface.normalX > 0 ? -1 : 1;
  }
  if (!touched) f.surfaceRecovery.lastReflectedSurface = undefined;
  return wallSide;
}

/**
 * Whether Melee checks for a wall jump after this frame's collision: falls,
 * jumps, tumbles past hitstun and recoveries past their hang do; aerials,
 * specials, air dodges, special falls and hitstun don't (the callers of
 * ftWallJump_8008169C in melee:src/melee/ft/ft_081B.c).
 */
function checksWallJump(f: Fighter): boolean {
  const { motion, launch, attack, special, dodge, down, surfaceRecovery: recovery } = f;
  return !motion.grounded && !f.status.out && launch.hitstun <= 0 && launch.hitlag <= 0 && attack.style === undefined
    && special.action === SpecialAction.none && !special.fall && !dodge.airDodging && !inGrabContext(f)
    && (down.state === DownState.none || isTumbling(f))
    && !(recovery.state === SurfaceContact.techWall && recovery.frame < WALL_TECH_STARTUP_FRAMES);
}

/**
 * Melee's wall jump (melee:src/melee/ft/ftwalljump.c ftWallJump_8008169C):
 * meeting a wall faster than the fighter's minimum approach speed opens a
 * window while it stays against that wall, and a fresh flick away from it in
 * that window jumps off it. `wallSide` is the side of the fighter a wall met
 * this frame (-1 left, 1 right, 0 none) and `deltaX` the frame's sideways
 * movement. True when a wall jump began.
 */
export function advanceWallJump(f: Fighter, wallSide: number, deltaX: number, stickX: number): boolean {
  const physics = f.tuning.surface;
  const recovery = f.surfaceRecovery;
  if (!physics.canWallJump || !checksWallJump(f)) return false;
  if (wallSide === 0) {
    recovery.wallJumpAge = undefined;
    return false;
  }
  const age = recovery.wallJumpAge;
  if (age !== undefined && wallSide === recovery.wallJumpSide) {
    recovery.wallJumpAge = age + 1 < WALL_JUMP_AGE_LIMIT ? age + 1 : undefined;
  } else if (Math.abs(deltaX) > physics.wallJumpMinimumApproach) {
    recovery.wallJumpSide = wallSide;
    recovery.wallJumpAge = 0;
  }
  const window = recovery.wallJumpAge;
  const away = -recovery.wallJumpSide;
  if (window === undefined || window >= WALL_JUMP_INPUT_WINDOW_FRAMES || f.motion.stickSideAge >= WALL_JUMP_FLICK_FRAMES) return false;
  if (away > 0 ? stickX < WALL_JUMP_STICK_X : stickX > -WALL_JUMP_STICK_X) return false;
  recovery.wallJumpAge = undefined;
  const used = recovery.wallJumpsUsed;
  beginWallRecovery(f, away, true, used);
  recovery.wallJumpsUsed = min(WALL_JUMPS_USED_LIMIT, used + 1);
  return true;
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

/** Whether a point lies strictly inside the main deck's solid body, below its walking plane and between its sides. */
export function insideMainDeckBody(stage: number, x: number, z: number): boolean {
  if (solidSurfaceCount(stage) === 0 || z >= mainDeckZ(stage)) return false;
  const right = mainDeckSideX(stage, 1, z);
  const left = mainDeckSideX(stage, -1, z);
  return right !== undefined && left !== undefined && x > f32(left + BODY_REACH) && x < f32(right - BODY_REACH);
}

/**
 * Moves a fighter whose feet ended a frame inside the main deck's body out
 * sideways to the nearer flank, as Melee's collision box slides off a ledge's
 * corner: a fighter running off a ledge drops within its half-width of the
 * wall without crossing it. Callers skip it on a frame that lands on a deck.
 * Returns the side of the fighter the wall it now stands against is on (-1
 * left, 1 right), or 0 when it wasn't inside.
 */
export function leaveMainDeckBody(f: Fighter, stage: number): number {
  const { motion } = f;
  if (f.cannon.passing || solidSurfaceCount(stage) === 0 || motion.z >= mainDeckZ(stage)) return 0;
  const right = mainDeckSideX(stage, 1, motion.z);
  const left = mainDeckSideX(stage, -1, motion.z);
  if (right === undefined || left === undefined || motion.x <= left || motion.x >= right) return 0;
  const toRight = f32(right - motion.x) <= f32(motion.x - left);
  motion.x = toRight ? right : left;
  setWorldMotionValue(motion.meleeX, motion.x);
  return toRight ? -1 : 1;
}

/** Advances a wall or ceiling tech; true on the frame a queued wall jump launches. */
export function advanceSurfaceRecovery(f: Fighter, input: Readonly<Controls>): boolean {
  if (f.launch.hitlag > 0) return false;
  const { surfaceRecovery: recovery, motion } = f;
  const physics = f.tuning.surface;
  const timing = f.tuning.tech;
  if (recovery.state === SurfaceContact.techCeiling) {
    recovery.frame++;
    // The animation's throw-flag event sets sideways speed from the stick times passiveceil_vel_x (ftCo_PassiveCeil.c ftCo_PassiveCeil_Anim).
    if (recovery.frame === timing.ceilingImpulseFrame && !recovery.velocityApplied) {
      motion.vx = f32(stickX(input) * physics.passiveCeilingSpeed);
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
  const away = f.facing > 0 ? 1.0 : -1.0;
  if (recovery.wallJumpQueued) {
    motion.vx = f32(away * physics.wallJumpHorizontalSpeed);
    motion.vz = wallJumpRise(physics.wallJumpVerticalSpeed, recovery.wallJumpRepeat);
    f.jump.serial++;
    f.jump.isDouble = false;
  } else {
    motion.vx = f32(away * physics.passiveWallSpeed);
  }
  recovery.velocityApplied = true;
  return recovery.wallJumpQueued;
}
