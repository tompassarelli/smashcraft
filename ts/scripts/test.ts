import { readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join, resolve } from "node:path";
import { ISOLATED_TEST_GROUPS, TEST_WORKER_ENV } from "./testWorkers";

const project = resolve(import.meta.dir, "..");
const files = [
  ...new Bun.Glob("**/*{.test,_test,.spec,_spec}.{js,jsx,ts,tsx}").scanSync(project),
  ...new Bun.Glob("scripts/**/*.tests.ts").scanSync(project),
]
  .filter((file) => !file.startsWith("build/") && !file.split("/").some((part) => part === "node_modules" || part === ".git"))
  .sort();
if (files.length === 0) throw new Error("No tests found");

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
const queue = [...groups].reverse();
const started = performance.now();
const codes: number[] = [];
await Promise.all(Array.from({ length: slots }, async () => {
  for (let group = queue.shift(); group !== undefined; group = queue.shift()) {
    const child = Bun.spawn([process.execPath, "test", ...group.files.map((file) => resolve(project, file))], {
      cwd: project,
      env: { ...process.env, ...TEST_WORKER_ENV },
      stdout: "inherit",
      stderr: "inherit",
    });
    codes.push(await child.exited);
  }
}));
console.log(`full logic suite: ${files.length} files in ${groups.length} processes, ${slots} at a time, ${(performance.now() - started).toFixed(0)} ms`);
process.exitCode = codes.find((code) => code !== 0) ?? 0;
