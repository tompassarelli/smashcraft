import { floorMod } from "wisp/src/sim/intMath";
import type { Fighter } from "../sim/fighter";

export const WHITE_GLOW_PERIOD = 12;
export const HEAVY_HITLAG_FRAMES = 8;

export interface WhiteGlowState {
  hit: number;
  remaining: number;
  total: number;
  frame: number;
}

export function createWhiteGlowState(): WhiteGlowState {
  return { hit: 0, remaining: 0, total: 0, frame: -1 };
}

/** Remember the contact's full freeze so its last seven frames stay heavy. */
export function whiteGlowAlpha(state: WhiteGlowState, fighter: Readonly<Fighter>, frame: number): number {
  const remaining = fighter.launch.hitlag;
  if (remaining <= 0 || fighter.status.out) state.total = 0;
  else if (state.hit !== fighter.visuals.hit || remaining > state.remaining || frame < state.frame) state.total = remaining;
  state.hit = fighter.visuals.hit;
  state.remaining = remaining;
  state.frame = frame;
  if (fighter.status.out) return 0;
  if (remaining > 0 && state.total >= HEAVY_HITLAG_FRAMES) {
    return floorMod(state.total - remaining, 4) < 2 ? 220 : 100;
  }
  if (!fighter.attack.smashCharging) return 0;
  return floorMod(fighter.attack.smashChargeFrames, WHITE_GLOW_PERIOD) < WHITE_GLOW_PERIOD / 2 ? 190 : 0;
}
