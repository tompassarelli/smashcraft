// What a fighter's mana bar shows (smashcraft:docs/design/mana.md, "The bar"):
// its fill, a flash when a special it could not afford did not come out, and
// a short glow when a hit or throw pays it. Local presentation read from the
// simulation, the same for every player.
import { f32 } from "wisp/src/sim/f32";
import { idiv, imod } from "wisp/src/sim/intMath";
import { ROSTER_MANA } from "../sim/mana";
import { ESCAPE_METER_BORDER, ESCAPE_METER_HEIGHT } from "./escapeMeter";

/** Mana between the bar's segment lines. */
export const MANA_BAR_SEGMENT = 10;
export const MANA_BAR_SEGMENTS = idiv(ROSTER_MANA.max, MANA_BAR_SEGMENT);
/** Rendered updates a refusal flashes for, about three quarters of a second, blinking every 6. */
export const MANA_FLASH_UPDATES = 45;
const MANA_FLASH_BLINK = 6;
/** A rise of at least this much in one update glows; the trickle's single points never do. */
export const MANA_GLOW_GAIN = 3;
export const MANA_GLOW_UPDATES = 12;

/** UI height of the overhead bar and its border, and the gap kept from the escape meter under it. */
/** The overhead bar's length, the escape meter's. */
export const OVERHEAD_MANA_WIDTH = f32(0.07);
export const OVERHEAD_MANA_HEIGHT = f32(0.005);
export const OVERHEAD_MANA_BORDER = f32(0.0015);
const OVERHEAD_GAP = f32(0.003);

export interface ManaFeedback {
  /** The refusal count last seen; a larger one starts a flash. */
  seenDenials: number;
  /** The points last seen, or -1 before the first update. */
  seenPoints: number;
  flashLeft: number;
  glowLeft: number;
}

export const manaFeedback = (): ManaFeedback => ({ seenDenials: 0, seenPoints: -1, flashLeft: 0, glowLeft: 0 });

/** Advances one rendered update from the fighter's points and refusal count. */
export function advanceManaFeedback(feedback: ManaFeedback, points: number, denials: number): void {
  if (feedback.seenPoints < 0) {
    feedback.seenPoints = points;
    feedback.seenDenials = denials;
    return;
  }
  if (denials > feedback.seenDenials) feedback.flashLeft = MANA_FLASH_UPDATES;
  else if (feedback.flashLeft > 0) feedback.flashLeft--;
  feedback.seenDenials = denials;
  if (points - feedback.seenPoints >= MANA_GLOW_GAIN) feedback.glowLeft = MANA_GLOW_UPDATES;
  else if (feedback.glowLeft > 0) feedback.glowLeft--;
  feedback.seenPoints = points;
}

/** Whether the refusal flash is lit this update: it blinks while it lasts. */
export function manaFlashLit(feedback: Readonly<ManaFeedback>): boolean {
  return feedback.flashLeft > 0 && imod(idiv(MANA_FLASH_UPDATES - feedback.flashLeft, MANA_FLASH_BLINK), 2) === 0;
}

export function manaGlowLit(feedback: Readonly<ManaFeedback>): boolean {
  return feedback.glowLeft > 0;
}

/** The fill's share of the bar, 0..1. */
export function manaFill(points: number): number {
  return Math.min(1.0, Math.max(0.0, points / ROSTER_MANA.max));
}

/**
 * The overhead bar's centre, in UI units up from the head anchor where the
 * escape meter sits: on the anchor alone, stacked just above a shown escape meter.
 */
export function overheadManaLift(escapeShown: boolean): number {
  return escapeShown ? ESCAPE_METER_HEIGHT / 2 + ESCAPE_METER_BORDER + OVERHEAD_GAP + OVERHEAD_MANA_HEIGHT / 2 + OVERHEAD_MANA_BORDER : 0.0;
}
