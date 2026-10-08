// The new-failure gate: a push to main runs the tests its change affects
// (`bun wisp dev`'s selection, smashcraft:ts/scripts/wisp/commands/dev.ts; the
// game registry also in 32-bit Lua when sim code changed) and is refused when
// one fails that wasn't failing in main's latest completed CI run. Tests main
// already fails don't block. The pre-push gate (smashcraft:ts/scripts/prePush.ts)
// calls it; `bun scripts/newFailures.ts run PLAN_JSON` is the admitted runner.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { Effect, Schema } from "effect";
import { TestPlan } from "wisp/scripts/wisp/testSelection";
import { runAdmitted } from "./heavyCapacity";
import { failedTest, failingTests } from "./mainRed";
import { ISOLATED_TEST_GROUPS, TEST_WORKER_ENV, testWorkerEnvironment } from "./testWorkers";
import { readBaseline } from "./testCost";
import { SMASHCRAFT_DEV } from "./wisp/commands/dev";

const tsRoot = resolve(import.meta.dir, "..");
const repositoryRoot = resolve(tsRoot, "..");

/** Wall time the gate's tests may take, the capacity queue included; past it the push goes on unverified. */
export const GATE_BUDGET_S = 150;
/** Baseline CPU of the Bun tests and of the Lua32 tests one push runs; the heaviest affected beyond it are left to CI. */
const BUN_CPU_BUDGET_S = 90;
const LUA_CPU_BUDGET_S = 40;
const LUA_JOBS = 4;
const SHARED_PROCESSES = 3;

export interface Plan {
  /** Bun test files, relative to ts/. */
  readonly files: readonly string[];
  /** Game registry modules, relative to ts/ (src/...). */
  readonly game: readonly string[];
  /** Registry modules also run in 32-bit Lua: the affected ones, when sim code changed. */
  readonly lua: readonly string[];
  /** Changed files no test selection covers, each with why. */
  readonly uncovered: readonly string[];
  /** Affected Bun files over the CPU budget, left to CI. */
  readonly deferred: readonly string[];
}

const isSim = (path: string) => /^ts\/src\/(?:.+\/)?sim\//.test(path);

/** The tests a change to `paths` (relative to the repository root) affects, as `bun wisp dev` selects them on a save. */
export function affectedTests(paths: readonly string[]): Plan {
  const plan = new TestPlan(tsRoot, SMASHCRAFT_DEV.tests);
  const units = new Map(plan.all().map((unit) => [unit.path, unit]));
  const selected = new Map<string, "file" | "registry">();
  const uncovered: string[] = [];
  for (const path of paths.filter((path) => path.startsWith("ts/"))) {
    const absolute = resolve(repositoryRoot, path);
    // A deleted module's importers changed too.
    if (!existsSync(absolute)) continue;
    const own = units.get(absolute);
    if (own !== undefined) selected.set(own.path, own.kind);
    const selection = plan.select({ changed: [absolute], created: [], deleted: [] });
    if (selection.full !== undefined) {
      if (own === undefined) uncovered.push(`${path} (${selection.full})`);
      continue;
    }
    for (const unit of selection.units) selected.set(unit.path, unit.kind);
  }
  const local = (path: string) => relative(tsRoot, path);
  const bun = withinBudget([...selected].map(([path, kind]) => ({ path: local(path), kind })), join(tsRoot, "test/cost-baseline.tsv"), BUN_CPU_BUDGET_S);
  const game = bun.kept.filter(({ kind }) => kind === "registry").map(({ path }) => path).sort();
  const lua = paths.some(isSim) ? withinBudget(game.map((path) => ({ path, kind: "registry" })), join(tsRoot, "test/lua/cost-baseline.tsv"), LUA_CPU_BUDGET_S) : { kept: [], deferred: [] };
  return {
    files: bun.kept.filter(({ kind }) => kind === "file").map(({ path }) => path).sort(),
    game,
    lua: lua.kept.map(({ path }) => path).sort(),
    uncovered,
    deferred: [...bun.deferred, ...lua.deferred.map((path) => `Lua32 ${path}`)].sort(),
  };
}

/** The cheapest `units` whose baseline CPU fits in `budget` seconds, and the rest. */
function withinBudget<T extends { readonly path: string }>(units: readonly T[], baselinePath: string, budget: number): { readonly kept: T[]; readonly deferred: string[] } {
  const baseline = readBaseline(baselinePath);
  const cost = (path: string) => baseline.get(path)?.cpu ?? 1;
  const kept: T[] = [];
  const deferred: string[] = [];
  let cpu = 0;
  for (const unit of [...units].sort((left, right) => cost(left.path) - cost(right.path))) {
    if (cpu + cost(unit.path) > budget) deferred.push(unit.path);
    else {
      cpu += cost(unit.path);
      kept.push(unit);
    }
  }
  return { kept, deferred };
}

