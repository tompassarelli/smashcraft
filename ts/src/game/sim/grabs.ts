// Holding a grabbed fighter: mash-out escapes, pummels and throws.
import { max, min } from "../../runtime/wurst";
import { f32 } from "../../sim/f32";
import { ContactKind, GrabAction } from "./codes";
import { finishDamageContacts, openDamageContacts, queueDamageContact } from "./contacts";
import { emptyHitEffect } from "./hitRegions";
import { GRAB_HOLD_DISTANCE, grabActionDuration, grabContactFrame } from "./moves";
import { INPUT_PARTICIPANT_CAPACITY } from "./participants";
import { type Controls, type Roster, controlsAt, fighterAt, isActive } from "./roster";
import { beginGrabAction, clearGrabLinks } from "./transitions";

const PUMMEL_HIT = { damage: 3.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } as const;
// Preallocated: a throw's effect depends on its direction; contacts copy it.
const throwHit = emptyHitEffect();

function escapeGrab(world: Roster, ownerSlot: number, targetSlot: number): void {
  clearGrabLinks(world, ownerSlot);
  beginGrabAction(fighterAt(world, ownerSlot), GrabAction.escape);
  fighterAt(world, targetSlot).launch.hitstun = 10;
}

function releaseThrow(world: Roster, ownerSlot: number, targetSlot: number, targetInput: Readonly<Controls>): void {
  const owner = fighterAt(world, ownerSlot);
  const target = fighterAt(world, targetSlot);
  const { action } = owner.grab;
  owner.grab.target = undefined;
  target.grab.owner = undefined;
  target.grab.grabbedFrames = 0;
  target.grab.mashX = 0;
  target.grab.mashZ = 0;
  const up = action === GrabAction.throwUp;
  const down = action === GrabAction.throwDown;
  throwHit.damage = up ? 6.0 : down ? 5.0 : 7.0;
  throwHit.growth = 70.0;
  throwHit.base = down ? 55.0 : 45.0;
  throwHit.launchX = up ? 0.17364799976348877 : down ? 0.3420200049877167 : 0.8660249710083008;
  throwHit.launchZ = up ? 0.9848080277442932 : down ? 0.9396929740905762 : 0.5;
  const direction = action === GrabAction.throwBack ? -owner.facing : owner.facing;
  queueDamageContact(world, ownerSlot, targetSlot, throwHit, direction, ContactKind.throw, false, targetInput);
  // Release changes ground-contact eligibility before later trap/catch checks.
  target.motion.grounded = false;
  target.motion.surface = undefined;
}

/** Holds the target at the grabber's hand, carried along a throw's arc; a broken hold releases. */
function resolveHeldTarget(world: Roster, ownerSlot: number): void {
  const owner = fighterAt(world, ownerSlot);
  const targetSlot = owner.grab.target;
  if (targetSlot === undefined) return;
  const target = fighterAt(world, targetSlot);
  if (owner.status.out || target.status.out || owner.status.frozenFrames > 0 || target.status.frozenFrames > 0
    || owner.launch.hitstun > 0 || target.grab.grabbedFrames <= 0 || target.grab.owner !== ownerSlot) {
    clearGrabLinks(world, ownerSlot);
    return;
  }
  owner.motion.vx = 0.0;
  owner.motion.vz = 0.0;
  owner.launch.knockbackX = 0.0;
  owner.launch.groundKnockbackX = 0.0;
  owner.launch.knockbackZ = 0.0;
  const held = target.motion;
  held.x = f32(owner.motion.x + f32(owner.facing * GRAB_HOLD_DISTANCE));
  held.z = owner.motion.z;
  const { action, frame } = owner.grab;
  if (action >= GrabAction.throwForward && action <= GrabAction.throwDown) {
    const progress = min(1.0, f32(f32(frame * 1.0) / grabContactFrame(action)));
    const swing = f32(f32(2 * progress) - 1);
    const arc = f32(1 - f32(swing * swing));
    if (action === GrabAction.throwBack) {
      held.x = f32(owner.motion.x + f32(f32(owner.facing * GRAB_HOLD_DISTANCE) * f32(1 - f32(2 * progress))));
      held.z = f32(held.z + f32(75 * arc));
    } else if (action === GrabAction.throwUp) {
      held.z = f32(held.z + f32(65 * progress));
    } else if (action === GrabAction.throwDown) {
      held.z = f32(held.z + f32(25 * arc));
    }
  }
  held.surface = owner.motion.surface;
  held.grounded = owner.motion.grounded;
  target.facing = -owner.facing;
  held.vx = 0.0;
  held.vz = 0.0;
  target.launch.knockbackX = 0.0;
  target.launch.groundKnockbackX = 0.0;
  target.launch.knockbackZ = 0.0;
}

