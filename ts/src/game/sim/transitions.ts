// State transitions every system shares: starting attacks, entering down
// states, and ending or interrupting actions. Grab links are the only state
// that spans fighters, so clearing them takes the roster.
import { clearTechInput } from "../physics/techInput";
import { at } from "wisp/src/runtime/lookup";
import { mutableProjectile } from "./fighterProjectiles";
import { max } from "../../runtime/numbers";
import { AttackStyle, DASH_GRAB_REQUEST, DownState, GrabAction, HippogryphKind, LedgeState, PlatformMove, ProjectileKind, SpecialAction, SurfaceContact } from "./codes";
import { isTumbling } from "./conditions";
import { type Fighter, SHIELD_POWERSHIELD_INPUT_WINDOW_FRAMES } from "./fighter";
import { clearDash } from "./groundMovement";
import { clearMash } from "./mash";
import { DOWN_ATTACK_FRAMES, attackDurationFramesForGrounding, isSmashAttack } from "./moves";
import type { Roster } from "./roster";
import { clearPowershield, clearShieldBreak } from "./shield";

export const LEDGE_REGRAB_FRAMES = 30;
// A response at the 15-frame reaction floor completes the longest jump squat
// (5 frames) before the next trap check may catch the fighter.
const FREEZE_IMMUNITY_FRAMES = 20;
/** However fast a frozen fighter mashes, the freeze lasts this long, so a trap sprung near Rifleman still gives him a follow-up. */
export const FREEZE_MINIMUM_FRAMES = 60;

/** Natural thaw, a mash-out and hits that break ice grant the same finite trap escape interval. */
export function thawFighter(f: Fighter): void {
  if (f.status.frozenFrames <= 0) return;
  f.status.frozenFrames = 0;
  f.status.freezeImmunityFrames = FREEZE_IMMUNITY_FRAMES;
  clearMash(f.grab);
}

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

/** Drops a raised shield and its powershield timers. */
function lowerShield(f: Fighter): void {
  f.shield.raised = false;
  f.shield.tiltX = 0.0;
  f.shield.tiltZ = 0.0;
  f.shield.heldFrames = 0;
  clearPowershield(f);
}

export function cancelAttack(f: Fighter): void {
  const { attack } = f;
  f.motion.crouching = false;
  attack.dashGrab = false;
  attack.pivotGrab = false;
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
  // A hero marker that has not become active ends with its interrupted cast.
  if (special.action >= SpecialAction.heroNeutral) {
    for (let index = 0; index < f.projectiles.length; index++) {
      const projectile = at(f.projectiles, index);
      const spec = projectile.spec;
      if (projectile.life > 0 && spec?.cancelOnInterrupt === true && spec.life - projectile.life < (spec.activeFrom ?? 0)) mutableProjectile(f, index).life = 0;
    }
  }
  special.fall = false;
  special.ex = false;
  special.exArmorUsed = false;
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
  bear.exDamage = false;
  f.placed.life = 0;
  for (const animal of f.pack) animal.life = 0;
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
  for (let index = 0; index < f.projectiles.length; index++) {
    const projectile = mutableProjectile(f, index);
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
    projectile.longRifle = false;
    projectile.exReach = false;
    projectile.spec = undefined;
  }
  special.form = 0;
  special.aimX = 0;
  special.aimZ = 0;
  special.airtimeUses = 0;
}

export function clearOwnedFreezeTrap(f: Fighter): void {
  const trap = f.freezeTrap;
  trap.life = 0;
  trap.exReach = false;
  trap.arming = 0;
  trap.x = 0.0;
  trap.z = 0.0;
  trap.surface = undefined;
}

/** Ends a move through a platform where the fighter is, with its latched inputs. */
export function clearPlatformMove(f: Fighter): void {
  const p = f.platform;
  p.move = PlatformMove.none;
  p.frame = 0;
  p.duration = 0;
  p.deck = undefined;
  p.fromX = 0.0;
  p.toX = 0.0;
  p.fromZ = 0.0;
  p.toZ = 0.0;
  p.rise = 0.0;
  p.stand = false;
  p.shield = false;
  p.wrapLeft = 0;
  p.wrapLeftAge = 0;
  p.wrapRight = 0;
  p.wrapRightAge = 0;
  p.dodgeQueued = false;
  p.dodgeX = 0;
  p.dodgeZ = 0;
  p.specialQueued = false;
  p.specialX = 0;
  p.specialZ = 0;
}

