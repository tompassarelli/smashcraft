import { placedObject } from "../sim/fighter";
// Keep the whole canonical record together: field order and spelling are
// shared with the retained replay oracle, including fields from every slot.
// Replay2, Wurst ReplayState's canonical tape of gameplay state. Labels,
// order and number formats are a cross-runtime contract: a tape compares
// these strings and checksums between Wurst's Lua, Bun and 32-bit Lua.
import { attackBufferCanonicalState } from "../input/attackBuffer";
import { PARTICIPANT_CAPACITY, PARTICIPANT_SLOTS, participantActive, type Slots } from "../input/participants";
import { at } from "wisp/src/runtime/lookup";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import type { BotObservationFrame } from "../match/botPerception";
import { AttackStyle, GrabAction, LAST_ATTACK_STYLE, SPECIAL_ACTION_CAPACITY, SpecialAction } from "../sim/codes";
import type { FighterMoves } from "../sim/heroMoves";
import type { AuthoredSpecial, FighterSpecials, SpecialPlacement, SpecialProjectile } from "../sim/heroSpecials";
import type { HitEffect } from "../sim/hitRegions";
import { type HurtPart, HurtState } from "../sim/hurtboxes";
import { HERO_STATUS_GROUPS } from "../sim/codes";
import { writeMatchItems } from "../match/items";
import { PROJECTILE_CAPACITY, type Fighter } from "../sim/fighter";
import { fighterAt, isActive } from "../sim/roster";
import { writeTrainingState } from "../match/trainingState";
import { writeConfiguredRun } from "../classic/runState";
import { CPU_OPPONENT_CHOICES, CPU_OPPONENT_IDS, CPU_TIERS } from "../match/cpuProfiles";
import { botStrategyValues } from "../match/botStrategy";
import type { ReplayState } from "./snapshot";
import { HERO_ROSTER } from "../sim/heroes/registry";
import { ARCHER_MOVES, RIFLEMAN_MOVES } from "../sim/originalMoves";

const REPLAY_CHECKSUM_MODULUS = 1_000_003;

/** Decimal bytes use integer division, including the negative int32 endpoint. */
function writeIntegerBytes(emit: (code: number) => void, value: number): void {
  if (value < -2147483648 || value > 2147483647) {
    const text = `${value}`;
    for (let index = 0; index < text.length; index++) emit(text.charCodeAt(index));
    return;
  }
  if (value < 0) emit(45);
  let remaining = value > 0 ? -value : value;
  let divisor = 1;
  while (divisor < 1_000_000_000 && remaining <= -10 * divisor) divisor *= 10;
  while (divisor > 0) {
    const digit = -floorDiv(remaining, divisor) - (floorMod(remaining, divisor) === 0 ? 0 : 1);
    emit(48 + digit);
    remaining += digit * divisor;
    divisor = floorDiv(divisor, 10);
  }
}

/** The same exact numeric bytes feed replay text and allocation-free observation checks. */
export function writeCanonicalNumber(emit: (code: number) => void, value: number, integer = true): void {
  if (integer && Math.floor(value) === value) { writeIntegerBytes(emit, Math.floor(value)); return; }
  if (value !== value) { emit(110); emit(97); emit(110); return; }
  const negative = value < 0;
  if (!negative && !(value > 0)) { emit(48); return; }
  emit(negative ? 45 : 43);
  if (!splitFiniteReal(negative ? -value : value)) { emit(105); emit(110); emit(102); return; }
  writeIntegerBytes(emit, realParts.exponent);
  emit(58);
  writeIntegerBytes(emit, realParts.high);
  emit(58);
  writeIntegerBytes(emit, realParts.low);
}

/** The magnitude splitFiniteReal last split: binary exponent and 52 fraction bits as two 26-bit integers. */
export const realParts = { exponent: 0, high: 0, low: 0 };

/** Splits a positive magnitude into realParts without allocating; false when it is infinite. */
export function splitFiniteReal(positive: number): boolean {
  let magnitude = positive;
  if (magnitude * 2 === magnitude) return false;
  let exponent = 0;
  while (magnitude >= 2) {
    magnitude /= 2;
    exponent++;
  }
  while (magnitude < 1) {
    magnitude *= 2;
    exponent--;
  }
  const fraction = (magnitude - 1) * 67108864;
  const high = Math.floor(fraction);
  realParts.exponent = exponent;
  realParts.high = high;
  realParts.low = Math.floor((fraction - high) * 67108864);
  return true;
}

/** Exact finite binary representation: sign, binary exponent and 52 fraction bits as two 26-bit integers. */
export function canonicalReal(value: number): string {
  const parts: string[] = [];
  writeCanonicalNumber(code => { parts.push(String.fromCharCode(code)); }, value, false);
  return parts.join("");
}

/**
 * Wurst's I2S. Lua prints an integral float as "3.0", so the value is floored
 * to Lua's integer type first; a fraction, which no Wurst int can hold, keeps
 * its exact real form so a tape comparison still reports it.
 */
function integerText(value: number): string {
  const whole = Math.floor(value);
  return whole === value ? `${whole}` : canonicalReal(value);
}

export function canonicalInt(name: string, value: number): string {
  return `|${name}=${integerText(value)}`;
}

export function canonicalBoolean(name: string, value: boolean): string {
  return `|${name}=${value ? 1 : 0}`;
}

export function canonicalRealField(name: string, value: number): string {
  return `|${name}=${canonicalReal(value)}`;
}

/** Authored move values travel with tuning; absent profiles leave retained tapes unchanged. */
export function fighterMovesCanonical(moves: FighterMoves | undefined, prefix = "moves"): string {
  if (moves === undefined) return "";
  const result: string[] = [canonicalInt(`${prefix}.dashAttack`, moves.dashAttack)];
  const int = (name: string, value: number) => { result.push(canonicalInt(`${prefix}.${name}`, value)); };
  const real = (name: string, value: number) => { result.push(canonicalRealField(`${prefix}.${name}`, value)); };
  const effect = (name: string, hit: Readonly<HitEffect>) => {
    real(`${name}.damage`, hit.damage);
    real(`${name}.growth`, hit.growth);
    real(`${name}.base`, hit.base);
    real(`${name}.launchX`, hit.launchX);
    real(`${name}.launchZ`, hit.launchZ);
    int(`${name}.electric`, hit.electric ? 1 : 0);
    int(`${name}.element`, hit.element ?? 0);
    if (hit.carry === true) int(`${name}.carry`, 1);
    if (hit.manaSteal !== undefined) int(`${name}.manaSteal`, hit.manaSteal);
  };
  int("chargeFrames", moves.smashMaxChargeFrames);
  int("maxPummels", moves.maxPummels ?? -1);
  real("chargeMultiplier", moves.smashMaxDamageMultiplier);
  for (let style = 0; style <= LAST_ATTACK_STYLE; style++) {
    const move = moves.normals[style];
    if (move === undefined) continue;
    const name = `normal[${style}]`;
    int(`${name}.startup`, move.startupFrames);
    int(`${name}.active`, move.activeFrames);
    int(`${name}.total`, move.totalFrames);
    int(`${name}.landingLag`, move.landingLag);
    real(`${name}.travel`, move.startupTravelX ?? 0.0);
    int(`${name}.stopsAtBody`, move.startupStopsAtBody ? 1 : 0);
    if (move.chainsFrom !== undefined) int(`${name}.chainsFrom`, move.chainsFrom);
    // Optional fields enter the text only when present, so kits without them keep their checksum.
    const phases = move.fall ?? [];
    for (let index = 0; index < phases.length; index++) {
      const phase = at(phases, index);
      const part = `${name}.fall[${index}]`;
      int(`${part}.first`, phase.firstFrame);
      int(`${part}.last`, phase.lastFrame);
      if (phase.speedZ !== undefined) real(`${part}.speedZ`, phase.speedZ);
      if (phase.speedX !== undefined) real(`${part}.speedX`, phase.speedX);
    }
    if (move.landingHit !== undefined) {
      int(`${name}.landingHit.first`, move.landingHit.firstFrame);
      int(`${name}.landingHit.total`, move.landingHit.totalFrames);
    }
    int(`${name}.regions`, move.regions.length);
    for (let index = 0; index < move.regions.length; index++) {
      const region = at(move.regions, index);
      const part = `${name}.region[${index}]`;
      int(`${part}.first`, region.firstFrame);
      int(`${part}.last`, region.lastFrame);
      int(`${part}.window`, region.hit.window);
      real(`${part}.minX`, region.hit.minX);
      real(`${part}.maxX`, region.hit.maxX);
      real(`${part}.minZ`, region.hit.minZ);
      real(`${part}.maxZ`, region.hit.maxZ);
      effect(`${part}.hit`, region.hit.effect);
      const { strike, groundedEffect } = region.hit;
      int(`${part}.strike`, strike === undefined ? 0 : 1);
      if (strike !== undefined) {
        real(`${part}.strike.x1`, strike.x1);
        real(`${part}.strike.z1`, strike.z1);
        real(`${part}.strike.x2`, strike.x2);
        real(`${part}.strike.z2`, strike.z2);
        real(`${part}.strike.radius`, strike.radius);
      }
      int(`${part}.groundedHit`, groundedEffect === undefined ? 0 : 1);
      if (groundedEffect !== undefined) effect(`${part}.groundedHit`, groundedEffect);
    }
  }
  for (let action = GrabAction.pummel; action <= GrabAction.throwDown; action++) {
    const move = moves.throws[action];
    if (move === undefined) continue;
    const name = `throw[${action}]`;
    int(`${name}.contact`, move.contactFrame);
    int(`${name}.total`, move.totalFrames);
    effect(name, move.effect);
  }
  const { hurtboxes } = moves;
  if (hurtboxes === undefined) return result.join("");
  const parts = (name: string, list: readonly HurtPart[]) => {
    int(`${name}.parts`, list.length);
    for (let index = 0; index < list.length; index++) {
      const part = at(list, index);
      const prefix = `${name}.part[${index}]`;
      real(`${prefix}.x1`, part.x1);
      real(`${prefix}.z1`, part.z1);
      real(`${prefix}.x2`, part.x2);
      real(`${prefix}.z2`, part.z2);
      real(`${prefix}.radius`, part.radius);
      int(`${prefix}.state`, part.state ?? HurtState.normal);
    }
  };
  parts("hurt.stand", hurtboxes.stand);
  int("hurt.crouch", hurtboxes.crouch === undefined ? 0 : 1);
  if (hurtboxes.crouch !== undefined) parts("hurt.crouch", hurtboxes.crouch);
  for (let style = 0; style <= LAST_ATTACK_STYLE; style++) {
    const poses = hurtboxes.attacks[style];
    if (poses === undefined) continue;
    const name = `hurt.attack[${style}]`;
    int(`${name}.poses`, poses.length);
    for (let index = 0; index < poses.length; index++) {
      const pose = at(poses, index);
      int(`${name}.pose[${index}].first`, pose.firstFrame);
      int(`${name}.pose[${index}].last`, pose.lastFrame);
      parts(`${name}.pose[${index}]`, pose.parts);
    }
  }
  return result.join("");
}

