import { basename } from "node:path";
import { Console, Effect } from "effect";
import { PerfFailure, measureRun } from "wisp/scripts/wisp/commands/perf";
import { SMASHCRAFT_PERF } from "./commands/perf";

export const writePlaytestCost = (map: string) => Effect.gen(function*() {
  const run = "playable-bot-four";
  const { output, measured } = yield* measureRun(SMASHCRAFT_PERF, run, 1800, true);
  if (measured.problems > 0) return yield* new PerfFailure({ problem: `playtest cost found ${measured.problems} problems; its callbacks are not a measurement` });
  const values = measured.clients.get(0)?.["native-us"];
  if (values === undefined) return yield* new PerfFailure({ problem: "playtest cost has no player 0 callbacks" });
  const report = {
    map: basename(map),
    note: "Lua cost predicted; whole frame not measured",
    run,
    player: 0,
    callbacks: measured.frames,
    calibration: {
      reference: "wisp#19",
      scope: "solo and four-bot callbacks only; playable-bot-four",
      percentiles: ["p50", "p95"],
      nativeToleranceShare: 0.2,
    },
    predictedLuaMs: { p50: values.median / 1000, p95: values.p95 / 1000 },
    diagnostics: { worstPredictedLuaMs: values.max / 1000 },
    samples: basename(`${map}.lua-cost.perf`),
  };
  yield* Effect.tryPromise({
    try: async () => {
      await Bun.write(`${map}.lua-cost.perf`, output);
      await Bun.write(`${map}.lua-cost.json`, `${JSON.stringify(report, null, 2)}\n`);
    },
    catch: (cause) => new PerfFailure({ problem: `writing playtest cost beside ${map}: ${String(cause)}` }),
  });
  yield* Console.log(`${report.note}; p50 ${report.predictedLuaMs.p50.toFixed(2)} ms, p95 ${report.predictedLuaMs.p95.toFixed(2)} ms; worst ${report.diagnostics.worstPredictedLuaMs.toFixed(2)} ms diagnostic (${map}.lua-cost.json)`);
});
