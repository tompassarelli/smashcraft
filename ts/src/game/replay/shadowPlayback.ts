// Runs a shadow schedule's two cursors: speculative frames on local and
// predicted rows, corrected in place as remote rows arrive, and confirmed
// frames on accepted rows in a world of their own.
import { type InputRow, copyInput, emptyInput, predictInto } from "../input/inputRow";
import { PARTICIPANT_SLOTS, participantInputs } from "../input/participants";
import {
  captureNetworkFrame,
  copyNetworkRow,
  createMatchFrameInput,
  executeMatchFrame,
  hasNetworkRows,
  replaceNetworkRows,
} from "../match/frameInput";
import { humanActive } from "../match/rules";
import type { ShadowInputSchedule } from "../netcode/shadowSchedule";
import { type CorrectionResult, type ReplayHistory, ReplayCorrections } from "./history";
import type { ReplayState } from "./snapshot";

const NEUTRAL: Readonly<InputRow> = emptyInput();

/**
 * Frames one service callback may run speculatively. Live sampling owns one
 * new frame, and running further would skip later capture targets; replayed
 * journals already hold their rows.
 */
export function shadowSpeculativeStepBudget(originalFramesRetained: boolean): number {
  return originalFramesRetained ? 6 : 1;
}

/** Observes each speculative frame after it runs; the native response probe implements it. */
interface SpeculativeFrameObserver {
  speculativeFrameRan(epoch: number, localPlayer: number, frame: number, local: Readonly<InputRow>, frontier: number): void;
}

export class ShadowInputPlayback {
  // Preallocated: every speculative, confirmed and corrected frame refills these.
  private readonly inputs = participantInputs();
  private readonly actual = participantInputs();
  private readonly row = createMatchFrameInput();
  private readonly confirmedRow = createMatchFrameInput();
  private readonly correctionRow = createMatchFrameInput();
  private readonly corrections = new ReplayCorrections();
  private current: number | undefined;

  constructor(private readonly observer?: SpeculativeFrameObserver) {}

  epoch(): number | undefined {
    return this.current;
  }

  beginEpoch(epoch: number): boolean {
    if (!this.corrections.beginEpoch(epoch)) return false;
    this.current = epoch;
    return true;
  }

  /**
   * Runs local rows already assigned, at most stepBudget of them and never
   * frame stopBefore, an acknowledged pause frontier. The schedule still
   * bounds prediction by its rollback window.
   */
  catchUpSpeculative(schedule: ShadowInputSchedule, epoch: number, localPlayer: number, live: ReplayState, history: ReplayHistory, stepBudget: number, stopBefore?: number): boolean {
    for (let steps = 0; steps < stepBudget && schedule.mayAdvanceSpeculativeFor(localPlayer); steps++) {
      if (stopBefore !== undefined && schedule.speculativeFrame() >= stopBefore) break;
      if (!this.advanceSpeculative(schedule, epoch, localPlayer, live, history)) return false;
    }
    return true;
  }

  /**
   * Records and runs the next speculative frame from rows the service owner
   * already sampled and sent. It never polls, sends or touches presentation.
   */
  advanceSpeculative(schedule: ShadowInputSchedule, epoch: number, localPlayer: number, live: ReplayState, history: ReplayHistory, executed?: (frame: number, local: Readonly<InputRow>) => void): boolean {
    const { match, world, controls, runtime } = live;
    if (schedule.participantMask() !== match.humanMask || epoch !== this.current) return false;
    const frame = schedule.speculativeFrame();
    if (frame !== runtime.simulationFrame + 1) return false;
    const resolution = schedule.resolveSpeculative(epoch, localPlayer, this.inputs);
    if (resolution === undefined) return false;
    if (!captureNetworkFrame(this.row, frame, this.inputs, world, match.humanMask)) return false;
    const saved = resolution === "speculative" ? history.saveSpeculative(epoch, this.row, live) : history.save(epoch, this.row, live);
    if (!saved || !executeMatchFrame(this.row, match, world, controls, runtime, frame)) return false;
    const local = this.inputs[localPlayer];
    if (local !== undefined) executed?.(frame, local);
    if (local !== undefined) this.observer?.speculativeFrameRan(epoch, localPlayer, frame, local, schedule.speculativeFrame());
    return schedule.completeSpeculative(epoch, frame);
  }

  /** Runs the next confirmed frame in caller-owned state distinct from the speculative world. */
  advanceConfirmed(schedule: ShadowInputSchedule, epoch: number, live: ReplayState, history: ReplayHistory): boolean {
    const { match, world, controls, runtime } = live;
    const frame = schedule.nextConfirmedFrame();
    if (schedule.participantMask() !== match.humanMask || epoch !== this.current || frame !== runtime.simulationFrame + 1) return false;
    if (!schedule.readConfirmed(epoch, this.inputs)) return false;
    if (!captureNetworkFrame(this.confirmedRow, frame, this.inputs, world, match.humanMask)) return false;
    if (!history.save(epoch, this.confirmedRow, live) || !executeMatchFrame(this.confirmedRow, match, world, controls, runtime, frame)) return false;
    return schedule.completeConfirmed(epoch, frame);
  }

  /**
   * Rebuilds the speculative rows in frame order from accepted input and
   * replays from the earliest change. Accepted and local rows keep their
   * edges; a remote row still missing continues the slot's previous row
   * without them, and replay adapts it against the rebuilt state.
   */
  reconcile(schedule: ShadowInputSchedule, epoch: number, localPlayer: number, live: ReplayState, history: ReplayHistory): CorrectionResult {
    const { match, world } = live;
    if (schedule.participantMask() !== match.humanMask || epoch !== this.current || schedule.epoch() !== epoch || !humanActive(match, localPlayer)) return "rejected";
    const { actual, correctionRow, corrections } = this;
    corrections.clear();
    const firstFrame = Math.max(history.firstRetainedFrame(), schedule.firstAcceptedFrame());
    const lastFrame = history.lastRecordedFrame();
    for (const row of actual) copyInput(row, NEUTRAL);
    for (let frame = firstFrame; frame <= lastFrame; frame++) {
      if (!history.copyInputRow(epoch, frame, correctionRow) || correctionRow.mask !== world.mask) return "rejected";
      if (!hasNetworkRows(correctionRow)) continue;
      if (!history.isSpeculative(epoch, frame)) {
        for (const slot of PARTICIPANT_SLOTS) if (humanActive(match, slot)) copyNetworkRow(correctionRow, slot, actual[slot]);
        continue;
      }
      let allAccepted = true;
      for (const slot of PARTICIPANT_SLOTS) {
        if (!humanActive(match, slot)) continue;
        const accepted = schedule.accepted(epoch, slot, frame);
        if (accepted !== undefined) {
          copyInput(actual[slot], accepted);
          continue;
        }
        allAccepted = false;
        if (slot === localPlayer) copyNetworkRow(correctionRow, slot, actual[slot]);
        else predictInto(actual[slot], actual[slot]);
      }
      replaceNetworkRows(correctionRow, actual);
      if (!(allAccepted ? corrections.add(correctionRow) : corrections.addSpeculative(correctionRow))) return "rejected";
    }
    const result = history.correct(epoch, corrections, live);
    if (result === "rejected") return result;
    if (history.copyInputRow(epoch, lastFrame, correctionRow) && hasNetworkRows(correctionRow)) {
      for (const slot of PARTICIPANT_SLOTS) {
        if (!humanActive(match, slot)) continue;
        copyNetworkRow(correctionRow, slot, actual[slot]);
        schedule.rememberResolvedInput(slot, actual[slot]);
      }
    }
    return result;
  }
}
