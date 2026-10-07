import { f32 } from "wisp/src/sim/f32";
import { imod } from "wisp/src/sim/intMath";
import { SHIELD_MAX, type Fighter } from "../sim/fighter";
import { shieldCenterX, shieldCenterZ } from "../sim/shieldTilt";

interface ShieldPose {
  visible: boolean;
  x: number;
  z: number;
  scale: number;
  red: number;
  green: number;
  blue: number;
}

// Shared and never changed: renderers project every pooled effect on every callback.
const HIDDEN: Readonly<ShieldPose> = { visible: false, x: 0.0, z: 0.0, scale: 0.0, red: 255, green: 255, blue: 255 };

/** A raised shield's bubble, shrinking with its energy; hidden outside play. */
export function projectedShield(fighter: Readonly<Fighter> | undefined, playing: boolean): Readonly<ShieldPose> {
  if (!playing || fighter === undefined || fighter.status.out || !fighter.shield.raised) return HIDDEN;
  const struck = fighter.shield.stun > 0;
  // The bubble compresses and rebounds through contact freeze and shieldstun.
  // Deriving the pulse from replayable clocks keeps corrections read-only.
  const clock = fighter.launch.hitlag > 0 ? fighter.launch.hitlag : fighter.shield.stun;
  const pulse = struck ? (imod(clock, 4) < 2 ? 1.125 : 0.9375) : 1.0;
  const recoil = struck ? (fighter.shield.pushbackX > 0.0 ? 6.0 : fighter.shield.pushbackX < 0.0 ? -6.0 : 0.0) : 0.0;
  return {
    visible: true,
    x: f32(shieldCenterX(fighter) + recoil),
    z: shieldCenterZ(fighter),
    scale: f32(f32(f32(0.7) + f32(f32(0.5 * fighter.shield.energy) / SHIELD_MAX)) * pulse),
    red: 255,
    green: struck ? 225 : 255,
    blue: struck ? 150 : 255,
  };
}