/** Wurst's slotOf: -1 for no fighter, -2 for a fighter the roster doesn't seat. */
/** An authored hero projectile, field by field. */
export function specialProjectileCanonical(spec: Readonly<SpecialProjectile>, prefix: string): string {
  const result: string[] = [];
  const int = (name: string, value: number) => { result.push(canonicalInt(`${prefix}.${name}`, value)); };
  const real = (name: string, value: number) => { result.push(canonicalRealField(`${prefix}.${name}`, value)); };
  int("spawnFrame", spec.spawnFrame);
  real("offsetX", spec.offsetX);
  real("offsetZ", spec.offsetZ);
  real("velocityX", spec.velocityX);
  real("velocityZ", spec.velocityZ);
  real("upVelocityX", spec.upVelocityX ?? 0.0);
  real("upVelocityZ", spec.upVelocityZ ?? 0.0);
  int("life", spec.life);
  real("radius", spec.radius);
  int("activeFrom", spec.activeFrom ?? 0);
  result.push(hitEffectCanonical(spec.effect, `${prefix}.effect`));
  int("reflectable", spec.reflectable ? 1 : 0);
  int("limit", spec.limit);
  int("cancelOnInterrupt", spec.cancelOnInterrupt === true ? 1 : 0);
  if (spec.returnEffect !== undefined) result.push(hitEffectCanonical(spec.returnEffect, `${prefix}.returnEffect`));
  if (spec.catchHeal !== undefined) {
    real("catchHeal.heal", spec.catchHeal.heal);
  }
  if (spec.status !== undefined) {
    int("status.kind", spec.status.kind);
    int("status.frames", spec.status.frames);
    if (spec.status.airFrames !== undefined) int("status.airFrames", spec.status.airFrames);
    int("status.group", spec.status.group);
    int("status.immunityFrames", spec.status.immunityFrames);
    if (spec.status.tick !== undefined) {
      int("status.tick.every", spec.status.tick.every);
      real("status.tick.damage", spec.status.tick.damage);
    }
  }
  int("needsLineOfSight", spec.needsLineOfSight === true ? 1 : 0);
  if (spec.returns !== undefined) {
    int("returns.age", spec.returns.age);
    real("returns.speed", spec.returns.speed);
  }
  if (spec.pool !== undefined) {
    int("pool.every", spec.pool.every);
    real("pool.growth", spec.pool.growth);
    real("pool.maxRadius", spec.pool.maxRadius);
  }
  return result.join("");
}

/** An authored placed object, field by field. */
export function specialPlacementCanonical(spec: Readonly<SpecialPlacement>, prefix: string): string {
  const result: string[] = [];
  const int = (name: string, value: number) => { result.push(canonicalInt(`${prefix}.${name}`, value)); };
  const real = (name: string, value: number) => { result.push(canonicalRealField(`${prefix}.${name}`, value)); };
  int("frame", spec.frame);
  if (spec.slot !== undefined) int("slot", spec.slot);
  if (spec.offsetZ !== undefined) real("offsetZ", spec.offsetZ);
  if (spec.keepExisting === true) int("keepExisting", 1);
  real("offsetX", spec.offsetX);
  real("radius", spec.radius);
  real("height", spec.height);
  real("durability", spec.durability);
  int("life", spec.life);
  for (let index = 0; index < spec.fireAges.length; index++) int(`fireAge[${index}]`, at(spec.fireAges, index));
  if (spec.shot !== undefined) result.push(specialProjectileCanonical(spec.shot, `${prefix}.shot`));
  const partner = spec.companion;
  if (partner !== undefined) {
    if (partner.behavior !== undefined) int("companion.behavior", partner.behavior === "sentry" ? 1 : 2);
    if (partner.followHeight !== undefined) real("companion.followHeight", partner.followHeight);
    if (partner.lungeDrop !== undefined) real("companion.lungeDrop", partner.lungeDrop);
    for (let i = 0; i < (partner.volleyFrames?.length ?? 0); i++) int(`companion.volley[${i}]`, partner.volleyFrames?.[i] ?? 0);
    real("companion.followSpeed", partner.followSpeed);
    real("companion.followBehind", partner.followBehind);
    real("companion.returnSpeed", partner.returnSpeed);
    int("companion.lungeStartup", partner.lungeStartup);
    int("companion.lungeActive", partner.lungeActive);
    int("companion.lungeRecovery", partner.lungeRecovery);
    real("companion.lungeTravel", partner.lungeTravel);
    real("companion.bite.x1", partner.bite.x1);
    real("companion.bite.z1", partner.bite.z1);
    real("companion.bite.x2", partner.bite.x2);
    real("companion.bite.z2", partner.bite.z2);
    real("companion.bite.radius", partner.bite.radius);
    result.push(hitEffectCanonical(partner.biteEffect, `${prefix}.companion.biteEffect`));
    int("companion.stunFrames", partner.stunFrames);
    real("companion.leash", partner.leash);
    int("companion.leashFrames", partner.leashFrames);
  }
  return result.join("");
}

function hitEffectCanonical(hit: Readonly<HitEffect>, prefix: string): string {
  return canonicalRealField(`${prefix}.damage`, hit.damage) + canonicalRealField(`${prefix}.growth`, hit.growth)
    + canonicalRealField(`${prefix}.base`, hit.base) + canonicalRealField(`${prefix}.launchX`, hit.launchX)
    + canonicalRealField(`${prefix}.launchZ`, hit.launchZ) + canonicalInt(`${prefix}.electric`, hit.electric ? 1 : 0)
    + canonicalInt(`${prefix}.element`, hit.element ?? 0) + (hit.carry === true ? canonicalInt(`${prefix}.carry`, 1) : "")
    + (hit.manaSteal === undefined ? "" : canonicalInt(`${prefix}.manaSteal`, hit.manaSteal));
}

