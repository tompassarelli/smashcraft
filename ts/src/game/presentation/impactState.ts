import { floorDiv, floorMod } from "../../sim/intMath";
import { f32 } from "../../sim/f32";
import type { ImpactEvents } from "./impactEvents";

export const IMPACTS_PER_KIND = 8;
export const IMPACT_GRAB = 10;
export const IMPACT_THROW = 11;
export const IMPACT_CHARGE = 12;
export const IMPACT_READY = 13;
export const IMPACT_LEDGE_CATCH = 14;
export const IMPACT_LEDGE_RECOVERY = 15;
export const IMPACT_STAR_KO = 16;
export const IMPACT_SCREEN_KO = 17;
export const IMPACT_KIND_COUNT = 18;
export const KO_STAR_FLIGHT_FRAMES = 90;
export const KO_STAR_FRAMES = 108;
export const KO_SCREEN_FRAMES = 100;
export const IMPACT_COUNT = IMPACTS_PER_KIND * IMPACT_KIND_COUNT;

export interface ImpactPose {
  visible: boolean;
  alpha: number;
  scale: number;
  x: number;
  z: number;
  pitch: number;
}

export interface KoPose {
  visible: boolean;
  character: number;
  alpha: number;
  scale: number;
  x: number;
  y: number;
  z: number;
  pitch: number;
  yaw: number;
  roll: number;
}

export interface ImpactState {
  ages: number[];
  nextSlot: number[];
  originX: number[];
  originZ: number[];
  drift: number[];
  driftZ: number[];
  pitch: number[];
  character: number[];
  strength: number[];
}

export function createImpactState(): ImpactState {
  return {
    ages: Array.from({ length: IMPACT_COUNT }, () => -1),
    nextSlot: Array.from({ length: IMPACT_KIND_COUNT }, () => 0),
    originX: Array.from({ length: IMPACT_COUNT }, () => 0.0),
    originZ: Array.from({ length: IMPACT_COUNT }, () => 0.0),
    drift: Array.from({ length: IMPACT_COUNT }, () => 0),
    driftZ: Array.from({ length: IMPACT_COUNT }, () => 0.0),
    pitch: Array.from({ length: IMPACT_COUNT }, () => 0.0),
    character: Array.from({ length: IMPACT_COUNT }, () => 0),
    strength: Array.from({ length: IMPACT_COUNT }, () => 0.0),
  };
}

export function copyImpactState(source: Readonly<ImpactState>): ImpactState {
  const target = createImpactState();
  copyImpactStateInto(target, source);
  return target;
}

