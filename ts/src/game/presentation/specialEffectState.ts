import { toInt } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_SLOTS, type ParticipantSlot, type Slots } from "../input/participants";
import { Character, SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import {
  CHAOS_STRIKE_AIR_FORM, CHAOS_STRIKE_FIRST, CHAOS_STRIKE_FORM, CHAOS_STRIKE_LAST, DEMONHUNTER_IMMOLATE_ACTIVE, DEMONHUNTER_IMMOLATE_STARTUP,
  DEMONHUNTER_WING_STARTUP, FEL_RUSH_FIRST, FLAME_CRASH_FORM, FLAME_CRASH_HANG_LAST, FEL_RUSH_LAST, FEL_RUSH_TELL_LAST, VENGEFUL_RETREAT_FORM, VENGEFUL_RETREAT_MOVE_LAST,
} from "../sim/specials";
import { characterModelScale } from "./modelScale";

export const DRAIN_FLASH_FRAMES = 12;


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





export interface SpecialEffectState {
  readonly drainSerial: Slots<number>;

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


export function advanceSpecialEffect(state: SpecialEffectState, fighter: Readonly<Fighter>, slot: ParticipantSlot): void {
  const drainSerial = fighter.visuals.manaDrained;
  if (fighter.status.out) state.drainAge[slot] = DRAIN_FLASH_FRAMES;
  else if (drainSerial > state.drainSerial[slot]) state.drainAge[slot] = 0;
  else if (state.drainAge[slot] < DRAIN_FLASH_FRAMES) state.drainAge[slot]++;
  state.drainSerial[slot] = drainSerial;
}


const HIDDEN: Readonly<StaticSpecialPose> = { visible: false, x: 0.0, z: 0.0, scale: 0.0, alpha: 0, red: 0, green: 0, blue: 0 };

export const createStaticSpecialPose = (): StaticSpecialPose => ({ visible: false, x: 0.0, z: 0.0, scale: 0.0, alpha: 0, red: 0, green: 0, blue: 0 });

/** The pose of a static special effect, written into out (a renderer keeps one so a frame allocates none). */
export function projectSpecialEffect(state: Readonly<SpecialEffectState>, fighter: Readonly<Fighter> | undefined, slot: number, kind: StaticSpecial, out = createStaticSpecialPose()): Readonly<StaticSpecialPose> {
  if (fighter === undefined || fighter.status.out || (kind !== STATIC_DRAIN_FLASH && fighter.character !== Character.demonHunter)) return HIDDEN;
  const scale = characterModelScale(fighter.character);
  const { special, motion } = fighter;
  const felRush = special.action === SpecialAction.demonHunterFelRush;
  if (kind === STATIC_AURA) {

    const immolate = special.action === SpecialAction.demonHunterImmolate && (special.form === 0
      ? special.frame >= DEMONHUNTER_IMMOLATE_STARTUP && special.frame < DEMONHUNTER_IMMOLATE_STARTUP + DEMONHUNTER_IMMOLATE_ACTIVE
      : special.form === FLAME_CRASH_FORM && special.frame >= 1 && special.frame <= FLAME_CRASH_HANG_LAST);

    const tell = felRush && special.form === 0 && special.frame >= 1 && special.frame <= FEL_RUSH_TELL_LAST;
    const chaos = felRush && (special.form === CHAOS_STRIKE_FORM || special.form === CHAOS_STRIKE_AIR_FORM)
      && special.frame >= CHAOS_STRIKE_FIRST && special.frame <= CHAOS_STRIKE_LAST;
    out.visible = immolate || tell || chaos;
    out.x = motion.x;
    out.z = f32(motion.z + f32(50 * scale));
    out.scale = f32((immolate ? f32(1.4) : f32(1.1)) * scale);
    out.alpha = 230;
    out.red = immolate ? 85 : 60;
    out.green = 255;
    out.blue = immolate ? 100 : 60;
    return out;
  }
  if (kind === STATIC_WING_TRAIL) {
    const visible = (special.action === SpecialAction.demonHunterWingAscent && (special.frame >= DEMONHUNTER_WING_STARTUP || special.form !== 0))
      || (felRush && special.form === 0 && special.frame >= FEL_RUSH_FIRST && special.frame <= FEL_RUSH_LAST)
      || (felRush && special.form === VENGEFUL_RETREAT_FORM && special.frame <= VENGEFUL_RETREAT_MOVE_LAST);
    out.visible = visible;
    out.x = motion.x;
    out.z = f32(motion.z + f32(8 * scale));
    out.scale = f32(0.75 * scale);
    out.alpha = 180;
    out.red = 95;
    out.green = 255;
    out.blue = 125;
    return out;
  }
  const age = state.drainAge[slot] ?? DRAIN_FLASH_FRAMES;
  const progress = f32(age / DRAIN_FLASH_FRAMES);
  out.visible = age < DRAIN_FLASH_FRAMES;
  out.x = motion.x;
  out.z = f32(motion.z + f32(150 * scale));
  out.scale = f32(f32(f32(0.8) + f32(progress * f32(0.7))) * scale);
  out.alpha = toInt(f32(255 * f32(1.0 - progress)));
  out.red = 170;
  out.green = 80;
  out.blue = 255;
  return out;
}
