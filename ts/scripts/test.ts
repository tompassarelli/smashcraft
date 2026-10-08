// `bun run test`: the suite in a few processes, then Wisp's timing phase
// (wisp:docs/testing.md), then its CPU against the committed baseline
// (scripts/testCost.ts, AGENTS.md "Test cost").
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Cause, Effect, Exit, Schema } from "effect";
import { BUSY_PRESSURE, INCONCLUSIVE_EXIT, TEST_TIMEOUT_MS, timingTestFiles, timingTests, withPressure } from "wisp/scripts/wisp/testRunner";
import { TEST_PHASE_ENV } from "wisp/scripts/wisp/timingTest";
import { ISOLATED_TEST_GROUPS, testWorkerEnvironment } from "./testWorkers";
import { runAdmitted } from "./heavyCapacity";
import { BUN_TEST_CEILING_S, addCost, judge, readBaseline, type Costs } from "./testCost";

await runAdmitted("heavy", "smashcraft:test", 1800);

const project = resolve(import.meta.dir, "..");
process.chdir(project);
const files = [
  ...new Bun.Glob("**/*{.test,_test,.spec,_spec}.{js,jsx,ts,tsx}").scanSync(project),
  ...new Bun.Glob("scripts/**/*.tests.ts").scanSync(project),
]
  .filter((file) => !file.startsWith("build/") && !file.split("/").some((part) => part === "node_modules" || part === ".git"))
  .sort();
