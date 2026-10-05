import { participantInputs } from "../input/participants";
import { captureNetworkFrame, createMatchFrameInput, executeMatchFrame } from "../match/frameInput";
import type { FixedInputSchedule } from "../netcode/fixedSchedule";
import type { ReplayState } from "./snapshot";

/** Runs a fixed-delay schedule's accepted rows, one frame per call, in a world of their own. */
export class FixedInputPlayback {
  // Preallocated: refilled for every frame the schedule releases.
  private readonly accepted = participantInputs();
  private readonly recorded = createMatchFrameInput();

  /** Runs the schedule's next frame once every participant's row has arrived. */
  advanceNext(schedule: FixedInputSchedule, epoch: number, live: ReplayState): boolean {
    const frame = schedule.nextFrame();
    const mask = schedule.participantMask();
    if (mask !== live.world.mask || live.runtime.simulationFrame + 1 !== frame || !schedule.readNext(epoch, this.accepted)) return false;
    if (!captureNetworkFrame(this.recorded, frame, this.accepted, live.world, mask)) return false;
    if (!executeMatchFrame(this.recorded, live.match, live.world, live.controls, live.runtime, frame)) return false;
    return schedule.complete(epoch, frame);
  }

  lastRecordedFrame(): number | undefined {
    return this.recorded.frame;
  }
}
