// Conditions over a fighter's state that every system tests: what the fighter
// is doing, whether it can be hit, and whether it may start an action.
import { AttackPhase, AttackStyle, DASH_GRAB_REQUEST, DownState, GrabAction, LedgeState, PlatformMove, ShieldBreak, SurfaceContact } from "./codes";
import type { Fighter } from "./fighter";
import { attackStartupFrames, characterAttackActiveFrames, jabChainFrom, nextJab } from "./moves";

export const GROUND_ROLL_FRAMES = 31;
export const GROUND_ROLL_INTANGIBLE_START = 4;
const GROUND_ROLL_INTANGIBLE_END = 19;
export const SPOT_DODGE_FRAMES = 22;
export const SPOT_DODGE_INTANGIBLE_START = 2;
export const SPOT_DODGE_INTANGIBLE_END = 15;
// EscapeAir processes animation frame one before entry physics; frame 30 resumes air physics.
const AIR_DODGE_INTANGIBLE_START = 4;
const AIR_DODGE_INTANGIBLE_END = 29;
export const DOWN_RECOVERY_INTANGIBLE_FRAMES = 20;
export const DOWN_ROLL_INTANGIBLE_FRAMES_BACK_UP = 23;
export const DOWN_ROLL_INTANGIBLE_FRAMES_BACK_DOWN = 20;
export const DOWN_ATTACK_INTANGIBLE_FRAMES_UP = 27;
export const DOWN_ATTACK_INTANGIBLE_FRAMES_DOWN = 22;
export const TECH_INTANGIBLE_FRAMES = 20;
export const TECH_ROLL_INTANGIBLE_FRAMES = 34;
export const WALL_TECH_STARTUP_FRAMES = 5;

export function isTumbling(f: Fighter): boolean {
  return f.down.state === DownState.tumble;
}

export function isFloorTeching(f: Fighter): boolean {
  return f.down.state === DownState.tech || f.down.state === DownState.techRoll;
}

/** Lying on the floor where a weak hit jab-resets instead of launching. */
export function isDownDamageState(f: Fighter): boolean {
  const { state } = f.down;
  return f.motion.grounded && (state === DownState.bound || state === DownState.wait || state === DownState.damage);
}

export function isGroundDodging(f: Fighter): boolean {
  return f.dodge.groundFrame > 0;
}

export function isForwardGroundRoll(f: Fighter): boolean {
  return f.dodge.groundDirection !== 0 && f.dodge.groundDirection === f.dodge.groundEntryFacing;
}

/** Rolls keep their entry orientation until they end. */
export function fighterPoseFacing(f: Fighter): number {
  return isGroundDodging(f) ? f.dodge.groundEntryFacing : f.facing;
}

export function inGrabContext(f: Readonly<Fighter>): boolean {
  const { grab } = f;
  return grab.owner !== undefined || grab.target !== undefined || grab.action !== GrabAction.none || grab.grabbedFrames > 0;
}

/** Throws permit follow-up strikes, but no regrab before their hitstun ends. */
export function canBeGrabbed(f: Readonly<Fighter>): boolean {
  return f.status.frozenFrames <= 0 && !(f.launch.throwHitstun && f.launch.hitstun > 0);
}

/** Early in a ground jump's ascent, where a grab still reaches it at the deck it left (#107). */
export function inEarlyAscent(f: Readonly<Fighter>): boolean {
  return f.jump.ascent > 0 && !f.motion.grounded && f.launch.hitstun <= 0 && f.status.frozenFrames <= 0;
}

/** A wall tech's startup and a ceiling tech lock out jumps, dodges and attacks. */
export function inSurfaceTechStartup(f: Fighter): boolean {
  const { state, frame } = f.surfaceRecovery;
  return state === SurfaceContact.techCeiling || (state === SurfaceContact.techWall && frame < WALL_TECH_STARTUP_FRAMES);
}

export function isIntangible(f: Fighter): boolean {
  if (f.ledge.state !== LedgeState.none && f.ledge.intangible > 0) return true;
  const { dodge, down } = f;
  const groundDodgeIntangible = dodge.groundFrame > 0 && (
    (dodge.groundDirection === 0 && dodge.groundFrame >= SPOT_DODGE_INTANGIBLE_START && dodge.groundFrame <= SPOT_DODGE_INTANGIBLE_END)
    || (dodge.groundDirection !== 0 && dodge.groundFrame >= GROUND_ROLL_INTANGIBLE_START && dodge.groundFrame <= GROUND_ROLL_INTANGIBLE_END));
  const downRollIntangibleFrames = down.direction !== 0 && down.direction !== f.facing
    ? (down.faceUp ? DOWN_ROLL_INTANGIBLE_FRAMES_BACK_UP : DOWN_ROLL_INTANGIBLE_FRAMES_BACK_DOWN)
    : DOWN_RECOVERY_INTANGIBLE_FRAMES;
  const downRecoveryIntangible = down.frame > 0 && (
    (down.state === DownState.stand && down.frame <= DOWN_RECOVERY_INTANGIBLE_FRAMES)
    || (down.state === DownState.roll && down.frame <= downRollIntangibleFrames)
    || (down.state === DownState.attack && down.frame <= (down.faceUp ? DOWN_ATTACK_INTANGIBLE_FRAMES_UP : DOWN_ATTACK_INTANGIBLE_FRAMES_DOWN)));
  const techIntangible = isFloorTeching(f) && down.frame >= 1
    && down.frame <= (down.state === DownState.tech ? TECH_INTANGIBLE_FRAMES : TECH_ROLL_INTANGIBLE_FRAMES);
  const ceilingTechIntangible = f.surfaceRecovery.state === SurfaceContact.techCeiling && f.surfaceRecovery.frame < f.tuning.tech.ceilingImpulseFrame;
  // Melee's barrel makes the fighter it holds intangible (ftCo_BarrelWait.c ftCo_8009EB18, x1988 = 2).
  return f.status.invincible > 0 || f.cannon.held !== undefined || groundDodgeIntangible || downRecoveryIntangible || techIntangible || ceilingTechIntangible
    || (dodge.airDodging && dodge.airFrame >= AIR_DODGE_INTANGIBLE_START && dodge.airFrame <= AIR_DODGE_INTANGIBLE_END);
}