/** A hero's authored specials; empty for fighters without them. */
export function fighterSpecialsCanonical(specials: Readonly<FighterSpecials> | undefined, prefix = "specials"): string {
  if (specials === undefined) return "";
  const result: string[] = [];
  const kits = [specials.neutral, specials.side, specials.up, specials.down];
  for (let slot = 0; slot < kits.length; slot++) {
    const kit = at(kits, slot);
    if (kit.recallGroundOnly === true) result.push(canonicalInt(`${prefix}.kit[${slot}].recallGroundOnly`, 1));
    if (kit.recallWhile !== undefined) result.push(canonicalInt(`${prefix}.kit[${slot}].recallWhile`, kit.recallWhile === "armor" ? 2 : 1));
    const forms = [kit.ground, kit.air, kit.free, kit.recall, kit.marked?.special];
    // A fixed count: the list holds undefined forms, which a Lua length would skip.
    for (let form = 0; form < 6; form++) {
      const move = forms[form];
      if (move === undefined) continue;
      const name = `${prefix}.kit[${slot}].form[${form}]`;
      result.push(specialMoveCanonical(move, name));
    }
    if (kit.marked !== undefined) result.push(canonicalRealField(`${prefix}.kit[${slot}].markedRange`, kit.marked.range));
  }
  return result.join("");
}

function specialMoveCanonical(move: Readonly<AuthoredSpecial>, name: string): string {
  const result: string[] = [];
  if (move.ex !== undefined) result.push(specialMoveCanonical(move.ex, `${name}.ex`));
  const int = (field: string, value: number) => { result.push(canonicalInt(`${name}.${field}`, value)); };
  const real = (field: string, value: number) => { result.push(canonicalRealField(`${name}.${field}`, value)); };
  int("cost", move.cost);
  int("end", move.endFrame);
  int("groundOnly", move.groundOnly === true ? 1 : 0);
  int("oncePerAirtime", move.oncePerAirtime === true ? 1 : 0);
  int("helpless", move.helpless === true ? 1 : 0);
  int("landingLag", move.landingLag ?? -1);
  if (move.facesStick === true) int("facesStick", 1);
  int("intangible.first", move.intangible?.first ?? -1);
  int("intangible.last", move.intangible?.last ?? -1);
  int("armor.first", move.armor?.first ?? -1);
  int("armor.last", move.armor?.last ?? -1);
  real("armor.maxDamage", move.armor?.maxDamage ?? 0.0);
  int("armor.shell", move.armor?.shell === true ? 1 : 0);
  if (move.armor?.chillsStriker === true) int("armor.chillsStriker", 1);
  if (move.burst !== undefined) {
    int("burst.frame", move.burst.frame);
    result.push(specialProjectileCanonical(move.burst.from, `${name}.burst.from`), specialProjectileCanonical(move.burst.into, `${name}.burst.into`));
  }
  if (move.ritual !== undefined) {
    int("ritual.frame", move.ritual.frame);
    int("ritual.mana", move.ritual.mana);
  }
  if (move.cleanseFrame !== undefined) int("cleanseFrame", move.cleanseFrame);
  if (move.placement !== undefined) result.push(specialPlacementCanonical(move.placement, `${name}.placement`));
  if (move.recall === true) int("recall", 1);
  if (move.command !== undefined) {
    int("command.frame", move.command.frame);
    int("command.order", move.command.order);
    if (move.command.slot !== undefined) int("command.slot", move.command.slot);
  }
  if (move.recallsProjectiles === true) int("recallsProjectiles", 1);
  if (move.strikeStatus !== undefined) {
    int("strikeStatus.kind", move.strikeStatus.kind);
    int("strikeStatus.frames", move.strikeStatus.frames);
    int("strikeStatus.every", move.strikeStatus.tick?.every ?? 0);
    real("strikeStatus.damage", move.strikeStatus.tick?.damage ?? 0.0);
  }
  if (move.guard !== undefined) {
    int("guard.first", move.guard.first);
    int("guard.last", move.guard.last);
    real("guard.heal", move.guard.heal);
    if (move.guard.shieldFrames !== undefined) int("guard.shieldFrames", move.guard.shieldFrames);
  }
  const motion = move.motion ?? [];
  for (let index = 0; index < motion.length; index++) {
    const segment = at(motion, index);
    int(`motion[${index}].first`, segment.first);
    int(`motion[${index}].last`, segment.last);
    real(`motion[${index}].velocityX`, segment.velocityX);
    real(`motion[${index}].velocityZ`, segment.velocityZ);
    real(`motion[${index}].aimedSpeed`, segment.aimedSpeed ?? 0.0);
    if (segment.stopsAtBody === true) int(`motion[${index}].stopsAtBody`, 1);
    real(`motion[${index}].driftSpeed`, segment.driftSpeed ?? 0.0);
    if (segment.stopsAtShield === true) int(`motion[${index}].stopsAtShield`, 1);
    if (segment.relocate !== undefined) int(`motion[${index}].relocate`, segment.relocate);
    if (segment.relocateReach !== undefined) real(`motion[${index}].relocateReach`, segment.relocateReach);
    if (segment.stopsAtBody === true) int(`motion[${index}].stopsAtBody`, 1);
  }
  const grab = move.commandGrab;
  if (grab !== undefined) {
    int("commandGrab.first", grab.first);
    int("commandGrab.last", grab.last);
    real("commandGrab.strike.x1", grab.strike.x1);
    real("commandGrab.strike.z1", grab.strike.z1);
    real("commandGrab.strike.x2", grab.strike.x2);
    real("commandGrab.strike.z2", grab.strike.z2);
    real("commandGrab.strike.radius", grab.strike.radius);
    int("commandGrab.hold", grab.holdFrames);
    int("commandGrab.recovery", grab.recovery);
    if (grab.heal !== undefined) {
      real("commandGrab.heal", grab.heal.heal);
    }
    result.push(hitEffectCanonical(grab.effect, `${name}.commandGrab.effect`));
  }
  const poses = move.hurt ?? [];
  for (let index = 0; index < poses.length; index++) {
    const pose = at(poses, index);
    int(`hurt[${index}].first`, pose.firstFrame);
    int(`hurt[${index}].last`, pose.lastFrame);
    for (let part = 0; part < pose.parts.length; part++) {
      const p = at(pose.parts, part);
      const name = `hurt[${index}].part[${part}]`;
      real(`${name}.x1`, p.x1);
      real(`${name}.z1`, p.z1);
      real(`${name}.x2`, p.x2);
      real(`${name}.z2`, p.z2);
      real(`${name}.radius`, p.radius);
      int(`${name}.state`, p.state ?? HurtState.normal);
    }
  }
  const projectiles = move.projectiles ?? [];
  for (let index = 0; index < projectiles.length; index++) result.push(specialProjectileCanonical(at(projectiles, index), `${name}.projectile[${index}]`));
  const regions = move.regions ?? [];
  for (let index = 0; index < regions.length; index++) {
    const region = at(regions, index);
    const part = `region[${index}]`;
    int(`${part}.first`, region.firstFrame);
    int(`${part}.last`, region.lastFrame);
    real(`${part}.minX`, region.hit.minX);
    real(`${part}.maxX`, region.hit.maxX);
    real(`${part}.minZ`, region.hit.minZ);
    real(`${part}.maxZ`, region.hit.maxZ);
    const { strike } = region.hit;
    if (strike !== undefined) {
      real(`${part}.strike.x1`, strike.x1);
      real(`${part}.strike.z1`, strike.z1);
      real(`${part}.strike.x2`, strike.x2);
      real(`${part}.strike.z2`, strike.z2);
      real(`${part}.strike.radius`, strike.radius);
    }
    result.push(hitEffectCanonical(region.hit.effect, `${name}.${part}.hit`));
    if (region.hit.groundedEffect !== undefined) result.push(hitEffectCanonical(region.hit.groundedEffect, `${name}.${part}.groundedHit`));
  }
  const followUps = move.followUps ?? [];
  for (let index = 0; index < followUps.length; index++) {
    const followUp = at(followUps, index);
    int(`followUp[${index}].first`, followUp.window.first);
    int(`followUp[${index}].last`, followUp.window.last);
    int(`followUp[${index}].input`, followUp.input ?? 0);
    int(`followUp[${index}].facesStick`, followUp.facesStick === true ? 1 : 0);
    result.push(specialMoveCanonical(followUp.special, `${name}.followUp[${index}]`));
  }
  return result.join("");
}

