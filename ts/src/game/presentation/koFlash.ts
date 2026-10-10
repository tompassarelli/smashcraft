




import { f32 } from "wisp/src/sim/f32";
import { floorDiv } from "wisp/src/sim/intMath";
import type { Fighter } from "../sim/fighter";
import { sineTurns } from "../sim/mathTables";
import type { ImpactEvents } from "./impactEvents";


export const KO_FLASH_ALPHA = 117;

export const KO_BLUR_SCALE = 50.0;
export const KO_BLUR_DISTANCE = 50.0;

export const KO_BLUR_FADE_FRAMES = 36;

// Reforged and Definitive blend the filter in linear light and draw nothing below alpha 4, so the wash fades by colour at this alpha (#289).
export const KO_FLASH_FLOOR_ALPHA = 8;

export const KO_FLASH_TAIL_FRAMES = 20;

export interface KoFlash {

  readonly hitlag: number[];

  start: number | undefined;

  rise: number;
}

interface KoFlashLevels {

  readonly alpha: number;

  readonly colour: number;
  readonly blur: number;

  readonly showing: boolean;
}

export function createKoFlash(): KoFlash {
  return { hitlag: [0, 0, 0, 0], start: undefined, rise: 1 };
}


export function noteKoFlash(flash: KoFlash, frame: number, slot: number, fighter: Readonly<Fighter>, events: Readonly<ImpactEvents>): boolean {
  const { hitlag } = fighter.launch;
  if (events.hit) flash.hitlag[slot] = hitlag;
  else if (hitlag > (flash.hitlag[slot] ?? 0)) flash.hitlag[slot] = hitlag;
  if (events.koDirectionX === 0 && events.koDirectionZ === 0) return false;
  flash.start = frame;
  flash.rise = Math.max(1, flash.hitlag[slot] ?? 0);
  return true;
}

// The fall is a smoothstep that lands on 0 before the wash's colour tail, so turning the effect off changes nothing (#289).
function pulse(age: number, rise: number, fade: number, peak: number): number {
  if (age < rise) return peak * sineTurns(f32(f32(age / rise) / 4.0));
  if (age >= rise + fade - 1) return 0.0;
  const t = 1.0 - (age - rise) / (fade - 1);
  return t * t * (3.0 - 2.0 * t) * peak;
}


export function koFlashLevels(flash: Readonly<KoFlash>, frame: number): KoFlashLevels | undefined {
  if (flash.start === undefined) return undefined;
  const age = Math.max(0, frame - flash.start);
  const fading = age - flash.rise;
  const cube = KO_BLUR_FADE_FRAMES * KO_BLUR_FADE_FRAMES * KO_BLUR_FADE_FRAMES;
  const left = KO_BLUR_FADE_FRAMES - fading;
  const tail = fading - KO_BLUR_FADE_FRAMES;
  const alpha = age < flash.rise ? Math.floor(KO_FLASH_ALPHA * sineTurns(f32(f32(age / flash.rise) / 4.0)))
    : left > 0 ? KO_FLASH_FLOOR_ALPHA + floorDiv((KO_FLASH_ALPHA - KO_FLASH_FLOOR_ALPHA) * left * left * left + floorDiv(cube, 2), cube)
    : KO_FLASH_FLOOR_ALPHA;
  return {
    alpha,
    colour: tail < 0 ? 255 : floorDiv(255 * Math.max(0, KO_FLASH_TAIL_FRAMES - 1 - tail), KO_FLASH_TAIL_FRAMES),
    blur: pulse(age, flash.rise, KO_BLUR_FADE_FRAMES, KO_BLUR_SCALE),
    showing: tail < KO_FLASH_TAIL_FRAMES,
  };
}


export function endKoFlash(flash: KoFlash): void {
  flash.start = undefined;
}
