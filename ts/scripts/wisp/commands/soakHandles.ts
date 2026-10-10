import { join } from "node:path";
import { parseArgs } from "node:util";
import { BunServices } from "@effect/platform-bun";
import { Console, Effect, Schema, Stream } from "effect";
import { ChildProcess } from "effect/process";
import { mapCompiler, report } from "wisp/scripts/compiler";
import { type Command, UsageFailure, describeCause } from "wisp/scripts/wisp/command";
import { step } from "wisp/scripts/wisp/timings";
import { stockLua } from "../luaRuntimes";
import { buildProject, tsDirectory } from "../project";

class HandleSoakFailure extends Schema.TaggedError<HandleSoakFailure>()("HandleSoakFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

const compile = (config: string) => Effect.try({
  try: () => report(mapCompiler(config)()),
  catch: (cause) => new HandleSoakFailure({ problem: `compiling ${config}: ${describeCause(cause)}` }),
}).pipe(Effect.flatMap((problems) => (problems === "" ? Effect.void : Effect.fail(new HandleSoakFailure({ problem: problems })))));

const run = (name: string, command: string, args: readonly string[]) => Effect.scoped(Effect.gen(function*() {
  const child = yield* ChildProcess.make(command, [...args], { cwd: tsDirectory, stdin: "ignore", stderr: "inherit" });
  const [output, code] = yield* Effect.all([Stream.mkString(Stream.decodeText(child.stdout)), child.exitCode], { concurrency: "unbounded" });
  return { name, output, code };
})).pipe(
  Effect.catchTag("PlatformError", (cause) => Effect.fail(new HandleSoakFailure({ problem: `${name}: ${cause.message}` }))),
  Effect.provide(BunServices.layer),
  step(name),
);

// handleBaseline.ts's LOOKS and SOAK_MATCHES; that module is map code, so the host command restates them.
const LOOKS = ["classic", "definitive"] as const;
const SOAK_MATCHES = 21;

// smashcraft:ts/scripts/wisp/handleBaseline.ts's scenario, the first match and 20 rematches in each look, in Bun and on the
// compiled integrity build in 32-bit Lua: over the suites' per-test ceilings, so it runs here (#409).
export const soakHandles: Command = (args) => Effect.gen(function*() {
  const parsed = yield* Effect.try({
    try: () => parseArgs({ args: [...args], options: { rematches: { type: "string" } }, strict: true }).values,
    catch: (cause) => new UsageFailure({ problem: describeCause(cause) }),
  });
  const matches = parsed.rematches === undefined ? SOAK_MATCHES : Number(parsed.rematches) + 1;
  if (!Number.isInteger(matches) || matches < 2) return yield* new UsageFailure({ problem: "--rematches takes a whole number of at least 1" });
  const integrity = buildProject("integrity");
  yield* compile(integrity.configPath).pipe(step("compile the integrity build"));
  yield* compile(join(tsDirectory, "tsconfig.handles.json")).pipe(step("compile the handle baseline"));
  const lua = yield* stockLua.pipe(Effect.mapError((problem) => new HandleSoakFailure({ problem })));
  const declarations = join(tsDirectory, "node_modules/wisp/src/natives/warcraft.d.ts");
  const rematches = `${matches - 1} rematches`;
  const runs = yield* Effect.all(LOOKS.flatMap((look) => [
    run(`${look} in Bun, ${rematches}`, process.execPath, [join(tsDirectory, "test/soak/handles.ts"), look, String(matches)]),
    run(`${look} in 32-bit Lua, ${rematches}`, lua, [join(tsDirectory, "build/handles.lua"), integrity.bundlePath, declarations, look, String(matches)]),
  ]), { concurrency: "unbounded" });
  const failed: string[] = [];
  for (const { name, output, code } of runs) {
    yield* Console.log(`${name}:\n${output.trimEnd()}`);
    if (code !== 0 || !output.includes("done problems=0")) failed.push(`${name} (exited ${code})`);
  }
  if (failed.length > 0) return yield* new HandleSoakFailure({ problem: `live handles left their menu baseline: ${failed.join(", ")}` });
});
