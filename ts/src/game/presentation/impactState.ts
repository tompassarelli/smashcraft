import { max, min, toInt } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { idiv, imod } from "wisp/src/sim/intMath";
import { type Character, SurfaceContact } from "../sim/codes";
import { HitElement } from "../sim/hitRegions";
import { DodgeCue, type ImpactEvents, ImpactLanding, JumpCue } from "./impactEvents";
import { TIER_SPARK_SCALE } from "./moveTiers";

// Impact kinds. Each owns a ring of IMPACTS_PER_KIND pool slots, in kind order.
export const IMPACT_HIT = 0;
const IMPACT_TECH = 1;
const IMPACT_MISSED_TECH = 2;
export const IMPACT_DUST = 3;
export const IMPACT_DODGE = 4;
const IMPACT_ELECTRIC_HIT = 5;
const IMPACT_SHIELD_HIT = 6;
const IMPACT_AIR_JUMP = 7;
export const IMPACT_SIDE_KO = 8;
const IMPACT_RESPAWN = 9;
export const IMPACT_GRAB = 10;
export const IMPACT_THROW = 11;
export const IMPACT_CHARGE = 12;
export const IMPACT_READY = 13;
export const IMPACT_LEDGE_CATCH = 14;
export const IMPACT_LEDGE_RECOVERY = 15;
export const IMPACT_STAR_KO = 16;
export const IMPACT_SCREEN_KO = 17;
export const IMPACT_FIRE_HIT = 18;
export const IMPACT_SLASH_HIT = 19;
export const IMPACT_ICE_HIT = 20;
export const IMPACT_ELECTRIC_SHIELD = 21;
export const IMPACT_PUMMEL = 22;

export const IMPACTS_PER_KIND = 8;
export const IMPACT_KIND_COUNT = 23;
export const IMPACT_COUNT = IMPACTS_PER_KIND * IMPACT_KIND_COUNT;
export const KO_STAR_FLIGHT_FRAMES = 90;
export const KO_STAR_FRAMES = 108;
export const KO_SCREEN_FRAMES = 100;

const PI = f32(3.141592654);
const HALF_PI = f32(1.570796327);

interface ImpactPose {
  visible: boolean;
  alpha: number;
  scale: number;
  x: number;
  z: number;
  pitch: number;
}

/** A top KO's flying body: a visual handle's transform, never a fighter. */
interface KoPose {
  visible: boolean;
  character: Character;
  alpha: number;
  scale: number;
  x: number;
  y: number;
  z: number;
  pitch: number;
  yaw: number;
  roll: number;
}

/**
 * A pool of impacts by slot, as parallel arrays. Ages count executed frames
 * from emission; undefined marks a free slot, keeping each array dense in Lua.
 * A free slot holds the empty pool's values, so a copy skips slots free in both.
 * Projection reads the pool without advancing time or consuming events.
 */
export interface ImpactState {
  readonly ages: (number | undefined)[];
  readonly nextSlot: number[];
  readonly originX: number[];
  readonly originZ: number[];
  readonly drift: number[];
  readonly driftZ: number[];
  readonly pitch: number[];
  readonly character: Character[];
  readonly strength: number[];
}

const filled = <T>(length: number, value: T): T[] => Array.from({ length }, () => value);

/** An empty pool, copied for each new state: a snapshot ring creates one per frame it keeps. */
const EMPTY: Readonly<ImpactState> = {
  ages: filled<number | undefined>(IMPACT_COUNT, undefined),
  nextSlot: filled(IMPACT_KIND_COUNT, 0),
  originX: filled(IMPACT_COUNT, 0.0),
  originZ: filled(IMPACT_COUNT, 0.0),
  drift: filled(IMPACT_COUNT, 0),
  driftZ: filled(IMPACT_COUNT, 0.0),
  pitch: filled(IMPACT_COUNT, 0.0),
  character: filled<Character>(IMPACT_COUNT, 0),
  strength: filled(IMPACT_COUNT, 0.0),
};