export function copyImpactStateInto(target: ImpactState, source: Readonly<ImpactState>): void {
  for (let i = 0; i < IMPACT_COUNT; i++) {
    target.ages[i] = source.ages[i] ?? -1;
    target.originX[i] = source.originX[i] ?? 0.0;
    target.originZ[i] = source.originZ[i] ?? 0.0;
    target.drift[i] = source.drift[i] ?? 0;
    target.driftZ[i] = source.driftZ[i] ?? 0.0;
    target.pitch[i] = source.pitch[i] ?? 0.0;
    target.character[i] = source.character[i] ?? 0;
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
  for (let i = 0; i < IMPACT_COUNT; i++) {
    state.character[i] = 0;
    state.ages[i] = -1;
    state.originX[i] = 0.0;
    state.originZ[i] = 0.0;
    state.drift[i] = 0;
    state.driftZ[i] = 0.0;
    state.pitch[i] = 0.0;
    state.strength[i] = 0.0;
  }
  for (let kind = 0; kind < IMPACT_KIND_COUNT; kind++) state.nextSlot[kind] = 0;
}

export function advanceImpacts(state: ImpactState): void {
  for (let i = 0; i < IMPACT_COUNT; i++) {
    if ((state.ages[i] ?? -1) >= 0) {
      const age = (state.ages[i] ?? -1) + 1;
      state.ages[i] = age >= impactLifetime(floorDiv(i, IMPACTS_PER_KIND)) ? -1 : age;
    }
  }
}

export function impactLifetime(kind: number): number {
  if (kind === IMPACT_STAR_KO) return KO_STAR_FRAMES;
  if (kind === IMPACT_SCREEN_KO) return KO_SCREEN_FRAMES;
  if (kind === 0 || kind === 5 || kind === 6) return 9;
  if (kind === 1) return 15;
  if (kind === 3) return 32;
  if (kind === 8) return 24;
  return 12;
}

function spawn(state: ImpactState, kind: number, x: number, z: number, direction: number, size: number): number {
  const slot = kind * IMPACTS_PER_KIND + (state.nextSlot[kind] ?? 0);
  state.nextSlot[kind] = floorMod((state.nextSlot[kind] ?? 0) + 1, IMPACTS_PER_KIND);
  state.ages[slot] = 0;
  state.originX[slot] = x;
  state.originZ[slot] = z;
  state.drift[slot] = direction;
  state.driftZ[slot] = 0.0;
  state.pitch[slot] = 0.0;
  state.strength[slot] = size;
  return slot;
}

function surfaceFlash(state: ImpactState, kind: number, events: Readonly<ImpactEvents>): void {
  const slot = spawn(state, kind, events.contactX, events.contactZ, Math.trunc(events.normalX), f32(0.8));
  state.pitch[slot] = events.normalX === 0 ? 0.0 : f32(1.570796327);
  state.driftZ[slot] = events.normalZ;
}

export function emitImpacts(state: ImpactState, events: Readonly<ImpactEvents>, frame: number): void {
  const emit = (kind: number, x: number, z: number, direction: number, size: number): number => spawn(state, kind, x, z, direction, size);
  if (events.grab) emit(IMPACT_GRAB, events.x, f32(events.z + 50.0), 0, f32(0.65));
  if (events.throwRelease) emit(IMPACT_THROW, events.x, f32(events.z + 50.0), 0, f32(1.1));
  if (events.charge) emit(IMPACT_CHARGE, events.x, f32(events.z + 50.0), 0, 0.5);
  if (events.ready) emit(IMPACT_READY, events.x, f32(events.z + 65.0), 0, f32(0.9));
  if (events.ledgeCatch) emit(IMPACT_LEDGE_CATCH, events.ledgeX, events.ledgeZ, 0, f32(0.6));
  if (events.ledgeRecovery) emit(IMPACT_LEDGE_RECOVERY, events.ledgeX, events.ledgeZ, 0, f32(0.8));
  if (events.hit) emit(events.electric ? 5 : 0, events.x, f32(events.z + 50.0), 0, 1.0);
  if (events.shieldHit) emit(6, events.x, f32(events.z + 50.0), 0, 1.0);
  if (events.shieldBreak) emit(6, events.x, f32(events.z + 50.0), 0, 2.0);
  if (events.landing === 1) emit(1, events.x, f32(events.z + 3.0), 0, 1.0);
  else if (events.landing === 2) {
    emit(2, events.x, f32(events.z + 2.0), 0, 1.0);
    emit(3, f32(events.x - 15.0), f32(events.z + 3.0), -1, 1.0);
    emit(3, f32(events.x + 15.0), f32(events.z + 3.0), 1, 1.0);
  }
  if (events.surface === 3 || events.surface === 4) surfaceFlash(state, 1, events);
  else if (events.surfaceMissedTech) {
    surfaceFlash(state, 2, events);
    surfaceFlash(state, 3, events);
  }
  if (events.ordinaryLanding) {
    emit(3, f32(events.x - 12.0), f32(events.z + 2.0), -1, f32(0.7));
    emit(3, f32(events.x + 12.0), f32(events.z + 2.0), 1, f32(0.7));
  }
  if (events.jump === 1) {
    emit(3, f32(events.jumpOriginX - 12.0), f32(events.jumpOriginZ + 2.0), -1, f32(0.7));
    emit(3, f32(events.jumpOriginX + 12.0), f32(events.jumpOriginZ + 2.0), 1, f32(0.7));
  } else if (events.jump === 2 || events.jump === 3) emit(7, events.jumpOriginX, f32(events.jumpOriginZ - 5.0), 0, 1.0);
  if (events.airDodge) emit(4, events.x, f32(events.z + 50.0), 0, f32(0.6));
  if (events.movementDust || events.dodgeTrail || (events.runningDust && floorMod(frame, 8) === 0)) {
    emit(3, f32(events.x - events.direction * 12.0), f32(events.z + 2.0), -events.direction, f32(0.45));
  }
  if (events.launchTrail) emit(3, events.x, f32(events.z + 45.0), 0, f32(0.6));
  if (events.koDirectionX === 0 && events.koDirectionZ > 0) {
    const kind = floorMod(frame + events.character, 2) === 0 ? IMPACT_STAR_KO : IMPACT_SCREEN_KO;
    const slot = emit(kind, f32(events.x * f32(0.45)), Math.min(events.z, 480.0), events.facing, 1.0);
    state.character[slot] = events.character;
  } else if (events.koDirectionX !== 0 || events.koDirectionZ !== 0) {
    const slot = emit(8, events.x, f32(events.z + 35.0), events.koDirectionX, 2.0);
    state.driftZ[slot] = events.koDirectionZ * 2.0;
  }
  if (events.respawn) emit(9, events.x, f32(events.z + 50.0), 0, f32(1.3));
  if (events.dodge === 1) {
    emit(3, f32(events.x - 8.0), f32(events.z + 2.0), -1, f32(0.65));
    emit(3, f32(events.x + 8.0), f32(events.z + 2.0), 1, f32(0.65));
  } else if (events.dodge === 2) {
    emit(4, events.x, f32(events.z + 12.0), 0, 1.0);
    emit(3, f32(events.x - events.direction * 15.0), f32(events.z + 2.0), -events.direction, f32(0.55));
  }
}

function hiddenImpact(): ImpactPose {
  return { visible: false, alpha: 0, scale: 0.0, x: 0.0, z: 0.0, pitch: 0.0 };
}

export function projectImpact(state: Readonly<ImpactState>, i: number): ImpactPose {
  const age = state.ages[i];
  if (i < 0 || i >= IMPACT_COUNT || age === undefined || age < 0) return hiddenImpact();
  const kind = floorDiv(i, IMPACTS_PER_KIND);
  if (kind === IMPACT_SCREEN_KO || (kind === IMPACT_STAR_KO && age < KO_STAR_FLIGHT_FRAMES)) return hiddenImpact();
  if (kind === IMPACT_STAR_KO) {
    const sparkleProgress = f32(f32((age - KO_STAR_FLIGHT_FRAMES) * 1.0) / (KO_STAR_FRAMES - KO_STAR_FLIGHT_FRAMES));
    return {
      visible: true,
      alpha: Math.trunc(255 * f32(1.0 - sparkleProgress)),
      scale: f32(f32(0.6) + sparkleProgress),
      x: f32((state.originX[i] ?? 0) + (state.drift[i] ?? 0) * 75.0),
      z: f32((state.originZ[i] ?? 0) + 180.0),
      pitch: 0.0,
    };
  }
  const progress = f32(f32(age * 1.0) / impactLifetime(kind));
  const strength = state.strength[i] ?? 0.0;
  const scale = kind === 3 ? f32(0.75 + f32(progress * f32(1.1))) : kind === 2 ? f32(f32(0.7) + f32(progress * 0.5)) : f32(1.0 + f32(progress * 0.25));
  const fade = f32(1.0 - progress);
  const baseAlpha = kind === 3 ? f32(220.0 * strength) : 255.0;
  return {
    visible: true,
    alpha: Math.trunc(f32(f32(baseAlpha * fade) * fade)),
    scale: f32(scale * strength),
    x: f32((state.originX[i] ?? 0) + f32((state.drift[i] ?? 0) * f32(age * f32(1.3)))),
    z: f32((state.originZ[i] ?? 0) + f32((state.driftZ[i] ?? 0) * f32(age * f32(1.3))) + (kind === 3 ? f32(progress * 9.0) : 0.0)),
    pitch: state.pitch[i] ?? 0.0,
  };
}

function hiddenKo(): KoPose {
  return { visible: false, character: 0, alpha: 0, scale: 0.0, x: 0.0, y: 0.0, z: 0.0, pitch: 0.0, yaw: 0.0, roll: 0.0 };
}

export function projectKo(state: Readonly<ImpactState>, i: number): KoPose {
  const age = state.ages[i];
  if (i < IMPACT_STAR_KO * IMPACTS_PER_KIND || i >= IMPACT_COUNT || age === undefined || age < 0) return hiddenKo();
  const direction = state.drift[i] ?? 0;
  const yaw = direction > 0 ? 0.0 : f32(3.141592654);
  if (floorDiv(i, IMPACTS_PER_KIND) === IMPACT_STAR_KO) {
    if (age >= KO_STAR_FLIGHT_FRAMES) return hiddenKo();
    const t = f32(f32(age * 1.0) / KO_STAR_FLIGHT_FRAMES);
    const fade = f32(1.0 - t);
    return {
      visible: true,
      character: state.character[i] ?? 0,
      alpha: 255,
      scale: f32(fade * fade),
      x: f32((state.originX[i] ?? 0) + f32(direction * f32(75.0 * t))),
      y: f32(1400.0 * t),
      z: f32((state.originZ[i] ?? 0) + f32(180.0 * t)),
      pitch: f32(direction * f32(t * f32(18.84955592))),
      yaw,
      roll: f32(t * f32(12.56637061)),
    };
  }
  const flight = Math.min(1.0, f32(age / 24.0));
  const drop = Math.max(0.0, f32((age - 48) / 52.0));
  return {
    visible: true,
    character: state.character[i] ?? 0,
    alpha: Math.trunc(255.0 * f32(1.0 - drop)),
    scale: f32(1.0 + f32(flight * f32(1.7))),
    x: f32((state.originX[i] ?? 0) + f32(direction * f32(110.0 * flight))),
    y: f32(-550.0 * flight),
    z: f32((state.originZ[i] ?? 0) - f32(140.0 * flight) - f32(900.0 * f32(drop * drop))),
    pitch: f32(direction * (f32(flight * f32(6.283185307)) + f32(drop * f32(9.424777961)))),
    yaw,
    roll: f32(flight * f32(1.570796327)),
  };
}
