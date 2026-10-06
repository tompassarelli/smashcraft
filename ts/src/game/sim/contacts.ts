// Damage contacts: every contact of a frame is collected against the same
// pre-hit state, then each target resolves its contacts together. The
// strongest launch wins; blocked contacts drain and push the shield instead.
import { max, min, toInt } from "../../runtime/numbers";
import { addFloat32, divideFloat32, multiplyFloat32, roundToFloat32, subtractFloat32 } from "wisp/src/sim/binary32";
import { ContactKind, DownState } from "./codes";
import { isDownDamageState } from "./conditions";
import { DOWN_DAMAGE_RESET_THRESHOLD } from "./down";
import type { Fighter } from "./fighter";
import { HitElement, type HitEffect, copyHitEffect, emptyHitEffect } from "./hitRegions";
import {
  applyDirectionalInfluence,
  contactKnockback,
  hitContextKnockback,
  installDamageLaunch,
  ordinaryHitlagFrames,
  ordinaryHitstunFrames,
  victimHitlagFrames,
} from "./knockback";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { type Controls, type Roster, fighterAt, isActive } from "./roster";
import {
  SHIELD_BREAK_RESTORED_ENERGY,
  SHIELD_HIT_WEIGHT_MULTIPLIER,
  digitalShieldRecoil,
  grantParry,
  shieldContactDamage,
  shieldContactPushback,
  shieldstunFrames,
} from "./shield";
import { isAerialAttack } from "./moves";
import { beginShieldBreak } from "./shieldBreak";
import { beginSmashDirectionalInfluenceHit } from "./smashDirectionalInfluence";
import { beginDownDamage, cancelAttack, cancelSpecialState, clearDownState, clearGrabLinks, interruptJumpOrDodge, thawFighter } from "./transitions";
import { at } from "wisp/src/runtime/lookup";
import { type AppliedStatus, applyHeroStatus, damageEndsHeroStatus } from "./heroStatus";

/** One contact, with the source's and target's state sampled when it was collected. */
interface DamageContact {
  source: number;
  target: number;
  readonly effect: HitEffect;
  facing: number;
  kind: ContactKind;
  direct: boolean;
  blocked: boolean;
  crouching: boolean;
  grounded: boolean;
  sourceGrounded: boolean;
  /** A direct hit from an aerial attack, whose shieldstun has the aerial tilt. */
  sourceAerial: boolean;
  sourceDeltaX: number;
  sourceDeltaZ: number;
  targetDeltaX: number;
  targetDeltaZ: number;
  down: boolean;
  smashCharging: boolean;
  throwInput: Readonly<Controls> | undefined;
  /** A hero status the contact applies if it reaches the body. */
  status: Readonly<AppliedStatus> | undefined;
}

function emptyContact(): DamageContact {
  return {
    source: 0, target: 0, effect: emptyHitEffect(), facing: 0, kind: ContactKind.launch, direct: false, blocked: false,
    crouching: false, grounded: false, sourceGrounded: false, sourceAerial: false, sourceDeltaX: 0.0, sourceDeltaZ: 0.0, targetDeltaX: 0.0,
    targetDeltaZ: 0.0, down: false, smashCharging: false, throwInput: undefined, status: undefined,
  };
}

// Scratch for one synchronous step, never part of a saved world. Records are
// reused across frames; the pool only grows past its largest batch so far.
const batch: { contacts: DamageContact[]; count: number; collecting: boolean } = { contacts: [], count: 0, collecting: false };

/** A flinch without knockback (the blaster's) stuns 3 frames per point of damage: 9 for an aerial shot, 12 for a grounded one (#117). */
export function flinchHitstunFrames(damage: number): number {
  return toInt(multiplyFloat32(3.0, roundToFloat32(damage)));
}

export function beginDamageContacts(): void {
  batch.count = 0;
  batch.collecting = true;
}