export function createImpactState(): ImpactState {
  return {
    ages: EMPTY.ages.slice(),
    nextSlot: EMPTY.nextSlot.slice(),
    originX: EMPTY.originX.slice(),
    originZ: EMPTY.originZ.slice(),
    drift: EMPTY.drift.slice(),
    driftZ: EMPTY.driftZ.slice(),
    pitch: EMPTY.pitch.slice(),
    character: EMPTY.character.slice(),
    strength: EMPTY.strength.slice(),
  };
}

/** An element of a pool array; indexes come from the pool's own bounds. */
function at<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) throw new Error(`impact slot ${index} outside the pool`);
  return value;
}

/** Frees a slot and restores the empty pool's values. */
function freeSlot(state: ImpactState, i: number): void {
  state.ages[i] = undefined;
  state.character[i] = 0;
  state.originX[i] = 0.0;
  state.originZ[i] = 0.0;
  state.drift[i] = 0;
  state.driftZ[i] = 0.0;
  state.pitch[i] = 0.0;
  state.strength[i] = 0.0;
}

/** Every snapshot save and every replayed frame copies the pool: its live slots, and those it frees. */
export function copyImpactStateInto(target: ImpactState, source: Readonly<ImpactState>): void {
  for (let i = 0; i < IMPACT_COUNT; i++) {
    const age = source.ages[i];
    if (age === undefined) {
      if (target.ages[i] !== undefined) freeSlot(target, i);
      continue;
    }
    target.ages[i] = age;
    target.character[i] = source.character[i] ?? 0;
    target.originX[i] = source.originX[i] ?? 0.0;
    target.originZ[i] = source.originZ[i] ?? 0.0;
    target.drift[i] = source.drift[i] ?? 0;
    target.driftZ[i] = source.driftZ[i] ?? 0.0;
    target.pitch[i] = source.pitch[i] ?? 0.0;
    target.strength[i] = source.strength[i] ?? 0.0;
  }
  for (let kind = 0; kind < IMPACT_KIND_COUNT; kind++) target.nextSlot[kind] = source.nextSlot[kind] ?? 0;
}

export function firstImpactDifference(expected: Readonly<ImpactState>, actual: Readonly<ImpactState>): string | undefined {
  for (let kind = 0; kind < IMPACT_KIND_COUNT; kind++) {
    if (expected.nextSlot[kind] !== actual.nextSlot[kind]) return `nextSlot[${kind}]`;
  }
  for (let i = 0; i < IMPACT_COUNT; i++) {
    const prefix = `slot[${i}].`;
    if (expected.character[i] !== actual.character[i]) return `${prefix}character`;
    if (expected.ages[i] !== actual.ages[i]) return `${prefix}age`;
    if (expected.originX[i] !== actual.originX[i]) return `${prefix}originX`;
    if (expected.originZ[i] !== actual.originZ[i]) return `${prefix}originZ`;
    if (expected.drift[i] !== actual.drift[i]) return `${prefix}drift`;
    if (expected.driftZ[i] !== actual.driftZ[i]) return `${prefix}driftZ`;
    if (expected.pitch[i] !== actual.pitch[i]) return `${prefix}pitch`;
    if (expected.strength[i] !== actual.strength[i]) return `${prefix}strength`;
  }
  return undefined;
}

export function clearImpactState(state: ImpactState): void {
  for (let i = 0; i < IMPACT_COUNT; i++) freeSlot(state, i);
  for (let kind = 0; kind < IMPACT_KIND_COUNT; kind++) state.nextSlot[kind] = 0;
}

/** Frames an impact of this kind stays in the pool. */
export function impactLifetime(kind: number): number {
  switch (kind) {
    case IMPACT_STAR_KO: return KO_STAR_FRAMES;
    case IMPACT_SCREEN_KO: return KO_SCREEN_FRAMES;
    case IMPACT_HIT:
    case IMPACT_ELECTRIC_HIT:
    case IMPACT_FIRE_HIT:
    case IMPACT_SLASH_HIT:
    case IMPACT_ICE_HIT:
    case IMPACT_ELECTRIC_SHIELD:
    case IMPACT_PUMMEL:
    case IMPACT_SHIELD_HIT: return 9;
    case IMPACT_TECH: return 15;
    case IMPACT_DUST: return 32;
    case IMPACT_SIDE_KO: return 24;
    default: return 12;
  }
}

