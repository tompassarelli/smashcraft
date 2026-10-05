// Stopgap rollback playback until the replay history is integrated: it runs
// speculative frames on local and predicted rows but keeps no history, so a
// misprediction is never corrected and predicted presentation can drift. The
// confirmed match, its checksums and every synchronized decision are
// unaffected. Replace it with the replay code's playback.
import { participantInputs } from "../input/participants";
import { captureNetworkFrame, createMatchFrameInput, executeMatchFrame } from "../match/frameInput";
import type { RollbackPlayback } from "./playback";

export function uncorrectedPlayback(): RollbackPlayback {
  // Preallocated: every speculative frame resolves into these.
  const inputs = participantInputs();
  const row = createMatchFrameInput();
  let current: number | undefined;
  return {
    beginEpoch(epoch) {
      current = epoch;
      return true;
    },
    reconcile(_schedule, epoch) {
      return epoch === current ? "unchanged" : "rejected";
    },
    catchUp(schedule, epoch, localPlayer, match, budget, stopBefore, executed) {
      for (let steps = 0; steps < budget && schedule.mayAdvanceSpeculativeFor(localPlayer); steps++) {
        const frame = schedule.speculativeFrame();
        if (stopBefore !== undefined && frame >= stopBefore) return true;
        if (epoch !== current || frame !== match.runtime.simulationFrame + 1) return false;
        if (schedule.resolveSpeculative(epoch, localPlayer, inputs) === undefined) return false;
        if (!captureNetworkFrame(row, frame, inputs, match.world, match.game.humanMask)) return false;
        if (!executeMatchFrame(row, match.game, match.world, match.controls, match.runtime, frame)) return false;
        const local = inputs[localPlayer];
        if (local !== undefined) executed(frame, local);
        if (!schedule.completeSpeculative(epoch, frame)) return false;
      }
      return true;
    },
  };
}
