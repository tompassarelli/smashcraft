// What the shell asks of rollback playback: the speculative world runs ahead
// on local and predicted rows, and replays from history when accepted rows
// differ from what it ran. The replay code owns the history ring.
import type { InputRow } from "../input/inputRow";
import type { FrameControls } from "../match/controls";
import type { PacingAndPresentation } from "../match/pacingAndPresentation";
import type { MatchState } from "../match/rules";
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
 * Frames one callback runs in all: confirmed, replayed and speculative. Every
 * frame costs about the same, so the count bounds a callback's work. Replayed
 * whole, a correction 24 frames deep took one Lua32 callback 23 ms, and the
 * same callback could confirm a message's 6 frames and predict 6 more
 * (smashcraft:docs/warcraft-api-netcode-findings.md, "What a callback costs").
 * A deep correction now shows a few callbacks later, and a message's
 * confirmed events and HUD a callback later.
 */
export const CALLBACK_FRAMES = 12;

/** Frames of a pending correction one callback replays. */
export const REPAIR_FRAMES = 6;

/** Confirmed frames one callback runs: a message's six over two callbacks, a backlog, as after a stall, at the catch-up budget. */
export const confirmedBudget = (confirmable: number): number => (confirmable > CATCH_UP_FRAMES ? CATCH_UP_FRAMES : 3);

/**
 * Speculative frames one callback may run. Keyboard sampling owns one new
 * frame, and running farther would skip capture targets; journals already
 * hold their original frames, and run what the callback's confirmed and
 * replayed frames leave of CALLBACK_FRAMES, at least one.
 */
export const speculativeBudget = (journal: boolean, framesRun: number): number => (journal ? Math.min(CATCH_UP_FRAMES, Math.max(1, CALLBACK_FRAMES - framesRun)) : 1);
