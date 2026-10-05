import { resolve } from "node:path";

const project = resolve(import.meta.dir, "..");
const files = [
  ...new Bun.Glob("**/*{.test,_test,.spec,_spec}.{js,jsx,ts,tsx}").scanSync(project),
  ...new Bun.Glob("scripts/**/*.tests.ts").scanSync(project),
]
  .filter((file) => !file.startsWith("build/") && !file.split("/").some((part) => part === "node_modules" || part === ".git"))
  .sort();
if (files.length === 0) throw new Error("No tests found");

// The game registry and native fixtures own independent global stubs, so each
// group gets its own process. CI's 6 CPUs bound the suite, so a process more
// only repeats module loading and JIT warm-up: six measured no faster than five.
const isolated = [
  ["test/game.test.ts"],
  ["test/desync-guard.test.ts", "test/desync-guard-integrity.test.ts"],
  ["test/visual-lifecycle.test.ts", "test/player-view.test.ts", "test/selection-load.test.ts", "test/player-text.test.ts"],
  // source-shapes only reads files, so it fills the short group and the groups finish together.
  ["test/stack-trace.test.ts", "test/source-shapes.test.ts"],
];
const groups: { readonly files: readonly string[] }[] = [
  ...isolated.map((names) => ({ files: files.filter((file) => names.includes(file)) })),
  { files: files.filter((file) => !isolated.flat().includes(file)) },
].filter((group) => group.files.length > 0);
const started = performance.now();
const children = groups.map((group) =>
  Bun.spawn([process.execPath, "test", ...group.files.map((file) => resolve(project, file))], {
    cwd: project,
    // These short-lived workers cannot amortize the optimizing tiers' compile
    // work for all but their hottest loops, and a GC marker thread per core
    // costs more CPU than it saves.
    env: {
      ...process.env,
      BUN_JSC_useFTLJIT: "false",
      BUN_JSC_numberOfDFGCompilerThreads: "1",
      BUN_JSC_thresholdForOptimizeAfterWarmUp: "16000",
      BUN_JSC_thresholdForOptimizeSoon: "16000",
      BUN_JSC_numberOfGCMarkers: "1",
    },
    stdout: "inherit",
    stderr: "inherit",
  }));
const codes = await Promise.all(children.map((child) => child.exited));
console.log(`full logic suite: ${files.length} files in ${groups.length} processes, ${(performance.now() - started).toFixed(0)} ms`);
process.exitCode = codes.find((code) => code !== 0) ?? 0;
