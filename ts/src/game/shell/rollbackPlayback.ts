// The shell's speculative cursor is backed by the same bounded replay history
// as recorded tapes, so accepted remote rows can replace predictions in place.
import type { InputRow } from "../input/inputRow";
import type { FrameControls } from "../match/controls";
import type { PacingAndPresentation } from "../match/pacingAndPresentation";
import type { MatchState } from "../match/rules";
import { type CorrectionResult, ReplayHistory } from "../replay/history";
import { REPLAY_MAX_CORRECTION_FRAMES } from "../replay/limits";
import { ShadowInputPlayback } from "../replay/shadowPlayback";
import type { ReplayState } from "../replay/snapshot";
import type { MatchFrameInput } from "../match/frameInput";
import type { Roster } from "../sim/roster";
import type { RollbackPlayback, SpeculativeMatch } from "./playback";

interface MutableReplayState {
  world: ReplayState["world"];
  match: MatchState;
  controls: FrameControls;
  runtime: PacingAndPresentation;
}

/** Production rollback playback: the shell's private world is corrected from retained input rows. */
class ReplayHistoryPlayback implements RollbackPlayback {
  private readonly history = new ReplayHistory();
  private readonly playback = new ShadowInputPlayback();
  private state: MutableReplayState | undefined;
  private current: number | undefined;

  beginEpoch(epoch: number, window: number): boolean {
    if (epoch < 0 || (this.current !== undefined && epoch <= this.current) || window < 1 || window > REPLAY_MAX_CORRECTION_FRAMES) return false;
    if (!this.playback.beginEpoch(epoch) || !this.history.beginEpoch(epoch, 1, window)) return false;
    this.current = epoch;
    return true;
  }

  reconcile(schedule: Parameters<RollbackPlayback["reconcile"]>[0], epoch: number, localPlayer: number, match: SpeculativeMatch): ReturnType<RollbackPlayback["reconcile"]> {
    if (epoch !== this.current) return "rejected";
    const result = this.playback.amend(schedule, epoch, localPlayer, this.bind(match), this.history);
    return correction(result);
  }

  repair(epoch: number, match: SpeculativeMatch, budget: number, cost?: number): number | "rejected" {
    if (epoch !== this.current) return "rejected";
    return this.history.repair(epoch, budget, this.bind(match), cost);
  }

  pendingRepair(epoch: number): number | undefined {
    return epoch === this.current ? this.history.pendingRepairFrame(epoch) : undefined;
  }

  catchUp(
    schedule: Parameters<RollbackPlayback["catchUp"]>[0],
    epoch: number,
    localPlayer: number,
    match: SpeculativeMatch,
    budget: number,
    stopBefore: number | undefined,
    executed: (frame: number, local: Readonly<InputRow>) => void,
  ): boolean {
    if (epoch !== this.current) return false;
    const state = this.bind(match);
    for (let steps = 0; steps < budget && schedule.mayAdvanceSpeculativeFor(localPlayer); steps++) {
      const frame = schedule.speculativeFrame();
      if (stopBefore !== undefined && frame >= stopBefore) break;
      if (!this.playback.advanceSpeculative(schedule, epoch, localPlayer, state, this.history, executed)) return false;
    }
    return true;
  }

  rewind(schedule: Parameters<RollbackPlayback["rewind"]>[0], epoch: number, frame: number, match: SpeculativeMatch): boolean {
    if (epoch !== this.current) return false;
    if (frame >= schedule.speculativeFrame()) return true;
    if (!this.history.truncate(epoch, frame, this.bind(match)) || !schedule.rewindSpeculative(epoch, frame)) return false;
    this.playback.forgetReconciliation();
    return true;
  }

  confirmedState(epoch: number, frame: number, row: Readonly<MatchFrameInput>): Readonly<ReplayState> | undefined {
    return epoch === this.current ? this.history.stateAfter(epoch, frame, row) : undefined;
  }

  visitWorlds(visit: (world: Roster) => void): void {
    this.history.visitWorlds(visit);
  }

  private bind(match: SpeculativeMatch): MutableReplayState {
    if (this.state === undefined) {
      this.state = { world: match.world, match: match.game, controls: match.controls, runtime: match.runtime };
    } else {
      this.state.world = match.world;
      this.state.match = match.game;
      this.state.controls = match.controls;
      this.state.runtime = match.runtime;
    }
    return this.state;
  }
}

function correction(result: CorrectionResult): ReturnType<RollbackPlayback["reconcile"]> {
  if (result === "rejected" || result === "unchanged") return result;
  return { replayedFrom: result };
}

export function replayHistoryPlayback(): RollbackPlayback {
  return new ReplayHistoryPlayback();
}
