import { join } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Console, Effect, Schema, Stream } from "effect";
import { ChildProcess } from "effect/process";
import { mapCompiler, report } from "wisp/scripts/compiler";
import { type Command, describeCause } from "wisp/scripts/wisp/command";
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

// test/handle-baseline.test.ts's match and rematch on the compiled integrity build in 32-bit Lua: too many
// instructions for the Lua test suite's per-test ceiling, so it runs here (#409).
export const soakHandles: Command = () => Effect.gen(function*() {
  const integrity = buildProject("integrity");
  yield* compile(integrity.configPath).pipe(step("compile the integrity build"));
  yield* compile(join(tsDirectory, "tsconfig.handles.json")).pipe(step("compile the handle baseline"));
  const lua = yield* stockLua.pipe(Effect.mapError((problem) => new HandleSoakFailure({ problem })));
  const declarations = join(tsDirectory, "node_modules/wisp/src/natives/warcraft.d.ts");
  const [output, code] = yield* Effect.scoped(Effect.gen(function*() {
    const child = yield* ChildProcess.make(lua, [join(tsDirectory, "build/handles.lua"), integrity.bundlePath, declarations], { stdin: "ignore", stderr: "inherit" });
    return yield* Effect.all([Stream.mkString(Stream.decodeText(child.stdout)), child.exitCode], { concurrency: "unbounded" });
  })).pipe(
    Effect.catchTag("PlatformError", (cause) => Effect.fail(new HandleSoakFailure({ problem: `the handle baseline in ${lua}: ${cause.message}` }))),
    Effect.provide(BunServices.layer),
    step("a match and its rematch in 32-bit Lua"),
  );
  yield* Console.log(output.trimEnd());
  if (code !== 0 || !output.includes("done problems=0")) return yield* new HandleSoakFailure({ problem: `live handles differ after the rematch (${lua} exited ${code})` });
});
