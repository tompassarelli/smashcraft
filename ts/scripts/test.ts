import { resolve } from "node:path";

const project = resolve(import.meta.dir, "..");
const files = [
  ...new Bun.Glob("**/*{.test,_test,.spec,_spec}.{js,jsx,ts,tsx}").scanSync(project),
  ...new Bun.Glob("scripts/**/*.tests.ts").scanSync(project),
]
  .filter((file) => !file.startsWith("build/") && !file.split("/").some((part) => part === "node_modules" || part === ".git"))
  .sort();
if (files.length === 0) throw new Error("No tests found");

// Each Bun process isolates native stubs and registered game tests. Two
// workers bound memory while independent test files run in parallel.
const groups = [files.filter((_, index) => index % 2 === 0), files.filter((_, index) => index % 2 === 1)];
const started = performance.now();
const children = groups.filter((group) => group.length > 0).map((group) =>
  Bun.spawn([process.execPath, "test", ...group.map((file) => resolve(project, file))], {
    cwd: project,
    stdout: "inherit",
    stderr: "inherit",
  }));
const codes = await Promise.all(children.map((child) => child.exited));
console.log(`full logic suite: ${files.length} files, ${(performance.now() - started).toFixed(0)} ms`);
process.exitCode = codes.find((code) => code !== 0) ?? 0;
