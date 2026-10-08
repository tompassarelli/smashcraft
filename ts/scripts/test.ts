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

// Each isolated group gets its own process and the rest share one. CI's 6
// CPUs bound the suite, so a process more only repeats module loading and JIT
// warm-up: six measured no faster than five.
const isolated = ISOLATED_TEST_GROUPS;
const groups: { readonly files: readonly string[] }[] = [
  ...isolated.map((names) => ({ files: files.filter((file) => names.includes(file)) })),
  { files: files.filter((file) => !isolated.flat().includes(file)) },
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
const runGroup = async (group: { readonly files: readonly string[] }): Promise<void> => {
  const junit = junitDirectory === undefined ? [] : ["--reporter=junit", `--reporter-outfile=${resolve(junitDirectory, `${groups.indexOf(group)}.xml`)}`];
  const child = Bun.spawn([process.execPath, "test", ...junit, ...group.files.map((file) => resolve(project, file))], {
    cwd: project,
    env: { ...process.env, ...testWorkerEnvironment(group.files) },
    stdout: "inherit",
    stderr: "inherit",
  });
  codes.push(await child.exited);
};
const standalone = groups.find((group) => group.files.includes("test/standalone.test.ts"));
if (standalone !== undefined) await runGroup(standalone);
const queue = groups.filter((group) => group !== standalone).reverse();
await Promise.all(Array.from({ length: slots }, async () => {
  for (let group = queue.shift(); group !== undefined; group = queue.shift()) {
    await runGroup(group);
  }
}));
console.log(`full logic suite: ${files.length} files in ${groups.length} processes, ${slots} at a time, ${(performance.now() - started).toFixed(0)} ms`);
process.exitCode = codes.find((code) => code !== 0) ?? 0;
