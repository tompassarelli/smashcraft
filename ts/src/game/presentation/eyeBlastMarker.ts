import { f32 } from "wisp/src/sim/f32";
import { min, toInt } from "../../runtime/numbers";
import { Character, SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { EYE_BLAST_FIRST, EYE_BLAST_FORM, EYE_BLAST_LAST, EYE_BLAST_NEAR, EYE_BLAST_REACH, EYE_BLAST_SWEEP, EYE_BLAST_WINDUP } from "../sim/specials";

export const EYE_BLAST_MARKS = 8;
const MARK_NEAR = 60.0;
const MARK_HEIGHT = 20.0;
const MARK_SPACING = f32(f32(EYE_BLAST_REACH - MARK_NEAR) / (EYE_BLAST_MARKS - 1));

export interface EyeBlastMarkPose {
  x: number;
  z: number;
  scale: number;
  alpha: number;
}

const pose: EyeBlastMarkPose = { x: 0.0, z: 0.0, scale: 0.0, alpha: 0 };

export function eyeBlastMark(fighter: Readonly<Fighter>, mark: number): Readonly<EyeBlastMarkPose> | undefined {
  const { action, form, frame } = fighter.special;
  if (fighter.character !== Character.demonHunter || fighter.status.out || action !== SpecialAction.demonHunterManaBurn || form !== EYE_BLAST_FORM) return undefined;
  if (frame < 1 || frame > EYE_BLAST_LAST) return undefined;
  const ahead = f32(MARK_NEAR + f32(MARK_SPACING * mark));
  const lit = frame >= EYE_BLAST_FIRST && ahead <= f32(EYE_BLAST_NEAR + f32(EYE_BLAST_SWEEP * (frame - EYE_BLAST_FIRST)));
  pose.x = f32(fighter.motion.x + f32(fighter.facing * ahead));
  pose.z = f32(fighter.motion.z + MARK_HEIGHT);
  const grown = f32(f32(min(frame, EYE_BLAST_WINDUP)) / EYE_BLAST_WINDUP);
  pose.scale = lit ? 1.0 : f32(f32(0.2) + f32(f32(0.15) * grown));
  pose.alpha = lit ? 255 : 120 + toInt(f32(100.0 * grown));
  return pose;
}
