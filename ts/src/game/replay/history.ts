// Rollback history: the state before each recorded frame, with that frame's
// row, in a ring of the last REPLAY_HISTORY_CAPACITY frames of one epoch.
import { INPUT_LAST_FRAME } from "../input/wire";
import {
  type MatchFrameInput,
  copyMatchFrameInput,
  createMatchFrameInput,
  executeMatchFrame,
  hasNetworkRows,
  refreshNetworkAdaptation,
  resetMatchFrameInput,
  sameMatchFrameInput,
} from "../match/frameInput";
import { at } from "waygate/src/runtime/lookup";
import { floorMod } from "waygate/src/sim/intMath";
import { REPLAY_HISTORY_CAPACITY, REPLAY_MAX_CORRECTION_FRAMES } from "./limits";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "./snapshot";

/** The earliest frame a correction replayed, "unchanged" when every row matched, or "rejected" with nothing changed. */
export type CorrectionResult = number | "unchanged" | "rejected";

const repeat = <T>(count: number, make: () => T): T[] => Array.from({ length: count }, () => make());

/**
 * Detached replacement rows for frames already run. Adding a row copies it,
 * never editing its producer; an identical duplicate is accepted and a
 * conflicting one refused.
 */
export class ReplayCorrections {
  private readonly rows = repeat(REPLAY_MAX_CORRECTION_FRAMES, createMatchFrameInput);
  private readonly speculative = repeat(REPLAY_MAX_CORRECTION_FRAMES, () => false);
  private count = 0;
  private current: number | undefined;

  /** Epochs increase; a repeated or stale epoch is refused. */
  beginEpoch(epoch: number): boolean {
    if (epoch < 0 || (this.current !== undefined && epoch <= this.current)) return false;
    this.current = epoch;
    this.count = 0;
    return true;
  }

  epoch(): number | undefined {
    return this.current;
  }

  clear(): void {
    this.count = 0;
  }

  size(): number {
    return this.count;
  }

  add(row: Readonly<MatchFrameInput>): boolean {
    return this.addRow(row, false);
  }

  /** A row that still predicts some remote input; it stays correctable. */
  addSpeculative(row: Readonly<MatchFrameInput>): boolean {
    return this.addRow(row, true);
  }

  isSpeculative(index: number): boolean {
    return index >= 0 && index < this.count && at(this.speculative, index);
  }

  /** The row at index, valid until the batch changes. */
  row(index: number): Readonly<MatchFrameInput> | undefined {
    return index >= 0 && index < this.count ? this.rows[index] : undefined;
  }

  copyRow(index: number, target: MatchFrameInput): boolean {
    const row = this.row(index);
    if (row === undefined) return false;
    copyMatchFrameInput(target, row);
    return true;
  }

  private addRow(row: Readonly<MatchFrameInput>, predicted: boolean): boolean {
    if (this.current === undefined || row.frame === undefined || row.frame < 1) return false;
    for (let index = 0; index < this.count; index++) {
      const held = at(this.rows, index);
      if (held.frame === row.frame) return sameMatchFrameInput(held, row) && this.speculative[index] === predicted;
    }
    if (this.count === REPLAY_MAX_CORRECTION_FRAMES) return false;
    copyMatchFrameInput(at(this.rows, this.count), row);
    this.speculative[this.count] = predicted;
    this.count++;
    return true;
  }
}

/**
 * Construct at common initialization. Rows are private detached copies;
 * save, restore and replay allocate nothing.
 */
export class ReplayHistory {
  private readonly snapshots = repeat(REPLAY_HISTORY_CAPACITY, createReplaySnapshot);
  private readonly inputs = repeat(REPLAY_HISTORY_CAPACITY, createMatchFrameInput);
  private readonly speculative = repeat(REPLAY_HISTORY_CAPACITY, () => false);
  private correctionWindow = 0;
  private authoritativeThrough = 0;
  private current: number | undefined;
  private nextFrame = 1;
  private count = 0;

  /** Epochs increase across rematches, so a repeated or stale reset can't erase history. */
  beginEpoch(epoch: number, firstFrame: number, correctionWindow = 0): boolean {
    if (epoch < 0 || (this.current !== undefined && epoch <= this.current) || firstFrame < 1) return false;
    if (correctionWindow < 0 || correctionWindow > REPLAY_MAX_CORRECTION_FRAMES) return false;
    this.current = epoch;
    this.nextFrame = firstFrame;
    this.count = 0;
    this.correctionWindow = correctionWindow;
    this.authoritativeThrough = firstFrame - 1;
    for (const row of this.inputs) resetMatchFrameInput(row);
    this.speculative.fill(false);
    return true;
  }

  contains(epoch: number, frame: number): boolean {
    if (this.current === undefined || epoch !== this.current || frame < this.nextFrame - this.count || frame >= this.nextFrame) return false;
    return this.inputAt(frame).frame === frame;
  }

  isSpeculative(epoch: number, frame: number): boolean {
    return this.contains(epoch, frame) && this.speculativeAt(frame);
  }

  firstRetainedFrame(): number {
    return this.nextFrame - this.count;
  }

  lastRecordedFrame(): number {
    return this.nextFrame - 1;
  }

  copyInputRow(epoch: number, frame: number, target: MatchFrameInput): boolean {
    if (!this.contains(epoch, frame)) return false;
    copyMatchFrameInput(target, this.inputAt(frame));
    return true;
  }

