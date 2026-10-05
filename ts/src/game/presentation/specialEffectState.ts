import { toInt } from "../../runtime/numbers";
import { f32 } from "waygate/src/sim/f32";
import { PARTICIPANT_SLOTS, type ParticipantSlot, type Slots } from "../input/participants";
import { Character, SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { DEMONHUNTER_PARRY_END, DEMONHUNTER_PARRY_START } from "../sim/hits";
import { DEMONHUNTER_IMMOLATE_ACTIVE, DEMONHUNTER_IMMOLATE_STARTUP, DEMONHUNTER_WING_STARTUP } from "../sim/specials";
import { characterModelScale } from "./modelScale";

export const PARRY_FLASH_FRAMES = 12;

/** Illidan's effects that follow him: his special aura, wing trail and parry flash. */
export const STATIC_AURA = 0;
export const STATIC_WING_TRAIL = 1;
export const STATIC_PARRY_FLASH = 2;
type StaticSpecial = typeof STATIC_AURA | typeof STATIC_WING_TRAIL | typeof STATIC_PARRY_FLASH;

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

/**
 * Only event history: action windows and transforms come from the fighter
 * itself, and projection never consumes or advances time.
 */
export interface SpecialEffectState {
  readonly parrySerial: Slots<number>;
  /** Executed frames since the latest parry; PARRY_FLASH_FRAMES once the flash is over. */
  readonly parryAge: Slots<number>;
}

export function createSpecialEffectState(): SpecialEffectState {
  return {
    parrySerial: [0, 0, 0, 0],
    parryAge: [PARRY_FLASH_FRAMES, PARRY_FLASH_FRAMES, PARRY_FLASH_FRAMES, PARRY_FLASH_FRAMES],
  };
}

export function copySpecialEffectStateInto(target: SpecialEffectState, source: Readonly<SpecialEffectState>): void {
  for (const slot of PARTICIPANT_SLOTS) {
    target.parrySerial[slot] = source.parrySerial[slot];
    target.parryAge[slot] = source.parryAge[slot];
  }
}

export function clearSpecialEffectState(state: SpecialEffectState): void {
  for (const slot of PARTICIPANT_SLOTS) {
    state.parrySerial[slot] = 0;
    state.parryAge[slot] = PARRY_FLASH_FRAMES;
  }
}

export function firstSpecialEffectDifference(expected: Readonly<SpecialEffectState>, actual: Readonly<SpecialEffectState>): string | undefined {
  for (const slot of PARTICIPANT_SLOTS) {
    if (expected.parrySerial[slot] !== actual.parrySerial[slot]) return `slot[${slot}].parrySerial`;
    if (expected.parryAge[slot] !== actual.parryAge[slot]) return `slot[${slot}].parryAge`;
  }
  return undefined;
}

/** Advances one executed frame for the fighter in a participant slot. */
export function advanceSpecialEffect(state: SpecialEffectState, fighter: Readonly<Fighter>, slot: ParticipantSlot): void {
  const parrySerial = fighter.visuals.parry;
  if (fighter.character !== Character.demonHunter || fighter.status.out) state.parryAge[slot] = PARRY_FLASH_FRAMES;
  else if (parrySerial > state.parrySerial[slot]) state.parryAge[slot] = 0;
  else if (state.parryAge[slot] < PARRY_FLASH_FRAMES) state.parryAge[slot]++;
  state.parrySerial[slot] = parrySerial;
}

function hiddenSpecial(): StaticSpecialPose {
  return { visible: false, x: 0.0, z: 0.0, scale: 0.0, alpha: 0, red: 0, green: 0, blue: 0 };
}

export function projectSpecialEffect(state: Readonly<SpecialEffectState>, fighter: Readonly<Fighter> | undefined, slot: number, kind: StaticSpecial): StaticSpecialPose {
  if (fighter === undefined || fighter.character !== Character.demonHunter || fighter.status.out) return hiddenSpecial();
  const scale = characterModelScale(fighter.character);
  const { special, motion } = fighter;
  if (kind === STATIC_AURA) {
    const immolate = special.action === SpecialAction.demonHunterImmolate
      && special.frame >= DEMONHUNTER_IMMOLATE_STARTUP && special.frame < DEMONHUNTER_IMMOLATE_STARTUP + DEMONHUNTER_IMMOLATE_ACTIVE;
    const parry = special.action === SpecialAction.demonHunterParryStep
      && special.frame >= DEMONHUNTER_PARRY_START && special.frame <= DEMONHUNTER_PARRY_END;
    return {
      visible: immolate || parry,
      x: motion.x,
      z: f32(motion.z + f32(50 * scale)),
      scale: f32((immolate ? f32(1.4) : f32(0.85)) * scale),
      alpha: 230,
      red: immolate ? 85 : 150,
      green: 255,
      blue: immolate ? 100 : 255,
    };
  }
  if (kind === STATIC_WING_TRAIL) {
    return {
      visible: special.action === SpecialAction.demonHunterWingAscent && special.frame >= DEMONHUNTER_WING_STARTUP,
      x: motion.x,
      z: f32(motion.z + f32(8 * scale)),
      scale: f32(0.75 * scale),
      alpha: 180,
      red: 95,
      green: 255,
      blue: 125,
    };
  }
  const age = state.parryAge[slot] ?? PARRY_FLASH_FRAMES;
  const progress = f32(age / PARRY_FLASH_FRAMES);
  return {
    visible: age < PARRY_FLASH_FRAMES,
    x: f32(motion.x + f32(f32(fighter.facing * 35.0) * scale)),
    z: f32(motion.z + f32(80 * scale)),
    scale: f32(f32(f32(0.8) + f32(progress * f32(0.7))) * scale),
    alpha: toInt(f32(255 * f32(1.0 - progress))),
    red: 160,
    green: 255,
    blue: 210,
  };
}
