


import type { InputRow } from "../input/inputRow";
import { REPAIR_WHOLE_COST } from "../replay/history";
import { REPLAY_HISTORY_CAPACITY } from "../replay/limits";
import type { FrameControls } from "../match/controls";
import type { PacingAndPresentation } from "../match/pacingAndPresentation";
import type { MatchFrameInput } from "../match/frameInput";
import type { MatchState } from "../match/rules";
import type { ReplayState } from "../replay/snapshot";
import type { ShadowInputSchedule } from "../netcode/shadowSchedule";
import type { Roster } from "../sim/roster";


type Reconciliation = "unchanged" | "rejected" | { readonly replayedFrom: number };


type SpeculativeFrameObserver = (frame: number, local: Readonly<InputRow>) => void;


export interface SpeculativeMatch {
  readonly world: Roster;
  readonly game: MatchState;
  readonly controls: FrameControls;
  readonly runtime: PacingAndPresentation;
}

export interface RollbackPlayback {

  beginEpoch(epoch: number, window: number): boolean;




  reconcile(schedule: ShadowInputSchedule, epoch: number, localPlayer: number, match: SpeculativeMatch): Reconciliation;






  repair(epoch: number, match: SpeculativeMatch, budget: number, cost?: number): number | "rejected";

  pendingRepair(epoch: number): number | undefined;




  catchUp(schedule: ShadowInputSchedule, epoch: number, localPlayer: number, match: SpeculativeMatch, budget: number, stopBefore: number | undefined, executed: SpeculativeFrameObserver): boolean;





  confirmedState(epoch: number, frame: number, row: Readonly<MatchFrameInput>): Readonly<ReplayState> | undefined;





  rewind(schedule: ShadowInputSchedule, epoch: number, frame: number, match: SpeculativeMatch): boolean;

  visitWorlds(visit: (world: Roster) => void): void;
}










export const CATCH_UP_FRAMES = 6;








export const REPAIR_FRAMES = 4;

// Bound repair to two whole frames per callback: each costs about 2.5 ms in Lua32 (#168).





export const REPAIR_COST = 4;








export function repairBudget(speculative: number, depth: number): { readonly frames: number; readonly cost: number } {
  if (depth <= REPLAY_HISTORY_CAPACITY / 2) return { frames: REPAIR_FRAMES, cost: REPAIR_COST };
  const frames = Math.max(REPAIR_FRAMES, speculative + 1);
  return { frames, cost: Math.max(REPAIR_COST, (speculative + 1) * REPAIR_WHOLE_COST) };
}






export const confirmedBudget = (confirmable: number): number => (confirmable > 2 * CATCH_UP_FRAMES ? CATCH_UP_FRAMES : 3);






export const speculativeBudget = (journal: boolean): number => (journal ? CATCH_UP_FRAMES : 1);
