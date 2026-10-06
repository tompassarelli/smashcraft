import { f32 } from "wisp/src/sim/f32";
import type { Fighter } from "../sim/fighter";
import { projectileActive } from "../sim/projectiles";
import { meleeAtan2 } from "../../sim/meleeScalarMath";

interface ProjectilePose {
  visible: boolean;
  x: number;
  z: number;
  yaw: number;
  pitch: number;
}

// Shared and never changed: renderers project every pooled effect on every callback.
const HIDDEN: Readonly<ProjectilePose> = { visible: false, x: 0.0, z: 0.0, yaw: 0.0, pitch: 0.0 };

/** A live projectile, facing its direction of travel and pitched along its path; hidden outside play. */
export function projectedProjectile(fighter: Readonly<Fighter> | undefined, index: number, playing: boolean): Readonly<ProjectilePose> {
  const projectile = fighter?.projectiles[index];
  if (!playing || fighter === undefined || projectile === undefined || fighter.status.out || !projectileActive(fighter, index)) {
    return HIDDEN;
  }
  const { velocityX, velocityZ } = projectile;
  return {
    visible: true,
    x: projectile.x,
    z: projectile.z,
    yaw: velocityX >= 0.0 ? 0.0 : f32(3.141592654),
    pitch: -meleeAtan2(velocityZ, Math.abs(velocityX)),
  };
}
