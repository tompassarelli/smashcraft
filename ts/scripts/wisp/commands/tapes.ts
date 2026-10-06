// `wisp tapes`, the replay acceptance oracle: recorded tapes must give
// identical canonical replay states, hence identical checksums, after every
// frame in TypeScript under Bun and TypeScript under two 32-bit Luas: a
// stock one, whose raw float + - * round to nearest, and one rounding them
// toward zero (scripts/wisp/luaRuntimes.ts). Agreement in both shows no raw
// float + - * leaked past the exact helpers.
// Prints the totals, or each runtime pair's first divergent frame and field.
// smashcraft:ts/scripts/wisp/acceptanceTapes.ts records the tapes fresh
// each run; every runtime then replays the same recorded rows.
// Environment: LUA, a stock LUA_32BITS lua; TOWARD_ZERO_LUA, optional.
import "../../../test/host-natives";
import { join } from "node:path";
import { Console, Effect, Schema } from "effect";
import { decodeTape } from "../../../src/game/replay/tape";
import { runTape } from "../../../src/game/replay/tapeRunner";
import { type Command, UsageFailure, describeCause } from "wisp/scripts/wisp/command";
import { step } from "wisp/scripts/wisp/timings";
import { captureProcess } from "wisp/scripts/wisp/mapBuild";
import { generateTapes } from "../acceptanceTapes";
import { luaRuntimes } from "../luaRuntimes";

const ts = join(import.meta.dir, "../../..");
const build = join(ts, "build", "tapes");

// ---------------------------------------------------------------- runtimes

/** One runtime's records for one tape: "LINE OPERATION RESULT CANONICAL-STATE". */
interface Run {
  readonly records: string[];
  readonly error: string | undefined;
}

function command(argv: string[], cwd = ts): { output: string; error: string | undefined } {
  const result = Bun.spawnSync(argv, { cwd, stdout: "pipe", stderr: "pipe" });
  const stderr = result.stderr.toString().trim();
  return { output: result.stdout.toString(), error: result.exitCode === 0 ? undefined : stderr || `exit ${result.exitCode}` };
}

const recordsOf = (output: string) => output.split("\n").filter(line => line.length > 0);

function runInBun(text: string): Run {
  const decoded = decodeTape(text);
  if (!decoded.ok) return { records: [], error: `line ${decoded.line}: ${decoded.message}` };
  const records: string[] = [];
  const result = runTape(decoded.value, record => records.push(record));
  return { records, error: result.ok ? undefined : `line ${result.line}: ${result.message}` };
}

const lua = process.env.LUA ?? "lua";

async function inputsHash(paths: readonly string[], extra: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(extra);
  for (const path of paths) {
    hasher.update(path);
    hasher.update(await Bun.file(path).bytes());
  }
  return hasher.digest("hex");
}

/** Rebuilds `output` only when the hash of its inputs changed. Returns build seconds, 0 when cached. */
async function cachedBuild(output: string, hash: string, buildIt: () => string | undefined): Promise<number> {
  const stamp = Bun.file(`${output}.inputs`);
  if (await Bun.file(output).exists() && await stamp.exists() && await stamp.text() === hash) return 0;
  const started = performance.now();
  const failure = buildIt();
  if (failure !== undefined) throw new Error(failure);
  await Bun.write(stamp, hash);
  return (performance.now() - started) / 1000;
}

const tapesLua = join(ts, "build", "lua-tapes", "tapes.lua");

async function compileTypeScriptLua(): Promise<number> {
  const sources = ["src", "test/tapes"].flatMap(dir => [...new Bun.Glob(`${dir}/**/*.ts`).scanSync(ts)]).sort().map(path => join(ts, path));
  const config = join(ts, "tsconfig.lua-tapes.json");
  const framework = [...new Bun.Glob("src/**/*.{ts,lua}").scanSync(join(ts, "node_modules/wisp"))]
    .map((file) => join(ts, "node_modules/wisp", file));
  return cachedBuild(tapesLua, await inputsHash([...sources, ...framework,
    join(ts, "node_modules/wisp/plugins/warcraft-numbers.ts"), config], "tstl"), () =>
    command([process.execPath, "--bun", join(ts, "node_modules/typescript-to-lua/dist/tstl.js"), "-p", config]).error);
}

/** Two replay children bound pipe buffers while Bun replays on this thread. */
export const replayInLua = (files: readonly string[], executable = lua) =>
  Effect.forEach(files, (file) =>
    captureProcess("replay in 32-bit Lua", file, [executable, tapesLua], { env: { ...process.env, TAPE_FILE: file } }).pipe(
      Effect.map(({ stdout, stderr, exitCode }): Run => ({
        records: recordsOf(stdout), error: exitCode === 0 ? undefined : stderr.trim() || `exit ${exitCode}`,
      })),
      Effect.mapError((cause) => new TapesFailure({ problem: describeCause(cause) })),
    ), { concurrency: 2 });

// ---------------------------------------------------------------- comparison

type RuntimeName = "bun" | "ts-lua32" | "ts-lua32-toward-zero";
const RUNTIMES: readonly RuntimeName[] = ["bun", "ts-lua32", "ts-lua32-toward-zero"];
const PAIRS: readonly (readonly [RuntimeName, RuntimeName])[] = [["bun", "ts-lua32"], ["bun", "ts-lua32-toward-zero"]];

