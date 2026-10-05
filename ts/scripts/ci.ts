// CI reports and gates the measured development loops; it runs each check and
// returns the first child failure so one slow check cannot hide later results.
import { resolve } from "node:path";

const project = resolve(import.meta.dir, "..");
const bun = process.execPath;
let failureExitCode = 0;

async function check(
  name: string,
  args: readonly string[],
  targetMs?: number,
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  const started = performance.now();
  const child = Bun.spawn([bun, ...args], { cwd: project, env, stdout: "inherit", stderr: "inherit" });
  const exitCode = await child.exited;
  const elapsedMs = performance.now() - started;
  console.log(`${name}: ${elapsedMs.toFixed(0)} ms`);
  if (exitCode !== 0) {
    console.error(`${name} failed with exit code ${exitCode}`);
    if (failureExitCode === 0) failureExitCode = exitCode;
  }
  if (targetMs !== undefined && elapsedMs > targetMs) {
    console.error(`${name} exceeded ${targetMs} ms`);
    if (failureExitCode === 0) failureExitCode = 1;
  }
}

await check("type-check edit-loop and dependency validation", ["scripts/typecheck-benchmark.ts"]);
await check(
  "focused logic test (target ≤0.1 s)",
  ["test", "test/game.test.ts"],
  100,
  { ...process.env, GAME_TESTS: "sim/meleeScalarMath" },
);
await check("fake-client hot-reload and fresh-match protocol", ["test", "test/waygate.test.ts", "-t", "fake client"]);
await check("full logic suite (target ≤3 s)", ["run", "test"], 3000);
await check(
  "compiler affected-module and output-equivalence checks",
  ["scripts/compiler-benchmark.ts"],
  undefined,
  { ...process.env, COMPILER_TIMINGS: "1" },
);
if (failureExitCode !== 0) process.exit(failureExitCode);