/** Opens a batch unless one is already open; true when the caller owns it and must finish it. */
export function openDamageContacts(): boolean {
  if (batch.collecting) return false;
  beginDamageContacts();
  return true;
}

/** Adds a contact; throws and pummels can't be blocked. */
export function collectDamageContact(
  world: Roster, sourceSlot: number, targetSlot: number, effect: Readonly<HitEffect>, facing: number,
  kind: ContactKind, direct: boolean, throwInput: Readonly<Controls> | undefined, shieldContact: boolean,
  status?: Readonly<AppliedStatus>,
): void {
  const source = fighterAt(world, sourceSlot);
  const target = fighterAt(world, targetSlot);
  let contact = batch.contacts[batch.count];
  if (contact === undefined) {
    contact = emptyContact();
    batch.contacts.push(contact);
  }
  batch.count++;
  const unblockable = kind === ContactKind.throw || kind === ContactKind.pummel;
  contact.source = sourceSlot;
  contact.target = targetSlot;
  copyHitEffect(contact.effect, effect);
  contact.facing = facing;
  contact.kind = kind;
  contact.direct = direct;
  contact.blocked = !unblockable && shieldContact;
  contact.crouching = target.motion.crouching;
  contact.grounded = target.motion.grounded;
  contact.sourceGrounded = source.motion.grounded;
  contact.sourceAerial = direct && isAerialAttack(source.attack.style);
  contact.sourceDeltaX = source.motion.deltaX;
  contact.sourceDeltaZ = source.motion.deltaZ;
  contact.targetDeltaX = target.motion.deltaX;
  contact.targetDeltaZ = target.motion.deltaZ;
  contact.down = isDownDamageState(target);
  contact.smashCharging = target.attack.smashCharging;
  contact.throwInput = throwInput;
  contact.status = status;
}

/** Adds a contact that the target's raised shield blocks. */
export function queueDamageContact(
  world: Roster, sourceSlot: number, targetSlot: number, effect: Readonly<HitEffect>, facing: number,
  kind: ContactKind, direct: boolean, throwInput: Readonly<Controls> | undefined,
): void {
  collectDamageContact(world, sourceSlot, targetSlot, effect, facing, kind, direct, throwInput, fighterAt(world, targetSlot).shield.raised);
}

function shieldRecoilAxis(attackerDelta: number, defenderDelta: number): number {
  return multiplyFloat32(attackerDelta, defenderDelta) >= 0 ? subtractFloat32(defenderDelta, attackerDelta) : defenderDelta;
}

/** An airborne attacker recoils by the relative step, scaled by the weight ratio. */
function applyAirborneShieldRecoil(source: Fighter, target: Fighter, contact: Readonly<DamageContact>): void {
  const weightRatio = multiplyFloat32(min(divideFloat32(target.tuning.physics.weight, source.tuning.physics.weight), 1.0), SHIELD_HIT_WEIGHT_MULTIPLIER);
  source.shield.recoilX = addFloat32(source.shield.recoilX, multiplyFloat32(shieldRecoilAxis(contact.sourceDeltaX, contact.targetDeltaX), weightRatio));
  source.shield.recoilZ = addFloat32(source.shield.recoilZ, multiplyFloat32(shieldRecoilAxis(contact.sourceDeltaZ, contact.targetDeltaZ), weightRatio));
}

function contactAt(index: number): DamageContact {
  return at(batch.contacts, index);
}

