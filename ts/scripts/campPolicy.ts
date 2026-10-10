import { f32 } from "wisp/src/sim/f32";
import { type AttackBuffer, clearAttackBuffer } from "../src/game/input/attackBuffer";
import { approachPoint } from "../src/game/match/botPlay";
import { botChoice, useMatchSeed } from "../src/game/match/botRandom";
import { DownState, GrabAction, LedgeState } from "../src/game/sim/codes";
import type { Fighter } from "../src/game/sim/fighter";
import { type Controls, copyControls, neutralControls } from "../src/game/sim/roster";
import { mainDeckLeft, mainDeckRight, mainDeckZAt } from "../src/game/sim/stage";

// #385's camping policy: the fighter ahead on stocks retreats to the far side
// of the main deck and waits there, and fights with its computer's own input
// only once the opponent comes within its engage range.

const NEUTRAL = neutralControls();

/** How close a camper stands to its edge and how near the opponent comes before it fights; drawn once per match and slot from the match seed. */
interface Camp {
  readonly inset: number;
  readonly engage: number;
  /** The edge it holds, -1 or 1; 0 until it first camps. */
  side: number;
  frames: number;
}

const SIDE_SWAP_GAP = 120.0;
const AT_SPOT = 16.0;

export function campOf(seed: number, slot: number, character: number): Camp {
  useMatchSeed(seed);
  const inset = 60.0 + botChoice(slot * 31 + 7, character, 61);
  const engage = 260.0 + botChoice(slot * 31 + 11, character, 81);
  useMatchSeed(0);
  return { inset, engage, side: 0, frames: 0 };
}

const onMainDeck = (f: Readonly<Fighter>, stage: number): boolean =>
  f.motion.x >= mainDeckLeft(stage) && f.motion.x <= mainDeckRight(stage) && f.motion.z >= 0.0;

/** Overrides the computer's input for a fighter ahead on stocks while the opponent is outside its engage range; returns whether it camped this frame. */
export function campInput(camp: Camp, f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, frame: number, input: Controls, commands: AttackBuffer): boolean {
  if (f.status.stocks <= target.status.stocks || f.status.out || target.status.out) return false;
  if (!onMainDeck(f, stage) || f.launch.hitstun > 0 || f.ledge.state !== LedgeState.none || f.down.state !== DownState.none) return false;
  if (f.grab.action !== GrabAction.none || f.grab.owner !== undefined) return false;
  if (Math.abs(f32(target.motion.x - f.motion.x)) <= camp.engage) return false;
  // The far side is the edge away from the opponent; it keeps its edge until the opponent is plainly on that half.
  const away = target.motion.x < f.motion.x ? 1 : -1;
  if (camp.side === 0 || f32(target.motion.x * camp.side) > SIDE_SWAP_GAP) camp.side = away;
  const x = camp.side > 0 ? f32(mainDeckRight(stage) - camp.inset) : f32(mainDeckLeft(stage) + camp.inset);
  copyControls(input, NEUTRAL);
  clearAttackBuffer(commands);
  camp.frames++;
  const z = mainDeckZAt(stage, x);
  if (f.motion.grounded && f.motion.z <= f32(z + AT_SPOT) && Math.abs(f32(x - f.motion.x)) <= AT_SPOT) return true;
  approachPoint(f, stage, x, z, frame, input);
  return true;
}
