// Barriers every human participant crosses together: match start, match end
// and a shared pause.
import { participantActive } from "../../input/participants";

/**
 * One match's start and end barriers. Every human slot must report ready
 * before the match starts and stopped before it is quiescent; the local
 * client's own report alone cannot release the menus.
 */
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

/** The frame a shared pause takes effect: the highest frontier any participant prepared. */
export function pauseBarrierFrame(prepared: readonly [number, ...number[]]): number {
  return Math.max(...prepared);
}
