


import { max, min, toInt } from "../../runtime/numbers";
import { addFloat32, divideFloat32, multiplyFloat32, roundToFloat32, subtractFloat32 } from "wisp/src/sim/binary32";
import { Character, ContactKind, DownState, HeroStatusKind, SpecialAction } from "./codes";
import { f32 } from "wisp/src/sim/f32";

/** A Banished fighter takes this much more damage from Kael's spells. */
const BANISH_SPELL_DAMAGE = f32(1.3);
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
  STRONG_HIT_EXTRA_HITLAG,
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
import { CHILL } from "./chill";
import { fighterHurtParts } from "./hurtboxes";
import { knockbackWeight } from "./itemBuffs";
import { type AppliedStatus, applyHeroStatus, damageEndsHeroStatus } from "./heroStatus";
import { dealtManaGain, gainMana, takenManaGain } from "./mana";
import { EX_ARMOR_DAMAGE, exArmorActive } from "./exSpecials";
import { FORSAKEN_PALADIN_DAMAGE_MULTIPLIER, forsakenPaladinHammerContact } from "./heroes/forsakenPaladinHammer";


interface DamageContact {
  source: number;
  target: number;
  readonly effect: HitEffect;
  facing: number;
  kind: ContactKind;
  direct: boolean;
  strongHitlag: number;
  hitlagDamage: number;
  blocked: boolean;
  crouching: boolean;
  grounded: boolean;
  sourceGrounded: boolean;

  sourceAerial: boolean;
  sourceDeltaX: number;
  sourceDeltaZ: number;

  sourceVelocityX: number;
  sourceVelocityZ: number;
  targetDeltaX: number;
  targetDeltaZ: number;
  down: boolean;
  smashCharging: boolean;
  throwInput: Readonly<Controls> | undefined;

  status: Readonly<AppliedStatus> | undefined;
  height: number;
}

function emptyContact(): DamageContact {
  return {
    source: 0, target: 0, effect: emptyHitEffect(), facing: 0, kind: ContactKind.launch, direct: false, strongHitlag: 0, hitlagDamage: 0.0, blocked: false,
    crouching: false, grounded: false, sourceGrounded: false, sourceAerial: false, sourceDeltaX: 0.0, sourceDeltaZ: 0.0, sourceVelocityX: 0.0, sourceVelocityZ: 0.0, targetDeltaX: 0.0,
    targetDeltaZ: 0.0, down: false, smashCharging: false, throwInput: undefined, status: undefined,
    height: 1,
  };
}



const batch: { contacts: DamageContact[]; count: number; collecting: boolean } = { contacts: [], count: 0, collecting: false };


function flinchHitstunFrames(damage: number): number {
  return toInt(multiplyFloat32(3.0, roundToFloat32(damage)));
}

export function beginDamageContacts(): void {
  batch.count = 0;
  batch.collecting = true;
}


export function clearDamageContacts(): void {
  batch.contacts.length = 0;
  batch.count = 0;
  batch.collecting = false;
}


export function openDamageContacts(): boolean {
  if (batch.collecting) return false;
  beginDamageContacts();
  return true;
}


