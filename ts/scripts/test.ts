// `bun run test`: the suite in a few processes, then Wisp's timing phase
// (wisp:docs/testing.md), then a report of its CPU (scripts/testCost.ts,
// docs/commands/testing.md).
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Cause, Effect, Exit, Layer, Schema } from "effect";
import { BUSY_PRESSURE, INCONCLUSIVE_EXIT, timingTestFiles, timingTests, withPressure } from "wisp/scripts/wisp/testRunner";
import { TEST_PHASE_ENV } from "wisp/scripts/wisp/timingTest";
import { ISOLATED_TEST_GROUPS, testWorkerEnvironment } from "./testWorkers";
import { admit } from "./heavyCapacity";
import { runMeasuredProcess } from "./hostProcess";
import { BUN_TEST_CEILING_FRAMES, addCost, cpuReport, readBaseline, type Costs } from "./testCost";
import { refuseUntagged } from "./oracleTags";
import { refuseLiteralCopies } from "./literalCopies";
import { platformLayer } from "wisp/scripts/platform/layer";

/** The hang timeout per test; cost is bounded by BUN_TEST_CEILING_FRAMES. */
const TEST_TIMEOUT_MS = 60_000;
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

// A file's CPU depends on the files before it in its process, so the processes are fixed by name hash, never by machine.
// SWEEPS=1 runs only the sweeps (src/runtime/sweep.ts) in the same processes.
const GAME_SHARDS = 3;
const REST_SHARDS = 4;
const baseline = readBaseline(resolve(project, "test/cost-baseline.tsv"));
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
const shardOf = (name: string, count: number) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < name.length; index++) hash = Math.imul(hash ^ name.charCodeAt(index), 0x01000193) >>> 0;
  return hash % count;
};
const byName = (names: readonly string[], count: number) =>
  Array.from({ length: count }, (_, shard) => names.filter((name) => shardOf(name, count) === shard));
const groups: Group[] = [
  ...byName(gameModules, GAME_SHARDS).filter((modules) => modules.length > 0).map((modules) => ({ files: ["test/game.test.ts"], env: { GAME_MODULES: modules.join(",") } })),
  ...byName(shared, REST_SHARDS).map((bin) => ({ files: bin })),
  ...isolated.map((names) => ({ files: testFiles.filter((file) => names.includes(file)) })),
].filter((group) => group.files.length > 0);
refuseUntagged(project, [...testFiles, ...gameModules.map((module) => `src/${module}`)]);
refuseLiteralCopies(project);
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

// Each Bun process also runs compiler threads; leave half the CPUs for them.
const slots = Math.min(groups.length, 8, Math.max(1, Math.floor(usableCpus() / 2)));
const costDirectory = mkdtempSync(join(tmpdir(), "smashcraft-test-cost-"));
const costFile = (group: Group) => join(costDirectory, `${groups.indexOf(group)}.jsonl`);
/** One line of test/testCost.ts's output. */
const CostRow = Schema.Struct({
  unit: Schema.optionalKey(Schema.String),
  tests: Schema.optionalKey(Schema.Int),
  cpu: Schema.optionalKey(Schema.Finite),
  max: Schema.optionalKey(Schema.Finite),
  maxFrames: Schema.optionalKey(Schema.Int),
});
const decodeCostRow = Schema.decodeUnknownEffect(Schema.fromJsonString(CostRow));
const percent = (value: number | undefined) => (value === undefined ? "unknown" : `${Math.round(value)}%`);

/** One group's process; its exit code and CPU seconds (rusage, with its waited-for children). */
const runGroup = (group: Group) => Effect.suspend(() => {
  const junit = junitDirectory === undefined ? [] : ["--reporter=junit", `--reporter-outfile=${resolve(junitDirectory, `${groups.indexOf(group)}.xml`)}`];
  // Bun matches the pattern against the name with its describe blocks.
  const sweepFilter = sweeps ? ["-t", "\\(sweep\\) "] : [];
  const cost = sweeps ? {} : { TEST_COST_OUT: costFile(group), TEST_COST_CEILING_FRAMES: String(BUN_TEST_CEILING_FRAMES) };
  return runMeasuredProcess(
    [process.execPath, "test", "--timeout", String(TEST_TIMEOUT_MS), ...junit, ...sweepFilter, ...group.files.map((file) => resolve(project, file))],
    project,
    { ...process.env, ...testWorkerEnvironment(group.files), ...group.env, [TEST_PHASE_ENV]: "correctness", ...cost },
  );
});

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
  const admitted = yield* admit("heavy", "smashcraft:test", 1800);
  if (admitted !== undefined) return admitted;
  const { value: { results, verdicts }, pressure } = yield* withPressure(suite);
  const failed = results.some((result) => result.code !== 0) || verdicts.includes("failed");
  let inconclusive = verdicts.includes("inconclusive");
  if (!sweeps) {
    const measured: Costs = new Map();
    for (const group of groups) {
      if (!existsSync(costFile(group))) continue;
      for (const line of readFileSync(costFile(group), "utf8").split("\n").filter((text) => text !== "")) {
        const row = yield* decodeCostRow(line);
        if (row.unit !== undefined) addCost(measured, row.unit, row.tests ?? 0, row.cpu ?? 0, row.max ?? 0, row.maxFrames ?? 0);
      }
    }
    for (const line of cpuReport("suite", measured, results.reduce((sum, result) => sum + result.cpu, 0))) console.log(line);
  }
  console.log(`CPU pressure during this run: average ${percent(pressure.average)}, peak some avg10 ${percent(pressure.peak)} (budget and timing verdicts count as inconclusive above ${BUSY_PRESSURE}%)`);
  if (failed) return 1;
  return inconclusive ? INCONCLUSIVE_EXIT : 0;
}).pipe(Effect.ensuring(Effect.sync(() => rmSync(costDirectory, { recursive: true, force: true }))));

BunRuntime.runMain(program.pipe(Effect.provide(Layer.merge(BunServices.layer, platformLayer()))), {
  disableErrorReporting: true,
  teardown: (exit) => {
    if (Exit.isFailure(exit) && !Cause.hasInterruptsOnly(exit.cause)) console.error(Cause.pretty(exit.cause));
    process.exit(Exit.isSuccess(exit) ? Number(exit.value) : Cause.hasInterruptsOnly(exit.cause) ? 130 : 1);
  },
});
