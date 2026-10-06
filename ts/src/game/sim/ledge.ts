// Ledge catches and the options from a hang: jump, climb, drop, roll and attack.
import { max, min } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, DownState, LedgeState, ShieldBreak, SpecialAction } from "./codes";
import { inGrabContext, isTumbling } from "./conditions";
import type { Fighter } from "./fighter";
import { clearDash } from "./groundMovement";
import { AIR_DODGE_ANIMATION_FRAMES } from "./jumpsAndDodges";
import { LEDGE_ATTACK_FRAMES } from "./moves";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { type Controls, type Roster, controlsAt, fighterAt, isActive } from "./roster";
import { surfaceLeft, surfaceRight, surfaceZ } from "./stage";
import { checkBlastZone } from "./stocks";
import { beginAttack, cancelAttack, clearDownState, clearLedge, clearTech, leaveLedge } from "./transitions";
import { melee } from "./tuning";

export const LEDGE_CLIMB_FRAMES = 25;
export const LEDGE_ROLL_FRAMES = 36;
export const LEDGE_INTANGIBLE_FRAMES = 30;
export const LEDGE_HANG_OUTSET = 24.0;
export const LEDGE_HANG_DEPTH = 90.0;
const LEDGE_MOUNT_FRAMES = 12;
const LEDGE_CLIMB_INSET = 24.0;

/** A fighter's NTSC 1.02 ledge snap data (ftData x44 +0x10/+0x14/+0x18), in Melee units. */
interface LedgeSnap {
  readonly x: number;
  readonly y: number;
  readonly height: number;
}

/**
 * Where a fighter catches ledges, in world units: up to `reach` ahead of its
 * position, for ledges strictly between `lowest` and `highest` above its feet.
 */
interface LedgeCatchBox {
  readonly reach: number;
  readonly lowest: number;
  readonly highest: number;
}

// Archer, Rifleman and Illidan catch with Fox's, Falco's and Captain Falcon's data.
const FOX_LEDGE_SNAP: LedgeSnap = { x: 11.0, y: 13.0, height: 9.0 };
const FALCO_LEDGE_SNAP: LedgeSnap = { x: 11.0, y: 13.0, height: 9.0 };
const CAPTAIN_FALCON_LEDGE_SNAP: LedgeSnap = { x: 9.0, y: 17.0, height: 11.0 };
// Melee widens the reach by the airborne collision box, never under 2 units a
// side; Smashcraft fighters collide as points, so they reach with that minimum.
export const LEDGE_CATCH_BODY_HALF_WIDTH = 2.0;

export function ledgeSnap(character: Character): LedgeSnap {
  switch (character) {
    case Character.archer:
      return FOX_LEDGE_SNAP;
    case Character.rifleman:
      return FALCO_LEDGE_SNAP;
    case Character.demonHunter:
      return CAPTAIN_FALCON_LEDGE_SNAP;
  }
}

function catchBox(snap: LedgeSnap): LedgeCatchBox {
  const half = f32(snap.height * 0.5);
  return {
    reach: melee(f32(LEDGE_CATCH_BODY_HALF_WIDTH + snap.x)),
    lowest: melee(f32(snap.y - half)),
    highest: melee(f32(snap.y + half)),
  };
}

const ARCHER_CATCH_BOX = catchBox(FOX_LEDGE_SNAP);
const RIFLEMAN_CATCH_BOX = catchBox(FALCO_LEDGE_SNAP);
const DEMON_HUNTER_CATCH_BOX = catchBox(CAPTAIN_FALCON_LEDGE_SNAP);

export function ledgeCatchBox(character: Character): LedgeCatchBox {
  switch (character) {
    case Character.archer:
      return ARCHER_CATCH_BOX;
    case Character.rifleman:
      return RIFLEMAN_CATCH_BOX;
    case Character.demonHunter:
      return DEMON_HUNTER_CATCH_BOX;
  }
}

function ledgeX(stage: number, side: number): number {
  return side < 0 ? surfaceLeft(stage, 0) : surfaceRight(stage, 0);
}

/**
 * Falling, helpless and tumbling fighters catch; attacks, specials, air dodges,
 * hitstun and shield breaks don't. An air dodge turns helpless when its
 * animation ends.
 */
function canCatchLedge(f: Fighter): boolean {
  const { attack, special, dodge, launch, down } = f;
  return !f.status.out && f.status.frozenFrames <= 0 && launch.hitlag <= 0 && launch.hitstun <= 0
    && attack.style === undefined && attack.cooldown <= 0 && special.action === SpecialAction.none && special.lockFrames <= 0
    && (!dodge.airDodging || dodge.airFrame >= AIR_DODGE_ANIMATION_FRAMES) && f.shield.breakState === ShieldBreak.none
    && !inGrabContext(f) && (down.state === DownState.none || isTumbling(f));
}

/**
 * The ledge ahead that the fighter's last movement swept into its catch box,
 * or zero. Only a downward movement catches; holding down lets ledges pass.
 */
function ledgeCandidate(f: Fighter, stage: number, input: Readonly<Controls>): number {
  const { motion } = f;
  if (!canCatchLedge(f) || motion.grounded || f.ledge.regrab > 0 || input.down || motion.deltaZ >= 0) {
    return 0;
  }
  const side = -f.facing;
  const box = ledgeCatchBox(f.character);
  const edge = ledgeX(stage, side);
  const outside = f32(f32(motion.x - edge) * side);
  const outsideBefore = f32(f32(f32(motion.x - motion.deltaX) - edge) * side);
  if (outside <= 0 || min(outside, outsideBefore) >= box.reach) return 0;
  const below = f32(surfaceZ(stage, 0) - motion.z);
  const belowBefore = f32(below + motion.deltaZ);
  return below > box.lowest && belowBefore < box.highest ? side : 0;
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
  f.dodge.airDodging = false;
  f.dodge.airFrame = 0;
  f.dodge.airMotionFrames = 0;
  f.jump.remaining = 1;
  motion.dropTime = 0;
  f.landing.lCancelWindow = 0;
  clearTech(f);
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
        clearLedge(f);
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
    clearLedge(f);
  }
}
