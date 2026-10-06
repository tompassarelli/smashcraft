// The loading screen between the stage choice and the match: every client
// draws the chosen stage behind it, and the match starts once each present
// player's client reports the stage drawn, or after a timeout, so a stuck
// client can't hold the others forever. Every step runs from a synchronized
// event (the start press, a player's sync message, the game timer), so all
// clients start on the same callback.
import { PARTICIPANT_SLOTS, type ParticipantSlot } from "../input/participants";
import { type MatchState, humanPresent } from "../match/rules";

/** Sync prefix of a client's "stage drawn" report; its data is the stage. */
export const STAGE_READY_PREFIX = "SC_STAGE";
/** Game frames a client lets its newly drawn stage settle before it reports. */
export const STAGE_SETTLE_FRAMES = 30;
/** Frames after which the match starts without the reports still missing: ten seconds. */
export const STAGE_LOAD_TIMEOUT_FRAMES = 600;

export interface StageLoad {
  /** The player whose press starts the match. */
  readonly starter: ParticipantSlot;
  readonly stage: number;
  /** Players whose reports the start waits for: those present at the press. */
  readonly waiting: number;
  ready: number;
  frames: number;
  reported: boolean;
}

export function beginStageLoad(game: Readonly<MatchState>, starter: ParticipantSlot): StageLoad {
  let waiting = 0;
  for (const slot of PARTICIPANT_SLOTS) if (humanPresent(game, slot)) waiting += 1 << slot;
  return { starter, stage: game.stageChoice, waiting, ready: 0, frames: 0, reported: false };
}

/** A player's report arrived; true once every awaited player has reported this stage. */
export function stageReported(load: StageLoad, sender: number, data: string): boolean {
  if (data === `${load.stage}` && sender >= 0 && sender < 4) load.ready |= (1 << sender) & load.waiting;
  return load.ready === load.waiting;
}

export const StageLoadStep = { wait: 0, report: 1, start: 2 } as const;
export type StageLoadStep = (typeof StageLoadStep)[keyof typeof StageLoadStep];

/** One game frame of loading: report once the stage has settled, start at the timeout. */
export function tickStageLoad(load: StageLoad): StageLoadStep {
  load.frames++;
  if (load.frames >= STAGE_LOAD_TIMEOUT_FRAMES) return StageLoadStep.start;
  if (!load.reported && load.frames >= STAGE_SETTLE_FRAMES) {
    load.reported = true;
    return StageLoadStep.report;
  }
  return StageLoadStep.wait;
}
