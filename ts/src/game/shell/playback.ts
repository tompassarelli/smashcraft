// What the shell asks of rollback playback: the speculative world runs ahead
// on local and predicted rows, and replays from history when accepted rows
// differ from what it ran. The replay code owns the history ring.
import type { InputRow } from "../input/inputRow";
import type { FrameControls } from "../match/controls";
import type { PacingAndPresentation } from "../match/pacingAndPresentation";
import type { MatchState } from "../match/rules";
import type { ShadowInputSchedule } from "../netcode/shadowSchedule";
import type { Roster } from "../sim/roster";

/** The speculative world after a reconciliation: unchanged, replayed from a frame, or refused. */
type Reconciliation = "unchanged" | "rejected" | { readonly replayedFrom: number };

/** Called after each speculative frame runs and before the schedule completes it, with the local row it used. */
type SpeculativeFrameObserver = (frame: number, local: Readonly<InputRow>) => void;

/** The speculative match: the state presentation predicts from. */
export interface SpeculativeMatch {
  readonly world: Roster;
  readonly game: MatchState;
  readonly controls: FrameControls;
  readonly runtime: PacingAndPresentation;
}

export interface RollbackPlayback {
  /** Starts an epoch whose history can correct `window` frames. */
  beginEpoch(epoch: number, window: number): boolean;
  /** Replays the speculative match from the first retained frame whose accepted rows differ from those it ran. */
  reconcile(schedule: ShadowInputSchedule, epoch: number, localPlayer: number, match: SpeculativeMatch): Reconciliation;
  /**
   * Runs already-assigned speculative frames, at most `budget`, stopping
   * before `stopBefore` when given. False when a frame could not run.
   */
  catchUp(schedule: ShadowInputSchedule, epoch: number, localPlayer: number, match: SpeculativeMatch, budget: number, stopBefore: number | undefined, executed: SpeculativeFrameObserver): boolean;
  /** Every world the history holds, for a change a replay must not undo, such as authored tuning a reload changed. */
  visitWorlds(visit: (world: Roster) => void): void;
}

/**
 * Journal rows one callback admits, a helper's or the keyboard's, and frames
 * each of the confirmed and speculative cursors runs in one callback: the
 * per-callback catch-up budget. A stall leaves the helper's clock ahead by the
 * stalled time, and catching up
 * needs more frames per callback than real time adds while the rows' echo is
 * on its way (smashcraft:docs/warcraft-api-netcode-findings.md, "Catching up
 * after a stall").
 */
export const CATCH_UP_FRAMES = 6;

/**
 * Speculative frames one callback may run. Keyboard sampling owns one new
 * frame, and running farther would skip capture targets; journals already
 * hold their original frames.
 */
export const speculativeBudget = (journal: boolean): number => (journal ? CATCH_UP_FRAMES : 1);
