import { f32 } from "waygate/src/sim/f32";
import { SHIELD_MAX, type Fighter } from "../sim/fighter";

interface ShieldPose {
  visible: boolean;
  x: number;
  z: number;
  scale: number;
}

/** A raised shield's bubble, shrinking with its energy; hidden outside play. */
export function projectedShield(fighter: Readonly<Fighter> | undefined, playing: boolean): ShieldPose {
  if (!playing || fighter === undefined || fighter.status.out || !fighter.shield.raised) return { visible: false, x: 0.0, z: 0.0, scale: 0.0 };
  return {
    visible: true,
    x: fighter.motion.x,
    z: f32(fighter.motion.z + 50.0),
    scale: f32(f32(0.7) + f32(f32(0.5 * fighter.shield.energy) / SHIELD_MAX)),
  };
}
