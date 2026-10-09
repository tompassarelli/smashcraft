




import "../../../test/host-natives";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { Console, Effect, Schema } from "effect";
import { type Command, UsageFailure, describeCause, flagValues } from "wisp/scripts/wisp/command";
import { captureProcess } from "wisp/scripts/wisp/mapBuild";
import { step } from "wisp/scripts/wisp/timings";
import { type MatchReplayResult, parseReplayHeader, replayMatch } from "../../../src/game/replay/matchReplay";
import { stockLua } from "../luaRuntimes";
import { readReplay } from "../replayFiles";

const ts = join(import.meta.dir, "../../..");
const replayLua = join(ts, "build", "lua-replay", "replay.lua");

class ReplayFailure extends Schema.TaggedError<ReplayFailure>()("ReplayFailure", {
  problem: Schema.String,
}) {
  override get message(): string {
    return this.problem;
  }
}

async function inputsHash(paths: readonly string[]): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  for (const path of paths) {
    hasher.update(path);
    hasher.update(await Bun.file(path).bytes());
  }
  return hasher.digest("hex");
}


async function compileReplayLua(): Promise<void> {
  const sources = ["src", "test/replay"].flatMap((dir) => [...new Bun.Glob(`${dir}/**/*.ts`).scanSync(ts)]).sort().map((path) => join(ts, path));
  const framework = [...new Bun.Glob("src/**/*.{ts,lua}").scanSync(join(ts, "node_modules/wisp"))].map((file) => join(ts, "node_modules/wisp", file));
  const config = join(ts, "tsconfig.lua-replay.json");
  const hash = await inputsHash([...sources, ...framework.sort(), join(ts, "node_modules/wisp/plugins/warcraft-numbers.ts"), config]);
  const stamp = Bun.file(`${replayLua}.inputs`);
  if (await Bun.file(replayLua).exists() && await stamp.exists() && await stamp.text() === hash) return;
  const result = Bun.spawnSync([process.execPath, "--bun", join(ts, "node_modules/typescript-to-lua/dist/tstl.js"), "-p", config], { cwd: ts, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(`${result.stdout.toString()}${result.stderr.toString()}`.trim() || `tstl exit ${result.exitCode}`);
  await Bun.write(stamp, hash);
}


export function parseLuaReport(stdout: string): MatchReplayResult | undefined {
  const lines = stdout.split("\n").filter((line) => line.length > 0);
  const match = /^frames (\d+) reached (\d+) recorded (\d+) checksum (\S*) digests (\d+) divergent (\d+)$/.exec(lines[0] ?? "");
  if (match === null) return undefined;
  return {
    frames: Number(match[1]), reached: Number(match[2]), recorded: Number(match[3]), checksum: match[4] ?? "",
    digests: Number(match[5]), divergent: Number(match[6]),
    problems: lines.slice(1).map((line) => line.replace(/^problem /, "")),
  };
}

const passed = (result: MatchReplayResult) => result.problems.length === 0 && result.reached === result.recorded;

const report = (runtime: string, result: MatchReplayResult) => [
  `${runtime}: ran ${result.frames} frames, reached ${result.reached} of ${result.recorded} recorded checksums${result.digests === 0 ? "" : `, ${result.divergent} of ${result.digests} frame digests divergent`}`,
  ...result.problems.map((problem) => `${runtime}: ${problem}`),
];


export const replayInLua = (file: string, given?: string) => Effect.gen(function*() {
  const lua = given ?? (yield* stockLua.pipe(Effect.mapError((problem) => new ReplayFailure({ problem }))));
  yield* Effect.tryPromise({ try: compileReplayLua, catch: (cause) => new ReplayFailure({ problem: `compiling the Lua replayer: ${describeCause(cause)}` }) }).pipe(step("compile Lua replayer"));
  const { stdout, stderr, exitCode } = yield* captureProcess("replay in 32-bit Lua", file, [lua, replayLua], { env: { ...process.env, REPLAY_FILE: file } }).pipe(
    Effect.mapError((cause) => new ReplayFailure({ problem: describeCause(cause) })),
  );
  const result = parseLuaReport(stdout);
  if (exitCode !== 0 || result === undefined) return yield* new ReplayFailure({ problem: `32-bit Lua stopped: ${stderr.trim() || stdout.trim() || `exit ${exitCode}`}` });
  return result;
});

export const replay: Command = (args) => Effect.gen(function*() {
  const [out, ...extraOut] = flagValues(args, "out");
  const files = args.filter((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--out");
  const file = files[0];
  if (file === undefined || files.length > 1 || extraOut.length > 0 || (args.includes("--out") && out === undefined)) {
    return yield* new UsageFailure({ problem: "replay takes one replay file (a manifest with its parts beside it, or a joined replay) and at most one --out FILE" });
  }
  const lines = readReplay(file);
  if (typeof lines === "string") return yield* new ReplayFailure({ problem: lines });
  const header = parseReplayHeader(lines);
  if (typeof header === "string") return yield* new ReplayFailure({ problem: header });
  const joined = out ?? join(tmpdir(), `smashcraft-replay-${process.pid}-${basename(file)}`);
  yield* Effect.try({
    try: () => {
      if (out !== undefined) mkdirSync(dirname(out), { recursive: true });
      writeFileSync(joined, `${lines.join("\n")}\n`);
    },
    catch: (cause) => new ReplayFailure({ problem: `writing ${joined}: ${describeCause(cause)}` }),
  });
  yield* Console.log(`${basename(file)}: replay ${header.serial}, build ${header.repro.build}, version ${header.version}, ${header.repro.frame} frames`);
  const lua = replayInLua(joined).pipe(step("replay in 32-bit Lua"));
  const bun = Effect.try({ try: () => replayMatch(lines), catch: (cause) => new ReplayFailure({ problem: `the replay stopped in Bun: ${describeCause(cause)}` }) }).pipe(step("replay in Bun"));
  const [luaResult, bunResult] = yield* Effect.all([lua, bun], { concurrency: 2 }).pipe(Effect.ensuring(Effect.sync(() => {
    if (out === undefined) rmSync(joined, { force: true });
  })));
  yield* Console.log([...report("bun", bunResult), ...report("lua32", luaResult)].join("\n"));
  if (out !== undefined) yield* Console.log(`wrote ${out}`);
  if (!passed(bunResult) || !passed(luaResult)) return yield* new ReplayFailure({ problem: "the replay doesn't reach every recorded checksum" });
  yield* Console.log(`Bun and 32-bit Lua reach all ${bunResult.recorded} recorded checksums`);
});
