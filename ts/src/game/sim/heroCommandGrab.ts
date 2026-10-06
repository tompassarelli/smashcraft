// A hero special's command grab (heroSpecials.ts CommandGrab): catch through
// the shared grab link, hold, then release as a throw. Every value it changes
// is fighter state, so rollback restores it with the fighters.
import { f32 } from "wisp/src/sim/f32";
import { emptyCapsule, placeCapsule } from "../physics/contactGeometry";
import { ContactKind } from "./codes";
import { canBeGrabbed, inGrabContext, isIntangible } from "./conditions";
import { queueDamageContact } from "./contacts";
import type { Fighter } from "./fighter";
import { runningHeroSpecial } from "./heroSpecialRules";
import { grabTouchesBody } from "./hurtboxes";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { type Roster, fighterAt, isActive } from "./roster";
import { cancelAttack, cancelSpecialState, clearDownState, clearGrabLinks, interruptJumpOrDodge } from "./transitions";

// Preallocated: rollback replays test the catch every frame of its window.
const strike = emptyCapsule();

function stopMotion(f: Fighter): void {
  f.motion.vx = 0.0;
  f.motion.vz = 0.0;
  f.launch.knockbackX = 0.0;
  f.launch.groundKnockbackX = 0.0;
  f.launch.knockbackZ = 0.0;
}

/** The nearest body the strike latches, ties to the lower slot; shields do not stop it. */
function caughtTarget(world: Roster, slot: number, owner: Readonly<Fighter>): number | undefined {
  let best: number | undefined;
  let bestDistance = 0.0;
  for (let target = 0; target < PARTICIPANT_CAPACITY; target++) {
    if (target === slot || !isActive(world, target)) continue;
    const victim = fighterAt(world, target);
    if (victim.status.out || (isIntangible(victim) && victim.status.divineFrames <= 0) || !canBeGrabbed(victim) || inGrabContext(victim)) continue;
    if (!grabTouchesBody(strike, victim)) continue;
    const distance = Math.abs(f32(victim.motion.x - owner.motion.x));
    if (best === undefined || distance < bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }
  return best;
}

/** Links the pair as an ordinary grab does, without the holder's pummel and throw choices. */
function latch(world: Roster, slot: number, targetSlot: number, holdFrames: number): void {
  const owner = fighterAt(world, slot);
  const target = fighterAt(world, targetSlot);
  clearGrabLinks(world, targetSlot);
  owner.grab.target = targetSlot;
  target.grab.owner = slot;
  target.grab.grabbedFrames = holdFrames + 1;
  target.visuals.grab++;
  stopMotion(owner);
  target.launch.diPending = false;
  target.launch.diLaunchSpeed = 0.0;
  interruptJumpOrDodge(target);
  clearDownState(target);
  cancelAttack(target);
  target.launch.hitstun = 0;
  target.launch.throwHitstun = false;
  target.launch.hitlag = 0;
  cancelSpecialState(target);
  target.shield.raised = false;
  target.shield.stun = 0;
  stopMotion(target);
}

/** One frame of the slot's command grab, after its special frame advanced. */
export function advanceHeroCommandGrab(world: Roster, slot: number): void {
  const owner = fighterAt(world, slot);
  const grab = runningHeroSpecial(owner)?.commandGrab;
  if (grab === undefined) return;
  const { special } = owner;
  const frame = special.frame;
  if (special.grabFrame === 0) {
    if (frame < grab.first || frame > grab.last || owner.launch.hitlag > 0 || inGrabContext(owner)) return;
    placeCapsule(strike, grab.strike, owner.motion.x, owner.motion.z, owner.facing);
    const target = caughtTarget(world, slot, owner);
    if (target === undefined) return;
    special.grabFrame = frame;
    latch(world, slot, target, grab.holdFrames);
    return;
  }
  if (frame !== special.grabFrame + grab.holdFrames) return;
  const targetSlot = owner.grab.target;
  // A hold an external hit already broke releases nothing.
  if (targetSlot === undefined || fighterAt(world, targetSlot).grab.owner !== slot) return;
  clearGrabLinks(world, slot);
  const target = fighterAt(world, targetSlot);
  queueDamageContact(world, slot, targetSlot, grab.effect, owner.facing, ContactKind.throw, true, undefined);
  target.motion.grounded = false;
  target.motion.surface = undefined;
}
