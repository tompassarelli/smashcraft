





import { Console, Effect } from "effect";
import { type Command, UsageFailure, describeCause, flagValues } from "wisp/scripts/wisp/command";
import { PerfFailure } from "wisp/scripts/wisp/commands/perf";
import { parsePerfSamples } from "wisp/scripts/wisp/nativeFit";
import { WARCRAFT_COST, nativeFrameCost } from "wisp/src/headless/nativeCost";

const BUDGET_P99_MS = 10;
const BUDGET_TOP_MS = 14;
/** The worst frames a budget averages instead of one worst frame, whose identity moves with any bot choice (#394). */
const TOP_SHARE = 0.01;


function rank(sorted: readonly number[], share: number): number {
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(share * sorted.length) - 1))] ?? 0;
}

interface ClientBudget {
  readonly slot: number;
  readonly frames: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly top: number;
  readonly worst: number;
}


function clientBudgets(samples: string): ClientBudget[] {
  return [...parsePerfSamples(samples)].map(([slot, frames]) => {
    const ms = frames.map((frame) => nativeFrameCost(WARCRAFT_COST, { ...frame, typedCharacters: 0 }).callbacksUs / 1000).sort((a, b) => a - b);
    const worstFrames = ms.slice(ms.length - Math.max(1, Math.ceil(TOP_SHARE * ms.length)));
    const top = worstFrames.reduce((sum, value) => sum + value, 0) / Math.max(1, worstFrames.length);
    return { slot, frames: ms.length, p50: rank(ms, 0.5), p95: rank(ms, 0.95), p99: rank(ms, 0.99), top, worst: rank(ms, 1) };
  });
}

export const budget: Command = (args) => Effect.gen(function*() {
  const [p99Text = String(BUDGET_P99_MS)] = flagValues(args, "p99");
  const [topText = String(BUDGET_TOP_MS)] = flagValues(args, "top");
  const files = args.filter((arg, index) => !arg.startsWith("--") && !["--p99", "--top"].includes(args[index - 1] ?? ""));
  const p99 = Number(p99Text);
  const top = Number(topText);
  const [file] = files;
  if (file === undefined || files.length !== 1 || !(p99 > 0) || !(top > 0)) return yield* new UsageFailure({ problem: "perf budget takes a run written with --samples, and optional --p99 MS and --top MS" });
  const text = yield* Effect.tryPromise({ try: () => Bun.file(file).text(), catch: (cause) => new PerfFailure({ problem: `${file}: ${describeCause(cause)}` }) });
  const clients = clientBudgets(text);
  if (clients.length === 0) return yield* new PerfFailure({ problem: `${file} has no frame samples: write it with perf RUN --samples --out FILE` });
  const over: string[] = [];
  for (const client of clients) {
    yield* Console.log(`p${client.slot} predicted ms per frame over ${client.frames} frames: ${client.p50.toFixed(2)} p50, ${client.p95.toFixed(2)} p95, ${client.p99.toFixed(2)} p99, ${client.top.toFixed(2)} top 1% mean, ${client.worst.toFixed(2)} worst (budget ${p99} p99, ${top} top 1% mean)`);
    if (client.p99 > p99) over.push(`p${client.slot} p99 ${client.p99.toFixed(2)} ms > ${p99}`);
    if (client.top > top) over.push(`p${client.slot} top 1% mean ${client.top.toFixed(2)} ms > ${top}`);
  }
  if (over.length > 0) return yield* new PerfFailure({ problem: `over the frame budget: ${over.join("; ")}` });
});
