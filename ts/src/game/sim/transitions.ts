// State transitions every system shares: starting attacks, entering down
// states, and ending or interrupting actions. Grab links are the only state
// that spans fighters, so clearing them takes the roster.
import { clearTechInput } from "../physics/techInput";
import { max } from "../../runtime/numbers";
import { AttackStyle, DASH_GRAB_REQUEST, DownState, GrabAction, HippogryphKind, LedgeState, ProjectileKind, SpecialAction, SurfaceContact } from "./codes";
import { isTumbling } from "./conditions";
import { type Fighter, SHIELD_POWERSHIELD_INPUT_WINDOW_FRAMES } from "./fighter";
import { clearDash } from "./groundMovement";
import { DOWN_ATTACK_FRAMES, attackDurationFramesForGrounding, isSmashAttack } from "./moves";
import type { Roster } from "./roster";
import { clearShieldBreak } from "./shield";

export const LEDGE_REGRAB_FRAMES = 30;

export function clearSurfaceRecovery(f: Fighter): void {
  const recovery = f.surfaceRecovery;
  recovery.state = SurfaceContact.none;
  recovery.frame = 0;
  recovery.velocityApplied = false;
  recovery.wallJumpQueued = false;
  recovery.wallJumpRepeat = 0;
}

export function clearDownState(f: Fighter): void {
  const { down } = f;
  down.state = DownState.none;
  down.frame = 0;
  down.direction = 0;
  down.waitRemaining = 0;
  down.faceUp = true;
  down.attackQueued = false;
  clearSurfaceRecovery(f);
}

export function clearTech(f: Fighter): void {
  const { tech } = f;
  tech.window = 0;
  clearTechInput(tech);
}

export function clearLedge(f: Fighter): void {
  const { ledge } = f;
  ledge.state = LedgeState.none;
  ledge.side = 0;
  ledge.frame = 0;
  ledge.intangible = 0;
}

export function leaveLedge(f: Fighter): void {
  clearLedge(f);
  f.ledge.regrab = LEDGE_REGRAB_FRAMES;
}

function clearShieldTimers(f: Fighter): void {
  f.shield.reflectFrames = 0;
  f.shield.perfectFrames = 0;
  f.shield.perfectActionFrames = 0;
}

/** Drops a raised shield and its powershield timers. */
function lowerShield(f: Fighter): void {
  f.shield.raised = false;
  f.shield.heldFrames = 0;
  clearShieldTimers(f);
}

export function cancelAttack(f: Fighter): void {
  const { attack } = f;
  f.motion.crouching = false;
  attack.dashGrab = false;
  attack.style = undefined;
  attack.frame = 0;
  attack.duration = 0;
  attack.hit = false;
  attack.cooldown = 0;
  attack.smashCharging = false;
  attack.smashChargeFrames = 0;
  attack.smashChargeAllowed = false;
}

/** Ends the special action; spawned cover and bears outlive it, a mount does not. */
export function cancelSpecialState(f: Fighter): void {
  const { special, hippogryph } = f;
  special.fall = false;
  special.action = SpecialAction.none;
  special.frame = 0;
  special.duration = 0;
  special.lockFrames = 0;
  if (hippogryph.kind === HippogryphKind.mount) {
    hippogryph.life = 0;
    hippogryph.kind = HippogryphKind.none;
  }
}

/** Losing a stock removes every special, summon and projectile the fighter owns. */
export function clearSpecialOnStock(f: Fighter): void {
  cancelSpecialState(f);
  const { special, bear, hippogryph } = f;
  special.fall = false;
  special.hit = false;
  bear.life = 0;
  bear.swipeCooldown = 0;
  hippogryph.life = 0;
  hippogryph.kind = HippogryphKind.none;
  for (let action = 0; action < special.cooldowns.length; action++) special.cooldowns[action] = 0;
  special.direction = 0;
  bear.x = 0.0;
  bear.z = 0.0;
  bear.velocityX = 0.0;
  bear.velocityZ = 0.0;
  bear.hitSerial = 0;
  bear.surface = undefined;
  hippogryph.x = 0.0;
  hippogryph.z = 0.0;
  hippogryph.velocityX = 0.0;
  hippogryph.velocityZ = 0.0;
  for (const projectile of f.projectiles) {
    projectile.life = 0;
    projectile.x = 0.0;
    projectile.z = 0.0;
    projectile.direction = 0;
    projectile.kind = ProjectileKind.blaster;
    projectile.visualFamily = f.character;
    projectile.velocityX = 0.0;
    projectile.velocityZ = 0.0;
    projectile.serial = 0;
    projectile.damageMultiplier = 1.0;
    projectile.newlyReflected = false;
  }
}

export function clearOwnedFreezeTrap(f: Fighter): void {
  const trap = f.freezeTrap;
  trap.life = 0;
  trap.arming = 0;
  trap.x = 0.0;
  trap.z = 0.0;
  trap.surface = undefined;
}

