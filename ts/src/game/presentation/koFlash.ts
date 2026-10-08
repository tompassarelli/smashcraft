// A KO's screen blur and flash, after the hit effect of Blizzard's Silverpine
// Sprint (Forsaken Kingdom, build 24329; docs/design/visual-quality.md): a
// white MODULATE_2X cinematic filter and a camera depth-of-field pulse, each
// eased in over a sine quarter and faded linearly. It reads confirmed state
// only and writes nothing back.
import { floorDiv } from "wisp/src/sim/intMath";
import type { Fighter } from "../sim/fighter";
import type { ImpactEvents } from "./impactEvents";

/** Silverpine's caps, which a KO always reaches: its filter alpha and depth-of-field scale. */
export const KO_FLASH_ALPHA = 255;
export const KO_BLUR_SCALE = 50.0;
/** Silverpine's depth-of-field distance while the blur runs. */
export const KO_BLUR_DISTANCE = 50.0;
/** Silverpine's fades at 60 frames a second: the flash over 0.25 s, the blur over 0.6 s. */
export const KO_FLASH_FADE_FRAMES = 15;
export const KO_BLUR_FADE_FRAMES = 36;

export interface KoFlash {
  /** Per slot, the hitlag of the last hit that fighter took. */
  readonly hitlag: number[];
  /** The confirmed frame of the KO playing, if one is. */
  start: number | undefined;
  /** Frames to the peak: the KO blow's hitlag. */
  rise: number;
}

export interface KoFlashLevels {
  /** The filter's grey, 185-255, as Silverpine maps its alpha. */
  readonly grey: number;
  readonly blur: number;
  /** False on the frame both have faded, when the filter and blur turn off. */
  readonly showing: boolean;
}

export function createKoFlash(): KoFlash {
  return { hitlag: [0, 0, 0, 0], start: undefined, rise: 1 };
}

/** Notes one fighter's confirmed frame; true when it starts the flash. */
export function noteKoFlash(flash: KoFlash, frame: number, slot: number, fighter: Readonly<Fighter>, events: Readonly<ImpactEvents>): boolean {
  const { hitlag } = fighter.launch;
  if (events.hit) flash.hitlag[slot] = hitlag;
  else if (hitlag > (flash.hitlag[slot] ?? 0)) flash.hitlag[slot] = hitlag;
  if (events.koDirectionX === 0 && events.koDirectionZ === 0) return false;
  flash.start = frame;
  flash.rise = Math.max(1, flash.hitlag[slot] ?? 0);
  return true;
}

function pulse(age: number, rise: number, fade: number, peak: number): number {
  if (age < rise) return peak * Math.sin(age / rise * Math.PI / 2.0);
  return age >= rise + fade ? 0.0 : (1.0 - (age - rise) / fade) * peak;
}

/** The flash at a presented frame; undefined when none plays. */
export function koFlashLevels(flash: Readonly<KoFlash>, frame: number): KoFlashLevels | undefined {
  if (flash.start === undefined) return undefined;
  const age = Math.max(0, frame - flash.start);
  const alpha = pulse(age, flash.rise, KO_FLASH_FADE_FRAMES, KO_FLASH_ALPHA);
  return {
    grey: 185 + floorDiv(Math.floor(alpha) * 70, 255),
    blur: pulse(age, flash.rise, KO_BLUR_FADE_FRAMES, KO_BLUR_SCALE),
    showing: age < flash.rise + KO_BLUR_FADE_FRAMES,
  };
}

/** Forgets a finished or abandoned flash. */
export function endKoFlash(flash: KoFlash): void {
  flash.start = undefined;
}
