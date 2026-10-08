// What the shell asks of rollback playback: the speculative world runs ahead
// on local and predicted rows, and replays from history when accepted rows
// differ from what it ran. The replay code owns the history ring.
import type { InputRow } from "../input/inputRow";
import type { FrameControls } from "../match/controls";
import type { PacingAndPresentation } from "../match/pacingAndPresentation";
import type { MatchFrameInput } from "../match/frameInput";
import type { MatchState } from "../match/rules";
import type { ReplayState } from "../replay/snapshot";
import type { ShadowInputSchedule } from "../netcode/shadowSchedule";
import type { Roster } from "../sim/roster";

/** Accepted rows against what the speculative world ran: unchanged, changed from a frame, or refused. */
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
  /**
   * Takes every accepted row that differs from what the speculative match ran,
   * from the first retained frame; repair() replays the changed frames.
   */
  reconcile(schedule: ShadowInputSchedule, epoch: number, localPlayer: number, match: SpeculativeMatch): Reconciliation;
  /**
   * Replays at most `budget` changed frames apart from the speculative match,
   * which keeps running local rows; when the replay reaches its present, the
   * corrected state replaces it. Returns the frames it replayed.
   */
  repair(epoch: number, match: SpeculativeMatch, budget: number): number | "rejected";
  /**
   * Runs already-assigned speculative frames, at most `budget`, stopping
   * before `stopBefore` when given. False when a frame could not run.
   */
  catchUp(schedule: ShadowInputSchedule, epoch: number, localPlayer: number, match: SpeculativeMatch, budget: number, stopBefore: number | undefined, executed: SpeculativeFrameObserver): boolean;
  /**
   * The state after confirmed `frame` when the speculative match already ran
   * it on this same authoritative row and its history holds the result
   * corrected, so the confirmed match may take it instead of running the frame.
   */
  confirmedState(epoch: number, frame: number, row: Readonly<MatchFrameInput>): Readonly<ReplayState> | undefined;
  /**
   * Returns the speculative match to the state before `frame`, dropping the
   * predicted frames from it on: a pause at `frame` will not run them. True
   * when nothing past it ran.
   */
  rewind(schedule: ShadowInputSchedule, epoch: number, frame: number, match: SpeculativeMatch): boolean;
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
 * Frames of a pending correction one callback replays. Replayed whole, a
 * correction 24 frames deep took one Lua32 callback 23 ms, with a message's
 * 6 confirmed frames and up to 6 predicted ones beside it
 * (smashcraft:docs/warcraft-api-netcode-findings.md, "What a callback costs").
 * A deep correction now shows a few callbacks later; 4 keeps the worst
 * callback inside #168's frame budget.
 */
export const REPAIR_FRAMES = 4;

/**
 * Confirmed frames one callback runs: a message's frames 3 a callback, so its
 * confirmed events and HUD show a callback or two later; a backlog of more
 * than two messages, as after a stall, at the catch-up budget.
 */
export const confirmedBudget = (confirmable: number): number => (confirmable > 2 * CATCH_UP_FRAMES ? CATCH_UP_FRAMES : 3);

/**
 * Speculative frames one callback may run. Keyboard sampling owns one new
 * frame, and running farther would skip capture targets; journals already
 * hold their original frames.
 */
export const speculativeBudget = (journal: boolean): number => (journal ? CATCH_UP_FRAMES : 1);