function advanceGrab(world: Roster, ownerSlot: number, ownerInput: Readonly<Controls>, targetInput: Readonly<Controls>, paused: boolean): void {
  const owner = fighterAt(world, ownerSlot);
  const { grab } = owner;
  if (grab.action === GrabAction.none || paused) return;
  const targetSlot = grab.target;
  if (targetSlot !== undefined && (grab.action === GrabAction.hold || grab.action === GrabAction.pummel)) {
    const held = fighterAt(world, targetSlot).grab;
    let contributions = targetInput.grabMashPressed ? 1 : 0;
    const x = targetInput.direction === 0 ? held.mashX : targetInput.direction;
    const z = targetInput.verticalDirection === 0 ? held.mashZ : targetInput.verticalDirection;
    if (x !== held.mashX || z !== held.mashZ) contributions++;
    held.mashX = x;
    held.mashZ = z;
    held.grabbedFrames = max(0, held.grabbedFrames - 1 - 6 * contributions);
    if (held.grabbedFrames === 0) {
      escapeGrab(world, ownerSlot, targetSlot);
      return;
    }
  }
  if (grab.action === GrabAction.hold) {
    if (ownerInput.attackPressed) beginGrabAction(owner, GrabAction.pummel);
    else if (ownerInput.grabThrowZ !== 0) beginGrabAction(owner, ownerInput.grabThrowZ > 0 ? GrabAction.throwUp : GrabAction.throwDown);
    else if (ownerInput.grabThrowX !== 0) beginGrabAction(owner, ownerInput.grabThrowX === owner.facing ? GrabAction.throwForward : GrabAction.throwBack);
  } else if (grab.frame >= grabActionDuration(grab.action)) {
    grab.action = targetSlot === undefined ? GrabAction.none : GrabAction.hold;
    grab.frame = 0;
  } else {
    grab.frame++;
  }
  if (targetSlot !== undefined && grab.action >= GrabAction.pummel && grab.action <= GrabAction.throwDown && grab.frame === grabContactFrame(grab.action)) {
    resolveHeldTarget(world, ownerSlot);
    // A hold broken just now still delivers its contact, as a throw.
    if (grab.action === GrabAction.pummel) queueDamageContact(world, ownerSlot, targetSlot, PUMMEL_HIT, owner.facing, ContactKind.pummel, true, undefined);
    else releaseThrow(world, ownerSlot, targetSlot, targetInput);
  }
}

/** Advances every grab; hitlag on either end, captured beforehand, pauses it. */
export function advanceGrabs(world: Roster, controls: readonly Readonly<Controls>[]): void {
  const ownsBatch = openDamageContacts();
  for (let slot = 0; slot < INPUT_PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot)) continue;
    const target = fighterAt(world, slot).grab.target;
    const heldSlot = target !== undefined && isActive(world, target) ? target : undefined;
    const ownerInput = controlsAt(controls, slot);
    const targetInput = heldSlot === undefined ? ownerInput : controlsAt(controls, heldSlot);
    const paused = world.grabPaused[slot]! || (heldSlot !== undefined && world.grabPaused[heldSlot]!);
    advanceGrab(world, slot, ownerInput, targetInput, paused);
  }
  if (ownsBatch) finishDamageContacts(world);
}

export function captureGrabPauses(world: Roster): void {
  for (let slot = 0; slot < INPUT_PARTICIPANT_CAPACITY; slot++) {
    world.grabPaused[slot] = isActive(world, slot) && fighterAt(world, slot).launch.hitlag > 0;
  }
}

/**
 * Anchors every held fighter. Runs after both fighters advance, so expiry
 * never gives the second slot an extra movement tick, and again after
 * contacts to anchor a newly caught pair.
 */
export function resolveGrabs(world: Roster): void {
  for (let slot = 0; slot < INPUT_PARTICIPANT_CAPACITY; slot++) {
    if (isActive(world, slot)) resolveHeldTarget(world, slot);
  }
}
