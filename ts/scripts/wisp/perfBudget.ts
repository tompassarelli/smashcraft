// `bun wisp perf budget RUN_FILE [--p99 MS] [--worst MS]`: holds a run
// written by `perf RUN --samples --out RUN_FILE` to #168's frame budget. Each
// client's predicted Warcraft cost per frame (wisp's nativeFrameCost, the
// map's callbacks; typing is reported apart) may not exceed --p99 at its 99th
// percentile or --worst at its worst frame (10 and 14 ms by default: 60 fps
// locked with room for rendering inside the 16.7 ms frame).
import { Console, Effect } from "effect";
import { type Command, UsageFailure, describeCause, flagValues } from "wisp/scripts/wisp/command";
import { PerfFailure } from "wisp/scripts/wisp/commands/perf";
import { parsePerfSamples } from "wisp/scripts/wisp/nativeFit";
import { WARCRAFT_COST, nativeFrameCost } from "wisp/src/headless/nativeCost";

export const BUDGET_P99_MS = 10;
export const BUDGET_WORST_MS = 14;

/** Nearest rank, as the perf summaries compute it. */
function rank(sorted: readonly number[], share: number): number {
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(share * sorted.length) - 1))] ?? 0;
}

export interface ClientBudget {
  readonly slot: number;
  readonly frames: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly worst: number;
}

/** Each client's predicted callback ms per frame: median, 95th and 99th percentile, worst. */
export function clientBudgets(samples: string): ClientBudget[] {
  return [...parsePerfSamples(samples)].map(([slot, frames]) => {
    const ms = frames.map((frame) => nativeFrameCost(WARCRAFT_COST, { ...frame, typedCharacters: 0 }).callbacksUs / 1000).sort((a, b) => a - b);
    return { slot, frames: ms.length, p50: rank(ms, 0.5), p95: rank(ms, 0.95), p99: rank(ms, 0.99), worst: rank(ms, 1) };
  });
}

export const budget: Command = (args) => Effect.gen(function*() {
  const [p99Text = String(BUDGET_P99_MS)] = flagValues(args, "p99");
  const [worstText = String(BUDGET_WORST_MS)] = flagValues(args, "worst");
  const files = args.filter((arg, index) => !arg.startsWith("--") && !["--p99", "--worst"].includes(args[index - 1] ?? ""));
  const p99 = Number(p99Text);
  const worst = Number(worstText);
  const [file] = files;
  if (file === undefined || files.length !== 1 || !(p99 > 0) || !(worst > 0)) return yield* new UsageFailure({ problem: "perf budget takes a run written with --samples, and optional --p99 MS and --worst MS" });
  const text = yield* Effect.tryPromise({ try: () => Bun.file(file).text(), catch: (cause) => new PerfFailure({ problem: `${file}: ${describeCause(cause)}` }) });
  const clients = clientBudgets(text);
  if (clients.length === 0) return yield* new PerfFailure({ problem: `${file} has no frame samples: write it with perf RUN --samples --out FILE` });
  const over: string[] = [];
  for (const client of clients) {
    yield* Console.log(`p${client.slot} predicted ms per frame over ${client.frames} frames: ${client.p50.toFixed(2)} p50, ${client.p95.toFixed(2)} p95, ${client.p99.toFixed(2)} p99, ${client.worst.toFixed(2)} worst (budget ${p99} p99, ${worst} worst)`);
    if (client.p99 > p99) over.push(`p${client.slot} p99 ${client.p99.toFixed(2)} ms > ${p99}`);
    if (client.worst > worst) over.push(`p${client.slot} worst ${client.worst.toFixed(2)} ms > ${worst}`);
  }
  if (over.length > 0) return yield* new PerfFailure({ problem: `over the frame budget: ${over.join("; ")}` });
});
