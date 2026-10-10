import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, DownState } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import type { Controls } from "../sim/roster";
import { steerOnGround } from "./botFooting";
import { moveReachAhead } from "./botMoves";
import { PunishKind, type PunishWindow, punishWindow } from "./botPunish";
import { BURN_MEMORY_FRAMES, type BotStrategy } from "./botStrategy";

const BURN_MARGIN = 30.0;
// Only a move that hits twice running is kept clear of (#412): after one hit the computer plays on, so a full bar still goes to its ultimate (#382).
const BURN_REPEATS = 2;
const opening: PunishWindow = { frames: 0, kind: PunishKind.none, elapsed: 0, key: 0, earliest: 0 };

export function burnedMove(state: Readonly<BotStrategy>, target: Readonly<Fighter>, frame: number, observationAge: number): AttackStyle | undefined {
  if (state.burnStyle === -1 || state.burnCount < BURN_REPEATS || frame - state.burnFrame > BURN_MEMORY_FRAMES + observationAge || target.character !== state.burnCharacter) return undefined;
  if (target.launch.hitstun > 0 || target.down.state !== DownState.none || !target.motion.grounded) return undefined;
  return state.burnStyle;
}

export function keepClearOfBurn(state: Readonly<BotStrategy>, burned: AttackStyle | undefined, own: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, frame: number, observationAge: number, matchFrame: number, input: Controls): boolean {
  if (burned === undefined || !own.motion.grounded) return false;
  if (punishWindow(target, frame, opening, observationAge, stage, matchFrame)) return true;
  const reach = Math.max(moveReachAhead(target.character, burned, own, target.tuning.moves), state.burnGap);
  const away = own.motion.x < target.motion.x ? -1 : 1;
  const edge = f32(reach + BURN_MARGIN);
  if (Math.abs(f32(own.motion.x - target.motion.x)) < edge) steerOnGround(own, stage, f32(target.motion.x + f32(away * edge)), input);
  return true;
}
