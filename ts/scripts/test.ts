import { resolve } from "node:path";
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
const started = performance.now();
const children = groups.map((group) =>
  Bun.spawn([process.execPath, "test", ...group.files.map((file) => resolve(project, file))], {
    cwd: project,
    env: { ...process.env, ...TEST_WORKER_ENV },
    stdout: "inherit",
    stderr: "inherit",
  }));
const codes = await Promise.all(children.map((child) => child.exited));
console.log(`full logic suite: ${files.length} files in ${groups.length} processes, ${(performance.now() - started).toFixed(0)} ms`);
process.exitCode = codes.find((code) => code !== 0) ?? 0;
