// `bun wisp farm test|balance|pads|perf|memory [--ref REF] [--wait]`: runs headless work on
// GitHub's free hosted runners instead of this machine. `test` runs the full
// Bun and 32-bit Lua suites through smashcraft:.github/workflows/farm-test.yml
// (wisp:docs/farm.md). `balance` dispatches
// smashcraft:.github/workflows/balance.yml (the balance gate's computer
// field, a `cpuField --pairs` process a core over about 17 jobs, merged in
// one, then each fighter's spam probe, `--probe N` matches a pair, 0 to skip);
// `pads` dispatches smashcraft:.github/workflows/headless-pads.yml
// (every top-level native check script, or the files/folders `--only PATH` names,
// headless, against its own expectations);
// `perf "RUN ARGS" ... [--out DIR]` dispatches smashcraft:.github/workflows/perf.yml,
// one `bun wisp perf RUN ARGS` a job, and always waits: it prints each run's
// summary and writes its output to DIR/<run>.txt.
// `memory` dispatches smashcraft:.github/workflows/memory-soak.yml (#168's
// memory soak, `soak memory`, for `--minutes` game minutes, 30 by default).
// --wait waits for the run and prints the verdict and field table, or each
// failing script. Without --ref, the checkout's HEAD (wisp:scripts/wisp/farm.ts).
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { Effect } from "effect";
import { type Command, UsageFailure, describeCause } from "wisp/scripts/wisp/command";
import { FarmFailure, type RunState, currentRepo, dispatch, farmTest, resolveRef, run, runTag, waitFor } from "wisp/scripts/wisp/farm";

const WORKFLOWS = { balance: "balance.yml", pads: "headless-pads.yml", perf: "perf.yml", memory: "memory-soak.yml" } as const;
type Job = keyof typeof WORKFLOWS;

// A failing gate still publishes its tables: print them, then fail.
const balanceResult = (repo: string, id: number, state: RunState) => Effect.gen(function*() {
  const folder = mkdtempSync(join(tmpdir(), "farm-balance-"));
  const downloaded = yield* run(["gh", "run", "download", String(id), "-R", repo, "-n", "balance-field", "-D", folder]).pipe(Effect.as(true), Effect.orElseSucceed(() => false));
  if (downloaded) {
    console.log(readFileSync(join(folder, "field.md"), "utf8"));
    console.log(`Merged records: gh run download ${id} -R ${repo} -n balance-field`);
  }
  rmSync(folder, { recursive: true });
  if (state.conclusion !== "success") {
    const failed = state.jobs.filter((job) => job.conclusion !== "success" && job.conclusion !== "skipped").map((job) => job.name);
    return yield* new FarmFailure({ problem: `the balance run ended ${state.conclusion} (${failed.join(", ")}); gh run view ${id} -R ${repo} --log-failed` });
  }
});

const padsResult = (repo: string, id: number, state: RunState) => Effect.gen(function*() {
  const pads = state.jobs.filter((job) => job.name.startsWith("pad "));
  const failed = pads.filter((job) => job.conclusion !== "success");
  for (const job of pads) console.log(`${job.conclusion === "success" ? "pass" : job.conclusion === "failure" ? "FAIL" : job.conclusion}  ${job.name.replace(/^pad \((.*)\)$/, "$1")}`);
  if (state.conclusion === "success") return;
  if (failed.length > 0) {
    const log = yield* run(["gh", "run", "view", String(id), "-R", repo, "--log-failed"]).pipe(Effect.orElseSucceed(() => ""));
    for (const line of log.split("\n").filter((text) => /FAIL|failed for|error/.test(text)).slice(0, 40)) console.log(line);
  }
  return yield* new FarmFailure({ problem: `${failed.length} of ${pads.length} pad scripts failed (${state.conclusion}); evidence: gh run download ${id} -R ${repo}` });
});

/** The artifact name perf.yml gives a run: its arguments with every other character an underscore. */
const perfArtifact = (runArgs: string) => `perf-${runArgs.replace(/[^A-Za-z0-9-]/g, "_")}`;

