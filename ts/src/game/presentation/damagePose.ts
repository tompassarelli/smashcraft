import { Character, DownState, LedgeState, ShieldBreak } from "../sim/codes";
import { isTumbling } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { at } from "wisp/src/runtime/lookup";
import type { HeroClip } from "../sim/heroes/hero";
import { TINKER_DAMAGE_CLIPS } from "./heroes/tinkerClipInfo";
import { DAMAGE_CLIPS } from "./damageClipInfo";

/** A fighter's hit reaction clip; the numbers are the Wurst codes pose keys record. */
export const DamagePose = { none: 0, ground: 1, air: 2, tumble: 3, shield: 4 } as const;
export type DamagePose = (typeof DamagePose)[keyof typeof DamagePose];

/** Low/middle/high rows, small/medium/large columns; presentation only. */
export function contactDamageClip(fighter: Readonly<Fighter>): HeroClip {
  const row = fighter.character === Character.tinker ? TINKER_DAMAGE_CLIPS : DAMAGE_CLIPS[fighter.character];
  if (row === undefined) throw new Error("Missing fighter damage grid");
  return at(row, fighter.visuals.hitHeight * 3 + fighter.visuals.hitStrength);
}

/** Animation selection only; this result never feeds combat. */
export function damagePose(fighter: Readonly<Fighter>): DamagePose {
  const { status, shield, ledge, down, launch, motion } = fighter;
  if (status.out || status.frozenFrames > 0 || shield.breakState !== ShieldBreak.none || ledge.state !== LedgeState.none) return DamagePose.none;
  if (down.state !== DownState.none && down.state !== DownState.tumble) return DamagePose.none;
  // A grounded contact keeps its grounded reaction through hitlag, before the launch lifts it.
  if (launch.hitstun > 0 && (motion.grounded || (launch.hitlag > 0 && launch.sdiWasGrounded))) return DamagePose.ground;
  if (isTumbling(fighter)) return DamagePose.tumble;
  if (launch.hitstun > 0) return DamagePose.air;
  if (shield.raised && shield.stun > 0) return DamagePose.shield;
  return DamagePose.none;
}
