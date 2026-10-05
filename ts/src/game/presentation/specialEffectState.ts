import { PARTICIPANT_CAPACITY } from "../input/participants";
import { f32 } from "../../sim/f32";
import { Character, SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { DEMONHUNTER_IMMOLATE_ACTIVE, DEMONHUNTER_IMMOLATE_STARTUP, DEMONHUNTER_WING_STARTUP } from "../sim/specials";
import { DEMONHUNTER_PARRY_END, DEMONHUNTER_PARRY_START } from "../sim/hits";

export const PARRY_FLASH_FRAMES = 12;
export const STATIC_AURA = 0;
export const STATIC_WING_TRAIL = 1;
export const STATIC_PARRY_FLASH = 2;

export interface StaticSpecialPose {
  visible: boolean;
  x: number;
  z: number;
  scale: number;
  alpha: number;
  red: number;
  green: number;
  blue: number;
}

export interface SpecialEffectState {
  parrySerial: number[];
  parryAge: number[];
}

export function createSpecialEffectState(): SpecialEffectState {
  return {
    parrySerial: Array.from({ length: PARTICIPANT_CAPACITY }, () => 0),
    parryAge: Array.from({ length: PARTICIPANT_CAPACITY }, () => PARRY_FLASH_FRAMES),
  };
}

export function copySpecialEffectState(source: Readonly<SpecialEffectState>): SpecialEffectState {
  const target = createSpecialEffectState();
  copySpecialEffectStateInto(target, source);
  return target;
}

export function copySpecialEffectStateInto(target: SpecialEffectState, source: Readonly<SpecialEffectState>): void {
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    target.parrySerial[slot] = source.parrySerial[slot] ?? 0;
    target.parryAge[slot] = source.parryAge[slot] ?? PARRY_FLASH_FRAMES;
  }
}

export function clearSpecialEffectState(state: SpecialEffectState): void {
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    state.parrySerial[slot] = 0;
    state.parryAge[slot] = PARRY_FLASH_FRAMES;
  }
}

export function firstSpecialEffectDifference(expected: Readonly<SpecialEffectState>, actual: Readonly<SpecialEffectState>): string | undefined {
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (expected.parrySerial[slot] !== actual.parrySerial[slot]) return `slot[${slot}].parrySerial`;
    if (expected.parryAge[slot] !== actual.parryAge[slot]) return `slot[${slot}].parryAge`;
  }
  return undefined;
}

export function advanceSpecialEffect(state: SpecialEffectState, fighter: Readonly<Fighter>, slot: number): void {
  if (fighter.character !== Character.demonHunter || fighter.status.out) state.parryAge[slot] = PARRY_FLASH_FRAMES;
  else if (fighter.visuals.parry > (state.parrySerial[slot] ?? 0)) state.parryAge[slot] = 0;
  else if ((state.parryAge[slot] ?? PARRY_FLASH_FRAMES) < PARRY_FLASH_FRAMES) state.parryAge[slot] = (state.parryAge[slot] ?? 0) + 1;
  state.parrySerial[slot] = fighter.visuals.parry;
}

const HIDDEN_POSE: StaticSpecialPose = { visible: false, x: 0.0, z: 0.0, scale: 0.0, alpha: 0, red: 0, green: 0, blue: 0 };

export function projectSpecialEffect(state: Readonly<SpecialEffectState>, fighter: Readonly<Fighter>, slot: number, kind: number): StaticSpecialPose {
  if (fighter.character !== Character.demonHunter || fighter.status.out) return HIDDEN_POSE;
  const scale = f32(0.8);
  const { special, motion } = fighter;
  if (kind === STATIC_AURA) {
    const immolate = special.action === SpecialAction.demonHunterImmolate
      && special.frame >= DEMONHUNTER_IMMOLATE_STARTUP && special.frame < DEMONHUNTER_IMMOLATE_STARTUP + DEMONHUNTER_IMMOLATE_ACTIVE;
    const parry = special.action === SpecialAction.demonHunterParryStep
      && special.frame >= DEMONHUNTER_PARRY_START && special.frame <= DEMONHUNTER_PARRY_END;
    return { visible: immolate || parry, x: motion.x, z: motion.z + 50.0 * scale,
      scale: (immolate ? f32(1.4) : f32(0.85)) * scale, alpha: 230, red: immolate ? 85 : 150,
      green: 255, blue: immolate ? 100 : 255 };
  }
  if (kind === STATIC_WING_TRAIL) return {
    visible: special.action === SpecialAction.demonHunterWingAscent && special.frame >= DEMONHUNTER_WING_STARTUP,
    x: motion.x, z: motion.z + 8.0 * scale, scale: 0.75 * scale, alpha: 180,
    red: 95, green: 255, blue: 125,
  };
  const age = state.parryAge[slot] ?? PARRY_FLASH_FRAMES;
  const progress = age / PARRY_FLASH_FRAMES;
  return { visible: age < PARRY_FLASH_FRAMES, x: motion.x + fighter.facing * 35.0 * scale,
    z: motion.z + 80.0 * scale, scale: (f32(0.8) + progress * f32(0.7)) * scale,
    alpha: Math.trunc(255 * (1.0 - progress)), red: 160, green: 255, blue: 210 };
}
