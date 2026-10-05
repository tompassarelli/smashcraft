// The shield bubble projected from completed state alone: it grows with shield
// energy and follows a restored or corrected frame without hidden state.
import { f32 } from "../../sim/f32";
import { SHIELD_MAX, type Fighter } from "../sim/fighter";

export interface ShieldPose {
  readonly visible: boolean;
  readonly x: number;
  readonly z: number;
  readonly scale: number;
}

const HIDDEN: ShieldPose = { visible: false, x: 0.0, z: 0.0, scale: 0.0 };

/** The bubble sits at the fighter's middle. */
const SHIELD_HEIGHT = 50.0;

export function projectedShield(fighter: Readonly<Fighter> | undefined, playing: boolean): ShieldPose {
  if (!playing || fighter === undefined || fighter.status.out || !fighter.shield.raised) return HIDDEN;
  const { motion, shield } = fighter;
  return {
    visible: true,
    x: motion.x,
    z: f32(motion.z + SHIELD_HEIGHT),
    scale: f32(f32(0.7) + f32(f32(0.5 * shield.energy) / SHIELD_MAX)),
  };
}
