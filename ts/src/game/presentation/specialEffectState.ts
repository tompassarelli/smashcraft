import { toInt } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_SLOTS, type ParticipantSlot, type Slots } from "../input/participants";
import { Character, SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import {
  CHAOS_STRIKE_AIR_FORM, CHAOS_STRIKE_FIRST, CHAOS_STRIKE_FORM, CHAOS_STRIKE_LAST, DEMONHUNTER_IMMOLATE_ACTIVE, DEMONHUNTER_IMMOLATE_STARTUP,
  DEMONHUNTER_WING_STARTUP, FEL_RUSH_FIRST, FEL_RUSH_LAST, FEL_RUSH_TELL_LAST, VENGEFUL_RETREAT_FORM, VENGEFUL_RETREAT_MOVE_LAST,
} from "../sim/specials";
import { characterModelScale } from "./modelScale";

export const DRAIN_FLASH_FRAMES = 12;

/** Illidan's effects that follow him (his special aura and wing trail), and the drain flash over any fighter his hits drain. */
export const STATIC_AURA = 0;
export const STATIC_WING_TRAIL = 1;
export const STATIC_DRAIN_FLASH = 2;
type StaticSpecial = typeof STATIC_AURA | typeof STATIC_WING_TRAIL | typeof STATIC_DRAIN_FLASH;

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
  readonly drainSerial: Slots<number>;
  /** Executed frames since the latest mana drain; DRAIN_FLASH_FRAMES once the flash is over. */
  readonly drainAge: Slots<number>;
}

export function createSpecialEffectState(): SpecialEffectState {
  return {
    drainSerial: [0, 0, 0, 0],
    drainAge: [DRAIN_FLASH_FRAMES, DRAIN_FLASH_FRAMES, DRAIN_FLASH_FRAMES, DRAIN_FLASH_FRAMES],
  };
}

export function copySpecialEffectStateInto(target: SpecialEffectState, source: Readonly<SpecialEffectState>): void {
  for (const slot of PARTICIPANT_SLOTS) {
    target.drainSerial[slot] = source.drainSerial[slot];
    target.drainAge[slot] = source.drainAge[slot];
  }
}

export function clearSpecialEffectState(state: SpecialEffectState): void {
  for (const slot of PARTICIPANT_SLOTS) {
    state.drainSerial[slot] = 0;
    state.drainAge[slot] = DRAIN_FLASH_FRAMES;
  }
}

export function firstSpecialEffectDifference(expected: Readonly<SpecialEffectState>, actual: Readonly<SpecialEffectState>): string | undefined {
  for (const slot of PARTICIPANT_SLOTS) {
    if (expected.drainSerial[slot] !== actual.drainSerial[slot]) return `slot[${slot}].drainSerial`;
    if (expected.drainAge[slot] !== actual.drainAge[slot]) return `slot[${slot}].drainAge`;
  }
  return undefined;
}

/** Advances one executed frame for the fighter in a participant slot. */
export function advanceSpecialEffect(state: SpecialEffectState, fighter: Readonly<Fighter>, slot: ParticipantSlot): void {
  const drainSerial = fighter.visuals.manaDrained;
  if (fighter.status.out) state.drainAge[slot] = DRAIN_FLASH_FRAMES;
  else if (drainSerial > state.drainSerial[slot]) state.drainAge[slot] = 0;
  else if (state.drainAge[slot] < DRAIN_FLASH_FRAMES) state.drainAge[slot]++;
  state.drainSerial[slot] = drainSerial;
}

// Shared and never changed: renderers project every pooled effect on every callback.
const HIDDEN: Readonly<StaticSpecialPose> = { visible: false, x: 0.0, z: 0.0, scale: 0.0, alpha: 0, red: 0, green: 0, blue: 0 };

export function projectSpecialEffect(state: Readonly<SpecialEffectState>, fighter: Readonly<Fighter> | undefined, slot: number, kind: StaticSpecial): Readonly<StaticSpecialPose> {
  if (fighter === undefined || fighter.status.out || (kind !== STATIC_DRAIN_FLASH && fighter.character !== Character.demonHunter)) return HIDDEN;
  const scale = characterModelScale(fighter.character);
  const { special, motion } = fighter;
  const felRush = special.action === SpecialAction.demonHunterFelRush;
  if (kind === STATIC_AURA) {
    const immolate = special.action === SpecialAction.demonHunterImmolate
      && special.frame >= DEMONHUNTER_IMMOLATE_STARTUP && special.frame < DEMONHUNTER_IMMOLATE_STARTUP + DEMONHUNTER_IMMOLATE_ACTIVE;
    // Fel Rush's tell flares the aura before the rush; Chaos Strike flares it on its active frames.
    const tell = felRush && special.form === 0 && special.frame >= 1 && special.frame <= FEL_RUSH_TELL_LAST;
    const chaos = felRush && (special.form === CHAOS_STRIKE_FORM || special.form === CHAOS_STRIKE_AIR_FORM)
      && special.frame >= CHAOS_STRIKE_FIRST && special.frame <= CHAOS_STRIKE_LAST;
    return {
      visible: immolate || tell || chaos,
      x: motion.x,
      z: f32(motion.z + f32(50 * scale)),
      scale: f32((immolate ? f32(1.4) : f32(1.1)) * scale),
      alpha: 230,
      red: immolate ? 85 : 60,
      green: 255,
      blue: immolate ? 100 : 60,
    };
  }
  if (kind === STATIC_WING_TRAIL) {
    return {
      // The glide (form 1, its slash 2) keeps the wings spread from its first frame; the
      // same fel trail follows Fel Rush's rush and Vengeful Retreat's vault.
      visible: (special.action === SpecialAction.demonHunterWingAscent && (special.frame >= DEMONHUNTER_WING_STARTUP || special.form !== 0))
        || (felRush && special.form === 0 && special.frame >= FEL_RUSH_FIRST && special.frame <= FEL_RUSH_LAST)
        || (felRush && special.form === VENGEFUL_RETREAT_FORM && special.frame <= VENGEFUL_RETREAT_MOVE_LAST),
      x: motion.x,
      z: f32(motion.z + f32(8 * scale)),
      scale: f32(0.75 * scale),
      alpha: 180,
      red: 95,
      green: 255,
      blue: 125,
    };
  }
  const age = state.drainAge[slot] ?? DRAIN_FLASH_FRAMES;
  const progress = f32(age / DRAIN_FLASH_FRAMES);
  return {
    visible: age < DRAIN_FLASH_FRAMES,
    // Over the drained fighter's head, in mana-burn purple.
    x: motion.x,
    z: f32(motion.z + f32(150 * scale)),
    scale: f32(f32(f32(0.8) + f32(progress * f32(0.7))) * scale),
    alpha: toInt(f32(255 * f32(1.0 - progress))),
    red: 170,
    green: 80,
    blue: 255,
  };
}
