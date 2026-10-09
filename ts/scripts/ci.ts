






import { resolve } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Cause, Effect, Exit, Schema } from "effect";
import { ChildProcess } from "effect/process";

const project = resolve(import.meta.dir, "..");
const bun = process.execPath;

const TIMED_ATTEMPTS = 3;
const gateTiming = process.env.CI_TIMING !== "report";


class CheckFailure extends Schema.TaggedError<CheckFailure>()("CheckFailure", { problem: Schema.String, exitCode: Schema.Int }) {
  override get message(): string {
    return this.problem;
  }
}

const check = (
  name: string,
  args: readonly string[],
  targetMs?: number,
  env: Record<string, string | undefined> = process.env,
) => Effect.gen(function*() {
  const samples: number[] = [];

  const sample = Effect.scoped(Effect.gen(function*() {
    const started = performance.now();
    const child = yield* ChildProcess.make(bun, args, { cwd: project, env, stdin: "ignore", stdout: "inherit", stderr: "inherit" });
    const exitCode = yield* child.exitCode;
    const elapsedMs = performance.now() - started;
    samples.push(elapsedMs);
    console.log(`${name}: ${elapsedMs.toFixed(0)} ms`);
    if (exitCode !== 0) return yield* new CheckFailure({ problem: `${name} failed with exit code ${exitCode}`, exitCode });
    return elapsedMs;
  })).pipe(Effect.catchTag("PlatformError", (cause) => Effect.fail(new CheckFailure({ problem: `${name}: ${cause.message}`, exitCode: 1 }))));
  const overTarget = (elapsedMs: number) => targetMs !== undefined && elapsedMs > targetMs;

  const last = yield* Effect.repeat(sample, { while: elapsedMs => gateTiming && overTarget(elapsedMs), times: TIMED_ATTEMPTS - 1 });
  if (!overTarget(last)) return;
  const summary = `${name} exceeded ${targetMs} ms in ${samples.length} samples: ${samples.map((ms) => ms.toFixed(0)).join(", ")} ms`;
  if (!gateTiming) {
    console.log(`${summary} (reported, not gated: CI_TIMING=report)`);
    return;
  }
  return yield* new CheckFailure({ problem: summary, exitCode: 1 });
});

const checks = [
  check("type-check edit-loop and dependency validation", ["scripts/typecheck-benchmark.ts"]),
  check(
    "focused logic test (target ≤0.1 s)",
    ["test", "test/game.test.ts"],
    100,
    { ...process.env, GAME_TESTS: "sim/meleeScalarMath" },
  ),
  check("full logic suite (target ≤5 s)", ["run", "test"], 5000),
  check(
    "compiler affected-module and output-equivalence checks",
    ["scripts/compiler-benchmark.ts"],
    undefined,
    { ...process.env, COMPILER_TIMINGS: "1" },
  ),
];


const program = Effect.gen(function*() {
  const failures: CheckFailure[] = [];
  for (const run of checks) {
    const outcome = yield* Effect.flip(run).pipe(Effect.option);
    if (outcome._tag === "Some") {
      console.error(outcome.value.problem);
      failures.push(outcome.value);
    }
  }
  return failures[0]?.exitCode ?? 0;
});


BunRuntime.runMain(program.pipe(Effect.provide(BunServices.layer)), {
  disableErrorReporting: true,
  teardown: (exit) => {
    if (Exit.isFailure(exit) && !Cause.hasInterruptsOnly(exit.cause)) console.error(Cause.pretty(exit.cause));
    process.exit(Exit.isSuccess(exit) ? Number(exit.value) : Cause.hasInterruptsOnly(exit.cause) ? 130 : 1);
  },
});
