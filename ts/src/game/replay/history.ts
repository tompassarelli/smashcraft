// Rollback history: the state before each recorded frame, with that frame's
// row, in a ring of the last REPLAY_HISTORY_CAPACITY frames of one epoch.
import { INPUT_LAST_FRAME } from "../input/wire";
import type { Roster } from "../sim/roster";
import {
  type MatchFrameInput,
  type RepeatedComputers,
  type ScopedFrame,
  copyMatchFrameInput,
  createMatchFrameInput,
  executeMatchFrame,
  resetMatchFrameInput,
  sameMatchFrameInput,
} from "../match/frameInput";
import { at } from "wisp/src/runtime/lookup";
import { PARTICIPANT_SLOTS, participantActive } from "../input/participants";
import { sameComputerInputs } from "../match/botPlay";
import { computerActive } from "../match/rules";
import { fighterAt, isActive } from "../sim/roster";
import { floorMod } from "wisp/src/sim/intMath";
import { REPLAY_HISTORY_CAPACITY, REPLAY_MAX_CORRECTION_FRAMES } from "./limits";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "./snapshot";
import { sameInput } from "../input/inputRow";
import { copyAttackBuffer, sameAttackBuffer } from "../input/attackBuffer";
import { copyMatchState } from "../match/rules";
import { copyPacingAndPresentation } from "../match/pacingAndPresentation";
import { copyFighterState, sameFighterState } from "./fighterState";
import { apartFromOthers, authoredMotionApartFromOthers, matchScopable, scopedStepHeld } from "./scopedRepair";
import { sameReplayState } from "./difference";
import { firstFighterPoseDifference } from "../presentation/fighterPose";
import { firstSummonPoseDifference } from "../presentation/summonPose";

/** A whole repaired frame's cost against a repair's budget, where a fighter-scoped one costs 1. */
export const REPAIR_WHOLE_COST = 2;

/** How repairs choose fighter-scoped steps: by the eligibility tests, never, or always (a test's broken eligibility). */
type ScopedRepair = "auto" | "off" | "force";

/** One bit per changed slot, or the single slot in a one-bit mask. */
const soleSlot = (mask: number): number | undefined => {
  for (const slot of PARTICIPANT_SLOTS) if (mask === 1 << slot) return slot;
  return undefined;
};

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
/** The slots whose input differs between two rows of the same frame; every slot when they aren't both network rows. */
function changedSlots(before: Readonly<MatchFrameInput>, after: Readonly<MatchFrameInput>): number {
  if (before.source !== "network" || after.source !== "network" || before.networkMask !== after.networkMask) return after.mask | before.mask;
  let mask = 0;
  for (const slot of PARTICIPANT_SLOTS) if (participantActive(after.networkMask, slot) && !sameInput(before.network[slot], after.network[slot])) mask |= 1 << slot;
  return mask;
}

const firstHuman = (state: Readonly<ReplayState>): number | undefined => {
  for (const slot of PARTICIPANT_SLOTS) if (isActive(state.world, slot) && !computerActive(state.match, slot)) return slot;
  return undefined;
};

