




import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Console, Effect, Schema, Stream } from "effect";
import { ChildProcess } from "effect/process";
import { mapCompiler, report } from "wisp/scripts/compiler";
import { type Command, UsageFailure, describeCause, flagValues } from "wisp/scripts/wisp/command";
import { step } from "wisp/scripts/wisp/timings";
import { MEMORY_LIMITS, checkMemory, parseMemoryRun } from "../memorySoak";
import { stockLua } from "../luaRuntimes";
import { buildProject, tsDirectory } from "../project";

class MemorySoakFailure extends Schema.TaggedError<MemorySoakFailure>()("MemorySoakFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}


const DEFAULT_MINUTES = 30;
const MAX_MINUTES = 120;

const compile = (config: string) => Effect.try({
  try: () => report(mapCompiler(config)()),
  catch: (cause) => new MemorySoakFailure({ problem: `compiling ${config}: ${describeCause(cause)}` }),
}).pipe(Effect.flatMap((problems) => (problems === "" ? Effect.void : Effect.fail(new MemorySoakFailure({ problem: problems })))));

export const soakMemory: Command = (args) => Effect.gen(function*() {
  const [minutesText = String(DEFAULT_MINUTES)] = flagValues(args, "minutes");
  const [out = join(tsDirectory, "build/memory-soak.txt")] = flagValues(args, "out");
  const minutes = Number(minutesText);
  const [matchesText] = flagValues(args, "matches");
  const [givenBundle] = flagValues(args, "bundle");
  const matches = matchesText === undefined ? undefined : Number(matchesText);
  const [firstText = "0"] = flagValues(args, "first");
  const first = Number(firstText);
  if (!Number.isInteger(first) || first < 0 || first > 2000) return yield* new UsageFailure({ problem: "soak memory --first takes a lineup from 0 to 2000" });
  if (matches !== undefined && (!Number.isInteger(matches) || matches < 1 || matches > 2000)) return yield* new UsageFailure({ problem: "soak memory --matches takes 1 to 2000 all-computer matches" });
  if (!Number.isInteger(minutes) || minutes < MEMORY_LIMITS.warmupMinutes + 3 || minutes > MAX_MINUTES) {
    return yield* new UsageFailure({ problem: `soak memory --minutes takes ${MEMORY_LIMITS.warmupMinutes + 3} to ${MAX_MINUTES} game minutes: ${MEMORY_LIMITS.warmupMinutes} of warm-up, then the check` });
  }
  const playable = buildProject("playable");
  if (givenBundle === undefined) yield* compile(playable.configPath).pipe(step("compile the playable build"));
  yield* compile(join(tsDirectory, "tsconfig.memory.json")).pipe(step("compile the memory soak"));
  const lua = yield* stockLua.pipe(Effect.mapError((problem) => new MemorySoakFailure({ problem })));
  const declarations = join(tsDirectory, "node_modules/wisp/src/natives/warcraft.d.ts");

  const text = yield* Effect.scoped(Effect.gen(function*() {
    const child = yield* ChildProcess.make(lua, [join(tsDirectory, "build/memory.lua"), givenBundle ?? playable.bundlePath, declarations, String(minutes), ...(matches === undefined ? [] : [String(matches), String(first)])], { stdin: "ignore" });
    const [output, stderr, code] = yield* Effect.all([
      child.stdout.pipe(
        Stream.decodeText,

        Stream.tap((piece) => Effect.sync(() => {
          for (const line of piece.split("\n")) if (line.startsWith("sample kind=minute") || line.startsWith("release match=")) console.error(line.split(" | ")[0]);
        })),
        Stream.mkString,
      ),
      Stream.mkString(Stream.decodeText(child.stderr)),
      child.exitCode,
    ], { concurrency: "unbounded" });
    if (code !== 0 && !output.includes("\ndone ")) return yield* new MemorySoakFailure({ problem: `the memory soak in ${lua}: ${lua} exited ${code}: ${stderr.trim()}` });
    return output;
  })).pipe(
    Effect.catchTag("PlatformError", (cause) => Effect.fail(new MemorySoakFailure({ problem: `the memory soak in ${lua}: ${cause.message}` }))),
    Effect.provide(BunServices.layer),
    step(matches === undefined ? `${minutes} game minutes in 32-bit Lua` : `${matches} computer matches in 32-bit Lua`),
  );
  yield* Effect.tryPromise({
    try: async () => {
      mkdirSync(dirname(out), { recursive: true });
      await Bun.write(out, text);
    },
    catch: (cause) => new MemorySoakFailure({ problem: `writing ${out}: ${describeCause(cause)}` }),
  });
  if (matches !== undefined) {
    const passed = text.includes(`release matches=${matches} crashes=0 desyncs=0`) && text.includes(`matches=${matches} problems=0`);
    yield* Console.log(text.trimEnd());
    if (!passed) return yield* new MemorySoakFailure({ problem: `release match gate failed; samples: ${out}` });
    return;
  }
  const run = yield* Effect.try({ try: () => parseMemoryRun(text), catch: (cause) => new MemorySoakFailure({ problem: `${out}: ${describeCause(cause)}` }) });
  const verdict = checkMemory(run);
  yield* Console.log([...verdict.lines, `samples: ${out}`].join("\n"));
  if (verdict.failures.length > 0) return yield* new MemorySoakFailure({ problem: `memory grows after warm-up:\n${verdict.failures.join("\n")}` });
  yield* Console.log("memory flat after warm-up");
});