/** A hit, grab or shield break stops jumps, dodges, dashes and ledge hangs in progress. */
export function interruptJumpOrDodge(f: Fighter): void {
  const { jump, dodge, shield } = f;
  f.motion.fastFalling = false;
  f.motion.crouching = false;
  clearDash(f);
  if (f.ledge.state !== LedgeState.none) leaveLedge(f);
  clearShieldBreak(f);
  shield.triggerWasActive = false;
  shield.triggerAge = SHIELD_POWERSHIELD_INPUT_WINDOW_FRAMES;
  clearShieldTimers(f);
  jump.squat = 0;
  jump.dodgeQueued = false;
  jump.dodgeX = 0;
  jump.dodgeZ = 0;
  jump.held = false;
  dodge.airDodging = false;
  dodge.airMotionFrames = 0;
  dodge.airFrame = 0;
  dodge.groundFrame = 0;
  dodge.groundDirection = 0;
  dodge.groundEntryFacing = 0;
}

/** Breaks the fighter's grab links from both ends. */
export function clearGrabLinks(world: Roster, slot: number): void {
  const f = world.fighters[slot];
  if (f === undefined) return;
  const { grab } = f;
  const owner = grab.owner === undefined ? undefined : world.fighters[grab.owner];
  const target = grab.target === undefined ? undefined : world.fighters[grab.target];
  grab.owner = undefined;
  grab.target = undefined;
  grab.grabbedFrames = 0;
  grab.action = GrabAction.none;
  grab.frame = 0;
  grab.mashX = 0;
  grab.mashZ = 0;
  if (owner !== undefined && owner.grab.target === slot) {
    owner.grab.target = undefined;
    owner.grab.action = GrabAction.none;
    owner.grab.frame = 0;
  }
  if (target !== undefined && target.grab.owner === slot) {
    target.grab.owner = undefined;
    target.grab.grabbedFrames = 0;
    target.grab.mashX = 0;
    target.grab.mashZ = 0;
  }
}

export function beginGrabAction(owner: Fighter, action: GrabAction): void {
  owner.grab.action = action;
  owner.grab.frame = 1;
  owner.grab.serial++;
}

/** Lands the fighter in a down state; bound and floor techs keep their sliding launch. */
export function beginDownState(f: Fighter, state: DownState, direction: number): void {
  const { motion, launch, down, attack } = f;
  motion.fastFalling = false;
  motion.crouching = false;
  f.ground.dashGrabWindow = 0;
  attack.dashGrab = false;
  clearSurfaceRecovery(f);
  down.state = state;
  down.frame = 1;
  down.direction = direction;
  if (state !== DownState.damage) down.waitRemaining = 0;
  down.attackQueued = false;
  motion.vx = 0.0;
  motion.vz = 0.0;
  if (state !== DownState.bound && state !== DownState.tech && state !== DownState.techRoll) {
    launch.knockbackX = 0.0;
    launch.groundKnockbackX = 0.0;
  }
  launch.knockbackZ = 0.0;
  lowerShield(f);
  motion.grounded = true;
  if (state === DownState.attack) {
    attack.style = AttackStyle.getupAttack;
    attack.frame = 0;
    attack.duration = DOWN_ATTACK_FRAMES;
    attack.serial++;
    attack.hit = false;
    attack.smashCharging = false;
    attack.smashChargeFrames = 0;
    attack.smashChargeAllowed = false;
    attack.cooldown = DOWN_ATTACK_FRAMES;
  }
}

/** A weak hit on a lying fighter: it stays down and restarts its wait from the hitstun. */
export function beginDownDamage(f: Fighter, hitstunFrames: number): void {
  const { motion, launch, down } = f;
  clearSurfaceRecovery(f);
  down.state = DownState.damage;
  down.frame = 1;
  down.waitRemaining = max(0, hitstunFrames);
  down.attackQueued = false;
  launch.hitstun = max(0, hitstunFrames);
  launch.throwHitstun = false;
  launch.diPending = false;
  launch.diLaunchSpeed = 0.0;
  motion.vx = 0.0;
  motion.vz = 0.0;
  launch.knockbackX = 0.0;
  launch.groundKnockbackX = 0.0;
  launch.knockbackZ = 0.0;
  motion.grounded = true;
  lowerShield(f);
}

/** Starts an attack; DASH_GRAB_REQUEST starts a grab with the actor's dash-grab timing. */
export function beginAttack(attacker: Fighter, style: AttackStyle, mayCharge: boolean): void {
  const isDashGrab = style === DASH_GRAB_REQUEST;
  const resolvedStyle = isDashGrab ? AttackStyle.grab : style;
  const { shield, attack } = attacker;
  shield.releaseLag = 0;
  shield.perfectActionFrames = 0;
  shield.reflectFrames = 0;
  shield.perfectFrames = 0;
  attacker.surfaceRecovery.state = SurfaceContact.none;
  attacker.surfaceRecovery.frame = 0;
  attacker.motion.crouching = false;
  clearDash(attacker);
  if (isTumbling(attacker)) clearDownState(attacker);
  if (resolvedStyle === AttackStyle.grab && shield.raised) {
    shield.raised = false;
    shield.heldFrames = 0;
  }
  attack.style = resolvedStyle;
  attack.dashGrab = isDashGrab;
  attack.frame = 0;
  attack.duration = isDashGrab ? attacker.tuning.dashGrab.totalFrames : attackDurationFramesForGrounding(resolvedStyle, attacker.motion.grounded);
  attack.serial++;
  attack.hit = false;
  attack.smashCharging = false;
  attack.smashChargeFrames = 0;
  attack.smashChargeAllowed = isSmashAttack(resolvedStyle) && mayCharge;
  attack.cooldown = attack.duration;
}
