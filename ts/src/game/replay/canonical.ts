// Keep the whole canonical record together: field order and spelling are
// shared with the retained replay oracle, including fields from every slot.
// Replay2, Wurst ReplayState's canonical tape of gameplay state. Labels,
// order and number formats are a cross-runtime contract: a tape compares
// these strings and checksums between Wurst's Lua, Bun and 32-bit Lua.
import { attackBufferCanonicalState } from "../input/attackBuffer";
import { PARTICIPANT_CAPACITY, PARTICIPANT_SLOTS, participantActive } from "../input/participants";
import { at } from "wisp/src/runtime/lookup";
import { floorMod } from "wisp/src/sim/intMath";
import { AttackStyle, GrabAction, SPECIAL_ACTION_CAPACITY } from "../sim/codes";
import type { FighterMoves } from "../sim/heroMoves";
import type { AuthoredSpecial, FighterSpecials, SpecialPlacement, SpecialProjectile } from "../sim/heroSpecials";
import type { HitEffect } from "../sim/hitRegions";
import { type HurtPart, HurtState } from "../sim/hurtboxes";
import { HERO_STATUS_GROUPS } from "../sim/codes";
import { PROJECTILE_CAPACITY, type Fighter } from "../sim/fighter";
import { fighterAt, isActive } from "../sim/roster";
import type { ReplayState } from "./snapshot";

const REPLAY_CHECKSUM_MODULUS = 1_000_003;

