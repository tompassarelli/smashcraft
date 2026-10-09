
import { max } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, ContactKind, GrabAction, SpecialAction } from "./codes";
import { canBeGrabbed } from "./conditions";
import { collectDamageContact } from "./contacts";
import type { Fighter } from "./fighter";
import { clearDash } from "./groundMovement";
import type { AppliedStatus } from "./heroStatus";
import type { HitEffect } from "./hitRegions";
import { GRAB_HOLD_FRAMES } from "./moves";
import { type Roster, fighterAt } from "./roster";
import { beginGrabAction, cancelAttack, cancelSpecialState, clearDownState, clearGrabLinks, interruptJumpOrDodge } from "./transitions";

function stopMotion(f: Fighter): void {
  f.motion.vx = 0.0;
  f.motion.vz = 0.0;
  f.launch.knockbackX = 0.0;
  f.launch.groundKnockbackX = 0.0;
  f.launch.knockbackZ = 0.0;
}


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


export function applyAttackHit(
  world: Roster, attackerSlot: number, targetSlot: number, style: AttackStyle, facing: number,
  effect: Readonly<HitEffect>, directContact: boolean, shieldContact: boolean, status?: Readonly<AppliedStatus>, contactZ?: number,
): void {
  const target = fighterAt(world, targetSlot);
  if (style === AttackStyle.grab) {
    if (canBeGrabbed(target)) catchTarget(world, attackerSlot, targetSlot);
    return;
  }
  collectDamageContact(world, attackerSlot, targetSlot, effect, facing, ContactKind.launch, directContact, undefined, shieldContact, status, contactZ);
}
