// CI's per-commit metrics line (smashcraft:.github/workflows/ci.yml): the
// playable four-bot match's p95 frame cost and allocation, and the playable
// map script's size, so a regression is a lookup in the run's summary or log
// (`gh run view RUN --log | grep commit-metrics`).
// Usage: bun scripts/commitMetrics.ts PERF_FILE MAP_SCRIPT
import { existsSync, readFileSync, statSync } from "node:fs";

const [perfPath = "", scriptPath = ""] = process.argv.slice(2);
const commit = process.env.GITHUB_SHA ?? "local";

/** Player 0's `p0 METRIC ... p95=N ... total=N` fields from a `bun wisp perf --out` file. */
function perfMetrics(text: string): Record<string, Record<string, number>> {
  const metrics: Record<string, Record<string, number>> = {};
  for (const line of text.split("\n")) {
    const [player, metric, ...fields] = line.split(" ");
    if (player !== "p0" || metric === undefined) continue;
    metrics[metric] = Object.fromEntries(fields.map((field) => field.split("=")).map(([key = "", value = ""]) => [key, Number(value)]));
  }
  return metrics;
}

{
  const perf = existsSync(perfPath) ? perfMetrics(readFileSync(perfPath, "utf8")) : undefined;
  const fields = {
    "p95 instructions": perf?.instructions?.p95,
    "p95 lua-us": perf?.["lua-us"]?.p95,
    "p95 alloc-kb": perf?.["alloc-kb"]?.p95,
    "total alloc-kb": perf?.["alloc-kb"]?.total,
    "map script bytes": existsSync(scriptPath) ? statSync(scriptPath).size : undefined,
  };
  console.log(`commit-metrics ${commit} ${Object.entries(fields).map(([name, value]) => `${name.replaceAll(" ", "_")}=${value ?? "missing"}`).join(" ")}`);
  console.log("");
  console.log(`| ${Object.keys(fields).join(" | ")} |`);
  console.log(`| ${Object.keys(fields).map(() => "---").join(" | ")} |`);
  console.log(`| ${Object.values(fields).map((value) => value ?? "missing").join(" | ")} |`);
}
