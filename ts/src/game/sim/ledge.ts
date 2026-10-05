// Ledge catches and the options from a hang: jump, climb, drop, roll and attack.
import { max, min } from "../../runtime/wurst";
import { f32 } from "waygate/src/sim/f32";
import { AttackStyle, DownState, LedgeState } from "./codes";
import { canAttack, isTumbling } from "./conditions";
import type { Fighter } from "./fighter";
import { clearDash } from "./groundMovement";
import { LEDGE_ATTACK_FRAMES } from "./moves";
import { totalVelocityZ } from "./motion";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { type Controls, type Roster, controlsAt, fighterAt, isActive } from "./roster";
import { surfaceLeft, surfaceRight, surfaceZ } from "./stage";
import { checkBlastZone } from "./stocks";
import { beginAttack, cancelAttack, clearDownState, clearTechInput, leaveLedge } from "./transitions";

export const LEDGE_CLIMB_FRAMES = 25;
export const LEDGE_ROLL_FRAMES = 36;
export const LEDGE_INTANGIBLE_FRAMES = 30;
export const LEDGE_GRAB_WIDTH = 54.0;
export const LEDGE_GRAB_BELOW = 90.0;
export const LEDGE_GRAB_ABOVE = 12.0;
export const LEDGE_HANG_OUTSET = 24.0;
export const LEDGE_HANG_DEPTH = 90.0;
export const LEDGE_MOUNT_FRAMES = 12;
export const LEDGE_CLIMB_INSET = 24.0;

function ledgeX(stage: number, side: number): number {
  return side < 0 ? surfaceLeft(stage, 0) : surfaceRight(stage, 0);
}

/** The ledge side a falling fighter facing the stage can catch, or zero. */
function ledgeCandidate(f: Fighter, stage: number, input: Readonly<Controls>): number {
  const { launch, motion } = f;
  const canCatchDuringSpecialFall = f.special.fall && !f.status.out && f.special.lockFrames <= 0 && launch.hitlag <= 0
    && launch.hitstun <= 0 && f.shield.stun <= 0 && (f.down.state === DownState.none || isTumbling(f));
  if ((!canAttack(f) && !canCatchDuringSpecialFall) || motion.grounded || f.ledge.regrab > 0 || f.attack.style !== undefined
    || input.down || input.verticalDirection < 0 || totalVelocityZ(f) >= 0) {
    return 0;
  }
  const height = f32(motion.z - surfaceZ(stage, 0));
  if (height < -LEDGE_GRAB_BELOW || height > LEDGE_GRAB_ABOVE) return 0;
  const side = motion.x < 0 ? -1 : 1;
  const outside = f32(f32(motion.x - ledgeX(stage, side)) * side);
  if (outside < 0 || outside > LEDGE_GRAB_WIDTH || f.facing !== -side) return 0;
  return side;
}

function ledgeDistance(f: Fighter, stage: number, side: number): number {
  const dx = f32(f.motion.x - ledgeX(stage, side));
  const dz = f32(f.motion.z - surfaceZ(stage, 0));
  return f32(f32(dx * dx) + f32(dz * dz));
}

function catchLedge(f: Fighter, stage: number, side: number): void {
  const { motion, launch, ledge } = f;
  motion.crouching = false;
  motion.fastFalling = false;
  clearDash(f);
  clearDownState(f);
  ledge.state = LedgeState.hang;
  ledge.side = side;
  ledge.frame = 0;
  ledge.serial++;
  ledge.intangible = LEDGE_INTANGIBLE_FRAMES;
  motion.x = f32(ledgeX(stage, side) + f32(side * LEDGE_HANG_OUTSET));
  motion.z = f32(surfaceZ(stage, 0) - LEDGE_HANG_DEPTH);
  f.facing = -side;
  motion.grounded = false;
  motion.surface = undefined;
  motion.vx = 0.0;
  motion.vz = 0.0;
  launch.knockbackX = 0.0;
  launch.groundKnockbackX = 0.0;
  launch.knockbackZ = 0.0;
  f.special.fall = false;
  f.jump.remaining = 1;
  motion.dropTime = 0;
  f.landing.lCancelWindow = 0;
  clearTechInput(f);
}