/** Ages every live impact by one executed frame. */
export function advanceImpacts(state: ImpactState): void {
  for (let i = 0; i < IMPACT_COUNT; i++) {
    const age = state.ages[i];
    if (age === undefined) continue;
    if (age + 1 >= impactLifetime(idiv(i, IMPACTS_PER_KIND))) freeSlot(state, i);
    else state.ages[i] = age + 1;
  }
}

/** Takes the kind's next ring slot, replacing whatever it held. */
function spawn(state: ImpactState, kind: number, x: number, z: number, direction: number, size: number): number {
  const next = at(state.nextSlot, kind);
  const slot = kind * IMPACTS_PER_KIND + next;
  state.nextSlot[kind] = imod(next + 1, IMPACTS_PER_KIND);
  state.ages[slot] = 0;
  state.originX[slot] = x;
  state.originZ[slot] = z;
  state.drift[slot] = direction;
  state.driftZ[slot] = 0.0;
  state.pitch[slot] = 0.0;
  state.strength[slot] = size;
  return slot;
}

/** A tech stays anchored to contact; other cues drift along the inward normal. */
function surfaceFlash(state: ImpactState, kind: number, events: Readonly<ImpactEvents>): void {
  const anchored = kind === IMPACT_TECH;
  const slot = spawn(state, kind, events.contactX, events.contactZ, anchored ? 0 : toInt(events.normalX), f32(0.8));
  state.pitch[slot] = events.normalX === 0.0 ? 0.0 : HALF_PI;
  state.driftZ[slot] = anchored ? 0.0 : events.normalZ;
}