function resolveDamageContacts(world: Roster, slot: number): void {
  const target = fighterAt(world, slot);
  const { launch, shield, status } = target;
  let totalDamage = 0.0;
  let shieldDamage = 0.0;
  let winner: number | undefined;
  let strongest = -1.0;
  let flinch: number | undefined;
  let hurtContact: number | undefined;
  let visualContact: number | undefined;
  let blockedContact = false;
  let shieldElectric = false;
  let hitlagDamage = 0.0;
  let shieldPushback = 0.0;
  let shieldDirection = 1;
  const perfectShield = shield.perfectFrames > 0;
  for (let index = 0; index < batch.count; index++) {
    const contact = contactAt(index);
    if (contact.target !== slot) continue;
    if (contact.blocked) {
      blockedContact = true;
      shieldElectric ||= contact.effect.electric || contact.effect.element === HitElement.electric;
      if (!perfectShield) shieldDamage = addFloat32(shieldDamage, contact.effect.damage);
    } else {
      totalDamage = addFloat32(totalDamage, roundToFloat32(contact.effect.damage));
    }
  }
  const postHitPercent = addFloat32(toInt(max(0.0, roundToFloat32(status.damage))), totalDamage);
  for (let index = 0; index < batch.count; index++) {
    const contact = contactAt(index);
    if (contact.target !== slot) continue;
    const source = fighterAt(world, contact.source);
    const { damage } = contact.effect;
    if (contact.direct) source.launch.hitlag = max(source.launch.hitlag, ordinaryHitlagFrames(damage));
    if (contact.blocked) {
      if (contact.kind === ContactKind.damageOnly) continue;
      if (!perfectShield) shield.stun = max(shield.stun, shieldstunFrames(damage, shield.strength, contact.sourceAerial));
      launch.hitlag = max(launch.hitlag, ordinaryHitlagFrames(damage));
      const pushback = shieldContactPushback(damage, shield.strength, perfectShield);
      shieldPushback = max(shieldPushback, pushback);
      if (pushback === shieldPushback) shieldDirection = contact.facing;
      if (contact.direct) {
        if (contact.sourceGrounded) source.shield.recoilX = multiplyFloat32(-contact.facing, max(Math.abs(source.shield.recoilX), digitalShieldRecoil(damage)));
        else applyAirborneShieldRecoil(source, target, contact);
      }
      continue;
    }
    if (contact.kind === ContactKind.throw) target.visuals.throw++;
    visualContact ??= index;
    if (damage > 0 && contact.kind !== ContactKind.pummel) {
      thawFighter(target);
      damageEndsHeroStatus(target);
    }
    if (contact.kind !== ContactKind.damageOnly && contact.kind !== ContactKind.throw) {
      hitlagDamage = max(hitlagDamage, damage);
      hurtContact ??= index;
    }
    if (contact.kind === ContactKind.flinch) flinch ??= index;
    if (contact.kind === ContactKind.launch || contact.kind === ContactKind.throw) {
      const magnitude = contactKnockback(postHitPercent, damage, target.tuning.physics.weight, contact.effect.growth, contact.effect.base, 1.0);
      const knockback = contact.kind === ContactKind.throw ? magnitude : hitContextKnockback(magnitude, contact.crouching, contact.smashCharging);
      // Equal-strength contacts retain the first contact's direction.
      if (knockback > strongest) {
        strongest = knockback;
        winner = index;
      }
    }
  }
  if (visualContact !== undefined) {
    const effectContact = contactAt(winner ?? flinch ?? hurtContact ?? visualContact);
    target.visuals.hit++;
    target.visuals.hitElectric = effectContact.effect.electric;
    target.visuals.hitElement = effectContact.effect.element ?? (effectContact.effect.electric ? HitElement.electric : HitElement.normal);
    target.visuals.hitStrength = strongest >= 180.0 ? 2 : strongest >= 80.0 ? 1 : 0;
    target.visuals.hitPummel = effectContact.kind === ContactKind.pummel;
    // The strongest launch supplies the effect; the largest damage supplies hitlag power.
    if (hurtContact !== undefined) launch.hitlag = max(launch.hitlag, victimHitlagFrames(hitlagDamage, effectContact.effect.electric, effectContact.crouching));
  }
  status.damage = addFloat32(roundToFloat32(status.damage), totalDamage);
  if (blockedContact) {
    target.visuals.shieldElectric = shieldElectric;
    if (perfectShield) {
      target.visuals.shieldReflect++;
      grantParry(target);
    } else {
      // An ordinary block ends any parry reward, so a string pays out only when every hit is parried.
      target.visuals.shield++;
      shield.perfectActionFrames = 0;
      shield.redParryTried = false;
    }
  }
  if (shieldDamage > 0) shield.energy = subtractFloat32(shield.energy, shieldContactDamage(shieldDamage, shield.strength));
  if (shieldPushback > 0 && target.motion.grounded) {
    // Shield contact replaces the defender's self ground speed.
    target.motion.vx = 0.0;
    shield.pushbackX = multiplyFloat32(shieldDirection, shieldPushback);
    shield.drainResumePending = true;
  }
  if (shieldDamage > 0 && shield.energy < 0) {
    shield.energy = SHIELD_BREAK_RESTORED_ENERGY;
    beginShieldBreak(world, slot);
  }
  const chosenIndex = winner ?? flinch;
  if (chosenIndex === undefined) return;
  // Hero armor takes one hit's reaction up to its limit; its damage stays applied. Throws ignore it.
  if (status.armorFrames > 0 && contactAt(chosenIndex).kind !== ContactKind.throw) {
    status.armorFrames = 0;
    if (hitlagDamage <= status.armorMaxDamage) return;
  }
  // A later hit replaces both shield-contact motion channels.
  shield.pushbackX = 0.0;
  shield.recoilX = 0.0;
  shield.recoilZ = 0.0;
  shield.drainResumePending = false;
  const chosen = contactAt(chosenIndex);
  // Melee compares the damage summed over the frame's contacts.
  const jabReset = chosen.kind !== ContactKind.throw && chosen.down && totalDamage < DOWN_DAMAGE_RESET_THRESHOLD;
  clearGrabLinks(world, slot);
  launch.diPending = false;
  beginSmashDirectionalInfluenceHit(launch);
  launch.diLaunchSpeed = 0.0;
  interruptJumpOrDodge(target);
  if (!jabReset) clearDownState(target);
  cancelAttack(target);
  cancelSpecialState(target);
  launch.hitstun = winner !== undefined ? ordinaryHitstunFrames(strongest) : max(launch.hitstun, flinchHitstunFrames(chosen.effect.damage));
  launch.throwHitstun = chosen.kind === ContactKind.throw && launch.hitstun > 0;
  if (jabReset) {
    beginDownDamage(target, launch.hitstun);
    return;
  }
  if (winner === undefined) return;
  target.motion.vx = 0.0;
  target.motion.vz = 0.0;
  installDamageLaunch(target, strongest, multiplyFloat32(chosen.facing, chosen.effect.launchX), chosen.effect.launchZ, chosen.grounded);
  launch.sdiWasGrounded = chosen.grounded;
  launch.sdiLaunchesUpward = launch.knockbackZ > 0;
  launch.diPending = true;
  if (launch.damageLevel === 3) {
    target.down.state = DownState.tumble;
    target.down.frame = 0;
    target.down.direction = 0;
    target.down.faceUp = launch.knockbackZ >= 0;
  }
  if (chosen.kind === ContactKind.throw) {
    target.motion.surface = undefined;
    if (chosen.throwInput !== undefined) applyDirectionalInfluence(target, chosen.throwInput);
  }
}

/** Statuses from contacts that reached the body, after that frame's damage could end an earlier one. */
function applyContactStatuses(world: Roster, slot: number): void {
  for (let index = 0; index < batch.count; index++) {
    const contact = contactAt(index);
    if (contact.target === slot && !contact.blocked && contact.status !== undefined) applyHeroStatus(fighterAt(world, slot), contact.status);
  }
}

/** Resolves every active target's contacts in slot order and closes the batch. */
export function finishDamageContacts(world: Roster): void {
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot)) continue;
    resolveDamageContacts(world, slot);
    applyContactStatuses(world, slot);
  }
  batch.count = 0;
  batch.collecting = false;
}
