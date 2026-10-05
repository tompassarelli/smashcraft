import { DownState, LedgeState, ShieldBreak } from "../sim/codes";
import { isTumbling } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";

export const DAMAGE_POSE_NONE = 0;
export const DAMAGE_POSE_GROUND = 1;
export const DAMAGE_POSE_AIR = 2;
export const DAMAGE_POSE_TUMBLE = 3;
export const DAMAGE_POSE_SHIELD = 4;
export type DamagePose = typeof DAMAGE_POSE_NONE | typeof DAMAGE_POSE_GROUND | typeof DAMAGE_POSE_AIR | typeof DAMAGE_POSE_TUMBLE | typeof DAMAGE_POSE_SHIELD;

/** Animation selection only; this result never feeds combat. */
export function damagePose(fighter: Readonly<Fighter>): DamagePose {
  if (fighter.status.out || fighter.status.frozenFrames > 0 || fighter.shield.breakState !== ShieldBreak.none || fighter.ledge.state !== LedgeState.none) return DAMAGE_POSE_NONE;
  if (fighter.down.state !== DownState.none && fighter.down.state !== DownState.tumble) return DAMAGE_POSE_NONE;
  if (fighter.launch.hitstun > 0 && (fighter.motion.grounded || (fighter.launch.hitlag > 0 && fighter.launch.sdiWasGrounded))) return DAMAGE_POSE_GROUND;
  if (isTumbling(fighter)) return DAMAGE_POSE_TUMBLE;
  if (fighter.launch.hitstun > 0) return DAMAGE_POSE_AIR;
  if (fighter.shield.raised && fighter.shield.stun > 0) return DAMAGE_POSE_SHIELD;
  return DAMAGE_POSE_NONE;
}
