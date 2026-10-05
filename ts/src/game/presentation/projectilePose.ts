import { f32 } from "wisp/src/sim/f32";
import type { Fighter } from "../sim/fighter";
import { projectileActive } from "../sim/projectiles";
import { atan2 } from "../sim/warcraftMath";

interface ProjectilePose {
  visible: boolean;
  x: number;
  z: number;
  yaw: number;
  pitch: number;
}

/** A live projectile, facing its direction of travel and pitched along its path; hidden outside play. */
export function projectedProjectile(fighter: Readonly<Fighter> | undefined, index: number, playing: boolean): ProjectilePose {
  const projectile = fighter?.projectiles[index];
  if (!playing || fighter === undefined || projectile === undefined || fighter.status.out || !projectileActive(fighter, index)) {
    return { visible: false, x: 0.0, z: 0.0, yaw: 0.0, pitch: 0.0 };
  }
  const { velocityX, velocityZ } = projectile;
  return {
    visible: true,
    x: projectile.x,
    z: projectile.z,
    yaw: velocityX >= 0.0 ? 0.0 : f32(3.141592654),
    pitch: -atan2(velocityZ, Math.abs(velocityX)),
  };
}
