

import { participantActive } from "../../input/participants";






export class MatchLifecycle {
  private readyMask = 0;
  private stoppedMask = 0;

  constructor(
    readonly epoch: number,
    readonly humans: number,
  ) {}

  ready(epoch: number, slot: number): void {
    if (epoch === this.epoch && participantActive(this.humans, slot)) this.readyMask |= 1 << slot;
  }

  stopped(epoch: number, slot: number): void {
    if (epoch === this.epoch && participantActive(this.humans, slot)) this.stoppedMask |= 1 << slot;
  }

  started(): boolean {
    return this.humans > 0 && this.readyMask === this.humans;
  }

  quiescent(): boolean {
    return this.humans > 0 && this.stoppedMask === this.humans;
  }
}


export function pauseBarrierFrame(prepared: readonly [number, ...number[]]): number {
  return Math.max(...prepared);
}