export function canonicalSlot(slot: number | undefined, participantMask: number): number {
  if (slot === undefined) return -1;
  return participantActive(participantMask, slot) ? slot : -2;
}

/** Two polynomial lanes over printable ASCII; the largest intermediate stays below 2^28 in both runtimes. */
interface ChecksumLanes {
  valid: boolean;
  first: number;
  second: number;
}

function foldChecksum(lanes: ChecksumLanes, fragment: string): void {
  foldChecksumRange(lanes, fragment, 0, fragment.length);
}

/** Folds text's characters from index start up to, not including, end. */
function foldChecksumRange(lanes: ChecksumLanes, text: string, start: number, end: number): void {
  if (!lanes.valid) return;
  let { first, second } = lanes;
  for (let index = start; index < end; index++) {
    const byte = text.charCodeAt(index);
    if (byte < 32 || byte > 126) {
      lanes.valid = false;
      return;
    }
    // Both operands are nonnegative, where floorMod equals Wurst's mod.
    first = floorMod(first * 257 + byte + 1, REPLAY_CHECKSUM_MODULUS);
    second = floorMod(second * 263 + byte + 1, REPLAY_CHECKSUM_MODULUS);
  }
  lanes.first = first;
  lanes.second = second;
}

const checksumText = ({ valid, first, second }: Readonly<ChecksumLanes>): string => (valid ? `${first}:${second}` : "invalid-ascii");

export function canonicalChecksum(text: string): string {
  const lanes: ChecksumLanes = { valid: true, first: 0, second: 0 };
  foldChecksum(lanes, text);
  return checksumText(lanes);
}

/** Receives canonical fragments in tape order. */
type Emit = (fragment: string) => void;

// A kit is immutable, so its canonical text is folded once per kit object and
// a state writes that digest. Map load folds every registered kit
// (prepareKitDigests), so no match frame builds kit text: one kit's text is
// millions of Lua instructions (perf bot-blademaster).
const MOVES_DIGESTS = new Map<Readonly<FighterMoves>, string>();
const SPECIALS_DIGESTS = new Map<Readonly<FighterSpecials>, string>();
const PLACEMENT_DIGESTS = new Map<Readonly<SpecialPlacement>, string>();
const placedSpecCanonical = (spec: Readonly<SpecialPlacement>): string => specialPlacementCanonical(spec, "placedSpec");
let kitDigestBuilds = 0;

/** Kit texts folded so far; a match frame after prepareKitDigests adds none. */
export function kitDigestBuildCount(): number {
  return kitDigestBuilds;
}

function kitDigestField<K>(name: string, kit: K | undefined, digests: Map<K, string>, text: (kit: K) => string): string {
  if (kit === undefined) return "";
  let digest = digests.get(kit);
  if (digest === undefined) {
    kitDigestBuilds++;
    digest = canonicalChecksum(text(kit));
    digests.set(kit, digest);
  }
  return `|${name}.digest=${digest}`;
}

/** Immutable authored kit identity used by delayed opponent observations. */
export function observedOpponentKitCanonical(fighter: Readonly<Fighter>): string {
  return kitDigestField("moves", fighter.tuning.moves, MOVES_DIGESTS, fighterMovesCanonical)
    + kitDigestField("specials", fighter.tuning.specials, SPECIALS_DIGESTS, fighterSpecialsCanonical);
}

const absentKit = {};
const kitTexts = new WeakMap<object, WeakMap<object, string>>();

function kitText(f: Readonly<Fighter>): string {
  const moves = f.tuning.moves ?? absentKit;
  const specials = f.tuning.specials ?? absentKit;
  let texts = kitTexts.get(moves);
  if (texts === undefined) {
    texts = new WeakMap<object, string>();
    kitTexts.set(moves, texts);
  }
  let text = texts.get(specials);
  if (text === undefined) {
    text = observedOpponentKitCanonical(f).replaceAll("|", ";");
    texts.set(specials, text);
  }
  return text;
}

export interface ObservationWriter {
  readonly byte: (this: void, code: number) => void;
  /** Writes the separator before the scalar as well as its canonical number. */
  readonly number: (this: void, value: number) => void;
  readonly text: (this: void, text: string, repetitions: number) => void;
}
const PROJECTILE_OBSERVATION_FIELDS = ["life", "x", "z", "direction", "velocityX", "velocityZ", "serial"] as const;
interface RepeatedProjectile { readonly values: readonly [number, number, number, number, number, number, number]; readonly text: string }
let repeatedProjectile: RepeatedProjectile | undefined;

function repeatedProjectileText(p: Readonly<Fighter["projectiles"][number]>): string | undefined {
  if (p.life !== 0) return undefined;
  if (repeatedProjectile === undefined) {
    const values: RepeatedProjectile["values"] = [p.life, p.x, p.z, p.direction, p.velocityX, p.velocityZ, p.serial];
    const parts: string[] = [];
    const emit = (code: number) => { parts.push(String.fromCharCode(code)); };
    for (const key of PROJECTILE_OBSERVATION_FIELDS) {
      emit(44); writeCanonicalNumber(emit, p[key]);
    }
    repeatedProjectile = { values, text: parts.join("") };
  }
  const values = repeatedProjectile.values;
  if (p.life !== values[0] || p.x !== values[1] || p.z !== values[2] || p.direction !== values[3]
    || p.velocityX !== values[4] || p.velocityZ !== values[5] || p.serial !== values[6]) return undefined;
  return repeatedProjectile.text;
}

export function writeObservations(writer: ObservationWriter, opponents: Slots<Readonly<Fighter> | undefined>): void {
  for (const slot of PARTICIPANT_SLOTS) {
    if (slot !== 0) writer.byte(44);
    const f = opponents[slot];
    writeCanonicalNumber(writer.byte, f === undefined ? 0 : 1);
    if (f === undefined) continue;
    writer.byte(44);
    const kit = kitText(f);
    writer.text(kit, 1);
    writer.number(f.tuning.physics.gravity);
    writer.number(f.tuning.physics.terminalSpeed);
    writer.number(f.tuning.tech.ceilingImpulseFrame);
    writer.number(f.character);
    writer.number(f.facing);
    writer.number(f.motion.x);
    writer.number(f.motion.z);
    writer.number(f.motion.deltaX);
    writer.number(f.motion.deltaZ);
    writer.number(f.motion.vx);
    writer.number(f.motion.vz);
    writer.number(f.motion.grounded ? 1 : 0);
    writer.number(f.motion.surface ?? -1);
    writer.number(f.attack.style ?? -1);
    writer.number(f.attack.frame);
    writer.number(f.attack.duration);
    writer.number(f.attack.serial);
    writer.number(f.attack.cooldown);
    writer.number(f.special.action);
    if (f.special.ex) writer.number(197);
    if (f.special.exArmorUsed) writer.number(198);
    writer.number(f.special.frame);
    writer.number(f.special.duration);
    writer.number(f.special.lockFrames);
    writer.number(f.special.form);
    writer.number(f.special.grabFrame);
    writer.number(f.shield.raised ? 1 : 0);
    writer.number(f.shield.stun);
    writer.number(f.shield.releaseLag);
    writer.number(f.launch.hitstun);
    writer.number(f.launch.hitlag);
    writer.number(f.hits.lastAttacker ?? -1);
    writer.number(f.status.out ? 1 : 0);
    writer.number(f.status.stocks);
    writer.number(f.status.damage);
    writer.number(f.status.invincible);
    writer.number(f.status.frozenFrames);
    writer.number(f.status.condition);
    writer.number(f.status.conditionFrames);
    writer.number(f.status.poisonFrames);
    writer.number(f.landing.lag);
    writer.number(f.down.state);
    writer.number(f.down.frame);
    writer.number(f.down.direction);
    writer.number(f.down.faceUp ? 1 : 0);
    writer.number(f.grab.owner ?? -1);
    writer.number(f.grab.target ?? -1);
    writer.number(f.grab.action);
    writer.number(f.ledge.state);
    writer.number(f.ledge.side);
    writer.number(f.ledge.intangible);
    writer.number(f.dodge.groundFrame);
    writer.number(f.dodge.groundDirection);
    writer.number(f.dodge.airDodging ? 1 : 0);
    writer.number(f.dodge.airFrame);
    writer.number(f.surfaceRecovery.state);
    writer.number(f.surfaceRecovery.frame);
    writer.number(f.cannon.held ?? -1);
    writer.number(f.bear.life);
    writer.number(f.bear.x);
    writer.number(f.bear.z);
    writer.number(f.bear.hitSerial);
    let repeatedCount = 0;
    let repeatedText = "";
    for (const p of f.projectiles) {
      const repeated = repeatedProjectileText(p);
      if (repeated !== undefined) { repeatedText = repeated; repeatedCount++; continue; }
      if (repeatedCount > 0) { writer.text(repeatedText, repeatedCount); repeatedCount = 0; }
      writer.number(p.life);
      writer.number(p.x);
      writer.number(p.z);
      writer.number(p.direction);
      writer.number(p.velocityX);
      writer.number(p.velocityZ);
      writer.number(p.serial);
    }
    if (repeatedCount > 0) writer.text(repeatedText, repeatedCount);
  }
}