export function collectDamageContact(
  world: Roster, sourceSlot: number, targetSlot: number, effect: Readonly<HitEffect>, facing: number,
  kind: ContactKind, direct: boolean, throwInput: Readonly<Controls> | undefined, shieldContact: boolean,
  status?: Readonly<AppliedStatus>, contactZ?: number,
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
  // Banish: an ethereal fighter takes more from the Blood Mage's spells, as Warcraft's ethereal units take extra magic damage.
  if (target.status.condition === HeroStatusKind.banish && source.character === Character.kaelthas && (!direct || source.special.action !== SpecialAction.none)) {
    contact.effect.damage = f32(contact.effect.damage * BANISH_SPELL_DAMAGE);
  }
  contact.facing = facing;
  contact.kind = kind;
  contact.direct = direct;
  contact.strongHitlag = kind === ContactKind.launch && (effect.strong === true || forsakenPaladinHammerContact(source, effect.damage, direct)) ? STRONG_HIT_EXTRA_HITLAG : 0;
  contact.blocked = !unblockable && shieldContact;
  contact.crouching = target.motion.crouching;
  contact.grounded = target.motion.grounded;
  contact.sourceGrounded = source.motion.grounded;
  contact.sourceAerial = direct && isAerialAttack(source.attack.style);
  contact.sourceDeltaX = source.motion.deltaX;
  contact.sourceDeltaZ = source.motion.deltaZ;
  contact.sourceVelocityX = source.motion.vx;
  contact.sourceVelocityZ = source.motion.vz;
  contact.targetDeltaX = target.motion.deltaX;
  contact.targetDeltaZ = target.motion.deltaZ;
  contact.down = isDownDamageState(target);
  contact.smashCharging = target.attack.smashCharging;
  contact.throwInput = throwInput;
  contact.status = status;


  contact.height = 1;
  if (contactZ !== undefined) {
    let bottom = 0.0;
    let top = 0.0;
    for (const part of fighterHurtParts(target)) {
      bottom = min(bottom, subtractFloat32(min(part.z1, part.z2), part.radius));
      top = max(top, addFloat32(max(part.z1, part.z2), part.radius));
    }
    const relative = subtractFloat32(contactZ, target.motion.z);
    const span = subtractFloat32(top, bottom);
    contact.height = relative < addFloat32(bottom, multiplyFloat32(span, 0.375)) ? 0
      : relative >= addFloat32(bottom, multiplyFloat32(span, 0.75)) ? 2 : 1;
  }

  contact.hitlagDamage = contact.effect.damage;
  if (source.character === Character.forsakenPaladin) contact.effect.damage = multiplyFloat32(contact.effect.damage, FORSAKEN_PALADIN_DAMAGE_MULTIPLIER);
}


export function collectTerrainContact(world: Roster, targetSlot: number, effect: Readonly<HitEffect>): void {
  collectDamageContact(world, targetSlot, targetSlot, effect, 1, ContactKind.launch, false, undefined, false, undefined, undefined);
}


export function queueDamageContact(
  world: Roster, sourceSlot: number, targetSlot: number, effect: Readonly<HitEffect>, facing: number,
  kind: ContactKind, direct: boolean, throwInput: Readonly<Controls> | undefined,
): void {
  collectDamageContact(world, sourceSlot, targetSlot, effect, facing, kind, direct, throwInput, fighterAt(world, targetSlot).shield.raised);
}

function shieldRecoilAxis(attackerDelta: number, defenderDelta: number): number {
  return multiplyFloat32(attackerDelta, defenderDelta) >= 0 ? subtractFloat32(defenderDelta, attackerDelta) : defenderDelta;
}


function applyAirborneShieldRecoil(source: Fighter, target: Fighter, contact: Readonly<DamageContact>): void {
  const weightRatio = multiplyFloat32(min(divideFloat32(target.tuning.physics.weight, source.tuning.physics.weight), 1.0), SHIELD_HIT_WEIGHT_MULTIPLIER);
  source.shield.recoilX = addFloat32(source.shield.recoilX, multiplyFloat32(shieldRecoilAxis(contact.sourceDeltaX, contact.targetDeltaX), weightRatio));
  source.shield.recoilZ = addFloat32(source.shield.recoilZ, multiplyFloat32(shieldRecoilAxis(contact.sourceDeltaZ, contact.targetDeltaZ), weightRatio));
}


