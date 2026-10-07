// Pain-pose blending for the clip pool. Every clip is its own model, so a
// blend keeps the outgoing pose frozen over the incoming one and dissolves it;
// the incoming pose is fully drawn from its first frame. Presentation only:
// these numbers read combat state and never feed it.
import { at } from "wisp/src/runtime/lookup";
import { floorDiv } from "wisp/src/sim/intMath";
import { max, min } from "../../runtime/numbers";
import type { Fighter } from "../sim/fighter";
import { DAMAGE_CLIPS } from "./damageClipInfo";

/**
 * Frames the previous pose takes to dissolve into a contact's pain pose, by
 * hit strength (small, medium, large). Stronger hits snap harder.
 */
export const PAIN_ENTRY_BLEND_FRAMES: readonly number[] = [3, 2, 1];
/** Frames a pain pose takes to dissolve into tumble, the end of hitstun or recovery. */
export const PAIN_EXIT_BLEND_FRAMES = 4;

/** Whether this clip index is one of the character's nine contact pain poses. */
export function isContactPainClip(character: number, index: number): boolean {
  const row = DAMAGE_CLIPS[character];
  if (row === undefined) return false;
  for (const clip of row) if (clip.index === index) return true;
  return false;
}

/**
 * Dissolve length into a pain pose. It ends at least one frame before hitstop
 * does, so the first pain pose is shown alone while the hit is frozen.
 */
export function painEntryBlendFrames(strength: number, hitlag: number): number {
  const frames = at(PAIN_ENTRY_BLEND_FRAMES, max(0, min(strength, PAIN_ENTRY_BLEND_FRAMES.length - 1)));
  return max(0, min(frames, hitlag - 1));
}

/** Dissolve length when the shown clip changes from `from` to `to`; zero cuts. */
export function poseBlendFrames(fighter: Readonly<Fighter>, from: number, to: number): number {
  if (from === to) return 0;
  if (isContactPainClip(fighter.character, to)) return painEntryBlendFrames(fighter.visuals.hitStrength, fighter.launch.hitlag);
  if (isContactPainClip(fighter.character, from)) return PAIN_EXIT_BLEND_FRAMES;
  return 0;
}

/**
 * Outgoing pose opacity, 0-255, `elapsed` simulation frames into a dissolve
 * of `frames`; zero once it has finished or when the clock went backward.
 */
export function outgoingPoseAlpha(elapsed: number, frames: number): number {
  if (frames <= 0 || elapsed < 0 || elapsed >= frames) return 0;
  return floorDiv(255 * (frames - elapsed), frames + 1);
}
