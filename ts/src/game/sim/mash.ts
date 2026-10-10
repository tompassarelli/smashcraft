

import { max, min } from "../../runtime/numbers";
import type { Controls } from "./roster";


const MASH_FRAMES = 8;


export interface MashMemory {
  mashX: number;
  mashZ: number;
  heldFrames: number;
}






export function mashInputs(memory: MashMemory, input: Readonly<Controls>): number {
  let inputs = input.grabMashPressed ? 1 : 0;
  const x = input.direction === 0 ? memory.mashX : input.direction;
  const z = input.verticalDirection === 0 ? memory.mashZ : input.verticalDirection;
  if (x !== memory.mashX || z !== memory.mashZ) inputs++;
  memory.mashX = x;
  memory.mashZ = z;
  return inputs;
}





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