/** Splits a record into its label ("LINE OPERATION RESULT") and its canonical fields. */
function parseRecord(record: string | undefined): { label: string; fields: string[] } {
  const words = (record ?? "").split(" ");
  return { label: words.slice(0, 3).join(" "), fields: words.slice(3).join(" ").split("|") };
}

/** The first canonical field that differs, with both values, and how many differ. */
function describeDivergence(a: string | undefined, b: string | undefined, names: readonly [RuntimeName, RuntimeName]): string {
  const left = parseRecord(a);
  const right = parseRecord(b);
  if (a === undefined || b === undefined || left.label !== right.label) return `records differ: "${left.label || "none"}" in ${names[0]}, "${right.label || "none"}" in ${names[1]}`;
  let first: string | undefined;
  let count = 0;
  for (let index = 0; index < Math.max(left.fields.length, right.fields.length); index++) {
    if (left.fields[index] === right.fields[index]) continue;
    count++;
    first ??= `${left.fields[index] ?? "(missing)"} in ${names[0]}, ${right.fields[index] ?? "(missing)"} in ${names[1]}`;
  }
  return `${first ?? "no field"} (${count} fields differ)`;
}

// ---------------------------------------------------------------- command

/** The runtimes disagree, one stopped, or the check couldn't run. */
class TapesFailure extends Schema.TaggedError<TapesFailure>()("TapesFailure", {
  problem: Schema.String,
}) {
  override get message(): string {
    return this.problem;
  }
}

const attempt = <A>(what: string, run: () => A | PromiseLike<A>) =>
  Effect.tryPromise({ try: async () => run(), catch: (cause) => new TapesFailure({ problem: `${what}: ${describeCause(cause)}` }) });

/** Executed frames, run on recorded or on predicted rows. */
const isFrame = (operation: string | undefined) => operation === "frame" || operation === "predict";
const frameCount = (run: Run) => run.records.filter(record => isFrame(record.split(" ", 2)[1])).length;

export const tapes: Command = (args) => Effect.gen(function*() {
  if (args.length > 0) return yield* new UsageFailure({ problem: "tapes takes no arguments; set LUA to a 32-bit Lua" });
  const luas = yield* luaRuntimes(ts).pipe(Effect.mapError((problem) => new TapesFailure({ problem })));
  const tapes = yield* attempt("record tapes", async () => {
    await Bun.$`mkdir -p ${build}`;
    const recorded = [...generateTapes()].map(([name, text]) => ({ name, text, file: join(build, `${name}.tape`) }));
    for (const { file, text } of recorded) await Bun.write(file, text);
    return recorded;
  }).pipe(step("record tapes"));
  yield* attempt("compile TypeScript Lua", compileTypeScriptLua).pipe(step("compile TypeScript Lua"));
  // Lua processes start before the in-process Bun runs occupy this thread.
  const files = tapes.map(({ file }) => file);
  const replays = yield* Effect.all({
    "ts-lua32": replayInLua(files, luas.nearest).pipe(step("replay in ts-lua32")),
    "ts-lua32-toward-zero": replayInLua(files, luas.towardZero).pipe(step("replay in ts-lua32-toward-zero")),
    "bun": attempt("replay in Bun", () => tapes.map(({ text }) => runInBun(text))).pipe(step("replay in bun")),
  }, { concurrency: 3 });
  const runs = new Map(tapes.map(({ name }, index): [string, Record<RuntimeName, Run>] => {
    const byRuntime = (runtime: RuntimeName): Run => replays[runtime][index] ?? { records: [], error: "no run" };
    return [name, { bun: byRuntime("bun"), "ts-lua32": byRuntime("ts-lua32"), "ts-lua32-toward-zero": byRuntime("ts-lua32-toward-zero") }];
  }));

  const perTape = [...runs].map(([name, byRuntime]) => `${name} ${frameCount(byRuntime.bun)}`);
  const totalFrames = [...runs.values()].reduce((sum, byRuntime) => sum + frameCount(byRuntime.bun), 0);
  yield* Console.log(`${runs.size} tapes, ${totalFrames} frames (${perTape.join(", ")})`);

  let failed = false;
  for (const [name, byRuntime] of runs) {
    for (const runtime of RUNTIMES) {
      const { error } = byRuntime[runtime];
      if (error === undefined) continue;
      failed = true;
      yield* Console.log(`${runtime} stopped on ${name}: ${error.split("\n").slice(0, 3).join(" | ")}`);
    }
  }
  for (const pair of PAIRS) {
    let divergentFrames = 0;
    let divergentOther = 0;
    let first: string | undefined;
    for (const [name, byRuntime] of runs) {
      const a = byRuntime[pair[0]].records;
      const b = byRuntime[pair[1]].records;
      for (let index = 0; index < Math.max(a.length, b.length); index++) {
        if (a[index] === b[index]) continue;
        const { label } = parseRecord(a[index] ?? b[index]);
        if (isFrame(label.split(" ")[1])) divergentFrames++;
        else divergentOther++;
        first ??= `${name} line ${label}: ${describeDivergence(a[index], b[index], pair)}`;
      }
    }
    if (first !== undefined) failed = true;
    const other = divergentOther > 0 ? ` and ${divergentOther} other records` : "";
    yield* Console.log(`${pair.join("/")}: ${divergentFrames} divergent frames${other}${first === undefined ? "" : `; first at ${first}`}`);
  }
  if (failed) return yield* new TapesFailure({ problem: "the runtimes disagree or one stopped" });
});