function drainMana(target: Fighter, drain: number | undefined): void {
  if (drain === undefined || drain <= 0 || target.mana.points <= 0) return;
  target.mana.points = max(0, target.mana.points - drain);
  target.visuals.manaDrained++;
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
  let armorDamage = 0.0;
  let strongHitlag = 0;
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
    if (contact.direct) source.launch.hitlag = max(source.launch.hitlag, ordinaryHitlagFrames(contact.hitlagDamage) + contact.strongHitlag);
    if (contact.blocked) {
      if (contact.kind === ContactKind.damageOnly) continue;
      if (!perfectShield) shield.stun = max(shield.stun, shieldstunFrames(damage, shield.strength, contact.sourceAerial));
      launch.hitlag = max(launch.hitlag, ordinaryHitlagFrames(contact.hitlagDamage) + contact.strongHitlag);
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
    drainMana(target, contact.effect.manaDrain);
    const stolen = min(target.mana.points, contact.effect.manaSteal ?? 0);
    if (stolen > 0) {
      drainMana(target, stolen);
      gainMana(source, stolen);
    }
    if (damage > 0) {
      if (source !== target) gainMana(source, dealtManaGain(damage));
      gainMana(target, takenManaGain(damage));
    }
    if (damage > 0 && contact.kind !== ContactKind.pummel) {
      thawFighter(target);
      damageEndsHeroStatus(target);
    }
    if (contact.kind !== ContactKind.damageOnly && contact.kind !== ContactKind.throw) {
      hitlagDamage = max(hitlagDamage, contact.hitlagDamage);
      armorDamage = max(armorDamage, damage);
      strongHitlag = max(strongHitlag, contact.strongHitlag);
      hurtContact ??= index;
    }
    if (contact.kind === ContactKind.flinch) flinch ??= index;
    if (contact.kind === ContactKind.launch || contact.kind === ContactKind.throw) {
      const magnitude = contactKnockback(postHitPercent, damage, knockbackWeight(target), contact.effect.growth, contact.effect.base, 1.0);
      const knockback = contact.kind === ContactKind.throw ? magnitude : hitContextKnockback(magnitude, contact.crouching, contact.smashCharging);

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
    target.visuals.hitStrong = effectContact.strongHitlag > 0;
    target.visuals.hitStrength = target.visuals.hitStrong || strongest >= 180.0 ? 2 : strongest >= 80.0 ? 1 : 0;
    target.visuals.hitHeight = effectContact.height;
    target.visuals.hitPummel = effectContact.kind === ContactKind.pummel;

    if (hurtContact !== undefined) {
      launch.sdiFollowup = launch.hitlag === 0 && launch.hitlagEndAge <= 15;
      launch.hitlagFrames = victimHitlagFrames(hitlagDamage, effectContact.effect.electric, effectContact.crouching) + strongHitlag;
      launch.hitlag = max(launch.hitlag, launch.hitlagFrames);
    }
  }
  status.damage = addFloat32(roundToFloat32(status.damage), totalDamage);
  if (blockedContact) {
    target.visuals.shieldElectric = shieldElectric;
    if (perfectShield) {
      target.visuals.shieldReflect++;
      grantParry(target);
    } else {

      target.visuals.shield++;
      shield.perfectActionFrames = 0;
      shield.redParryTried = false;
    }
  }
  if (shieldDamage > 0) shield.energy = subtractFloat32(shield.energy, shieldContactDamage(shieldDamage, shield.strength));
  if (shieldPushback > 0 && target.motion.grounded) {

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
  if (exArmorActive(target) && contactAt(chosenIndex).kind !== ContactKind.throw) {
    target.special.exArmorUsed = true;
    if (armorDamage <= EX_ARMOR_DAMAGE) return;
  }

  if (status.armorFrames > 0 && contactAt(chosenIndex).kind !== ContactKind.throw) {
    status.armorFrames = 0;
    const armorChills = status.armorChills;
    status.armorChills = false;
    if (armorDamage <= status.armorMaxDamage) {

      const spentBy = contactAt(chosenIndex);
      if (armorChills && spentBy.direct) applyHeroStatus(fighterAt(world, spentBy.source), CHILL);
      return;
    }
  }


  shield.pushbackX = 0.0;
  shield.recoilX = 0.0;
  shield.recoilZ = 0.0;
  shield.drainResumePending = false;
  const chosen = contactAt(chosenIndex);

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
  if (chosen.direct && chosen.effect.carry === true && !target.motion.grounded) {
    target.motion.vx = chosen.sourceVelocityX;
    target.motion.vz = chosen.sourceVelocityZ;
  }
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


function applyContactStatuses(world: Roster, slot: number): void {
  for (let index = 0; index < batch.count; index++) {
    const contact = contactAt(index);
    if (contact.target !== slot || contact.blocked || contact.status === undefined) continue;
    const target = fighterAt(world, slot);
    applyHeroStatus(target, contact.status);

    if (target.status.condition === HeroStatusKind.carried && contact.status.kind === HeroStatusKind.carried) target.facing = contact.facing < 0 ? 1 : -1;
  }
}


export function finishDamageContacts(world: Roster): void {
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot)) continue;
    resolveDamageContacts(world, slot);
    applyContactStatuses(world, slot);
  }
  batch.count = 0;
  batch.collecting = false;
}
