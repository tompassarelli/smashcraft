import { floorMod } from "wisp/src/sim/intMath";
import { ROSTER_MANA } from "../sim/mana";
import { SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";

export const WHITE_GLOW_PERIOD = 12;
export const HEAVY_HITLAG_FRAMES = 8;
/** The ultimate's super flash: at most four frames, never a cutscene (docs/design/ultimates.md). */
export const ULTIMATE_FLASH_FRAMES = 4;

export interface WhiteGlowState {
  hit: number;
  remaining: number;
  total: number;
  frame: number;
  meter: number;
  readyUntil: number;
}

export function createWhiteGlowState(): WhiteGlowState {
  return { hit: 0, remaining: 0, total: 0, frame: -1, meter: 0, readyUntil: -1 };
}


export function whiteGlowAlpha(state: WhiteGlowState, fighter: Readonly<Fighter>, frame: number): number {
  const remaining = fighter.launch.hitlag;
  if (fighter.mana.points >= ROSTER_MANA.max && state.meter < ROSTER_MANA.max) state.readyUntil = frame + 12;
  state.meter = fighter.mana.points;
  if (remaining <= 0 || fighter.status.out) state.total = 0;
  else if (state.hit !== fighter.visuals.hit || remaining > state.remaining || frame < state.frame) state.total = remaining;
  state.hit = fighter.visuals.hit;
  state.remaining = remaining;
  state.frame = frame;
  if (fighter.status.out) return 0;
  if (frame < state.readyUntil) return 230;
  if (fighter.special.action === SpecialAction.heroUltimate && fighter.special.frame <= ULTIMATE_FLASH_FRAMES) return 230;
  if (remaining > 0 && state.total >= HEAVY_HITLAG_FRAMES) {
    return floorMod(state.total - remaining, 4) < 2 ? 220 : 100;
  }
  if (!fighter.attack.smashCharging) return 0;
  return floorMod(fighter.attack.smashChargeFrames, WHITE_GLOW_PERIOD) < WHITE_GLOW_PERIOD / 2 ? 190 : 0;
}
