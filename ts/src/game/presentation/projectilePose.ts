import { f32 } from "wisp/src/sim/f32";
import type { Fighter } from "../sim/fighter";
import { heroProjectileRadius, projectileActive } from "../sim/projectiles";
import { ProjectileKind } from "../sim/codes";
import { meleeAtan2 } from "../../sim/meleeScalarMath";

interface ProjectilePose {
  visible: boolean;
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  /** A ground pool's horizontal danger radius; zero for traveling missiles. */
  poolRadius: number;
  dangerRadius: number;
  armed: boolean;
  poolPulse: number;
  modelScale: number;
  animationSequence?: string | undefined;
  animationSeconds?: number | undefined;
}

// Shared and never changed: renderers project every pooled effect on every callback.
const HIDDEN: Readonly<ProjectilePose> = { visible: false, x: 0.0, z: 0.0, yaw: 0.0, pitch: 0.0, poolRadius: 0.0, dangerRadius: 0.0, armed: false, poolPulse: 0.0, modelScale: 1.0 };

/** A live projectile, facing its direction of travel and pitched along its path; hidden outside play. */
export function projectedProjectile(fighter: Readonly<Fighter> | undefined, index: number, playing: boolean): Readonly<ProjectilePose> {
  const projectile = fighter?.projectiles[index];
  if (!playing || fighter === undefined || projectile === undefined || fighter.status.out || !projectileActive(fighter, index)) {
    return HIDDEN;
  }
  const { velocityX, velocityZ } = projectile;
  const spec = projectile.kind === ProjectileKind.hero ? projectile.spec : undefined;
  const radius = spec?.pool === undefined ? 0.0 : heroProjectileRadius(projectile, spec);
  const age = spec === undefined ? 0 : spec.life - projectile.life;
  const first = spec?.activeFrom ?? 0;
  const armed = spec !== undefined && age >= first;
  const animation = spec?.modelAnimation;
  const animationSeconds = animation === undefined ? undefined : armed
    ? f32(animation.activeSeconds + f32((age - first) / 60))
    : f32(animation.warningSeconds + f32(Math.max(0, age - 1) / 60));
  return {
    visible: true,
    x: projectile.x,
    z: projectile.z,
    yaw: velocityX >= 0.0 ? 0.0 : f32(3.141592654),
    pitch: -meleeAtan2(velocityZ, Math.abs(velocityX)),
    poolRadius: radius,
    dangerRadius: spec === undefined ? 0.0 : heroProjectileRadius(projectile, spec),
    armed,
    poolPulse: spec?.pool === undefined || projectile.poolHits === 0 ? 0.0
      : f32(Math.max(0.0, f32((projectile.poolWait - (spec.pool.every - 13)) / 12.0))),
    modelScale: spec?.modelRadius === undefined ? 1.0 : f32(radius / spec.modelRadius),
    animationSequence: animation?.sequence,
    animationSeconds,
  };
}
