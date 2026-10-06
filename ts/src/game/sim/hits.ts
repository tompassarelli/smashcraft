// Applying a selected hit: Demon Hunter parries, grab catches, and damage
// contacts for everything else.
import { max } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, ContactKind, GrabAction, SpecialAction } from "./codes";
import { canBeGrabbed } from "./conditions";
import { collectDamageContact } from "./contacts";
import type { Fighter } from "./fighter";
import { clearDash } from "./groundMovement";
import type { HitEffect } from "./hitRegions";
import { GRAB_HOLD_FRAMES } from "./moves";
import { type Roster, fighterAt } from "./roster";
import { beginGrabAction, cancelAttack, cancelSpecialState, clearDownState, clearGrabLinks, interruptJumpOrDodge } from "./transitions";

export const DEMONHUNTER_PARRY_START = 4;
export const DEMONHUNTER_PARRY_END = 9;

export function demonHunterParryIsActive(fighter: Fighter): boolean {
  const { special } = fighter;
  return fighter.character === Character.demonHunter && special.action === SpecialAction.demonHunterParryStep
    && special.frame >= DEMONHUNTER_PARRY_START && special.frame <= DEMONHUNTER_PARRY_END;
}

/**
 * Original parry choice: a strike during the parry's frames 4-9 cancels the
 * attacker and gives 10 hitstun and 4 hitlag. Projectiles are not reflected.
 */
export function resolveDemonHunterParry(defender: Fighter, attacker: Fighter, awayDirection: number): void {
  if (!demonHunterParryIsActive(defender)) return;
  cancelAttack(attacker);
  cancelSpecialState(attacker);
  const { launch, motion } = attacker;
  launch.hitstun = max(launch.hitstun, 10);
  launch.throwHitstun = false;
  launch.hitlag = max(launch.hitlag, 4);
  motion.grounded = false;
  motion.vx = 0.0;
  motion.vz = 0.0;
  launch.knockbackX = f32(awayDirection * 9.0);
  launch.knockbackZ = 4.0;
  defender.visuals.parry++;
  defender.special.action = SpecialAction.none;
  defender.special.frame = 0;
  defender.special.lockFrames = 0;
}

function stopMotion(f: Fighter): void {
  f.motion.vx = 0.0;
  f.motion.vz = 0.0;
  f.launch.knockbackX = 0.0;
  f.launch.groundKnockbackX = 0.0;
  f.launch.knockbackZ = 0.0;
}

/** Links a grab: the attacker holds, and the target loses every action in progress. */
function catchTarget(world: Roster, attackerSlot: number, targetSlot: number): void {
  const attacker = fighterAt(world, attackerSlot);
  const target = fighterAt(world, targetSlot);
  clearGrabLinks(world, attackerSlot);
  clearGrabLinks(world, targetSlot);
  attacker.grab.target = targetSlot;
  attacker.grab.pummels = 0;
  attacker.grab.queuedThrow = GrabAction.none;
  target.grab.owner = attackerSlot;
  target.visuals.grab++;
  cancelAttack(attacker);
  beginGrabAction(attacker, GrabAction.hold);
  clearDash(attacker);
  stopMotion(attacker);
  target.launch.diPending = false;
  target.launch.diLaunchSpeed = 0.0;
  interruptJumpOrDodge(target);
  clearDownState(target);
  cancelAttack(target);
  target.grab.grabbedFrames = GRAB_HOLD_FRAMES;
  target.grab.heldFrames = 0;
  target.launch.hitstun = 0;
  target.launch.throwHitstun = false;
  target.launch.hitlag = 0;
  cancelSpecialState(target);
  target.shield.raised = false;
  target.shield.stun = 0;
  stopMotion(target);
}

/** Applies a selected strike: a parry turns it back, an eligible grab catches. */
export function applyAttackHit(
  world: Roster, attackerSlot: number, targetSlot: number, style: AttackStyle, facing: number,
  effect: Readonly<HitEffect>, directContact: boolean, shieldContact: boolean,
): void {
  const target = fighterAt(world, targetSlot);
  if (demonHunterParryIsActive(target)) {
    resolveDemonHunterParry(target, fighterAt(world, attackerSlot), -facing);
    return;
  }
  if (style === AttackStyle.grab) {
    if (canBeGrabbed(target)) catchTarget(world, attackerSlot, targetSlot);
    return;
  }
  collectDamageContact(world, attackerSlot, targetSlot, effect, facing, ContactKind.launch, directContact, undefined, shieldContact);
}
