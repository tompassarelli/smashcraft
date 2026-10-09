




import { f32 } from "wisp/src/sim/f32";
import { renderClockFile } from "../../runtime/gameFiles";
declare const os: { readonly clock?: (this: void) => number } | undefined;

const PROBE_GAME_SECONDS = 4.0;
const MAX_SAMPLES = 64000;

const FAST_PERIOD = 0.0009765625;

const MIN_FRAME_GAP = 0.001953125;
const TENTH = f32(0.1);
const NINE_TENTHS = f32(0.9);

interface Candidate {
  readonly name: string;
  readonly clock: number[];
  readonly game: number[];
  readonly cost: number[];
  callbacks: number;
}

let runs = 0;

function now(): number {
  if (typeof os !== "object" || os === null || typeof os.clock !== "function") return 0;
  return os.clock();
}


function clockStep(): number {
  const start = now();
  let next = start;
  for (let i = 0; i < 1000000 && next === start; i++) next = now();
  return next - start;
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.floor((sorted.length - 1) * p)] ?? 0;
}

function ms(value: number): string {
  return R2SW(value * 1000.0, 1, 3);
}

function summarize(candidate: Candidate, gap: number): string[] {
  const { clock, game, cost, callbacks } = candidate;
  const n = clock.length;
  if (n < 2) return [`${candidate.name} callbacks=${I2S(callbacks)} samples=${I2S(n)}`];
  const frameGaps: number[] = [];
  const gameSteps: number[] = [];
  const perFrame: number[] = [];
  let burstSpan = 0.0;
  let burstPairs = 0;
  let first = 0;
  for (let i = 1; i <= n; i++) {
    if (i === n || (clock[i] ?? 0) - (clock[i - 1] ?? 0) > gap) {
      perFrame.push(i - first);
      burstSpan += (clock[i - 1] ?? 0) - (clock[first] ?? 0);
      burstPairs += i - first - 1;
      if (i < n) {
        frameGaps.push((clock[i] ?? 0) - (clock[first] ?? 0));
        gameSteps.push((game[i] ?? 0) - (game[first] ?? 0));
        first = i;
      }
    }
  }
  const frames = perFrame.length;
  const wall = (clock[n - 1] ?? 0) - (clock[0] ?? 0);
  const gameSpan = (game[n - 1] ?? 0) - (game[0] ?? 0);
  frameGaps.sort((a, b) => a - b);
  gameSteps.sort((a, b) => a - b);
  perFrame.sort((a, b) => a - b);
  let totalCost = 0.0;
  for (const value of cost) totalCost += value;
  cost.sort((a, b) => a - b);
  return [
    `${candidate.name} callbacks=${I2S(callbacks)} samples=${I2S(n)} capped=${callbacks > n ? "yes" : "no"}`
      + ` bursts=${I2S(frames)} clock=${ms(wall)}ms game=${ms(gameSpan)}ms`
      + ` bursts/s=${R2SW(wall > 0 ? (frames - 1) / wall : 0, 1, 1)}`,
    `${candidate.name} burst-gap-ms p10=${ms(percentile(frameGaps, TENTH))} p50=${ms(percentile(frameGaps, 0.5))}`
      + ` p90=${ms(percentile(frameGaps, NINE_TENTHS))} max=${ms(percentile(frameGaps, 1.0))}`,
    `${candidate.name} game-step-ms p10=${ms(percentile(gameSteps, TENTH))} p50=${ms(percentile(gameSteps, 0.5))}`
      + ` p90=${ms(percentile(gameSteps, NINE_TENTHS))} max=${ms(percentile(gameSteps, 1.0))}`,
    `${candidate.name} callbacks-per-burst min=${I2S(perFrame[0] ?? 0)} p50=${I2S(percentile(perFrame, 0.5))}`
      + ` max=${I2S(perFrame[frames - 1] ?? 0)} in-burst-spacing-us=${R2SW(burstPairs > 0 ? burstSpan / burstPairs * 1000000.0 : 0, 1, 2)}`,
    `${candidate.name} record-cost-us mean=${R2SW(totalCost / n * 1000000.0, 1, 2)}`
      + ` p50=${R2SW(percentile(cost, 0.5) * 1000000.0, 1, 2)}`
      + ` p90=${R2SW(percentile(cost, NINE_TENTHS) * 1000000.0, 1, 2)}`
      + ` max=${R2SW(percentile(cost, 1.0) * 1000000.0, 1, 2)} total-ms=${ms(totalCost)}`,
  ];
}


export function probeRenderClock(): void {
  runs++;
  const run = runs;
  const step = clockStep();
  const gap = step * 2.0 > MIN_FRAME_GAP ? step * 2.0 : MIN_FRAME_GAP;
  const reference = CreateTimer();
  const zero = CreateTimer();
  const fast = CreateTimer();
  const stop = CreateTimer();
  const zeroSamples: Candidate = { name: "period0", clock: [], game: [], cost: [], callbacks: 0 };
  const fastSamples: Candidate = { name: "period1024", clock: [], game: [], cost: [], callbacks: 0 };
  const record = (candidate: Candidate) => {
    candidate.callbacks++;
    if (candidate.clock.length >= MAX_SAMPLES) return;
    const started = now();
    candidate.clock.push(started);
    candidate.game.push(TimerGetElapsed(reference));
    candidate.cost.push(now() - started);
  };
  TimerStart(reference, 3600.0, false, () => {});
  TimerStart(zero, 0.0, true, () => record(zeroSamples));
  TimerStart(fast, FAST_PERIOD, true, () => record(fastSamples));
  TimerStart(stop, PROBE_GAME_SECONDS, false, () => {
    PauseTimer(zero);
    PauseTimer(fast);
    PauseTimer(reference);
    DestroyTimer(zero);
    DestroyTimer(fast);
    DestroyTimer(reference);
    DestroyTimer(stop);
    const lines = [`render-clock run=${I2S(run)} clock=${step > 0 ? "running" : "unavailable"}`
      + ` clock-step-us=${R2SW(step * 1000000.0, 1, 2)} burst-gap-threshold-ms=${ms(gap)}`];
    for (const candidate of [zeroSamples, fastSamples]) for (const line of summarize(candidate, gap)) lines.push(line);
    PreloadGenClear();
    PreloadGenStart();
    for (const line of lines) {
      Preload(line);
      DisplayTextToPlayer(GetLocalPlayer(), 0.0, 0.0, line);
    }
    PreloadGenEnd(renderClockFile(GetPlayerId(GetLocalPlayer()), run));
  });
}