/** One test process the gate ran: how to rerun it, and what it printed. */
export interface ProcessRun {
  readonly command: string;
  readonly exitCode: number;
  readonly output: string;
}

export interface Failure {
  readonly test: string;
  readonly reproduce: string;
}

const shellQuote = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A process's passed count and failing tests; a failed process that names no test fails as itself. */
export function processResult(run: ProcessRun): { readonly passed: number; readonly failures: readonly Failure[] } {
  const bunPassed = [...run.output.matchAll(/^\s*(\d+) pass$/gm)].reduce((sum, match) => sum + Number(match[1]), 0);
  const luaPassed = [...run.output.matchAll(/^(\d+) of \d+ passed$/gm)].reduce((sum, match) => sum + Number(match[1]), 0);
  const names = [...new Set(run.output.split("\n").flatMap((line) => failedTest(line.trim()) ?? []))];
  const lua = run.command.includes("lua-tests.ts");
  const failures = names.map((test) => ({
    test,
    reproduce: lua ? run.command : `${run.command} -t ${shellQuote(`^${escapeRegExp(test.replace(/ > /g, " "))}`)}`,
  }));
  // Exit 75 is an inconclusive cost verdict under CPU pressure, not a failure.
  if (failures.length === 0 && run.exitCode !== 0 && run.exitCode !== 75) failures.push({ test: `process: ${run.command} exited ${run.exitCode}`, reproduce: run.command });
  return { passed: bunPassed + luaPassed, failures };
}

/** The failures `runs` show that `known` (main's failing tests) doesn't list. */
export function newFailures(runs: readonly ProcessRun[], known: ReadonlySet<string>): Failure[] {
  return runs.flatMap((run) => processResult(run).failures).filter(({ test }) => !known.has(test));
}

/** The refusal that names each new failure and how to reproduce it. */
export function refusal(failures: readonly Failure[], knownFrom: string): string {
  return [
    `pre-push: ${failures.length} affected test${failures.length === 1 ? "" : "s"} fail that main does not (${knownFrom}):`,
    ...failures.flatMap(({ test, reproduce }) => [`  ${test}`, `    reproduce: cd ts && ${reproduce}`]),
    "pre-push: fix them before landing; tests main already fails don't block.",
  ].join("\n");
}

