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
// gets its own process. The registry and the remaining files run in shards so
// that no single process holds the suite's critical path.
const game = "test/game.test.ts";
const isolated = ["test/desync-guard.test.ts", "test/desync-guard-integrity.test.ts", "test/visual-lifecycle.test.ts", "test/stack-trace.test.ts"];
const GAME_SHARDS = 2;
const REST_SHARDS = 2;
const rest = files.filter((file) => file !== game && !isolated.includes(file));
const groups: { readonly files: readonly string[]; readonly env?: Record<string, string> }[] = [
  ...(files.includes(game) ? Array.from({ length: GAME_SHARDS }, (_, shard) => ({ files: [game], env: { GAME_TEST_SHARD: `${shard}/${GAME_SHARDS}` } })) : []),
  ...isolated.filter((file) => files.includes(file)).map((file) => ({ files: [file] })),
  ...Array.from({ length: REST_SHARDS }, (_, shard) => ({ files: rest.filter((_, index) => index % REST_SHARDS === shard) })),
].filter((group) => group.files.length > 0);
const started = performance.now();
const children = groups.map((group) =>
  Bun.spawn([process.execPath, "test", ...group.files.map((file) => resolve(project, file))], {
    cwd: project,
    // These short-lived workers cannot amortize the highest JIT tier's compile work.
    env: { ...process.env, ...group.env, BUN_JSC_useFTLJIT: "false", BUN_JSC_numberOfDFGCompilerThreads: "1" },
    stdout: "inherit",
    stderr: "inherit",
  }));
const codes = await Promise.all(children.map((child) => child.exited));
console.log(`full logic suite: ${files.length} files in ${groups.length} processes, ${(performance.now() - started).toFixed(0)} ms`);
process.exitCode = codes.find((code) => code !== 0) ?? 0;
