// Lich's Chill (smashcraft:docs/design/kit-review-2.md, "Lich"): a hero status
// that lowers the chilled fighter's walk, dash, run and air-drift top speeds.
// Jumps, shield, DI, dodges and specials keep their own values. The status
// itself lives in sim/heroStatus.ts; this module only scales speeds, so the
// movement code reads it without importing the status rules.
import { f32 } from "wisp/src/sim/f32";
import { HeroStatusGroup, HeroStatusKind } from "./codes";
import type { Fighter } from "./fighter";
import type { AppliedStatus } from "./heroStatus";

/** A chilled fighter's top speeds, as a fraction of its own. */
export const CHILL_SPEED_SCALE = f32(0.6);

/** The speed a fighter moves at: unchanged unless it is chilled. */
export function chillScaled(f: Readonly<Fighter>, speed: number): number {
  if (f.motion.grounded && f.status.condition === HeroStatusKind.root) return 0.0;
  return f.status.condition === HeroStatusKind.chill ? f32(speed * CHILL_SPEED_SCALE) : speed;
}

/** Chill as a hit applies it: 75 frames slower, then 120 frames immune. */
export const CHILL: AppliedStatus = { kind: HeroStatusKind.chill, frames: 75, group: HeroStatusGroup.chill, immunityFrames: 120 };
