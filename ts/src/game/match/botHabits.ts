import { f32 } from "wisp/src/sim/f32";
import { DownState, LedgeState } from "../sim/codes";
import type { Fighter } from "../sim/fighter";

export const HabitChoice = { none: 0, attack: 1, shield: 2, jump: 3, retreat: 4, approach: 5, landing: 6, ledge: 7 } as const;
export type HabitChoice = (typeof HabitChoice)[keyof typeof HabitChoice];
export const HABIT_FIELDS = 4;

export function habitContext(own: Readonly<Fighter>, target: Readonly<Fighter>): number {
  const gap = Math.abs(f32(target.motion.x - own.motion.x));
  const spacing = gap < 150.0 ? 0 : gap < 400.0 ? 1 : 2;
  const situation = target.ledge.state !== LedgeState.none ? 3 : target.down.state !== DownState.none ? 2 : target.motion.grounded ? 0 : 1;
  return spacing + 3 * situation;
}
