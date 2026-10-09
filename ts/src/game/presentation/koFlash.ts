




import { f32 } from "wisp/src/sim/f32";
import { floorDiv } from "wisp/src/sim/intMath";
import type { Fighter } from "../sim/fighter";
import { sineTurns } from "../sim/mathTables";
import type { ImpactEvents } from "./impactEvents";


export const KO_FLASH_ALPHA = 117;

export const KO_BLUR_SCALE = 50.0;
export const KO_BLUR_DISTANCE = 50.0;

export const KO_BLUR_FADE_FRAMES = 36;

export interface KoFlash {

  readonly hitlag: number[];

  start: number | undefined;

  rise: number;
}

export interface KoFlashLevels {

  readonly alpha: number;
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

function pulse(age: number, rise: number, fade: number, peak: number): number {
  if (age < rise) return peak * sineTurns(f32(f32(age / rise) / 4.0));
  return age >= rise + fade ? 0.0 : (1.0 - (age - rise) / fade) * peak;
}


export function koFlashLevels(flash: Readonly<KoFlash>, frame: number): KoFlashLevels | undefined {
  if (flash.start === undefined) return undefined;
  const age = Math.max(0, frame - flash.start);
  const left = Math.max(0, flash.rise + KO_BLUR_FADE_FRAMES - age);



  const alpha = age < flash.rise ? Math.floor(KO_FLASH_ALPHA * sineTurns(f32(f32(age / flash.rise) / 4.0))) : floorDiv(KO_FLASH_ALPHA * left * left, KO_BLUR_FADE_FRAMES * KO_BLUR_FADE_FRAMES);
  return {
    alpha,
    blur: pulse(age, flash.rise, KO_BLUR_FADE_FRAMES, KO_BLUR_SCALE),
    showing: left > 0,
  };
}


export function endKoFlash(flash: KoFlash): void {
  flash.start = undefined;
}
