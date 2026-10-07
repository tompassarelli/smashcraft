// `bun wisp soak memory [--minutes N] [--out FILE]` (#168): the playable
// build's memory soak in 32-bit Lua (scripts/wisp/memoryLua.ts), match after
// match with every fighter and stage, then the slope check
// (scripts/wisp/memorySoak.ts): fails when the Lua heap, live Warcraft handles
// or what the maps' globals reach grow after warm-up.
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { Console, Effect, Schema } from "effect";
import { mapCompiler, report } from "wisp/scripts/compiler";
import { type Command, UsageFailure, describeCause, flagValues } from "wisp/scripts/wisp/command";
import { step } from "wisp/scripts/wisp/timings";
import { MEMORY_LIMITS, checkMemory, parseMemoryRun } from "../memorySoak";
import { buildProject, tsDirectory } from "../project";

class MemorySoakFailure extends Schema.TaggedError<MemorySoakFailure>()("MemorySoakFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

/** #168's soak: 30 game minutes. */
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
  if (!Number.isInteger(minutes) || minutes < MEMORY_LIMITS.warmupMinutes + 3 || minutes > MAX_MINUTES) {
    return yield* new UsageFailure({ problem: `soak memory --minutes takes ${MEMORY_LIMITS.warmupMinutes + 3} to ${MAX_MINUTES} game minutes: ${MEMORY_LIMITS.warmupMinutes} of warm-up, then the check` });
  }
  const playable = buildProject("playable");
  yield* compile(playable.configPath).pipe(step("compile the playable build"));
  yield* compile(join(tsDirectory, "tsconfig.memory.json")).pipe(step("compile the memory soak"));
  const lua = process.env.LUA ?? "lua";
  const declarations = join(tsDirectory, "node_modules/wisp/src/natives/warcraft.d.ts");
  const text = yield* Effect.tryPromise({
    try: async () => {
      const child = Bun.spawn([lua, join(tsDirectory, "build/memory.lua"), playable.bundlePath, declarations, String(minutes)], { stdout: "pipe", stderr: "pipe" });
      let output = "";
      const decoder = new TextDecoder();
      for await (const chunk of child.stdout) {
        const piece = decoder.decode(chunk, { stream: true });
        output += piece;
        // A line a game minute, so a long run shows it is moving.
        for (const line of piece.split("\n")) if (line.startsWith("sample kind=minute")) console.error(line.split(" | ")[0]);
      }
      const [stderr, code] = await Promise.all([new Response(child.stderr).text(), child.exited]);
      if (code !== 0 && !output.includes("\ndone ")) throw new Error(`${lua} exited ${code}: ${stderr.trim()}`);
      return output;
    },
    catch: (cause) => new MemorySoakFailure({ problem: `the memory soak in ${lua}: ${describeCause(cause)}` }),
  }).pipe(step(`${minutes} game minutes in 32-bit Lua`));
  mkdirSync(dirname(out), { recursive: true });
  yield* Effect.promise(() => Bun.write(out, text));
  const run = yield* Effect.try({ try: () => parseMemoryRun(text), catch: (cause) => new MemorySoakFailure({ problem: `${out}: ${describeCause(cause)}` }) });
  const verdict = checkMemory(run);
  yield* Console.log([...verdict.lines, `samples: ${out}`].join("\n"));
  if (verdict.failures.length > 0) return yield* new MemorySoakFailure({ problem: `memory grows after warm-up:\n${verdict.failures.join("\n")}` });
  yield* Console.log("memory flat after warm-up");
});
