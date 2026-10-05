// Where a fighter's projectile is drawn, projected from completed state alone,
// so a restored or corrected frame draws exactly what its state says.
import { f32 } from "../../sim/f32";
import { PROJECTILE_CAPACITY, type Fighter } from "../sim/fighter";
import { atan2 } from "../sim/warcraftMath";

export interface ProjectilePose {
  readonly visible: boolean;
  readonly x: number;
  readonly z: number;
  /** Faces the direction of travel. */
  readonly yaw: number;
  /** Tilts with the climb or fall. */
  readonly pitch: number;
}

const HIDDEN: ProjectilePose = { visible: false, x: 0.0, z: 0.0, yaw: 0.0, pitch: 0.0 };

export function projectedProjectile(fighter: Readonly<Fighter> | undefined, index: number, playing: boolean): ProjectilePose {
  if (!playing || fighter === undefined || fighter.status.out || index < 0 || index >= PROJECTILE_CAPACITY) return HIDDEN;
  const projectile = fighter.projectiles[index];
  if (projectile === undefined || projectile.life <= 0) return HIDDEN;
  const { velocityX, velocityZ } = projectile;
  return {
    visible: true,
    x: projectile.x,
    z: projectile.z,
    yaw: velocityX >= 0 ? 0.0 : f32(3.141592654),
    pitch: -atan2(velocityZ, Math.abs(velocityX)),
  };
}
