



import { f32 } from "wisp/src/sim/f32";
import { idiv, imod } from "wisp/src/sim/intMath";
import { ROSTER_MANA } from "../sim/mana";
import { ESCAPE_METER_BORDER, ESCAPE_METER_HEIGHT } from "./escapeMeter";

/** The bar's 33/33/34 segments: an EX costs one, an ultimate all three. */
export const MANA_BAR_SEGMENTS = ROSTER_MANA.segments;
/** Rendered updates a refusal flashes for, about three quarters of a second, blinking every 6. */
export const MANA_FLASH_UPDATES = 45;
const MANA_FLASH_BLINK = 6;

export const MANA_GLOW_GAIN = 3;
export const MANA_GLOW_UPDATES = 12;

export const MANA_DRAIN_UPDATES = 20;



export const OVERHEAD_MANA_WIDTH = f32(0.07);
export const OVERHEAD_MANA_HEIGHT = f32(0.005);
export const OVERHEAD_MANA_BORDER = f32(0.0015);
const OVERHEAD_GAP = f32(0.003);

export interface ManaFeedback {

  seenDenials: number;

  seenPoints: number;
  flashLeft: number;
  glowLeft: number;

  seenDrains: number;
  drainLeft: number;
}

export const manaFeedback = (): ManaFeedback => ({ seenDenials: 0, seenPoints: -1, flashLeft: 0, glowLeft: 0, seenDrains: 0, drainLeft: 0 });


export function advanceManaFeedback(feedback: ManaFeedback, points: number, denials: number, drains: number): void {
  if (feedback.seenPoints < 0) {
    feedback.seenPoints = points;
    feedback.seenDenials = denials;
    feedback.seenDrains = drains;
    return;
  }
  if (drains > feedback.seenDrains) feedback.drainLeft = MANA_DRAIN_UPDATES;
  else if (feedback.drainLeft > 0) feedback.drainLeft--;
  feedback.seenDrains = drains;
  if (denials > feedback.seenDenials) feedback.flashLeft = MANA_FLASH_UPDATES;
  else if (feedback.flashLeft > 0) feedback.flashLeft--;
  feedback.seenDenials = denials;
  if (points - feedback.seenPoints >= MANA_GLOW_GAIN) feedback.glowLeft = MANA_GLOW_UPDATES;
  else if (feedback.glowLeft > 0) feedback.glowLeft--;
  feedback.seenPoints = points;
}


export function manaFlashLit(feedback: Readonly<ManaFeedback>): boolean {
  return feedback.flashLeft > 0 && imod(idiv(MANA_FLASH_UPDATES - feedback.flashLeft, MANA_FLASH_BLINK), 2) === 0;
}


export function manaDrainLit(feedback: Readonly<ManaFeedback>): boolean {
  return feedback.drainLeft > 0;
}

export function manaGlowLit(feedback: Readonly<ManaFeedback>): boolean {
  return feedback.seenPoints >= ROSTER_MANA.max || feedback.glowLeft > 0;
}


export function manaFill(points: number): number {
  return Math.min(1.0, Math.max(0.0, points / ROSTER_MANA.max));
}





export function overheadManaLift(escapeShown: boolean): number {
  return escapeShown ? ESCAPE_METER_HEIGHT / 2 + ESCAPE_METER_BORDER + OVERHEAD_GAP + OVERHEAD_MANA_HEIGHT / 2 + OVERHEAD_MANA_BORDER : 0.0;
}