/** Text is materialized only for replay serialization and difference reporting. */
export function botObservationCanonical(sample: Readonly<BotObservationFrame>): string {
  const parts: string[] = [];
  const byte = (code: number) => { parts.push(String.fromCharCode(code)); };
  writeObservations({ byte,
    number: value => { byte(44); writeCanonicalNumber(byte, value); },
    text: (text, repetitions) => { parts.push(text.repeat(repetitions)); },
  }, sample.opponents);
  return parts.join("");
}

function writeFighter(emit: Emit, prefix: string, fighter: Readonly<Fighter>, participantMask: number): void {
  const int = (name: string, value: number) => emit(canonicalInt(`${prefix}.${name}`, value));
  const bool = (name: string, value: boolean) => emit(canonicalBoolean(`${prefix}.${name}`, value));
  const real = (name: string, value: number) => emit(canonicalRealField(`${prefix}.${name}`, value));
  const reference = (name: string, slot: number | undefined) => int(name, canonicalSlot(slot, participantMask));
  const t = fighter.tuning;
  const m = fighter.motion;
  const g = fighter.ground;
  const j = fighter.jump;
  const l = fighter.launch;
  const s = fighter.shield;
  const a = fighter.attack;
  const sp = fighter.special;
  const v = fighter.visuals;
  const sr = fighter.surfaceRecovery;
  const gr = fighter.grab;
  const ledge = fighter.ledge;
  const st = fighter.status;

  int("ceilingTechImpulseFrame", t.tech.ceilingImpulseFrame);
  int("ceilingTechAnimationEndFrame", t.tech.ceilingAnimationEndFrame);
  int("wallTechAnimationEndFrame", t.tech.wallAnimationEndFrame);
  int("wallJumpTechAnimationEndFrame", t.tech.wallJumpAnimationEndFrame);
  int("dashGrabWindow", g.dashGrabWindow);
  int("groundAction", g.action);
  int("groundActionFrame", g.actionFrame);
  int("groundRunBrakeFramesRemaining", g.runBrakeFramesRemaining);
  int("groundTurnRunEntryFacing", g.turnRunEntryFacing);
  int("groundRules.dashRunEnableFrame", t.ground.dashRunEnableFrame);
  int("groundRules.turnRunFacingCommandFrame", t.ground.turnRunFacingCommandFrame);
  int("groundRules.turnRunAnimationEndFrame", t.ground.turnRunAnimationEndFrame);
  int("groundRules.runBrakeTurnCommandEndFrame", t.ground.runBrakeTurnCommandEndFrame);
  int("groundRules.runBrakeAnimationEndFrame", t.ground.runBrakeAnimationEndFrame);
  int("groundRules.runBrakeMaximumFrames", t.ground.runBrakeMaximumFrames);
  int("dashGrabTiming.startupFrames", t.dashGrab.startupFrames);
  int("dashGrabTiming.activeFrames", t.dashGrab.activeFrames);
  int("dashGrabTiming.totalFrames", t.dashGrab.totalFrames);
  bool("dashGrabAttack", a.dashGrab);
  bool("pivotGrabAttack", a.pivotGrab);
  bool("groundTurnRunFacingCommandLatched", g.turnRunFacingCommandLatched);
  bool("groundTurnRunPausePending", g.turnRunPausePending);
  int("character", fighter.character);
  emit(kitDigestField(`${prefix}.moves`, t.moves, MOVES_DIGESTS, fighterMovesCanonical));

  real("physics.weight", t.physics.weight);
  real("physics.gravity", t.physics.gravity);
  real("physics.terminalSpeed", t.physics.terminalSpeed);
  real("physics.fastFallSpeed", t.physics.fastFallSpeed);
  real("physics.airAcceleration", t.physics.airAcceleration);
  real("physics.airSpeed", t.physics.airSpeed);
  real("physics.airFriction", t.physics.airFriction);
  real("physics.airCap", t.physics.airCap);
  real("physics.traction", t.physics.traction);
  real("physics.dashSpeed", t.physics.dashSpeed);
  real("physics.runSpeed", t.physics.runSpeed);
  real("physics.walkSpeed", t.physics.walkSpeed);
  int("physics.jumpSquatFrames", t.physics.jumpSquatFrames);
  real("physics.fullJumpSpeed", t.physics.fullJumpSpeed);
  real("physics.shortJumpSpeed", t.physics.shortJumpSpeed);
  real("physics.aerialJumpSpeed", t.physics.aerialJumpSpeed);
  real("physics.jumpMomentum", t.physics.jumpMomentum);
  real("physics.jumpHorizontalSpeed", t.physics.jumpHorizontalSpeed);
  real("physics.jumpHorizontalCap", t.physics.jumpHorizontalCap);
  real("physics.aerialJumpHorizontalSpeed", t.physics.aerialJumpHorizontalSpeed);
  real("physics.shieldBreakSpeed", t.physics.shieldBreakSpeed);
  int("facing", fighter.facing);
  int("turnaroundSide", m.turnaroundSide);
  int("turnaroundAge", m.turnaroundAge);
  int("dashFrame", g.dashFrame);
  int("dashDirection", g.dashDirection);
  real("x", m.x);
  real("z", m.z);
  real("vx", m.vx);
  real("vz", m.vz);
  real("motionX.original", m.meleeX.original);
  real("motionX.published", m.meleeX.published);
  real("motionZ.original", m.meleeZ.original);
  real("motionZ.published", m.meleeZ.published);
  real("motionVelocityZ.original", m.meleeVelocityZ.original);
  real("motionVelocityZ.published", m.meleeVelocityZ.published);
  real("knockbackX", l.knockbackX);
  real("knockbackZ", l.knockbackZ);
  real("motionKnockbackX.original", l.meleeKnockbackX.original);
  real("motionKnockbackX.published", l.meleeKnockbackX.published);
  real("motionKnockbackZ.original", l.meleeKnockbackZ.original);
  real("motionKnockbackZ.published", l.meleeKnockbackZ.published);
  real("damage", st.damage);
  int("stocks", st.stocks);
  int("hitstun", l.hitstun);
  bool("throwHitstun", l.throwHitstun);
  int("hitlag", l.hitlag);
  bool("diPending", l.diPending);
  real("diLaunchSpeed", l.diLaunchSpeed);
  int("diSerial", l.diSerial);
  real("diAngleDegrees", l.diAngleDegrees);
  bool("sdiWasGrounded", l.sdiWasGrounded);
  bool("sdiLaunchesUpward", l.sdiLaunchesUpward);
  int("sdiSerial", l.sdiSerial);
  int("asdiSerial", l.asdiSerial);
  int("sdiHitTravel", l.sdiHitTravel);
  int("sdiStringTravel", l.sdiStringTravel);
  int("sdiStepX", l.sdiStepX);
  int("sdiStepZ", l.sdiStepZ);
  int("sdiStepTravel", l.sdiStepTravel);
  int("sdiNextX", l.sdiNextX);
  int("sdiNextZ", l.sdiNextZ);
  int("sdiNextTravel", l.sdiNextTravel);
  int("cooldown", a.cooldown);
  int("attackStyle", a.style ?? -1);
  int("attackFrame", a.frame);
  int("attackDuration", a.duration);
  int("attackSerial", a.serial);
  bool("attackHit", a.hit);
  for (let i = 0; i < PARTICIPANT_CAPACITY; i++) reference(`hitAttackers[${i}]`, at(fighter.hits.entries, i).attacker);
  for (let i = 0; i < PARTICIPANT_CAPACITY; i++) int(`hitSerials[${i}]`, at(fighter.hits.entries, i).attackSerial);
  for (let i = 0; i < PARTICIPANT_CAPACITY; i++) int(`hitWindows[${i}]`, at(fighter.hits.entries, i).window);
  for (let i = 0; i < PARTICIPANT_CAPACITY; i++) reference(`specialHitTargets[${i}]`, sp.hitTargets[i]);
  reference("lastHitAttacker", fighter.hits.lastAttacker);
  int("lastHitAttackSerial", fighter.hits.lastAttackSerial ?? -1);
  int("lastHitWindow", fighter.hits.lastWindow);
  bool("smashCharging", a.smashCharging);
  int("smashChargeFrames", a.smashChargeFrames);
  bool("smashChargeAllowed", a.smashChargeAllowed);
  for (let i = 0; i < PROJECTILE_CAPACITY; i++) int(`projectileLife[${i}]`, at(fighter.projectiles, i).life);
  for (let i = 0; i < PROJECTILE_CAPACITY; i++) real(`projectileX[${i}]`, at(fighter.projectiles, i).x);
  for (let i = 0; i < PROJECTILE_CAPACITY; i++) real(`projectileZ[${i}]`, at(fighter.projectiles, i).z);
  for (let i = 0; i < PROJECTILE_CAPACITY; i++) int(`projectileDirection[${i}]`, at(fighter.projectiles, i).direction);
  for (let i = 0; i < PROJECTILE_CAPACITY; i++) int(`projectileKind[${i}]`, at(fighter.projectiles, i).kind);
  for (let i = 0; i < PROJECTILE_CAPACITY; i++) real(`projectileDamageMultiplier[${i}]`, at(fighter.projectiles, i).damageMultiplier);
  for (let i = 0; i < PROJECTILE_CAPACITY; i++) int(`projectileVisualFamily[${i}]`, at(fighter.projectiles, i).visualFamily);
  for (let i = 0; i < PROJECTILE_CAPACITY; i++) bool(`projectileNewlyReflected[${i}]`, at(fighter.projectiles, i).newlyReflected);
  for (let i = 0; i < PROJECTILE_CAPACITY; i++) real(`projectileVelocityX[${i}]`, at(fighter.projectiles, i).velocityX);
  for (let i = 0; i < PROJECTILE_CAPACITY; i++) real(`projectileVelocityZ[${i}]`, at(fighter.projectiles, i).velocityZ);
  for (let i = 0; i < PROJECTILE_CAPACITY; i++) int(`projectileSerial[${i}]`, at(fighter.projectiles, i).serial);
  int("manaDrainedSerial", v.manaDrained);
  for (let i = 0; i < PROJECTILE_CAPACITY; i++) if (at(fighter.projectiles, i).exReach) int(`projectileExReach[${i}]`, 1);
  // A pool's growth and strike wait (the Lich King's Defile); written only while either is live.
  for (let i = 0; i < PROJECTILE_CAPACITY; i++) {
    const projectile = at(fighter.projectiles, i);
    if (projectile.poolHits !== 0) int(`projectilePoolHits[${i}]`, projectile.poolHits);
    if (projectile.poolWait !== 0) int(`projectilePoolWait[${i}]`, projectile.poolWait);
  }
  int("specialAction", sp.action);
  if (sp.ex) bool("specialEx", true);
  if (sp.exArmorUsed) bool("specialExArmorUsed", true);
  int("specialFrame", sp.frame);
  int("specialDuration", sp.duration);
  int("specialLockFrames", sp.lockFrames);
  bool("specialFall", sp.fall);
  for (let i = 0; i < SPECIAL_ACTION_CAPACITY; i++) {
    const cooldown = at(sp.cooldowns, i);
    if (i < SpecialAction.heroNeutral || cooldown !== 0) int(`specialCooldowns[${i}]`, cooldown);
  }
  int("specialDirection", sp.direction);
  bool("specialHit", sp.hit);
  int("bearLife", fighter.bear.life);
  if (fighter.bear.exDamage) int("bearExDamage", 1);
  real("bearX", fighter.bear.x);
  real("bearZ", fighter.bear.z);
  real("bearVelocityX", fighter.bear.velocityX);
  real("bearVelocityZ", fighter.bear.velocityZ);
  int("bearSwipeCooldown", fighter.bear.swipeCooldown);
  int("bearHitSerial", fighter.bear.hitSerial);
  int("bearSurface", fighter.bear.surface ?? -1);
  int("hippogryphLife", fighter.hippogryph.life);
  real("hippogryphX", fighter.hippogryph.x);
  real("hippogryphZ", fighter.hippogryph.z);
  real("hippogryphVelocityX", fighter.hippogryph.velocityX);
  real("hippogryphVelocityZ", fighter.hippogryph.velocityZ);
  int("hippogryphKind", fighter.hippogryph.kind);
  int("freezeTrapLife", fighter.freezeTrap.life);
  if (fighter.freezeTrap.exReach) int("freezeTrapExReach", 1);
  int("freezeTrapArming", fighter.freezeTrap.arming);
  real("freezeTrapX", fighter.freezeTrap.x);
  real("freezeTrapZ", fighter.freezeTrap.z);
  int("freezeTrapSurface", fighter.freezeTrap.surface ?? -1);
  int("freezeTrapSerial", fighter.freezeTrap.serial);
  int("frozenFrames", st.frozenFrames);
  int("offscreenFrames", st.offscreenFrames);
  int("freezeImmunityFrames", st.freezeImmunityFrames);
  int("freezeTrapCooldown", fighter.freezeTrap.cooldown);
  bool("out", st.out);
  int("respawn", st.respawn);
  bool("shield", s.raised);
  real("shieldTiltX", s.tiltX);
  real("shieldTiltZ", s.tiltZ);
  real("shieldEnergy", s.energy);
  int("shieldStun", s.stun);
  int("shieldHeldFrames", s.heldFrames);
  int("shieldReleaseLag", s.releaseLag);
  int("shieldBreakState", s.breakState);
  int("shieldBreakFrame", s.breakFrame);
  int("shieldBreakSerial", s.breakSerial);
  real("shieldBreakRemaining", s.breakRemaining);
  bool("grounded", m.grounded);
  bool("crouching", m.crouching);
  bool("fastFalling", m.fastFalling);
  int("jumps", j.remaining);
  int("jumpSerial", j.serial);
  bool("jumpIsDouble", j.isDouble);
  int("jumpSquat", j.squat);
  int("jumpAscent", j.ascent);
  bool("jumpDodgeQueued", j.dodgeQueued);
  int("jumpDodgeX", j.dodgeX);
  int("jumpDodgeZ", j.dodgeZ);
  bool("jumpHeld", j.held);
  int("invincible", st.invincible);
  int("surface", m.surface ?? -1);
  int("airDodgeTime", fighter.dodge.airMotionFrames);
  int("landingLag", fighter.landing.lag);
  bool("airDodging", fighter.dodge.airDodging);
  int("airDodgeFrame", fighter.dodge.airFrame);
  bool("airDodgeUsed", fighter.dodge.airUsed);
  int("groundDodgeFrame", fighter.dodge.groundFrame);
  int("groundDodgeDirection", fighter.dodge.groundDirection);
  int("groundDodgeEntryFacing", fighter.dodge.groundEntryFacing);
  int("downState", fighter.down.state);
  int("downFrame", fighter.down.frame);
  int("downDirection", fighter.down.direction);
  int("downWaitRemaining", fighter.down.waitRemaining);
  bool("downFaceUp", fighter.down.faceUp);
  bool("downAttackQueued", fighter.down.attackQueued);
  int("techWindow", fighter.tech.window);
  int("techPressAge", fighter.tech.pressAge);
  int("techPreviousPressAge", fighter.tech.previousPressAge);
  bool("techAccumulatedPress", fighter.tech.accumulatedPress);
  int("grabbedFrames", gr.grabbedFrames);
  int("grabAction", gr.action);
  int("grabFrame", gr.frame);
  int("grabPummels", gr.pummels);
  int("grabHeldFrames", gr.heldFrames);
  int("grabQueuedThrow", gr.queuedThrow);
  int("grabSerial", gr.serial);
  int("grabMashX", gr.mashX);
  int("grabMashZ", gr.mashZ);
  reference("grabOwner", gr.owner);
  reference("grabTarget", gr.target);
  int("ledgeState", ledge.state);
  int("ledgeSide", ledge.side);
  int("ledgeFrame", ledge.frame);
  int("ledgeSerial", ledge.serial);
  int("ledgeIntangible", ledge.intangible);
  int("ledgeRegrab", ledge.regrab);
  const p = fighter.platform;
  int("platformMove", p.move);
  int("platformFrame", p.frame);
  int("platformDuration", p.duration);
  int("platformDeck", p.deck ?? -1);
  real("platformFromX", p.fromX);
  real("platformToX", p.toX);
  real("platformFromZ", p.fromZ);
  real("platformToZ", p.toZ);
  real("platformRise", p.rise);
  bool("platformStand", p.stand);
  bool("platformShield", p.shield);
  int("platformWrapLeft", p.wrapLeft);
  int("platformWrapLeftAge", p.wrapLeftAge);
  int("platformWrapRight", p.wrapRight);
  int("platformWrapRightAge", p.wrapRightAge);
  bool("platformDodgeQueued", p.dodgeQueued);
  int("platformDodgeX", p.dodgeX);
  int("platformDodgeZ", p.dodgeZ);
  bool("platformSpecialQueued", p.specialQueued);
  int("platformSpecialX", p.specialX);
  int("platformSpecialZ", p.specialZ);
  int("cannonHeld", fighter.cannon.held ?? -1);
  int("cannonFiring", fighter.cannon.firing ?? -1);
  int("cannonCooldown", fighter.cannon.cooldown);
  bool("cannonPassing", fighter.cannon.passing);
  bool("waterIn", fighter.water.inWater);
  int("waterFrames", fighter.water.frames);
  int("waterEntries", fighter.water.entries);
  int("waterHydraFrame", fighter.water.hydraFrame);
  real("waterHydraX", fighter.water.hydraX);

  real("physics.walkAccelerationMultiplier", t.physics.walkAccelerationMultiplier);
  real("physics.walkAccelerationBase", t.physics.walkAccelerationBase);
  real("physics.groundAccelerationMultiplier", t.physics.groundAccelerationMultiplier);
  real("physics.groundAccelerationBase", t.physics.groundAccelerationBase);
  real("physics.groundSpeedCap", t.physics.groundSpeedCap);
  real("positionDeltaX", m.deltaX);
  real("positionDeltaZ", m.deltaZ);
  real("groundKnockbackX", l.groundKnockbackX);
  int("knockbackAgeFrames", l.knockbackAge ?? -1);
  int("damageLevel", l.damageLevel);
  real("shieldPushbackX", s.pushbackX);
  real("shieldRecoilX", s.recoilX);
  real("shieldRecoilZ", s.recoilZ);
  real("motionRecoilX.original", s.meleeRecoilX.original);
  real("motionRecoilX.published", s.meleeRecoilX.published);
  real("motionRecoilZ.original", s.meleeRecoilZ.original);
  real("motionRecoilZ.published", s.meleeRecoilZ.published);
  bool("shieldDrainResumePending", s.drainResumePending);
  int("grabVisualSerial", v.grab);
  int("throwVisualSerial", v.throw);
  int("hitVisualSerial", v.hit);
  bool("hitVisualElectric", v.hitElectric);
  int("hitVisualElement", v.hitElement);
  int("hitVisualStrength", v.hitStrength);
  int("hitVisualHeight", v.hitHeight);
  bool("hitVisualPummel", v.hitPummel);
  bool("shieldVisualElectric", v.shieldElectric);
  int("shieldVisualSerial", v.shield);
  bool("fastFallDownHeld", m.fastFallDownHeld);
  int("fastFallInputAge", m.fastFallInputAge);
  int("surfaceRecoveryState", sr.state);
  int("surfaceRecoveryFrame", sr.frame);
  bool("surfaceRecoveryVelocityApplied", sr.velocityApplied);
  int("surfaceReflectCooldown", sr.reflectCooldown);
  int("lastReflectedSurface", sr.lastReflectedSurface ?? -1);
  int("surfaceContactSerial", sr.contactSerial);
  int("surfaceContactKind", sr.contactKind);
  real("surfaceContactApproachSpeed", sr.contactApproachSpeed);
  real("surfaceContactX", sr.contactX);
  real("surfaceContactZ", sr.contactZ);
  real("surfaceContactNormalX", sr.contactNormalX);
  real("surfaceContactNormalZ", sr.contactNormalZ);
  real("surfacePhysics.passiveWallSpeed", t.surface.passiveWallSpeed);
  real("surfacePhysics.wallJumpHorizontalSpeed", t.surface.wallJumpHorizontalSpeed);
  real("surfacePhysics.wallJumpVerticalSpeed", t.surface.wallJumpVerticalSpeed);
  real("surfacePhysics.passiveCeilingSpeed", t.surface.passiveCeilingSpeed);
  real("surfacePhysics.wallJumpMinimumApproach", t.surface.wallJumpMinimumApproach);
  bool("surfacePhysics.canWallJump", t.surface.canWallJump);
  emit(kitDigestField(`${prefix}.specials`, t.specials, SPECIALS_DIGESTS, fighterSpecialsCanonical));
  int("manaPoints", fighter.mana.points);
  int("manaDeniedSerial", v.manaDenied);
  // Other hero state is written only where a hero kit or hero projectile exists.
  if (t.specials !== undefined) {
    int("specialForm", sp.form);
    int("specialAimX", sp.aimX);
    int("specialAimZ", sp.aimZ);
    int("specialAirtimeUses", sp.airtimeUses);
    if (sp.grabFrame !== 0) int("specialGrabFrame", sp.grabFrame);
    int("armorFrames", st.armorFrames);
    real("armorMaxDamage", st.armorMaxDamage);
    if (st.armorChills) int("armorChills", 1);
    for (let animal = 0; animal <= fighter.pack.length; animal++) {
      const placed = placedObject(fighter, animal);
      const animalName = animal === 0 ? "placed" : `pack[${animal - 1}]`;
      int(`${animalName}Life`, placed.life);
      int(`${animalName}Age`, placed.age);
      real(`${animalName}X`, placed.x);
      real(`${animalName}Z`, placed.z);
      int(`${animalName}Direction`, placed.direction);
      real(`${animalName}Durability`, placed.durability);
      int(`${animalName}Serial`, placed.serial);
      for (let i = 0; i < PARTICIPANT_CAPACITY; i++) int(`${animalName}Struck[${i}]`, placed.struck[i] ?? -1);
      int(`${animalName}SpecialStruck`, placed.specialStruck);
      // Command and movement state exists only for companion objects.
      if (placed.spec?.companion !== undefined) {
        int(`${animalName}Mode`, placed.mode);
        int(`${animalName}ModeFrame`, placed.modeFrame);
        int(`${animalName}Apart`, placed.apart);
        int(`${animalName}Bitten`, placed.bitten);
        int(`${animalName}Surface`, placed.surface ?? -1);
      }
      emit(kitDigestField(`${prefix}.${animalName}Spec`, placed.spec, PLACEMENT_DIGESTS, placedSpecCanonical));
    }
    int("specialGuarded", sp.guarded ? 1 : 0);
    if (st.divineFrames !== 0) int("divineFrames", st.divineFrames);
  }
  // An item's buff (#196), written only while one runs.
  if (st.buff !== 0 || st.buffFrames !== 0) {
    int("buff", st.buff);
    int("buffFrames", st.buffFrames);
  }
  // Any fighter can carry a hero status; it is written only while one or its immunity is live.
  if (st.condition !== 0 || st.conditionImmunity.some(frames => frames !== 0)) {
    int("condition", st.condition);
    int("conditionFrames", st.conditionFrames);
    int("conditionGroup", st.conditionGroup);
    int("conditionImmunityFrames", st.conditionImmunityFrames);
    for (let i = 0; i < HERO_STATUS_GROUPS; i++) int(`conditionImmunity[${i}]`, st.conditionImmunity[i] ?? 0);
  }
  if (st.poisonFrames !== 0) {
    int("poisonFrames", st.poisonFrames);
    int("poisonEvery", st.poisonEvery);
    real("poisonDamage", st.poisonDamage);
  }
  for (let i = 0; i < PROJECTILE_CAPACITY; i++) {
    const spec = at(fighter.projectiles, i).spec;
    if (spec !== undefined) emit(specialProjectileCanonical(spec, `${prefix}.projectileSpec[${i}]`));
  }
}

