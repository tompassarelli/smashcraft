




import { f32 } from "wisp/src/sim/f32";
import { HeroStatusGroup, HeroStatusKind } from "./codes";
import type { Fighter } from "./fighter";
import type { AppliedStatus } from "./heroStatus";


export const CHILL_SPEED_SCALE = f32(0.6);


export function chillScaled(f: Readonly<Fighter>, speed: number): number {
  if (f.motion.grounded && f.status.condition === HeroStatusKind.root) return 0.0;
  return f.status.condition === HeroStatusKind.chill ? f32(speed * CHILL_SPEED_SCALE) : speed;
}


export const CHILL: AppliedStatus = { kind: HeroStatusKind.chill, frames: 75, group: HeroStatusGroup.chill, immunityFrames: 120 };