/** The processes a plan runs: Bun file groups, the game registry, and the Lua leg. */
export function processesFor(plan: Plan): { readonly argv: readonly string[]; readonly env: Readonly<Record<string, string>>; readonly command: string }[] {
  const bun = process.execPath;
  // A bare path is a name filter, which never matches a `.tests.ts` file; `./` makes it a path.
  const testArgs = (files: readonly string[]) => [bun, "test", "--timeout", "120000", ...files.map((file) => `./${file}`)];
  const isolated = ISOLATED_TEST_GROUPS.map((group) => plan.files.filter((file) => group.includes(file))).filter((group) => group.length > 0);
  const shared = plan.files.filter((file) => !ISOLATED_TEST_GROUPS.flat().includes(file));
  const bins = Array.from({ length: Math.min(SHARED_PROCESSES, shared.length) }, (_, bin) => shared.filter((_, index) => index % SHARED_PROCESSES === bin));
  const game = plan.game.map((module) => module.replace(/^src\//, "")).join(",");
  return [
    ...[...isolated, ...bins].map((files) => ({ argv: testArgs(files), env: { ...testWorkerEnvironment(files) }, command: `bun test ${files.join(" ")}` })),
    ...(plan.game.length === 0 ? [] : [{ argv: testArgs(["test/game.test.ts"]), env: { ...TEST_WORKER_ENV, GAME_MODULES: game }, command: `GAME_MODULES=${game} bun test test/game.test.ts` }]),
    ...(plan.lua.length === 0 ? [] : [{ argv: [bun, "scripts/lua-tests.ts"], env: { GAME_MODULES: plan.lua.join(","), LUA_JOBS: String(LUA_JOBS) }, command: `GAME_MODULES=${plan.lua.join(",")} bun scripts/lua-tests.ts` }]),
  ];
}

const RESULT_PREFIX = "new-fail-gate result ";

/** Runs a plan's processes at once; each one's output is kept, not printed. */
const runPlan = (plan: Plan) => Effect.forEach(processesFor(plan), ({ argv, env, command }) => Effect.acquireUseRelease(
  Effect.sync(() => Bun.spawn([...argv], { cwd: tsRoot, env: { ...process.env, ...env }, stdin: "ignore", stdout: "pipe", stderr: "pipe" })),
  (child) => Effect.promise(async () => {
    const [exitCode, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
    return { command, exitCode, output: `${out}\n${err}` } satisfies ProcessRun;
  }),
  (child) => Effect.promise(async () => {
    if (child.exitCode === null) child.kill("SIGKILL");
    await child.exited;
  }),
), { concurrency: "unbounded" });

const ProcessRuns = Schema.Array(Schema.Struct({ command: Schema.String, exitCode: Schema.Finite, output: Schema.String }));

/** The runs the admitted runner printed, from its output; undefined when it printed none it could decode. */
export const decodeRuns = (output: string): Effect.Effect<readonly ProcessRun[] | undefined> => {
  const line = output.split("\n").find((text) => text.startsWith(RESULT_PREFIX));
  if (line === undefined) return Effect.succeed(undefined);
  return Schema.decodeEffect(Schema.fromJsonString(ProcessRuns))(line.slice(RESULT_PREFIX.length)).pipe(Effect.orElseSucceed(() => undefined));
};

/** Main's failing tests from its latest completed CI run, cached per main commit in the clone's git directory. */
export interface Known {
  readonly sha: string;
  readonly url: string;
  readonly tests: readonly string[];
}

const KnownSchema = Schema.Struct({ sha: Schema.String, url: Schema.String, tests: Schema.Array(Schema.String) });
const Runs = Schema.Array(Schema.Struct({ databaseId: Schema.Finite, headSha: Schema.String, conclusion: Schema.String, url: Schema.String }));

const capture = (argv: readonly string[]) => Effect.acquireUseRelease(
  Effect.sync(() => Bun.spawn([...argv], { cwd: repositoryRoot, stdin: "ignore", stdout: "pipe", stderr: "ignore" })),
  (child) => Effect.promise(async () => ({ exitCode: await child.exited, stdout: await new Response(child.stdout).text() })),
  (child) => Effect.promise(async () => {
    if (child.exitCode === null) child.kill("SIGKILL");
    await child.exited;
  }),
);

export const knownFailing = (cacheDirectory: string) => Effect.gen(function*() {
  const listed = yield* capture(["gh", "run", "list", "--workflow", "ci.yml", "--branch", "main", "--limit", "30", "--json", "databaseId,headSha,conclusion,url"]);
  if (listed.exitCode !== 0) return undefined;
  const runs = yield* Schema.decodeEffect(Schema.fromJsonString(Runs))(listed.stdout);
  const latest = runs.find(({ conclusion }) => conclusion === "success" || conclusion === "failure");
  if (latest === undefined) return undefined;
  const cached = join(cacheDirectory, `${latest.headSha}.json`);
  if (existsSync(cached)) return yield* Schema.decodeEffect(Schema.fromJsonString(KnownSchema))(readFileSync(cached, "utf8"));
  let tests: readonly string[] = [];
  if (latest.conclusion === "failure") {
    const log = yield* capture(["gh", "run", "view", String(latest.databaseId), "--log-failed"]);
    if (log.exitCode !== 0) return undefined;
    tests = failingTests(log.stdout);
  }
  const known: Known = { sha: latest.headSha, url: latest.url, tests };
  mkdirSync(cacheDirectory, { recursive: true });
  writeFileSync(cached, JSON.stringify(known));
  return known;
}).pipe(Effect.timeout("60 seconds"), Effect.orElseSucceed(() => undefined));

/** One line per commit pushed to main: when, the commit, its verdict, tests run and passed, its new failures (empty when it landed), main's set. */
export function landingLine(at: Date, sha: string, verdict: string, passed: number, failures: readonly Failure[], ran: number, knownFrom: string): string {
  return [at.toISOString(), sha, verdict, `ran=${ran}`, `passed=${passed}`, `new=${failures.map(({ test }) => test).join("; ")}`, `known=${knownFrom}`].join("\t");
}

export const appendLanding = (logPath: string, line: string) => Effect.sync(() => appendFileSync(logPath, `${line}\n`)).pipe(Effect.ignore);

if (import.meta.main && process.argv[2] === "run") {
  await runAdmitted("heavy", "smashcraft:pre-push", GATE_BUDGET_S);
  const Paths = Schema.Array(Schema.String);
  const PlanSchema = Schema.Struct({ files: Paths, game: Paths, lua: Paths, uncovered: Paths, deferred: Paths });
  const runs = await Effect.runPromise(Schema.decodeEffect(Schema.fromJsonString(PlanSchema))(process.argv[3] ?? "").pipe(Effect.flatMap(runPlan)));
  console.log(`${RESULT_PREFIX}${JSON.stringify(runs)}`);
}
