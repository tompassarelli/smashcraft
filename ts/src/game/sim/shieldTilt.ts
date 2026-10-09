import { f32 } from "wisp/src/sim/f32";
import type { Fighter } from "./fighter";
import type { Controls } from "./roster";
import { stickX, stickZ } from "./stick";





const RETAIL_RADIUS = f32(6.799376);
const UP_REACH = f32(4.400041);
const DOWN_REACH = f32(3.6297448);
const FORWARD_REACH = 2.75;
const BACK_REACH = f32(3.3000001);

export function advanceShieldTilt(fighter: Fighter, input: Readonly<Controls>): void {
  const active = fighter.shield.raised && input.diStickValid;
  fighter.shield.tiltX = active ? stickX(input) : 0.0;
  fighter.shield.tiltZ = active ? stickZ(input) : 0.0;
}

export function shieldCenterX(fighter: Readonly<Fighter>): number {
  const geometry = fighter.tuning.shield;
  const center = f32(fighter.motion.x + f32(fighter.facing * geometry.centerX));
  const stick = fighter.shield.tiltX;
  if (stick === 0) return center;
  const reach = f32(stick * fighter.facing) < 0 ? BACK_REACH : FORWARD_REACH;
  return f32(center + f32(f32(stick * reach) * f32(geometry.radius / RETAIL_RADIUS)));
}

export function shieldCenterZ(fighter: Readonly<Fighter>): number {
  const geometry = fighter.tuning.shield;
  const center = f32(fighter.motion.z + geometry.centerZ);
  const stick = fighter.shield.tiltZ;
  if (stick === 0) return center;
  const reach = stick < 0 ? DOWN_REACH : UP_REACH;
  return f32(center + f32(f32(stick * reach) * f32(geometry.radius / RETAIL_RADIUS)));
}
