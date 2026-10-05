import { resolve } from "node:path";

const project = resolve(import.meta.dir, "..");
const files = [
  ...new Bun.Glob("**/*{.test,_test,.spec,_spec}.{js,jsx,ts,tsx}").scanSync(project),
  ...new Bun.Glob("scripts/**/*.tests.ts").scanSync(project),
]
  .filter((file) => !file.startsWith("build/") && !file.split("/").some((part) => part === "node_modules" || part === ".git"))
  .sort();
if (files.length === 0) throw new Error("No tests found");

// The game registry and native desync guard own independent global stubs and
// most of the suite's work. Give each its own process; the third runs every
// other discovered file, including new tests.
const isolated = ["test/game.test.ts", "test/desync-guard.test.ts"];
const groups = [
  ...isolated.map((name) => files.filter((file) => file === name)),
  files.filter((file) => !isolated.includes(file)),
];
const started = performance.now();
const children = groups.filter((group) => group.length > 0).map((group) =>
  Bun.spawn([process.execPath, "test", ...group.map((file) => resolve(project, file))], {
    cwd: project,
    // These short-lived workers cannot amortize the highest JIT tier's compile work.
    env: { ...process.env, BUN_JSC_useFTLJIT: "false", BUN_JSC_numberOfDFGCompilerThreads: "1" },
    stdout: "inherit",
    stderr: "inherit",
  }));
const codes = await Promise.all(children.map((child) => child.exited));
console.log(`full logic suite: ${files.length} files, ${(performance.now() - started).toFixed(0)} ms`);
process.exitCode = codes.find((code) => code !== 0) ?? 0;
