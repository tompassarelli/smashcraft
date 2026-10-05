// Minimal entry for the native migration benchmark; no gameplay shell or hot reload.
import { runFrameCostBenchmark } from "../game/replay/frameCostBenchmark";

declare function smashcraftFrameCostEmit(language: string, frames: number, totalSeconds: number, meanSeconds: number,
  initialChecksum: string, finalChecksum: string, finalState: string): void;

export function start(this: void): void {}

export function run(this: void): void {
  const result = runFrameCostBenchmark();
  if (result === undefined) throw new Error("frame-cost TypeScript workload failed");
  smashcraftFrameCostEmit("typescript", result.frames, result.totalSeconds, result.meanSecondsPerFrame,
    result.initialChecksum, result.finalChecksum, result.finalState);
}