/** Catches each main-deck ledge for its nearest candidate; tied nearest candidates both fail. */
export function resolveLedges(world: Roster, stage: number, controls: readonly Readonly<Controls>[]): void {
  for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
    const side = sideIndex === 0 ? -1 : 1;
    let occupied = false;
    let best: number | undefined;
    let distance = 0.0;
    let tied = false;
    for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
      if (!isActive(world, slot)) continue;
      const f = fighterAt(world, slot);
      occupied = occupied || (f.ledge.state !== LedgeState.none && f.ledge.side === side);
      if (ledgeCandidate(f, stage, controlsAt(controls, slot)) !== side) continue;
      const candidate = ledgeDistance(f, stage, side);
      if (best === undefined || candidate < distance) {
        best = slot;
        distance = candidate;
        tied = false;
      } else if (candidate === distance) {
        tied = true;
      }
    }
    if (!occupied && best !== undefined && !tied) catchLedge(fighterAt(world, best), stage, side);
  }
}

function startLedgeOption(f: Fighter, state: LedgeState): void {
  f.ledge.state = state;
  f.ledge.frame = 0;
  if (state === LedgeState.attack) beginAttack(f, AttackStyle.ledgeAttack, false);
}

/** One frame on the ledge: hang options, then the mount onto the stage. */
export function advanceLedge(world: Roster, slot: number, stage: number, input: Readonly<Controls>): void {
  checkBlastZone(world, slot);
  const f = fighterAt(world, slot);
  const { motion, ledge } = f;
  if (f.status.out || f.launch.hitlag > 0) return;
  f.status.invincible = max(0, f.status.invincible - 1);
  ledge.intangible = max(0, ledge.intangible - 1);
  if (ledge.state === LedgeState.hang) {
    // The catch tick anchors before new options can begin.
    if (ledge.frame > 0) {
      const intoStage = input.getupDirectionPressed && input.getupDirection === -ledge.side;
      const away = input.getupDirectionPressed && input.getupDirection === ledge.side;
      if (input.jumpPressed) {
        motion.vx = f32(-ledge.side * f.tuning.physics.airSpeed);
        motion.vz = f.tuning.physics.fullJumpSpeed;
        f.jump.serial++;
        f.jump.isDouble = false;
        leaveLedge(f);
        return;
      }
      if (intoStage || input.ledgeVerticalPressed > 0) {
        startLedgeOption(f, LedgeState.climb);
        return;
      }
      if (away || input.ledgeVerticalPressed < 0) {
        motion.vx = f32(ledge.side * 2.0);
        motion.vz = -2.0;
        leaveLedge(f);
        return;
      }
      if (input.airDodgePressed) {
        startLedgeOption(f, LedgeState.roll);
        return;
      }
      if (input.getupAttackPressed) {
        startLedgeOption(f, LedgeState.attack);
        return;
      }
    }
    ledge.frame++;
    return;
  }
  ledge.frame++;
  const progress = f32(f32(min(LEDGE_MOUNT_FRAMES, ledge.frame) * 1.0) / LEDGE_MOUNT_FRAMES);
  const inset = ledge.state === LedgeState.roll ? 140.0 : ledge.state === LedgeState.attack ? 64.0 : LEDGE_CLIMB_INSET;
  const remaining = f32(1 - progress);
  motion.x = f32(ledgeX(stage, ledge.side) + f32(ledge.side * f32(f32(LEDGE_HANG_OUTSET * remaining) - f32(inset * progress))));
  motion.z = f32(surfaceZ(stage, 0) - f32(LEDGE_HANG_DEPTH * remaining));
  motion.grounded = ledge.frame >= LEDGE_MOUNT_FRAMES;
  motion.surface = motion.grounded ? 0 : undefined;
  if (ledge.state === LedgeState.attack) {
    f.attack.frame = ledge.frame;
    f.attack.cooldown = max(0, LEDGE_ATTACK_FRAMES - ledge.frame);
  }
  const duration = ledge.state === LedgeState.climb ? LEDGE_CLIMB_FRAMES : ledge.state === LedgeState.roll ? LEDGE_ROLL_FRAMES : LEDGE_ATTACK_FRAMES;
  if (ledge.frame >= duration) {
    if (ledge.state === LedgeState.attack) cancelAttack(f);
    f.jump.remaining = 2;
    leaveLedge(f);
  }
}
