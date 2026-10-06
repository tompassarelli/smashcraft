// Mashing out of a hold (smashcraft:docs/gameplay-design.md, "Grab holds and
// pummels" and "Rifleman's trap escape"): grab holds and freezes share one rule.
import { max, min } from "../../runtime/numbers";
import type { Controls } from "./roster";

/** Frames each mash input (a press, or a new stick direction) takes off a hold or a freeze. */
export const MASH_FRAMES = 8;

/** The stick signs a mash-out remembers, and how long it has run. */
export interface MashMemory {
  mashX: number;
  mashZ: number;
  heldFrames: number;
}

/**
 * Mash inputs this frame, 0-2: a fresh mash button counts once, and a change
 * of either remembered stick sign once more. Neutral keeps the remembered
 * sign, so holding a direction counts only on its first frame.
 */
export function mashInputs(memory: MashMemory, input: Readonly<Controls>): number {
  let inputs = input.grabMashPressed ? 1 : 0;
  const x = input.direction === 0 ? memory.mashX : input.direction;
  const z = input.verticalDirection === 0 ? memory.mashZ : input.verticalDirection;
  if (x !== memory.mashX || z !== memory.mashZ) inputs++;
  memory.mashX = x;
  memory.mashZ = z;
  return inputs;
}

/**
 * Advances a mash-out one frame: `remaining` frames less one and MASH_FRAMES a
 * mash input; mashing never ends it before its `minimum`-th frame. 0 is the escape.
 */
export function advanceMash(memory: MashMemory, input: Readonly<Controls>, remaining: number, minimum: number): number {
  const inputs = mashInputs(memory, input);
  memory.heldFrames++;
  return max(0, max(min(remaining - 1, minimum - memory.heldFrames), remaining - 1 - MASH_FRAMES * inputs));
}

export function clearMash(memory: MashMemory): void {
  memory.mashX = 0;
  memory.mashZ = 0;
  memory.heldFrames = 0;
}