/** Emits one fighter's cues for an executed frame; `frame` paces running dust and picks a top KO's cinematic. */
export function emitImpacts(state: ImpactState, events: Readonly<ImpactEvents>, frame: number): void {
  const { x, z } = events;
  if (events.grab) spawn(state, IMPACT_GRAB, x, f32(z + 50.0), 0, f32(0.65));
  if (events.throwRelease) spawn(state, IMPACT_THROW, x, f32(z + 50.0), 0, f32(1.1));
  if (events.charge) spawn(state, IMPACT_CHARGE, x, f32(z + 50.0), 0, 0.5);
  if (events.ready) spawn(state, IMPACT_READY, x, f32(z + 65.0), 0, f32(0.9));
  if (events.ledgeCatch) spawn(state, IMPACT_LEDGE_CATCH, events.ledgeX, events.ledgeZ, 0, f32(0.8));
  if (events.ledgeRecovery) spawn(state, IMPACT_LEDGE_RECOVERY, events.ledgeX, events.ledgeZ, 0, f32(0.8));
  if (events.hit) {
    const kind = events.pummel ? IMPACT_PUMMEL : events.element === HitElement.fire ? IMPACT_FIRE_HIT
      : events.element === HitElement.slash ? IMPACT_SLASH_HIT : events.element === HitElement.ice ? IMPACT_ICE_HIT
      : events.electric || events.element === HitElement.electric ? IMPACT_ELECTRIC_HIT : IMPACT_HIT;
    spawn(state, kind, x, f32(z + 50.0), 0, TIER_SPARK_SCALE[events.tier] ?? 1.0);
  }
  if (events.shieldHit || events.shieldReflect) spawn(state, events.shieldElectric ? IMPACT_ELECTRIC_SHIELD : IMPACT_SHIELD_HIT, x, f32(z + 50.0), 0, events.shieldReflect ? 1.5 : 1.0);
  if (events.shieldBreak) spawn(state, IMPACT_SHIELD_HIT, x, f32(z + 50.0), 0, 2.0);
  if (events.landing === ImpactLanding.tech) spawn(state, IMPACT_TECH, x, f32(z + 3.0), 0, 1.0);
  else if (events.landing === ImpactLanding.missedTech) {
    spawn(state, IMPACT_MISSED_TECH, x, f32(z + 2.0), 0, 1.0);
    spawn(state, IMPACT_DUST, f32(x - 15.0), f32(z + 3.0), -1, 1.0);
    spawn(state, IMPACT_DUST, f32(x + 15.0), f32(z + 3.0), 1, 1.0);
  }
  if (events.surface === SurfaceContact.techWall || events.surface === SurfaceContact.techCeiling) surfaceFlash(state, IMPACT_TECH, events);
  else if (events.surfaceMissedTech) {
    surfaceFlash(state, IMPACT_MISSED_TECH, events);
    surfaceFlash(state, IMPACT_DUST, events);
  }
  if (events.ordinaryLanding) {
    spawn(state, IMPACT_DUST, f32(x - 12.0), f32(z + 2.0), -1, f32(0.7));
    spawn(state, IMPACT_DUST, f32(x + 12.0), f32(z + 2.0), 1, f32(0.7));
  }
  if (events.jump === JumpCue.ground) {
    spawn(state, IMPACT_DUST, f32(events.jumpOriginX - 12.0), f32(events.jumpOriginZ + 2.0), -1, f32(0.7));
    spawn(state, IMPACT_DUST, f32(events.jumpOriginX + 12.0), f32(events.jumpOriginZ + 2.0), 1, f32(0.7));
  } else if (events.jump === JumpCue.wall) {
    surfaceFlash(state, IMPACT_AIR_JUMP, events);
  } else if (events.jump === JumpCue.double || events.jump === JumpCue.air) {
    spawn(state, IMPACT_AIR_JUMP, events.jumpOriginX, f32(events.jumpOriginZ - 5.0), 0, 1.0);
  }
  if (events.airDodge) spawn(state, IMPACT_DODGE, x, f32(z + 50.0), 0, f32(0.6));
  if (events.movementDust || events.dodgeTrail || (events.runningDust && imod(frame, 8) === 0)) {
    spawn(state, IMPACT_DUST, f32(x - events.direction * 12), f32(z + 2.0), -events.direction, f32(0.45));
  }
  if (events.launchTrail) spawn(state, IMPACT_DUST, x, f32(z + 45.0), 0, f32(0.6));
  if (events.koDirectionX === 0 && events.koDirectionZ > 0) {
    // Presentation policy only: no random state, stock or respawn mutation.
    const kind = imod(frame + events.character, 2) === 0 ? IMPACT_STAR_KO : IMPACT_SCREEN_KO;
    const slot = spawn(state, kind, f32(x * f32(0.45)), min(z, 480.0), events.facing, 1.0);
    state.character[slot] = events.character;
  } else if (events.koDirectionX !== 0 || events.koDirectionZ !== 0) {
    const slot = spawn(state, IMPACT_SIDE_KO, x, f32(z + 35.0), events.koDirectionX, 2.0);
    state.driftZ[slot] = events.koDirectionZ * 2.0;
  }
  if (events.respawn) spawn(state, IMPACT_RESPAWN, x, f32(z + 50.0), 0, f32(1.3));
  if (events.dodge === DodgeCue.spot) {
    spawn(state, IMPACT_DUST, f32(x - 8.0), f32(z + 2.0), -1, f32(0.65));
    spawn(state, IMPACT_DUST, f32(x + 8.0), f32(z + 2.0), 1, f32(0.65));
  } else if (events.dodge === DodgeCue.roll) {
    spawn(state, IMPACT_DODGE, x, f32(z + 12.0), 0, 1.0);
    spawn(state, IMPACT_DUST, f32(x - events.direction * 15), f32(z + 2.0), -events.direction, f32(0.55));
  }
}

/** How far an impact has drifted at the given velocity. */
const travel = (velocity: number, age: number): number => f32(f32(velocity * age) * f32(1.3));

// Shared and never changed: renderers project every pooled effect on every callback.
const HIDDEN_IMPACT: Readonly<ImpactPose> = { visible: false, alpha: 0, scale: 0.0, x: 0.0, z: 0.0, pitch: 0.0 };