function writeState(emit: Emit, state: Readonly<ReplayState>): void {
  const { world, match, controls, runtime } = state;
  const int = (name: string, value: number) => emit(canonicalInt(name, value));
  const bool = (name: string, value: boolean) => emit(canonicalBoolean(name, value));
  emit("SmashcraftReplay2");
  int("participantMask", world.mask);
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    writeFighter(emit, `fighter[${slot}]`, fighterAt(world, slot), world.mask);
    const command = attackBufferCanonicalState(controls.commands[slot]);
    int(`commands[${slot}].windowFrames`, command.graceFrames);
    int(`commands[${slot}].style`, command.style);
    int(`commands[${slot}].facing`, command.facing);
    int(`commands[${slot}].targetFrame`, command.targetFrame);
    int(`commands[${slot}].consumedFacing`, command.consumedFacing);
    bool(`commands[${slot}].mayCharge`, command.mayCharge);
    bool(`commands[${slot}].consumedMayCharge`, command.consumedMayCharge);
  }
  int("match.phase", match.phase);
  bool("match.camera.initialized", match.camera.initialized);
  for (const key of ["x", "z", "distance", "tangent", "left", "right", "bottom", "top"] as const) emit(canonicalRealField(`match.camera.${key}`, match.camera[key]));
  for (const slot of PARTICIPANT_SLOTS) for (const key of ["left", "right", "bottom", "top"] as const) emit(canonicalRealField(`match.camera.box${slot}.${key}`, match.camera.boxes[slot][key]));
  int("match.stageChoice", match.stageChoice);
  bool("match.stageResolved", match.stageResolved);
  bool("match.stagePool.only", match.stagePool.only);
  int("match.stagePool.selectedMask", match.stagePool.selectedMask);
  int("match.stagePool.remainingMask", match.stagePool.remainingMask);
  bool("match.hazards", match.hazards);

  int("match.winner", match.winner ?? -1);
  int("match.humanCount", match.humanCount);
  int("match.humanMask", match.humanMask);
  int("match.humanFighterMask", match.humanFighterMask);
  int("match.computerMask", match.computerMask);
  int("match.departedMask", match.departedMask);
  bool("match.interrupted", match.interrupted);
  for (const slot of PARTICIPANT_SLOTS) {
    const prefix = `match.slot${slot}`;
    int(`${prefix}.character`, match.characterChoices[slot]);
    bool(`${prefix}.ready`, match.characterReadiness[slot]);
    bool(`${prefix}.rematch`, match.rematchReadiness[slot]);
    int(`${prefix}.cpuOpponent`, CPU_OPPONENT_CHOICES.indexOf(match.cpuOpponents[slot]));
    int(`${prefix}.cpuTier`, CPU_TIERS.indexOf(match.cpuTiers[slot]));
    int(`${prefix}.cpuResolvedOpponent`, CPU_OPPONENT_IDS.indexOf(match.cpuResolvedOpponents[slot]));
  }
  int("match.stockCount", match.stockCount);
  int("match.timeLimitMinutes", match.timeLimitMinutes);
  bool("match.endless", match.endless);
  bool("match.automaticRematch", match.automaticRematch);
  int("match.rematchCountdown", match.rematchCountdown);
  int("match.remainingFrames", match.remainingFrames);
  int("match.matchSeed", match.matchSeed);
  int("match.matchFrame", match.matchFrame);
  // Only matches with a countdown carry it, so test and practice matches keep their checksums.
  if (match.startHold !== 0) int("match.startHold", match.startHold);
  writeMatchItems(match.items, int, bool);
  bool("match.timedOut", match.timedOut);
  bool("match.practice", match.practice);
  // Only training matches carry training state, so every other match keeps its checksum.
  if (match.training) {
    bool("match.training", true);
    writeTrainingState(match.trainer, int, bool, (name, value) => emit(canonicalRealField(name, value)));
  }
  // Only Classic selection and configured runs carry their state, so every other match keeps its checksum.
  if (match.classic) {
    bool("match.classic", true);
    int("match.classicTier", match.classicTier);
  }
  if (match.lore) {
    bool("match.lore", true);
    int("match.loreBattle", match.loreBattle);
  }
  if (match.run.active) writeConfiguredRun(match.run, int, bool, (name, value) => emit(canonicalRealField(name, value)), (name, value) => emit(`|${name}=${value}`));
  int("runtime.simulationFrame", runtime.simulationFrame);
  for (const slot of PARTICIPANT_SLOTS) emit(canonicalRealField(`runtime.botAttackDelays[${slot}]`, runtime.botAttackDelays[slot]));
  const memory = runtime.botMemory;
  for (const slot of PARTICIPANT_SLOTS) {
    const strategy = runtime.botStrategies[slot];
    if (strategy.observedFrame >= 0) {
      const values = botStrategyValues(strategy);
      for (let index = 0; index < values.length; index++) int(`runtime.botStrategies[${slot}].values[${index}]`, at(values, index));
    }
  }
  if (memory.history.length > 0) {
    for (let index = 0; index < memory.history.length; index++) {
      const observation = at(memory.history, index);
      int(`runtime.botMemory.history[${index}].frame`, observation.frame);
      emit(`|runtime.botMemory.history[${index}].values=${botObservationCanonical(observation)}`);
    }
    for (const slot of PARTICIPANT_SLOTS) {
      int(`runtime.botMemory.directions[${slot}]`, memory.directions[slot]);
      int(`runtime.botMemory.directionFrames[${slot}]`, memory.directionFrames[slot]);
    }
  }
}

