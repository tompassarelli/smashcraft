import { max, min, toInt } from "../../runtime/numbers";
import { idiv } from "wisp/src/sim/intMath";
import type { Fighter } from "./fighter";


export const ROSTER_MANA = { max: 100, exCost: 33, segments: 3, dealtPerPercent: 1, dealtCap: 12, takenPercentPerPoint: 2, takenCap: 6 } as const;

export function spendMana(f: Fighter, cost: number): void {
  if (cost > 0) f.mana.points = max(0, f.mana.points - cost);
}

export function gainMana(f: Fighter, points: number): void {
  if (points > 0 && !f.status.out) f.mana.points = min(ROSTER_MANA.max, f.mana.points + points);
}

export function drainMana(f: Fighter, points: number): void {
  f.mana.points = max(0, f.mana.points - points);
}

export function dealtManaGain(damage: number): number {
  return min(ROSTER_MANA.dealtCap, toInt(max(0.0, damage)) * ROSTER_MANA.dealtPerPercent);
}

export function takenManaGain(damage: number): number {
  return min(ROSTER_MANA.takenCap, idiv(toInt(max(0.0, damage)), ROSTER_MANA.takenPercentPerPoint));
}