export class ReplayHistory {
  private readonly snapshots = repeat(REPLAY_HISTORY_CAPACITY, createReplaySnapshot);
  private spare = createReplaySnapshot();
  private borrowed: ReplayState | undefined;
  private readonly inputs = repeat(REPLAY_HISTORY_CAPACITY, createMatchFrameInput);
  private readonly speculative = repeat(REPLAY_HISTORY_CAPACITY, () => false);
  /** Slots whose row on a frame changed since the run that reached the next frame's snapshot. */
  private readonly changed = repeat(REPLAY_HISTORY_CAPACITY, () => 0);
  /** Slots whose state in the pending repair may differ from the snapshot at repairNext. */
  private repairDirty = 0;
  /** Slots whose poses, special effects or summons in the pending repair may differ from the earlier run at repairNext. */
  private repairShown = 0;
  /** Slots whose rows the pending repair has met changed so far. */
  private repairInputs = 0;
  private readonly scope: ScopedFrame = { slot: 0, after: createReplaySnapshot(), reused: 0 };
  private scopedSteps = 0;
  /**
   * After a held scoped step: the frame after it and its slot, whose state and
   * earlier-run fighter that step already proved apart from the others.
   */
  private provenFrame = -1;
  private provenSlot = -1;
  scopedRepair: ScopedRepair = "auto";
  /** Tests see each scoped frame: the state before it (its snapshot), its row and the state it reached. */
  observeScoped: ((frame: number, before: Readonly<ReplayState>, row: MatchFrameInput, after: Readonly<ReplayState>) => void) | undefined;
  /** Whether a frame's snapshot is the state its previous frame's snapshot reached, so its computers' decisions were made from that one. */
  private readonly follows = repeat(REPLAY_HISTORY_CAPACITY, () => false);
  /** As follows, for live state: it is the state the last recorded frame reached from its snapshot. */
  private liveFollows = false;
  private skippedFrames = 0;
  /** Off, a repair that reaches a stored snapshot still replays every later frame (tests compare the two). */
  convergence = true;
  /** How a repair proves its state equals a stored snapshot; a test swaps in a weaker proof to show it matters. */
  sameState: (this: void, stored: Readonly<ReplayState>, state: Readonly<ReplayState>, first: number) => boolean = sameReplayState;
  private readonly repeated: { mask: number; after: ReplayState["runtime"] } = { mask: 0, after: createReplaySnapshot().runtime };
  private repeatedDecisions = 0;
  // The corrected state a repair replays, apart from live state, which keeps running.
  private readonly repairState = createReplaySnapshot();
  /** The next frame a pending repair runs; every snapshot before it is corrected. */
  private repairNext: number | undefined;
  /** Whether repairState holds the state before repairNext. */
  private repairPositioned = false;
  private correctionWindow = 0;
  private authoritativeThrough = 0;
  /** Every row through this frame is authoritative or matched a confirmed row in stateAfter. */
  private matchedThrough = 0;
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
    this.matchedThrough = firstFrame - 1;
    this.repairNext = undefined;
    this.repairPositioned = false;
    this.borrowed = undefined;
    for (const row of this.inputs) resetMatchFrameInput(row);
    this.speculative.fill(false);
    this.follows.fill(false);
    this.liveFollows = false;
    this.changed.fill(0);
    this.repairDirty = 0;
    this.repairShown = 0;
    this.repairInputs = 0;
    return true;
  }

  contains(epoch: number, frame: number): boolean {
    if (this.current === undefined || epoch !== this.current || frame < this.nextFrame - this.count || frame >= this.nextFrame) return false;
    return this.inputAt(frame).frame === frame;
  }

  isSpeculative(epoch: number, frame: number): boolean {
    return this.contains(epoch, frame) && this.speculativeAt(frame);
  }

  /** Every snapshot's world, retained or not, for a change they must all take, such as authored tuning a reload changed. */
  visitWorlds(visit: (world: Roster) => void): void {
    // The changed worlds no longer lead to the decisions recorded after them.
    this.follows.fill(false);
    this.liveFollows = false;
    for (const snapshot of this.snapshots) visit(snapshot.world);
    visit(this.spare.world);
    visit(this.repairState.world);
  }

  /** Computer decisions repairs took from an earlier run of the same frame instead of deciding again. */
  repeatedComputerDecisions(): number {
    return this.repeatedDecisions;
  }

  /** The next frame a pending repair replays; stateAfter refuses it and the frame before it. */
  pendingRepairFrame(epoch: number): number | undefined {
    return epoch === this.current ? this.repairNext : undefined;
  }

  /** Frames repairs kept from the earlier run, because the corrected state reached its snapshot. */
  convergedRepairFrames(): number {
    return this.skippedFrames;
  }

  /** Repaired frames that played only the corrected fighter. */
  scopedRepairSteps(): number {
    return this.scopedSteps;
  }

  firstRetainedFrame(): number {
    return this.nextFrame - this.count;
  }

  lastRecordedFrame(): number {
    return this.nextFrame - 1;
  }

  /** The first frame a correction may still change: every recorded frame before it is authoritative. */
  firstCorrectableFrame(): number {
    return this.authoritativeThrough + 1;
  }

  /** The recorded row, valid until the history records or amends that frame again. */
  inputRow(epoch: number, frame: number): Readonly<MatchFrameInput> | undefined {
    return this.contains(epoch, frame) ? this.inputAt(frame) : undefined;
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
    this.liveFollows = false;
    return true;
  }

  /**
   * Drops the recorded frames from `frame` on, none of them authoritative,
   * and restores the state before it: frames that will run again on other rows.
   */
  truncate(epoch: number, frame: number, live: ReplayState): boolean {
    if (this.current === undefined || epoch !== this.current || live.runtime.simulationFrame !== this.nextFrame - 1) return false;
    if (frame >= this.nextFrame) return true;
    if (frame <= this.authoritativeThrough || !this.contains(epoch, frame)) return false;
    // A positioned repair stopped at `frame` holds the corrected state; that snapshot predates the correction.
    copyReplayState(live, this.repairNext === frame && this.repairPositioned ? this.repairState : this.snapshotAt(frame));
    this.liveFollows = false;
    this.count -= this.nextFrame - frame;
    this.nextFrame = frame;
    this.matchedThrough = Math.min(this.matchedThrough, frame - 1);
    if (this.repairNext !== undefined && this.repairNext >= frame) {
      this.repairNext = undefined;
      this.repairPositioned = false;
    }
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
    const earliest = this.amend(epoch, corrections, live);
    if (earliest === "rejected" || this.repairNext === undefined) return earliest;
    return this.repair(epoch, REPLAY_HISTORY_CAPACITY, live) === "rejected" ? "rejected" : earliest;
  }

  /**
   * Marks speculative `frame`, which ran on exactly its now-authoritative
   * rows, as no longer correctable, as amending it with those rows would;
   * the next amend or correct advances past it.
   */
  settle(epoch: number, frame: number): boolean {
    if (this.current === undefined || epoch !== this.current || !this.contains(epoch, frame)) return false;
    this.speculative[this.slotOf(frame)] = false;
    return true;
  }

  /**
   * As correct, but replays nothing yet: the rows change now, and repair()
   * replays from the earliest frame any amendment changed. Returns the
   * earliest frame this batch changed.
   */
  amend(epoch: number, corrections: ReplayCorrections, live: Readonly<ReplayState>): CorrectionResult {
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
      this.changed[slot] = at(this.changed, slot) | changedSlots(at(this.inputs, slot), row);
      copyMatchFrameInput(at(this.inputs, slot), row);
      this.speculative[slot] = corrections.isSpeculative(index);
    }
    this.advanceAuthoritative();
    if (earliest === this.nextFrame) return "unchanged";
    // Snapshots before repairNext are corrected; a later change waits for the repair to reach it.
    if (this.repairNext === undefined || earliest < this.repairNext) {
      this.repairNext = earliest;
      this.repairPositioned = false;
    }
    return earliest;
  }

  /**
   * Replays a pending amendment in the history's own state, at most budget
   * frames and `cost` units (a whole frame REPAIR_WHOLE_COST, a scoped one
   * 1, and always at least one frame), refreshing each snapshot it passes.
   * Live state keeps running the present meanwhile; once the repair reaches
   * it, the corrected state replaces live state. Once the corrected state
   * equals a stored snapshot, every later frame whose row and run are
   * unchanged already holds the corrected run, so the repair skips them.
   * Returns the frames it advanced.
   */
  repair(epoch: number, budget: number, live: ReplayState, cost = Number.POSITIVE_INFINITY): number | "rejected" {
    if (this.current === undefined || epoch !== this.current) return "rejected";
    const start = this.repairNext;
    if (start === undefined) return 0;
    if (live.runtime.simulationFrame !== this.nextFrame - 1 || !this.contains(epoch, start)) return "rejected";
    // A repair that surely reaches the present in this call replays in live state, which it replaces anyway.
    const direct = !this.repairPositioned && this.nextFrame - start <= budget && (this.nextFrame - start) * REPAIR_WHOLE_COST <= cost;
    const state = direct ? live : this.repairState;
    // Positioning copies the start's snapshot, so the first frame needn't write it back onto itself.
    let restored = false;
    if (!this.repairPositioned) {
      copyReplayState(state, this.snapshotAt(start));
      this.repairPositioned = !direct;
      this.repairDirty = 0;
      this.repairShown = 0;
      this.repairInputs = 0;
      this.provenFrame = -1;
      restored = true;
    }
    let frame = start;
    let spent = 0;
    // The frame whose state was taken from its own snapshot, which needn't be written back.
    let resumed = restored ? start : -1;
    let converged = false;
    for (let steps = 0; steps < budget && frame < this.nextFrame; steps++) {
      const first = frame === resumed;
      const slot = this.slotOf(frame);
      const unchanged = state.world.mask & ~this.repairDirty;
      const dirty = this.repairDirty | at(this.changed, slot);
      const repeated = this.repeatedComputers(frame, state, first, unchanged);
      const scoped = this.scopedSlot(frame, state, repeated, dirty);
      const price = scoped === undefined ? REPAIR_WHOLE_COST : 1;
      if (steps > 0 && spent + price > cost) break;
      spent += price;
      this.repairDirty = dirty;
      this.repairInputs |= at(this.changed, slot);
      if (repeated !== undefined) for (const computer of PARTICIPANT_SLOTS) if (participantActive(repeated.mask, computer)) this.repeatedDecisions++;
      if (!first) {
        // Fighters the repair hasn't changed already match the snapshot.
        this.copySnapshot(frame, state, unchanged, state.world.mask & ~this.repairShown);
        // Either the state this repair carried from the frame before or the one its previous call left.
        this.follows[slot] = true;
      }
      if (frame + 1 < this.nextFrame) this.follows[this.slotOf(frame + 1)] = false;
      if (!this.step(frame, state, repeated, scoped)) return "rejected";
      this.changed[slot] = 0;
      frame++;
      this.repairNext = frame;
      const resume = this.convergence ? this.keptThrough(frame, direct) : frame;
      // Full equality, not a checksum: presentation and computer state must match too.
      if (resume === frame || !this.sameState(this.snapshotAt(frame), state, this.repairDirty | this.repairInputs)) continue;
      this.follows[this.slotOf(frame)] = true;
      this.repairDirty = 0;
      this.repairShown = 0;
      this.repairInputs = 0;
      this.skippedFrames += resume - frame;
      this.provenFrame = -1;
      converged = resume === this.nextFrame;
      if (!converged) copyReplayState(state, this.snapshotAt(resume));
      frame = resume;
      resumed = frame;
      this.repairNext = frame;
    }
    if (frame < this.nextFrame) return frame - start;
    // A converged repair leaves live state as it was: the run it kept reached it.
    if (!direct && !converged) copyReplayState(live, state);
    this.liveFollows = true;
    this.repairNext = undefined;
    this.repairPositioned = false;
    return frame - start;
  }


  /**
   * The state after `frame` when history ran it on a row equal to `row` from
   * a corrected state before it: every earlier row authoritative or already
   * matched here, no repair pending. Running `row` from the state before
   * `frame` would reach it. It stays immutable until the next successful
   * stateAfter call, even when the history ring reuses its slot.
   */
  stateAfter(epoch: number, frame: number, row: Readonly<MatchFrameInput>): Readonly<ReplayState> | undefined {
    if (!this.contains(epoch, frame) || !this.contains(epoch, frame + 1)) return undefined;
    if (Math.max(this.authoritativeThrough, this.matchedThrough) < frame - 1) return undefined;
    if (this.repairNext !== undefined && this.repairNext <= frame + 1) return undefined;
    if (!sameMatchFrameInput(this.inputAt(frame), row)) return undefined;
    this.matchedThrough = Math.max(this.matchedThrough, frame);
    this.borrowed = this.snapshotAt(frame + 1);
    return this.borrowed;
  }

  /**
   * The first frame from `frame` a converged repair must still run: frames
   * before it ran on unchanged rows from the snapshot before them, and live
   * state is the last one's result unless the repair runs in it (`direct`).
   */
  private keptThrough(frame: number, direct: boolean): number {
    let resume = frame;
    while (resume < this.nextFrame && at(this.changed, this.slotOf(resume)) === 0
      && (resume + 1 < this.nextFrame ? at(this.follows, this.slotOf(resume + 1)) : this.liveFollows && !direct)) resume++;
    return resume;
  }

  /**
   * The one fighter frame `frame` may play alone: the correction changed only
   * it, the frame's earlier run reached the next snapshot, every computer
   * repeats its decision, and in neither run can it touch another fighter.
   * Reads the frame's snapshot before the repair rewrites it. A held scoped
   * step on the frame before already proved the first two distance tests.
   */
  private scopedSlot(frame: number, state: Readonly<ReplayState>, repeated: RepeatedComputers | undefined, dirty: number): number | undefined {
    const proven = frame === this.provenFrame ? this.provenSlot : -1;
    this.provenFrame = -1;
    if (this.scopedRepair === "off" || frame + 1 >= this.nextFrame || !this.follows[this.slotOf(frame + 1)]) return undefined;
    // With no fighter changed yet, any human may play the frame.
    const slot = dirty === 0 ? firstHuman(state) : soleSlot(dirty);
    if (slot === undefined || !isActive(state.world, slot) || !matchScopable(state.match)) return undefined;
    for (const other of PARTICIPANT_SLOTS) {
      if (other === slot || !isActive(state.world, other) || !computerActive(state.match, other)) continue;
      if (repeated === undefined || !participantActive(repeated.mask, other)) return undefined;
    }
    if (this.scopedRepair === "force") return slot;
    const after = this.snapshotAt(frame + 1).world;
    const earlier = this.snapshotAt(frame).world;
    if (slot !== proven) {
      if (!apartFromOthers(slot, fighterAt(state.world, slot), state.world)) return undefined;
      if (!apartFromOthers(slot, fighterAt(earlier, slot), state.world)) return undefined;
    }
    if (!apartFromOthers(slot, fighterAt(after, slot), after)) return undefined;
    if (!authoredMotionApartFromOthers(slot, fighterAt(state.world, slot), after)) return undefined;
    return slot;
  }

  /** Runs one repaired frame, scoped to `scoped` when its result holds, otherwise whole. */
  private step(frame: number, state: ReplayState, repeated: RepeatedComputers | undefined, scoped: number | undefined): boolean {
    const row = this.inputAt(frame);
    if (scoped !== undefined) {
      const after = this.snapshotAt(frame + 1);
      this.scope.slot = scoped;
      this.scope.after = after;
      this.scope.reused = state.world.mask & ~this.repairShown & ~(1 << scoped);
      if (!executeMatchFrame(row, state.match, state.world, state.controls, state.runtime, frame, repeated, this.scope)) return false;
      const held = this.scopedRepair === "force" || (apartFromOthers(scoped, fighterAt(state.world, scoped), state.world) && scopedStepHeld(scoped, state.match, state.world, after.match));
      if (held) {
        // The state's other fighters are the next snapshot's, so its proofs carry to the next frame.
        if (this.scopedRepair === "auto" && state.world.mask === after.world.mask) {
          this.provenFrame = frame + 1;
          this.provenSlot = scoped;
        }
        this.repairShown |= 1 << scoped;
        this.scopedSteps++;
        this.observeScoped?.(frame, this.snapshotAt(frame), row, state);
        return true;
      }
      // The frame's snapshot holds the state before it.
      copyReplayState(state, this.snapshotAt(frame));
    }
    if (!executeMatchFrame(row, state.match, state.world, state.controls, state.runtime, frame, repeated)) return false;
    this.repairDirty = this.changedFighters(frame, state);
    this.repairShown = this.changedPresentation(frame, state, this.repairDirty);
    return true;
  }

  /** After a whole step that changed only the fighters in `changed`: those, when every other fighter's presentation came out as the next snapshot holds it; otherwise every fighter. */
  private changedPresentation(frame: number, state: Readonly<ReplayState>, changed: number): number {
    const mask = state.world.mask;
    if (changed === mask) return mask;
    const snapshot = this.snapshotAt(frame + 1);
    const shown = state.runtime;
    const was = snapshot.runtime;
    for (const slot of PARTICIPANT_SLOTS) {
      if (participantActive(changed, slot) || !isActive(state.world, slot)) continue;
      if (shown.specials.drainSerial[slot] !== was.specials.drainSerial[slot] || shown.specials.drainAge[slot] !== was.specials.drainAge[slot]
        || shown.summons.bearHitSerial[slot] !== was.summons.bearHitSerial[slot]
        || firstSummonPoseDifference(shown.summons.bears[slot], was.summons.bears[slot]) !== undefined
        || firstFighterPoseDifference(shown.poses[slot], was.poses[slot], state.world, snapshot.world) !== undefined) return mask;
    }
    return changed;
  }

  /**
   * After a whole step: the corrected fighter, when every other one came out
   * as the next snapshot holds it, so later frames may scope again; otherwise
   * every fighter. Comparing fighters costs about a third of a step, so it
   * runs only while the corrected fighter is clear of the others.
   */
  private changedFighters(frame: number, state: Readonly<ReplayState>): number {
    const mask = state.world.mask;
    const corrected = soleSlot(this.repairInputs);
    if (this.scopedRepair === "off" || corrected === undefined || frame + 2 >= this.nextFrame || !matchScopable(state.match)) return mask;
    const snapshot = this.snapshotAt(frame + 1);
    if (snapshot.world.mask !== mask || !apartFromOthers(corrected, fighterAt(state.world, corrected), state.world)) return mask;
    for (const slot of PARTICIPANT_SLOTS) {
      if (slot === corrected || !isActive(state.world, slot)) continue;
      if (!sameAttackBuffer(state.controls.commands[slot], snapshot.controls.commands[slot]) || !sameFighterState(fighterAt(state.world, slot), fighterAt(snapshot.world, slot))) return mask;
    }
    return 1 << corrected;
  }

  /**
   * The computers whose decisions frame `frame` can take from its earlier run:
   * that run started from the frame's snapshot, before this repair rewrites it,
   * and reached the next frame's. `same` says the state is that snapshot.
   */
  private repeatedComputers(frame: number, state: Readonly<ReplayState>, same: boolean, unchanged: number): RepeatedComputers | undefined {
    if (frame + 1 >= this.nextFrame || !this.follows[this.slotOf(frame + 1)]) return undefined;
    const row = this.inputAt(frame);
    if (row.source !== "network") return undefined;
    const before = this.snapshotAt(frame);
    const after = this.snapshotAt(frame + 1).runtime;
    let mask = 0;
    for (const slot of PARTICIPANT_SLOTS) {
      if (!isActive(state.world, slot) || !computerActive(state.match, slot) || !at(after.botDecisions, slot).decided) continue;
      if (same || sameComputerInputs(state.match, state.world, state.runtime, before.match, before.world, before.runtime, slot, frame, participantActive(unchanged, slot))) mask |= 1 << slot;
    }
    if (mask === 0) return undefined;
    this.repeated.mask = mask;
    this.repeated.after = after;
    return this.repeated;
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
    // Callers save each frame's state after running the frame before from its snapshot.
    this.follows[slot] = this.contains(epoch, this.nextFrame - 1);
    this.copySnapshot(this.nextFrame, live);
    copyMatchFrameInput(at(this.inputs, slot), row);
    this.speculative[slot] = predicted;
    this.changed[slot] = 0;
    // Its caller runs the frame from this snapshot next.
    this.liveFollows = true;
    this.nextFrame++;
    this.count = Math.min(this.count + 1, REPLAY_HISTORY_CAPACITY);
    this.advanceAuthoritative();
    return true;
  }

  private executeRecorded(frame: number, live: ReplayState): boolean {
    return executeMatchFrame(this.inputAt(frame), live.match, live.world, live.controls, live.runtime, frame);
  }

  /** `unchanged` names fighters, and `shown` fighters' poses, the snapshot already holds as `source` has them. */
  private copySnapshot(frame: number, source: Readonly<ReplayState>, unchanged = 0, shown = 0): void {
    const slot = this.slotOf(frame);
    let target = at(this.snapshots, slot);
    if (target === this.borrowed) {
      this.snapshots[slot] = this.spare;
      this.spare = target;
      target = at(this.snapshots, slot);
      unchanged = 0;
    }
    const mask = source.world.mask;
    if (unchanged === 0 || target.world.mask !== mask) {
      copyReplayState(target, source);
      return;
    }
    for (const fighter of PARTICIPANT_SLOTS) {
      if (!isActive(source.world, fighter)) continue;
      copyAttackBuffer(target.controls.commands[fighter], source.controls.commands[fighter]);
      if (!participantActive(unchanged, fighter)) copyFighterState(fighterAt(target.world, fighter), fighterAt(source.world, fighter), mask);
    }
    copyMatchState(target.match, source.match);
    copyPacingAndPresentation(target.runtime, source.runtime, source.world, shown);
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