/** The Replay2 text of a state; capture live state into a snapshot first, as Wurst does. */
export function canonicalState(state: Readonly<ReplayState>): string {
  const parts: string[] = [];
  writeState(fragment => { parts.push(fragment); }, state);
  return parts.join("");
}

/** canonicalChecksum(canonicalState(state)), folded fragment by fragment without building the text. */
export function stateChecksum(state: Readonly<ReplayState>): string {
  const lanes: ChecksumLanes = { valid: true, first: 0, second: 0 };
  writeState(fragment => foldChecksum(lanes, fragment), state);
  return checksumText(lanes);
}

/** A state's checksum folded a slice at a time, so no one callback folds the whole text. */
export interface StateChecksumFold {
  readonly text: string;
  position: number;
  readonly lanes: ChecksumLanes;
}

/** Captures the state's canonical text now; foldStateChecksum folds it later, after the state has moved on. */
export function beginStateChecksum(state: Readonly<ReplayState>): StateChecksumFold {
  return { text: canonicalState(state), position: 0, lanes: { valid: true, first: 0, second: 0 } };
}

/** Folds up to `characters` more of the text; once all of it is folded, the captured state's stateChecksum. */
export function foldStateChecksum(fold: StateChecksumFold, characters: number): string | undefined {
  const end = Math.min(fold.text.length, fold.position + characters);
  foldChecksumRange(fold.lanes, fold.text, fold.position, end);
  fold.position = end;
  return end === fold.text.length ? checksumText(fold.lanes) : undefined;
}