/** Exact finite binary representation: sign, binary exponent and 52 fraction bits as two 26-bit integers. */
export function canonicalReal(value: number): string {
  if (value !== value) return "nan";
  const negative = value < 0;
  if (!negative && !(value > 0)) return "0";
  let magnitude = negative ? -value : value;
  if (magnitude * 2 === magnitude) return negative ? "-inf" : "+inf";
  let exponent = 0;
  while (magnitude >= 2) {
    magnitude /= 2;
    exponent++;
  }
  while (magnitude < 1) {
    magnitude *= 2;
    exponent--;
  }
  let fraction = magnitude - 1;
  let high = 0;
  for (let i = 0; i < 26; i++) {
    fraction *= 2;
    high *= 2;
    if (fraction >= 1) {
      high++;
      fraction--;
    }
  }
  let low = 0;
  for (let i = 0; i < 26; i++) {
    fraction *= 2;
    low *= 2;
    if (fraction >= 1) {
      low++;
      fraction--;
    }
  }
  return `${negative ? "-" : "+"}${exponent}:${high}:${low}`;
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
  };
  int("chargeFrames", moves.smashMaxChargeFrames);
  int("maxPummels", moves.maxPummels ?? -1);
  real("chargeMultiplier", moves.smashMaxDamageMultiplier);
  for (let style = 0; style <= AttackStyle.dashAttack; style++) {
    const move = moves.normals[style];
    if (move === undefined) continue;
    const name = `normal[${style}]`;
    int(`${name}.startup`, move.startupFrames);
    int(`${name}.active`, move.activeFrames);
    int(`${name}.total`, move.totalFrames);
    int(`${name}.landingLag`, move.landingLag);
    real(`${name}.travel`, move.startupTravelX ?? 0.0);
    int(`${name}.stopsAtBody`, move.startupStopsAtBody ? 1 : 0);
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
  for (let style = 0; style <= AttackStyle.dashAttack; style++) {
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
function specialProjectileCanonical(spec: Readonly<SpecialProjectile>, prefix: string): string {
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
  if (spec.status !== undefined) {
    int("status.kind", spec.status.kind);
    int("status.frames", spec.status.frames);
    int("status.group", spec.status.group);
    int("status.immunityFrames", spec.status.immunityFrames);
    if (spec.status.tick !== undefined) {
      int("status.tick.every", spec.status.tick.every);
      real("status.tick.damage", spec.status.tick.damage);
    }
  }
  real("backOffsetX", spec.backOffsetX ?? -1.0);
  int("needsLineOfSight", spec.needsLineOfSight === true ? 1 : 0);
  return result.join("");
}

/** An authored placed object, field by field. */
function specialPlacementCanonical(spec: Readonly<SpecialPlacement>, prefix: string): string {
  const result: string[] = [];
  const int = (name: string, value: number) => { result.push(canonicalInt(`${prefix}.${name}`, value)); };
  const real = (name: string, value: number) => { result.push(canonicalRealField(`${prefix}.${name}`, value)); };
  int("frame", spec.frame);
  real("offsetX", spec.offsetX);
  real("radius", spec.radius);
  real("height", spec.height);
  real("durability", spec.durability);
  int("life", spec.life);
  for (let index = 0; index < spec.fireAges.length; index++) int(`fireAge[${index}]`, at(spec.fireAges, index));
  result.push(specialProjectileCanonical(spec.shot, `${prefix}.shot`));
  return result.join("");
}

function hitEffectCanonical(hit: Readonly<HitEffect>, prefix: string): string {
  return canonicalRealField(`${prefix}.damage`, hit.damage) + canonicalRealField(`${prefix}.growth`, hit.growth)
    + canonicalRealField(`${prefix}.base`, hit.base) + canonicalRealField(`${prefix}.launchX`, hit.launchX)
    + canonicalRealField(`${prefix}.launchZ`, hit.launchZ) + canonicalInt(`${prefix}.electric`, hit.electric ? 1 : 0)
    + canonicalInt(`${prefix}.element`, hit.element ?? 0);
}

/** A hero's authored specials; empty for fighters without them. */
export function fighterSpecialsCanonical(specials: Readonly<FighterSpecials> | undefined, prefix = "specials"): string {
  if (specials === undefined) return "";
  const result: string[] = [canonicalInt(`${prefix}.mana.max`, specials.mana.max) + canonicalInt(`${prefix}.mana.delay`, specials.mana.regenDelayFrames)
    + canonicalInt(`${prefix}.mana.framesPerPoint`, specials.mana.framesPerPoint)];
  const kits = [specials.neutral, specials.side, specials.up, specials.down];
  for (let slot = 0; slot < kits.length; slot++) {
    const kit = at(kits, slot);
    const forms = [kit.ground, kit.air, kit.free, kit.recall];
    for (let form = 0; form < 4; form++) {
      const move = forms[form];
      if (move === undefined) continue;
      const name = `${prefix}.kit[${slot}].form[${form}]`;
      result.push(specialMoveCanonical(move, name));
    }
  }
  return result.join("");
}

function specialMoveCanonical(move: Readonly<AuthoredSpecial>, name: string): string {
  const result: string[] = [];
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
  if (move.placement !== undefined) result.push(specialPlacementCanonical(move.placement, `${name}.placement`));
  if (move.recall === true) int("recall", 1);
  if (move.guard !== undefined) {
    int("guard.first", move.guard.first);
    int("guard.last", move.guard.last);
    real("guard.heal", move.guard.heal);
    real("guard.healCapPerStock", move.guard.healCapPerStock);
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
  if (move.followUp !== undefined) {
    int("followUp.first", move.followUp.window.first);
    int("followUp.last", move.followUp.window.last);
    result.push(specialMoveCanonical(move.followUp.special, `${name}.followUp`));
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
  if (!lanes.valid) return;
  let { first, second } = lanes;
  for (let index = 0; index < fragment.length; index++) {
    const byte = fragment.charCodeAt(index);
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
// a state writes that digest. Writing the whole text into every checksum built
// about 116 MB of Lua strings per checksum for one hero (perf bot-blademaster).
const MOVES_DIGESTS = new Map<Readonly<FighterMoves>, string>();
const SPECIALS_DIGESTS = new Map<Readonly<FighterSpecials>, string>();
const PLACEMENT_DIGESTS = new Map<Readonly<SpecialPlacement>, string>();

function kitDigestField<K>(name: string, kit: K | undefined, digests: Map<K, string>, text: (kit: K) => string): string {
  if (kit === undefined) return "";
  let digest = digests.get(kit);
  if (digest === undefined) {
    digest = canonicalChecksum(text(kit));
    digests.set(kit, digest);
  }
  return `|${name}.digest=${digest}`;
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
  int("lastAerialTapDirection", m.lastAerialTapDirection);
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
  int("parrySerial", v.parry);
  int("specialAction", sp.action);
  int("specialFrame", sp.frame);
  int("specialDuration", sp.duration);
  int("specialLockFrames", sp.lockFrames);
  bool("specialFall", sp.fall);
  for (let i = 0; i < SPECIAL_ACTION_CAPACITY; i++) int(`specialCooldowns[${i}]`, at(sp.cooldowns, i));
  int("specialDirection", sp.direction);
  bool("specialHit", sp.hit);
  int("bearLife", fighter.bear.life);
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
  // Hero state is written only where a hero kit or hero projectile exists, so
  // the original fighters' canonical text is unchanged.
  emit(kitDigestField(`${prefix}.specials`, t.specials, SPECIALS_DIGESTS, fighterSpecialsCanonical));
  if (t.specials !== undefined) {
    int("manaPoints", fighter.mana.points);
    int("manaSinceSpend", fighter.mana.sinceSpend);
    int("manaProgress", fighter.mana.progress);
    int("manaDeniedSerial", v.manaDenied);
    int("specialForm", sp.form);
    int("specialAimX", sp.aimX);
    int("specialAimZ", sp.aimZ);
    int("specialAirtimeUses", sp.airtimeUses);
    if (sp.grabFrame !== 0) int("specialGrabFrame", sp.grabFrame);
    int("armorFrames", st.armorFrames);
    real("armorMaxDamage", st.armorMaxDamage);
    const { placed } = fighter;
    int("placedLife", placed.life);
    int("placedAge", placed.age);
    real("placedX", placed.x);
    real("placedZ", placed.z);
    int("placedDirection", placed.direction);
    real("placedDurability", placed.durability);
    int("placedSerial", placed.serial);
    for (let i = 0; i < PARTICIPANT_CAPACITY; i++) int(`placedStruck[${i}]`, placed.struck[i] ?? -1);
    int("placedSpecialStruck", placed.specialStruck);
    emit(kitDigestField(`${prefix}.placedSpec`, placed.spec, PLACEMENT_DIGESTS, (spec) => specialPlacementCanonical(spec, "placedSpec")));
    int("specialGuarded", sp.guarded ? 1 : 0);
    real("guardHealed", st.guardHealed);
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
  }
  int("match.stockCount", match.stockCount);
  int("match.timeLimitMinutes", match.timeLimitMinutes);
  bool("match.endless", match.endless);
  bool("match.automaticRematch", match.automaticRematch);
  int("match.rematchCountdown", match.rematchCountdown);
  int("match.remainingFrames", match.remainingFrames);
  int("match.matchFrame", match.matchFrame);
  bool("match.timedOut", match.timedOut);
  bool("match.practice", match.practice);
  int("runtime.simulationFrame", runtime.simulationFrame);
  for (const slot of PARTICIPANT_SLOTS) emit(canonicalRealField(`runtime.botAttackDelays[${slot}]`, runtime.botAttackDelays[slot]));
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