  /** Records the row for the next frame with the state before it runs; call before executing it. */
  save(epoch: number, row: Readonly<MatchFrameInput>, live: Readonly<ReplayState>): boolean {
    return this.saveRow(epoch, row, false, live);
  }

  /** As save, for a row that predicts some remote input and may be corrected. */
  saveSpeculative(epoch: number, row: Readonly<MatchFrameInput>, live: Readonly<ReplayState>): boolean {
    return this.saveRow(epoch, row, true, live);
  }

  restore(epoch: number, frame: number, live: ReplayState): boolean {
    if (!this.contains(epoch, frame)) return false;
    copyReplayState(live, this.snapshotAt(frame));
    return true;
  }

  /**
   * Restores the state before fromFrame and runs the recorded rows through
   * throughFrame. The whole interval is validated before live state changes.
   */
  replay(epoch: number, fromFrame: number, throughFrame: number, live: ReplayState): boolean {
    if (fromFrame > throughFrame) return false;
    for (let frame = fromFrame; frame <= throughFrame; frame++) if (!this.contains(epoch, frame)) return false;
    this.restore(epoch, fromFrame, live);
    for (let frame = fromFrame; frame <= throughFrame; frame++) {
      if (!this.executeRecorded(frame, live)) return false;
    }
    return true;
  }

  /**
   * Replaces speculative rows with the batch's rows and replays from the
   * earliest changed frame, refreshing every later snapshot. The live state
   * must be at the saved present. A batch that would change an authoritative
   * row, a row outside the correction window or a frame no longer retained
   * is rejected whole, before history or live state changes.
   */
  correct(epoch: number, corrections: ReplayCorrections, live: ReplayState): CorrectionResult {
    if (this.current === undefined || epoch !== this.current || corrections.epoch() !== epoch || live.runtime.simulationFrame !== this.nextFrame - 1) return "rejected";
    let earliest = this.nextFrame;
    for (let index = 0; index < corrections.size(); index++) {
      const row = corrections.row(index);
      if (row === undefined || row.frame === undefined || !this.contains(epoch, row.frame) || row.mask !== live.world.mask) return "rejected";
      if (sameMatchFrameInput(this.inputAt(row.frame), row)) continue;
      if (!this.speculativeAt(row.frame) || this.nextFrame - row.frame > this.correctionWindow) return "rejected";
      earliest = Math.min(earliest, row.frame);
    }
    for (let frame = earliest; frame < this.nextFrame; frame++) if (!this.contains(epoch, frame)) return "rejected";
    for (let index = 0; index < corrections.size(); index++) {
      const row = corrections.row(index);
      if (row === undefined || row.frame === undefined || !this.speculativeAt(row.frame)) continue;
      const slot = this.slotOf(row.frame);
      copyMatchFrameInput(at(this.inputs, slot), row);
      this.speculative[slot] = corrections.isSpeculative(index);
    }
    this.advanceAuthoritative();
    if (earliest === this.nextFrame) return "unchanged";
    this.restore(epoch, earliest, live);
    for (let frame = earliest; frame < this.nextFrame; frame++) {
      copyReplayState(this.snapshotAt(frame), live);
      if (!this.executeRecorded(frame, live)) return "rejected";
    }
    return earliest;
  }

  private saveRow(epoch: number, row: Readonly<MatchFrameInput>, predicted: boolean, live: Readonly<ReplayState>): boolean {
    if (this.current === undefined || epoch !== this.current || row.mask !== live.world.mask) return false;
    if (row.frame !== this.nextFrame || live.runtime.simulationFrame !== this.nextFrame - 1) return false;
    // An authoritative row can't pass an unresolved earlier prediction either;
    // the ring's size grants no speculation distance.
    if ((predicted || this.authoritativeThrough < this.nextFrame - 1) && this.nextFrame - this.authoritativeThrough > this.correctionWindow) return false;
    // The frame counter must not wrap into a different history.
    if (this.nextFrame > INPUT_LAST_FRAME) return false;
    const slot = this.slotOf(this.nextFrame);
    copyReplayState(at(this.snapshots, slot), live);
    copyMatchFrameInput(at(this.inputs, slot), row);
    this.speculative[slot] = predicted;
    this.nextFrame++;
    this.count = Math.min(this.count + 1, REPLAY_HISTORY_CAPACITY);
    this.advanceAuthoritative();
    return true;
  }

  private executeRecorded(frame: number, live: ReplayState): boolean {
    const row = this.inputAt(frame);
    if (hasNetworkRows(row) && !refreshNetworkAdaptation(row, live.world, frame)) return false;
    return executeMatchFrame(row, live.match, live.world, live.controls, live.runtime, frame);
  }

  private advanceAuthoritative(): void {
    while (this.authoritativeThrough + 1 < this.nextFrame && !this.speculativeAt(this.authoritativeThrough + 1)) this.authoritativeThrough++;
  }

  private slotOf(frame: number): number {
    return floorMod(frame, REPLAY_HISTORY_CAPACITY);
  }

  private inputAt(frame: number): MatchFrameInput {
    return at(this.inputs, this.slotOf(frame));
  }

  private snapshotAt(frame: number): ReplayState {
    return at(this.snapshots, this.slotOf(frame));
  }

  private speculativeAt(frame: number): boolean {
    return at(this.speculative, this.slotOf(frame));
  }
}
