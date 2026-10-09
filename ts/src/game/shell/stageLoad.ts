





import { PARTICIPANT_SLOTS, type ParticipantSlot } from "../input/participants";
import { type MatchState, humanPresent } from "../match/rules";


export const STAGE_READY_PREFIX = "SC_STAGE";

export const STAGE_SETTLE_FRAMES = 30;

export const STAGE_LOAD_TIMEOUT_FRAMES = 600;

export interface StageLoad {

  readonly starter: ParticipantSlot;
  readonly stage: number;

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


export function stageReported(load: StageLoad, sender: number, data: string): boolean {
  if (data === `${load.stage}` && sender >= 0 && sender < 4) load.ready |= (1 << sender) & load.waiting;
  return load.ready === load.waiting;
}

export const StageLoadStep = { wait: 0, report: 1, start: 2 } as const;
export type StageLoadStep = (typeof StageLoadStep)[keyof typeof StageLoadStep];


export function tickStageLoad(load: StageLoad): StageLoadStep {
  load.frames++;
  if (load.frames >= STAGE_LOAD_TIMEOUT_FRAMES) return StageLoadStep.start;
  if (!load.reported && load.frames >= STAGE_SETTLE_FRAMES) {
    load.reported = true;
    return StageLoadStep.report;
  }
  return StageLoadStep.wait;
}