function canStartAttack(attacker: Fighter): boolean {
  if (inSurfaceTechStartup(attacker)) return false;
  const { grab, shield } = attacker;
  if (grab.target !== undefined || grab.action !== GrabAction.none) return false;
  if (attacker.status.frozenFrames > 0) return false;
  if (attacker.ledge.state !== LedgeState.none || attacker.cannon.held !== undefined || attacker.platform.move !== PlatformMove.none) return false;
  return !attacker.status.out && !attacker.special.fall && attacker.special.lockFrames <= 0 && shield.breakState === ShieldBreak.none
    && (attacker.down.state === DownState.none || isTumbling(attacker)) && grab.grabbedFrames <= 0
    && attacker.launch.hitlag <= 0 && attacker.launch.hitstun <= 0 && shield.stun <= 0 && shield.releaseLag <= 0
    && attacker.landing.lag <= 0 && !attacker.dodge.airDodging && !isGroundDodging(attacker) && attacker.jump.squat <= 0
    && attacker.attack.cooldown <= 0;
}

export function canAttack(attacker: Fighter): boolean {
  return canStartAttack(attacker) && !attacker.shield.raised && attacker.status.frozenFrames <= 0;
}

export function canShieldGrab(attacker: Fighter): boolean {
  return canStartAttack(attacker) && attacker.shield.raised && attacker.motion.grounded && !attacker.shield.drainResumePending;
}

/**
 * The jab a fresh jab press starts now by continuing the fighter's jab chain
 * (#163), or undefined: a grounded jab or second jab, out of hitlag, inside
 * its chain window. A press during hitlag or earlier in the jab waits in the
 * attack buffer for the window, as Melee latches it (ftCo_Attack1.c).
 */
export function jabChainStep(f: Readonly<Fighter>): AttackStyle | undefined {
  const { attack } = f;
  const next = nextJab(attack.style);
  if (next === undefined || attack.style === undefined || attack.dashGrab || !f.motion.grounded || f.launch.hitlag > 0 || f.status.frozenFrames > 0) return undefined;
  const from = jabChainFrom(f.character, attack.style, f.tuning.moves);
  return from !== undefined && attack.frame >= from - 1 && attack.frame < attack.duration ? next : undefined;
}

/** Whether a requested action may start; DASH_GRAB_REQUEST asks for a dash or shield grab. */
export function canStartAttackStyle(attacker: Fighter, style: AttackStyle | undefined): boolean {
  if (style === AttackStyle.jab && jabChainStep(attacker) !== undefined) return true;
  const dashGrabs = attacker.tuning.dashGrab.startupFrames > 0;
  if (style === DASH_GRAB_REQUEST) {
    return attacker.motion.grounded && dashGrabs
      && ((attacker.ground.dashFrame > 0 && canAttack(attacker)) || (attacker.shield.raised && canShieldGrab(attacker)));
  }
  if (style === AttackStyle.grab && attacker.motion.grounded && attacker.ground.dashFrame > 0 && dashGrabs) return canAttack(attacker);
  return canAttack(attacker) || (style === AttackStyle.grab && canShieldGrab(attacker));
}

/** The started attack's frames before its first active frame; attack frame zero is the start tick. */
export function attackStartup(f: Readonly<Fighter>, style: AttackStyle): number {
  if (!f.attack.dashGrab) return attackStartupFrames(style, f.tuning.moves);
  const authoredGrab = f.tuning.moves?.normals[AttackStyle.grab];
  return authoredGrab === undefined ? f.tuning.dashGrab.startupFrames : authoredGrab.startupFrames + 3;
}

/** The started attack's active frames. */
export function attackActive(f: Readonly<Fighter>, style: AttackStyle): number {
  if (!f.attack.dashGrab) return characterAttackActiveFrames(f.character, style, f.tuning.moves);
  const authoredGrab = f.tuning.moves?.normals[AttackStyle.grab];
  return authoredGrab === undefined ? f.tuning.dashGrab.activeFrames : authoredGrab.activeFrames;
}

export function attackPhase(f: Fighter): AttackPhase {
  const { style, frame } = f.attack;
  if (style === undefined) return AttackPhase.none;
  const startup = attackStartup(f, style);
  if (frame < startup) return AttackPhase.startup;
  return frame < startup + attackActive(f, style) ? AttackPhase.active : AttackPhase.recovery;
}