const perfResult = (repo: string, id: number, state: RunState, runs: readonly string[], out: string | undefined) => Effect.gen(function*() {
  const folder = mkdtempSync(join(tmpdir(), "farm-perf-"));
  const failed: string[] = [];
  for (const runArgs of runs) {
    const name = perfArtifact(runArgs);
    const got = yield* run(["gh", "run", "download", String(id), "-R", repo, "-n", name, "-D", join(folder, name)]).pipe(Effect.as(true), Effect.orElseSucceed(() => false));
    if (!got) {
      failed.push(`${runArgs} (no output)`);
      continue;
    }
    console.log(`== perf ${runArgs}`);
    console.log(readFileSync(join(folder, name, "summary.txt"), "utf8").split("\n").filter((line) => !line.startsWith("frame ")).join("\n").trimEnd());
    if (out !== undefined) yield* Effect.tryPromise({ try: () => Bun.write(join(out, `${name.slice(5)}.txt`), Bun.file(join(folder, name, "run.txt"))), catch: (cause) => new FarmFailure({ problem: describeCause(cause) }) }).pipe(Effect.orElseSucceed(() => 0));
  }
  rmSync(folder, { recursive: true });
  const jobsFailed = state.jobs.filter((job) => job.conclusion !== "success").map((job) => job.name);
  if (state.conclusion !== "success" || failed.length > 0) return yield* new FarmFailure({ problem: `the perf run ended ${state.conclusion} (${[...jobsFailed, ...failed].join(", ")}); gh run view ${id} -R ${repo} --log-failed` });
});

const memoryResult = (repo: string, id: number, state: RunState) => Effect.gen(function*() {
  const folder = mkdtempSync(join(tmpdir(), "farm-memory-"));
  const downloaded = yield* run(["gh", "run", "download", String(id), "-R", repo, "-n", "memory-soak", "-D", folder]).pipe(Effect.as(true), Effect.orElseSucceed(() => false));
  if (downloaded) console.log(readFileSync(join(folder, "verdict.txt"), "utf8").trimEnd());
  rmSync(folder, { recursive: true });
  console.log(`Samples: gh run download ${id} -R ${repo} -n memory-soak`);
  if (state.conclusion !== "success") return yield* new FarmFailure({ problem: `the memory soak ended ${state.conclusion}; gh run view ${id} -R ${repo} --log-failed` });
});

export const farm: Command = (args) => Effect.gen(function*() {
  const parsed = yield* Effect.try({
    try: () => parseArgs({ args: [...args], allowPositionals: true, options: {
      ref: { type: "string" }, wait: { type: "boolean" }, out: { type: "string" }, opponent: { type: "string" }, tier: { type: "string" }, "per-pair": { type: "string" }, seeds: { type: "string" }, matchups: { type: "string" }, probe: { type: "string" }, minutes: { type: "string" }, only: { type: "string", multiple: true },
    } }),
    catch: (cause) => new UsageFailure({ problem: describeCause(cause) }),
  });
  const [job, ...perfRuns] = parsed.positionals;
  if (job === "test") return yield* farmTest({ ref: parsed.values.ref, wait: parsed.values.wait === true });
  if (job !== "balance" && job !== "pads" && job !== "perf" && job !== "memory") return yield* new UsageFailure({ problem: "farm test, farm balance, farm pads, farm perf or farm memory" });
  const runs = perfRuns.length > 0 ? perfRuns : ["playable-bot-four"];
  const workflow = WORKFLOWS[job satisfies Job];
  const repo = yield* currentRepo;
  // Closing the scope deletes the scratch branch resolveRef pushed.
  yield* Effect.scoped(Effect.gen(function*() {
    const { ref, scratch } = yield* resolveRef(parsed.values.ref, repo);
    const tag = runTag();
    const inputs = job === "balance"
      ? { ref, opponent: parsed.values.opponent ?? "wren", tier: parsed.values.tier ?? "expert", "per-pair": parsed.values["per-pair"] ?? "400", seeds: parsed.values.seeds ?? "100", matchups: parsed.values.matchups ?? "", probe: parsed.values.probe ?? "40", tag }
      : job === "perf" ? { ref, runs: JSON.stringify(runs), tag } : job === "memory" ? { ref, minutes: parsed.values.minutes ?? "30", tag } : { ref, dirs: parsed.values.only?.join(" ") ?? ".", tag };
    const started = performance.now();
    const found = yield* dispatch(repo, workflow, inputs);
    if (parsed.values.wait !== true && scratch === undefined && job !== "perf") return;
    const state = yield* waitFor(repo, found.databaseId);
    console.error(`${((performance.now() - started) / 60000).toFixed(1)} min from dispatch to the result`);
    if (job === "balance") yield* balanceResult(repo, found.databaseId, state);
    else if (job === "perf") yield* perfResult(repo, found.databaseId, state, runs, parsed.values.out);
    else if (job === "pads") yield* padsResult(repo, found.databaseId, state);
    else yield* memoryResult(repo, found.databaseId, state);
  }));
});
