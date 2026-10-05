// Native CPU-clock boundary for the isolated 4096-frame workload.
import { runFrameCostBenchmark } from "../game/replay/frameCostBenchmark";

declare const os: { readonly clock: (this: void) => number };

export function start(source: string): void {
  TimerStart(CreateTimer(), 2.0, false, () => {
    const result = runFrameCostBenchmark(() => os.clock());
    if (result === undefined) throw new Error("frame-cost TypeScript workload failed");
    PreloadGenClear();
    PreloadGenStart();
    Preload(`SOURCE ${source}`);
    Preload(`frames=${I2S(result.frames)}`);
    Preload(`total_seconds=${R2SW(result.totalSeconds, 16, 9)}`);
    Preload(`mean_seconds=${R2SW(result.meanSecondsPerFrame, 16, 9)}`);
    Preload(`initial_checksum=${result.initialChecksum}`);
    Preload(`final_checksum=${result.finalChecksum}`);
    for (let offset = 0; offset < result.finalState.length; offset += 200) {
      Preload(`state=${result.finalState.slice(offset, offset + 200)}`);
    }
    PreloadGenEnd(`smashcraft-frame-cost-${source}-p${I2S(GetPlayerId(GetLocalPlayer()))}-typescript.txt`);
    BJDebugMsg(`Benchmark: ${I2S(result.frames)} frames, ${R2SW(result.totalSeconds, 12, 6)} seconds`);
  });
}