/** An impact slot's transform. KO slots show only a star KO's closing sparkle. */
export function projectImpact(state: Readonly<ImpactState>, i: number): Readonly<ImpactPose> {
  if (i < 0 || i >= IMPACT_COUNT) return HIDDEN_IMPACT;
  const age = state.ages[i];
  const kind = idiv(i, IMPACTS_PER_KIND);
  if (age === undefined || kind === IMPACT_SCREEN_KO || (kind === IMPACT_STAR_KO && age < KO_STAR_FLIGHT_FRAMES)) return HIDDEN_IMPACT;
  const originX = at(state.originX, i);
  const originZ = at(state.originZ, i);
  const drift = at(state.drift, i);
  if (kind === IMPACT_STAR_KO) {
    const sparkle = f32(f32((age - KO_STAR_FLIGHT_FRAMES) * 1.0) / (KO_STAR_FRAMES - KO_STAR_FLIGHT_FRAMES));
    return {
      visible: true,
      alpha: toInt(f32(255 * f32(1.0 - sparkle))),
      scale: f32(f32(0.6) + sparkle),
      x: f32(originX + drift * 75),
      z: f32(originZ + 180.0),
      pitch: 0.0,
    };
  }
  const strength = at(state.strength, i);
  const progress = f32(f32(age * 1.0) / impactLifetime(kind));
  let scale = f32(1.0 + f32(progress * 0.25));
  if (kind === IMPACT_DUST) scale = f32(0.75 + f32(progress * f32(1.1)));
  else if (kind === IMPACT_MISSED_TECH) scale = f32(f32(0.7) + f32(progress * 0.5));
  const fade = f32(1.0 - progress);
  const opacity = kind === IMPACT_DUST ? f32(220 * strength) : 255.0;
  return {
    visible: true,
    // Stock particles ignore alpha: a live slot must stay drawn until it parks.
    alpha: max(1, toInt(f32(f32(opacity * fade) * fade))),
    scale: f32(scale * strength),
    x: f32(originX + travel(drift, age)),
    z: f32(f32(originZ + travel(at(state.driftZ, i), age)) + (kind === IMPACT_DUST ? f32(progress * 9) : 0.0)),
    pitch: at(state.pitch, i),
  };
}

// Shared and never changed: renderers project every pooled effect on every callback.
const HIDDEN_KO: Readonly<KoPose> = { visible: false, character: 0, alpha: 0, scale: 0.0, x: 0.0, y: 0.0, z: 0.0, pitch: 0.0, yaw: 0.0, roll: 0.0 };

/**
 * A top KO's body: a star KO flies away and spins, a screen KO hits the
 * camera and drops. Pure transforms of the age, so they freeze with the
 * confirmed frame clock.
 */
export function projectKo(state: Readonly<ImpactState>, i: number): Readonly<KoPose> {
  if (i < IMPACT_STAR_KO * IMPACTS_PER_KIND || i >= IMPACT_COUNT) return HIDDEN_KO;
  const age = state.ages[i];
  if (age === undefined) return HIDDEN_KO;
  const drift = at(state.drift, i);
  const originX = at(state.originX, i);
  const originZ = at(state.originZ, i);
  const character = at(state.character, i);
  const yaw = drift > 0 ? 0.0 : PI;
  if (idiv(i, IMPACTS_PER_KIND) === IMPACT_STAR_KO) {
    if (age >= KO_STAR_FLIGHT_FRAMES) return HIDDEN_KO;
    const t = f32(f32(age * 1.0) / KO_STAR_FLIGHT_FRAMES);
    const remaining = f32(1.0 - t);
    return {
      visible: true,
      character,
      alpha: 255,
      scale: f32(remaining * remaining),
      x: f32(originX + f32((drift * 75) * t)),
      y: f32(1400 * t),
      z: f32(originZ + f32(180 * t)),
      pitch: f32(f32(drift * t) * f32(18.84955592)),
      yaw,
      roll: f32(t * f32(12.56637061)),
    };
  }
  const flight = min(1.0, f32(age / 24.0));
  const drop = max(0.0, f32((age - 48) / 52.0));
  return {
    visible: true,
    character,
    alpha: toInt(f32(255 * f32(1.0 - drop))),
    scale: f32(1.0 + f32(flight * f32(1.7))),
    x: f32(originX + f32((drift * 110) * flight)),
    y: f32(-550 * flight),
    z: f32(f32(originZ - f32(140 * flight)) - f32(f32(900 * drop) * drop)),
    pitch: f32(drift * f32(f32(flight * f32(6.283185307)) + f32(drop * f32(9.424777961)))),
    yaw,
    roll: f32(flight * HALF_PI),
  };
}
