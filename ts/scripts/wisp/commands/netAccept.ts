import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Console, Effect, Schema } from "effect";
import { type Command, UsageFailure, flagValues } from "wisp/scripts/wisp/command";
import { acceptanceSummary, runAcceptance } from "../netAcceptance";

class NetAcceptFailure extends Schema.TaggedError<NetAcceptFailure>()("NetAcceptFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

/** `net-accept`: wisp#112's online acceptance, full matches between two processes through Wisp's delay and loss proxy. */
export const netAccept: Command = (args) => Effect.gen(function*() {
  const value = (name: string, fallback: number) => Number(flagValues(args, name)[0] ?? fallback);
  const out = flagValues(args, "out")[0];
  if (out === undefined) return yield* new UsageFailure({ problem: "net-accept needs --out DIR" });
  const rtts = (flagValues(args, "rtts")[0] ?? "0,60,120").split(",").map(Number);
  const options = { matches: value("matches", 20), frames: value("frames", 7200), jobs: value("jobs", 5), loss: value("loss", 0.01), seed: value("seed", 112), out, rtts };
  if ([options.matches, options.frames, options.jobs, options.loss, options.seed, ...rtts].some((number) => !Number.isFinite(number))) return yield* new UsageFailure({ problem: "net-accept takes numbers" });
  const rows = yield* runAcceptance(options);
  const summary = acceptanceSummary(rows);
  writeFileSync(join(out, "summary.json"), JSON.stringify(summary, null, 1));
  for (const line of summary) yield* Console.log(JSON.stringify(line));
  const failed = summary.filter((line) => line.results < line.matches || line.mismatches > 0 || line.depthP99 > line.window);
  if (failed.length > 0) return yield* new NetAcceptFailure({ problem: `failed at ${failed.map((line) => `${line.rttMs} ms`).join(", ")}` });
});
