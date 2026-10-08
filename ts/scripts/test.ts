import { readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join, resolve } from "node:path";
import { ISOLATED_TEST_GROUPS, testWorkerEnvironment } from "./testWorkers";
import { runAdmitted } from "./heavyCapacity";

await runAdmitted("heavy", "smashcraft:test", 1800);

const project = resolve(import.meta.dir, "..");
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
// SWEEPS=1 runs only the sweeps (src/runtime/sweep.ts) in the same processes.
const GAME_SHARDS = 3;
const REST_SHARDS = 3;
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
  ...Array.from({ length: REST_SHARDS }, (_, shard) => ({ files: shared.filter((_, index) => index % REST_SHARDS === shard) })),
  ...isolated.map((names) => ({ files: testFiles.filter((file) => names.includes(file)) })),
].filter((group) => group.files.length > 0);
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
const started = performance.now();
const codes: number[] = [];
const runGroup = async (group: Group): Promise<void> => {
  const junit = junitDirectory === undefined ? [] : ["--reporter=junit", `--reporter-outfile=${resolve(junitDirectory, `${groups.indexOf(group)}.xml`)}`];
  // Bun matches the pattern against the name with its describe blocks.
  const sweepFilter = sweeps ? ["-t", "\\(sweep\\) "] : [];
  const child = Bun.spawn([process.execPath, "test", ...junit, ...sweepFilter, ...group.files.map((file) => resolve(project, file))], {
    cwd: project,
    env: { ...process.env, ...testWorkerEnvironment(group.files), ...group.env },
    stdout: "inherit",
    stderr: "inherit",
  });
  codes.push(await child.exited);
};
const standalone = groups.find((group) => group.files.includes("test/standalone.test.ts"));
if (standalone !== undefined) await runGroup(standalone);
const queue = groups.filter((group) => group !== standalone);
await Promise.all(Array.from({ length: slots }, async () => {
  for (let group = queue.shift(); group !== undefined; group = queue.shift()) {
    await runGroup(group);
  }
}));
console.log(`full logic suite: ${files.length} files in ${groups.length} processes, ${slots} at a time, ${(performance.now() - started).toFixed(0)} ms`);
process.exitCode = codes.find((code) => code !== 0) ?? 0;