/** A hit, grab or shield break stops jumps, dodges, dashes, ledge hangs and platform moves in progress. */
export function interruptJumpOrDodge(f: Fighter): void {
  const { jump, dodge, shield } = f;
  clearPlatformMove(f);
  f.motion.fastFalling = false;
  f.motion.crouching = false;
  clearDash(f);
  if (f.ledge.state !== LedgeState.none) leaveLedge(f);
  clearShieldBreak(f);
  shield.triggerWasActive = false;
  shield.triggerAge = SHIELD_POWERSHIELD_INPUT_WINDOW_FRAMES;
  clearPowershield(f);
  jump.squat = 0;
  jump.dodgeQueued = false;
  jump.dodgeX = 0;
  jump.dodgeZ = 0;
  jump.held = false;
  dodge.airDodging = false;
  dodge.airMotionFrames = 0;
  dodge.airFrame = 0;
  dodge.airUsed = false;
  refreshOriginalAirtime(f);
  dodge.groundFrame = 0;
  dodge.groundDirection = 0;
  dodge.groundEntryFacing = 0;
}

/** A hit, grab or ledge catch lets an original fighter use its once-per-airtime specials again (Archer's ride). */
export function refreshOriginalAirtime(f: Fighter): void {
  if (f.tuning.specials === undefined) f.special.airtimeUses = 0;
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
  grab.heldFrames = 0;
  grab.queuedThrow = GrabAction.none;
  grab.action = GrabAction.none;
  grab.frame = 0;
  grab.mashX = 0;
  grab.mashZ = 0;
  if (owner !== undefined && owner.grab.target === slot) {
    owner.grab.target = undefined;
    owner.grab.queuedThrow = GrabAction.none;
    owner.grab.action = GrabAction.none;
    owner.grab.frame = 0;
  }
  if (target !== undefined && target.grab.owner === slot) {
    target.grab.owner = undefined;
    target.grab.grabbedFrames = 0;
    target.grab.heldFrames = 0;
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
  attack.pivotGrab = false;
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
  endDivineShield(attacker);
  const isDashGrab = style === DASH_GRAB_REQUEST;
  const resolvedStyle = isDashGrab ? AttackStyle.grab : style;
  const { shield, attack } = attacker;
  shield.releaseLag = 0;
  clearPowershield(attacker);
  attacker.surfaceRecovery.state = SurfaceContact.none;
  attacker.surfaceRecovery.frame = 0;
  attacker.motion.crouching = false;
  clearDash(attacker);
  if (isTumbling(attacker)) clearDownState(attacker);
  if (resolvedStyle === AttackStyle.grab && shield.raised) {
    shield.raised = false;
    shield.heldFrames = 0;
  }
  if (resolvedStyle === AttackStyle.grab) {
    attacker.jump.squat = 0;
    attacker.jump.dodgeQueued = false;
    attacker.jump.dodgeX = 0;
    attacker.jump.dodgeZ = 0;
  }
  attack.style = resolvedStyle;
  attack.dashGrab = isDashGrab;
  attack.pivotGrab = false;
  attack.frame = 0;
  const authoredGrab = attacker.tuning.moves?.normals[AttackStyle.grab];
  attack.duration = isDashGrab
    ? authoredGrab === undefined ? attacker.tuning.dashGrab.totalFrames : authoredGrab.totalFrames + 11
    : attackDurationFramesForGrounding(resolvedStyle, attacker.motion.grounded, attacker.tuning.moves);
  attack.serial++;
  attack.hit = false;
  attack.smashCharging = false;
  attack.smashChargeFrames = 0;
  attack.smashChargeAllowed = isSmashAttack(resolvedStyle) && mayCharge;
  attack.cooldown = attack.duration;
  if (attacker.tuning.moves?.normals[resolvedStyle]?.startupTravelX !== undefined) attacker.motion.vx = 0.0;
}

/** Starting an attack, a special or a grab drops Divine Shield and the intangibility it gave. */
export function endDivineShield(f: Fighter): void {
  if (f.status.divineFrames <= 0) return;
  f.status.divineFrames = 0;
  f.status.invincible = 0;
}