if (files.length === 0) throw new Error("No tests found");
// `--units` prints what may be split across machines (`wisp farm test`): each
// isolated group comma-joined, every other file alone. Files as arguments run
// only those; TEST_JUNIT_DIR writes each process's JUnit report there.
const [first, ...rest] = process.argv.slice(2);
if (first === "--units") {
  const grouped = ISOLATED_TEST_GROUPS.flat();
  for (const group of ISOLATED_TEST_GROUPS) console.log(group.filter((file) => files.includes(file)).join(","));
  for (const file of files.filter((file) => !grouped.includes(file))) console.log(file);
  process.exit(0);
}
const only = [first, ...rest].filter((arg) => arg !== undefined).map((arg) => arg.replace(/^\.\//, ""));
if (only.length > 0) files.splice(0, files.length, ...files.filter((file) => only.includes(file)));
const junitDirectory = process.env.TEST_JUNIT_DIR;

// Each isolated group gets its own process. The game registry and the other
// files are each spread over a few processes, so no one process bounds the
// run; a process more than that only repeats module loading and JIT warm-up.
// The other files fill the CPUs the rest leave, balanced by baseline CPU.
// SWEEPS=1 runs only the sweeps (src/runtime/sweep.ts) in the same processes.
const GAME_SHARDS = 3;
const REST_SHARDS = 3;
const baselinePath = resolve(project, "test/cost-baseline.tsv");
const baseline = readBaseline(baselinePath);
const fileCost = (file: string) => baseline.get(file)?.cpu ?? 1;
const sweeps = process.env.SWEEPS === "1";
const hasSweeps = (file: string) => /(^|[^\w.])sweep\)?\(/m.test(readFileSync(resolve(project, file), "utf8"));
type Group = { readonly files: readonly string[]; readonly env?: Readonly<Record<string, string>> };
const isolated = ISOLATED_TEST_GROUPS;
const testFiles = files.filter((file) => file !== "test/game.test.ts" && (!sweeps || hasSweeps(file)));
const shared = testFiles.filter((file) => !isolated.flat().includes(file));
const gameModules = files.includes("test/game.test.ts")
  ? [...new Bun.Glob("**/*.tests.ts").scanSync(resolve(project, "src"))].sort().filter((module) => !sweeps || hasSweeps(`src/${module}`))
  : [];
const groups: Group[] = [
  ...Array.from({ length: GAME_SHARDS }, (_, shard) => gameModules.filter((_, index) => index % GAME_SHARDS === shard))
    .filter((modules) => modules.length > 0)
    .map((modules) => ({ files: ["test/game.test.ts"], env: { GAME_MODULES: modules.join(",") } })),
  ...balance(shared, Math.max(REST_SHARDS, usableCpus() - 1 - GAME_SHARDS - isolated.length)).map((bin) => ({ files: bin })),
  ...isolated.map((names) => ({ files: testFiles.filter((file) => names.includes(file)) })),
].filter((group) => group.files.length > 0);
/** Spreads files over `count` processes, heaviest first onto the lightest. */
function balance(names: readonly string[], count: number): string[][] {
  const bins = Array.from({ length: count }, () => ({ files: new Array<string>(), cpu: 0 }));
  for (const file of [...names].sort((a, b) => fileCost(b) - fileCost(a))) {
    const lightest = bins.reduce((best, bin) => (bin.cpu < best.cpu ? bin : best));
    lightest.files.push(file);
    lightest.cpu += fileCost(file);
  }
  return bins.map((bin) => bin.files.sort());
}
const groupCost = (group: Group) => group.env?.GAME_MODULES === undefined
  ? group.files.reduce((sum, file) => sum + fileCost(file), 0)
  : group.env.GAME_MODULES.split(",").reduce((sum, module) => sum + fileCost(`src/${module}`), 0);

/**
 * The CPUs this process may use: the tightest cgroup v2 `cpu.max` quota on its
 * path (a capacity scope's CPUQuota), else every core it may run on.
 */
function usableCpus(): number {
  let cpus = availableParallelism();
  let group: string | undefined;
  try {
    group = readFileSync("/proc/self/cgroup", "utf8").split("\n").find((line) => line.startsWith("0::"))?.slice(3);
  } catch {
    return cpus;
  }
  for (let dir = group; dir !== undefined && dir !== "/" && dir !== ""; dir = dirname(dir)) {
    try {
      const [quota, period] = readFileSync(join("/sys/fs/cgroup", dir, "cpu.max"), "utf8").trim().split(" ");
      if (quota !== undefined && quota !== "max" && Number(period) > 0) cpus = Math.min(cpus, Number(quota) / Number(period));
    } catch {
      // No cpu controller at this level.
    }
  }
  return Math.max(1, Math.floor(cpus));
}

// JSC's compiler threads share the quota with test bodies. Leave one CPU
// for them: six processes under six CPUs took the 10 s bot selection to 18 s.
const slots = Math.min(groups.length, Math.max(1, usableCpus() - 1));
const costDirectory = mkdtempSync(join(tmpdir(), "smashcraft-test-cost-"));
const costFile = (group: Group) => join(costDirectory, `${groups.indexOf(group)}.jsonl`);
/** One line of test/testCost.ts's output. */
const CostRow = Schema.Struct({
  unit: Schema.optionalKey(Schema.String),
  tests: Schema.optionalKey(Schema.Int),
  cpu: Schema.optionalKey(Schema.Finite),
  max: Schema.optionalKey(Schema.Finite),
  inconclusive: Schema.optionalKey(Schema.String),
});
const decodeCostRow = Schema.decodeUnknownEffect(Schema.fromJsonString(CostRow));
const percent = (value: number | undefined) => (value === undefined ? "unknown" : `${Math.round(value)}%`);

/** One group's process; its exit code and CPU seconds (rusage, with its waited-for children). */
const runGroup = (group: Group) => Effect.acquireUseRelease(
  Effect.sync(() => {
    const junit = junitDirectory === undefined ? [] : ["--reporter=junit", `--reporter-outfile=${resolve(junitDirectory, `${groups.indexOf(group)}.xml`)}`];
    // Bun matches the pattern against the name with its describe blocks.
    const sweepFilter = sweeps ? ["-t", "\\(sweep\\) "] : [];
    const cost = sweeps ? {} : { TEST_COST_OUT: costFile(group), TEST_COST_CEILING_S: String(BUN_TEST_CEILING_S), TEST_COST_BUSY: String(BUSY_PRESSURE) };
    return Bun.spawn([process.execPath, "test", "--timeout", String(TEST_TIMEOUT_MS), ...junit, ...sweepFilter, ...group.files.map((file) => resolve(project, file))], {
      cwd: project,
      env: { ...process.env, ...testWorkerEnvironment(group.files), ...group.env, [TEST_PHASE_ENV]: "correctness", ...cost },
      stdout: "inherit",
      stderr: "inherit",
    });
  }),
  (child) => Effect.promise(() => child.exited).pipe(Effect.map((code) => {
    const usage = child.resourceUsage()?.cpuTime;
    return { code, cpu: usage === undefined ? 0 : (Number(usage.user) + Number(usage.system)) / 1e6 };
  })),
  (child) => Effect.sync(() => {
    if (child.exitCode === null) child.kill();
  }),
);

const suite = Effect.gen(function*() {
  const started = performance.now();
  // The heaviest processes start first, so none starts last and bounds the run.
  const results = yield* Effect.forEach([...groups].sort((a, b) => groupCost(b) - groupCost(a)), runGroup, { concurrency: slots });
  console.log(`full logic suite: ${files.length} files in ${groups.length} processes, ${slots} at a time, ${(performance.now() - started).toFixed(0)} ms`);
  const timingFiles = sweeps ? [] : timingTestFiles(project, only);
  const verdicts = timingFiles.length === 0 ? new Map() : yield* timingTests(timingFiles, [], (line) => console.log(line));
  return { results, verdicts: [...verdicts.values()] };
});

const program = Effect.gen(function*() {
  const { value: { results, verdicts }, pressure } = yield* withPressure(suite);
  const failed = results.some((result) => result.code !== 0) || verdicts.includes("failed");
  let inconclusive = verdicts.includes("inconclusive");
  if (!sweeps) {
    const measured: Costs = new Map();
    const notes: string[] = [];
    for (const group of groups) {
      if (!existsSync(costFile(group))) continue;
      for (const line of readFileSync(costFile(group), "utf8").split("\n").filter((text) => text !== "")) {
        const row = yield* decodeCostRow(line);
        if (row.inconclusive !== undefined) notes.push(row.inconclusive);
        else if (row.unit !== undefined) addCost(measured, row.unit, row.tests ?? 0, row.cpu ?? 0, row.max ?? 0);
      }
    }
    const judgement = judge({
      label: "suite", measured, baselinePath, project, whole: only.length === 0,
      totalCpu: results.reduce((sum, result) => sum + result.cpu, 0),
    });
    for (const note of notes) console.log(note);
    inconclusive ||= notes.length > 0;
    const busy = pressure.peak !== undefined && pressure.peak > BUSY_PRESSURE;
    for (const line of judgement.risen) console.log(busy ? `${line} (inconclusive: CPU pressure ${percent(pressure.peak)})` : line);
    if (judgement.risen.length > 0 && busy) inconclusive = true;
    if (judgement.updated > 0) console.log(`test cost baseline: ${judgement.updated} rows updated in ts/test/cost-baseline.tsv; commit them with the tests`);
    console.log(judgement.heaviest);
    console.log(judgement.summary);
    if (judgement.risen.length > 0 && !busy) return 1;
  }
  console.log(`CPU pressure during this run: average ${percent(pressure.average)}, peak some avg10 ${percent(pressure.peak)} (budget and timing verdicts count as inconclusive above ${BUSY_PRESSURE}%)`);
  if (failed) return 1;
  return inconclusive ? INCONCLUSIVE_EXIT : 0;
}).pipe(Effect.ensuring(Effect.sync(() => rmSync(costDirectory, { recursive: true, force: true }))));

BunRuntime.runMain(program.pipe(Effect.provide(BunServices.layer)), {
  disableErrorReporting: true,
  teardown: (exit) => {
    if (Exit.isFailure(exit) && !Cause.hasInterruptsOnly(exit.cause)) console.error(Cause.pretty(exit.cause));
    process.exit(Exit.isSuccess(exit) ? Number(exit.value) : Cause.hasInterruptsOnly(exit.cause) ? 130 : 1);
  },
});
