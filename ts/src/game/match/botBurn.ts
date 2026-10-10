import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, DownState } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import type { Controls } from "../sim/roster";
import { steerOnGround } from "./botFooting";
import { moveReachAhead } from "./botMoves";
import { BURN_MEMORY_FRAMES, type BotStrategy } from "./botStrategy";

const BURN_MARGIN = 30.0;

export function burnedMove(state: Readonly<BotStrategy>, target: Readonly<Fighter>, frame: number, observationAge: number): AttackStyle | undefined {
  if (state.burnStyle === -1 || state.burnCount <= 0 || frame - state.burnFrame > BURN_MEMORY_FRAMES + observationAge || target.character !== state.burnCharacter) return undefined;
  if (target.launch.hitstun > 0 || target.down.state !== DownState.none || !target.motion.grounded) return undefined;
  return state.burnStyle;
}

export function keepClearOfBurn(state: Readonly<BotStrategy>, burned: AttackStyle | undefined, own: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, input: Controls): boolean {
  if (burned === undefined || !own.motion.grounded) return false;
  const reach = Math.max(moveReachAhead(target.character, burned, own, target.tuning.moves), state.burnGap);
  const away = own.motion.x < target.motion.x ? -1 : 1;
  const edge = f32(reach + BURN_MARGIN);
  if (Math.abs(f32(own.motion.x - target.motion.x)) < edge) steerOnGround(own, stage, f32(target.motion.x + f32(away * edge)), input);
  return true;
}