/** Folds every registered hero kit's digest; map load calls it before any match frame. */
export function prepareKitDigests(): void {
  for (const moves of [ARCHER_MOVES, RIFLEMAN_MOVES]) kitDigestField("moves", moves, MOVES_DIGESTS, fighterMovesCanonical);
  for (const hero of HERO_ROSTER) {
    kitDigestField("moves", hero.moves, MOVES_DIGESTS, fighterMovesCanonical);
    kitDigestField("specials", hero.specials, SPECIALS_DIGESTS, fighterSpecialsCanonical);
    const specials = hero.specials;
    if (specials === undefined) continue;
    for (const kit of [specials.neutral, specials.side, specials.up, specials.down]) {
      // Only the forms a kit has: in Lua a list holding a missing form (nil) would end there.
      const forms: AuthoredSpecial[] = [kit.ground];
      if (kit.air !== undefined) forms.push(kit.air);
      if (kit.free !== undefined) forms.push(kit.free);
      if (kit.recall !== undefined) forms.push(kit.recall);
      if (kit.marked !== undefined) forms.push(kit.marked.special);
      for (const branch of kit.ground.followUps ?? []) forms.push(branch.special);
      for (const branch of kit.air?.followUps ?? []) forms.push(branch.special);
      for (const form of forms) {
        kitDigestField("placedSpec", form.placement, PLACEMENT_DIGESTS, placedSpecCanonical);
        kitDigestField("placedSpec", form.ex?.placement, PLACEMENT_DIGESTS, placedSpecCanonical);
      }
    }
  }
}
