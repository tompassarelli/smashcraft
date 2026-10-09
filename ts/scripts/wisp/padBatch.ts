













import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { Cause, Context, Deferred, Effect, Exit, Fiber, Layer, Option, Schedule, Schema, Scope } from "effect";
import { BunServices } from "@effect/platform-bun";
import { ChildProcess } from "effect/process";
import { spawnLogged } from "wisp/scripts/wisp/hostProcess";
import { preloadLines } from "wisp/scripts/wisp/boundary";
import { UsageFailure, describeCause } from "wisp/scripts/wisp/command";
import { loadClients } from "wisp/scripts/warcraft/desktop";
import { HotReload } from "wisp/scripts/wisp/hotReload";
import { MapBuild } from "wisp/scripts/wisp/mapBuild";
import { readyAfter } from "./commands/fresh";
import { captureLoad, requireCaptureLease, timingCheck } from "./captureCapacity";
import { buildProject, gameFilesLayer, sourceErrorsLayer } from "./project";
import { INTEGRITY_BUILD } from "../../src/game/shell/currentBuild";
import { RESET_COMMAND } from "../../src/game/shell/devSettings";
import { devCommandReceiptFile } from "../../src/runtime/gameFiles";
import { IntegrityFailure } from "../integrity/evidence";
import { pollUntil } from "../hostPoll";
import { monotonicNs } from "../integrity/linux";
import { compareRuns, comparisonSteps, scriptChat } from "../integrity/padParity";
import { parsePadScript } from "../integrity/padScript";
import { onHealthyClients } from "./doctor";
import { type PadOptions, type NativeSession, headlessScript, headlessSession, nativeChat, nativeScript, nativeSession } from "./commands/pad";


export interface PadPair {
  readonly name: string;

  readonly clients: string;
  readonly appIds: ReadonlyMap<string, string>;

  readonly lan?: number;
}


export const LAN_POOL_FILE = join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"), "wisp/lan/pool.json");

const LanPool = Schema.Struct({ pairs: Schema.Array(Schema.Struct({ id: Schema.Finite, clients: Schema.String, appIds: Schema.optional(Schema.Record(Schema.String, Schema.String)) })) });





export function lanPairs(poolFile: string, select: { readonly count: number } | { readonly ids: readonly number[] }): PadPair[] {
  const pool = Schema.decodeSync(Schema.fromJsonString(LanPool))(readFileSync(poolFile, "utf8"));
  const parsed = pool.pairs.map((pair): PadPair => ({ name: `lan-${pair.id}`, clients: pair.clients, appIds: new Map(Object.entries(pair.appIds ?? {})), lan: pair.id }));
  if ("ids" in select) {
    const missing = select.ids.filter((id) => !parsed.some((pair) => pair.lan === id));
    if (missing.length > 0) throw new Error(`${poolFile} has no pair ${missing.join(", ")}; \`bun wisp lan status\` lists the pairs that are up`);
    return parsed.filter((pair) => pair.lan !== undefined && select.ids.includes(pair.lan));
  }
  if (parsed.length < select.count) throw new Error(`${poolFile} lists ${parsed.length} pairs, --pairs asks for ${select.count}; start them with \`bun wisp lan pool --pairs ${select.count}\``);
  return parsed.slice(0, select.count);
}

const ToolsOnly = Schema.Struct({ tools: Schema.Record(Schema.String, Schema.String) });





export function withTools(pair: PadPair, toolsFrom: string, dir: string): PadPair {
  const clients = Schema.decodeSync(Schema.fromJsonString(Schema.Unknown))(readFileSync(pair.clients, "utf8"));
  if (typeof clients === "object" && clients !== null && "tools" in clients) return pair;
  const { tools } = Schema.decodeSync(Schema.fromJsonString(ToolsOnly))(readFileSync(toolsFrom, "utf8"));
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${pair.name}-clients.json`);
  writeFileSync(path, `${JSON.stringify({ ...(typeof clients === "object" ? clients : {}), tools }, null, 2)}\n`);
  return { ...pair, clients: path };
}


export function batchScripts(paths: readonly string[]): string[] {
  return paths.flatMap((path) => statSync(path).isDirectory()
    ? readdirSync(path).filter((name) => name.endsWith(".pad")).sort().map((name) => join(path, name))
    : [path]);
}







function needsNewGame(previous: "none" | "valid" | "failed" | "invalid" | "broken", freshEach: boolean): boolean {
  return freshEach || previous === "none" || previous === "invalid" || previous === "broken";
}

const seconds = (since: number) => (performance.now() - since) / 1000;

const wispProgram = join(import.meta.dir, "../wisp.ts");

export class BatchProcessFailure extends Schema.TaggedError<BatchProcessFailure>()("BatchProcessFailure", {
  command: Schema.String, log: Schema.String, code: Schema.Int, problem: Schema.String,
}) {
  override get message(): string { return `${this.command} ${this.problem}; see ${this.log}`; }
}

class BatchRetry extends Schema.TaggedError<BatchRetry>()("BatchRetry", { script: Schema.String }) {}


export const runBatchProcess = (command: string, args: readonly string[], log: string) => Effect.scoped(Effect.gen(function*() {
  const { handle, written } = yield* spawnLogged(ChildProcess.make(command, args, { cwd: join(import.meta.dir, "../.."), stdin: "ignore", forceKillAfter: "1 second" }), { stdout: log, stderr: `${log}.err` });
  const code = yield* handle.exitCode;
  yield* written;
  if (code !== 0) return yield* new BatchProcessFailure({ command, log, code, problem: `exited ${code}` });
})).pipe(
  Effect.catchTag("PlatformError", (cause) => Effect.fail(new BatchProcessFailure({ command, log, code: 1, problem: cause.message }))),
  Effect.provide(BunServices.layer),
);

const wisp = (args: readonly string[], log: string) => runBatchProcess(process.execPath, [wispProgram, ...args], log);


const newGame = (pair: PadPair, map: string, log: string) => Effect.gen(function*() {
  const args = pair.lan === undefined ? ["fresh", map, "--no-quick", "--clients-file", pair.clients] : ["lan", "fresh", map, "--pair", String(pair.lan)];
  let attempt = 0;
  yield* Effect.suspend(() => Effect.gen(function*() {
    const started = Date.now();
    yield* wisp(args, `${log}.${attempt++}`);
    const clients = yield* loadClients(pair.clients).pipe(Effect.mapError((cause) => new IntegrityFailure({ operation: "binding-ready clients", path: pair.name, cause })));
    yield* Effect.forEach(clients, (client) => readyAfter(client, started), { concurrency: "unbounded" }).pipe(Effect.provide(gameFilesLayer), Effect.mapError((cause) => new IntegrityFailure({ operation: "binding-ready receipt", path: pair.name, cause })));
  })).pipe(Effect.retry({ schedule: Schedule.recurs(1), while: (failure) => failure._tag === "BatchProcessFailure" }), Effect.mapError((cause) => new IntegrityFailure({ operation: "start a new game", path: map, cause })));
});



const atSelection = (receipts: readonly string[], sinceMs: number) => Effect.gen(function*() {
  const reset = (path: string) => existsSync(path) && statSync(path).mtimeMs >= sinceMs
    && (preloadLines(readFileSync(path, "latin1")) ?? []).some((line) => line.startsWith("SETUP phase=0 "));
  yield* pollUntil(Effect.try({ try: () => receipts.every(reset) ? true : undefined, catch: (cause) => new IntegrityFailure({ operation: "reset", path: receipts.join(", "), cause }) }), { every: "50 millis", within: "8 seconds", orElse: () => Effect.fail(new IntegrityFailure({ operation: "reset", path: receipts.join(", "), cause: `no fighter-selection receipt from every client within 8 s of ${RESET_COMMAND}` })) });
});


const reset = (session: NativeSession, build: string) => Effect.gen(function*() {
  const typedMs = Date.now();
  const received = yield* nativeChat(session, RESET_COMMAND);
  yield* atSelection(session.data.map((dir, slot) => join(dir, devCommandReceiptFile(build, slot))), typedMs);
  return { command: RESET_COMMAND, clients: received, confirmed_monotonic_ns: monotonicNs() };
});


const hotServices = Layer.build(MapBuild.layer(buildProject("integrity")).pipe(Layer.provideMerge(sourceErrorsLayer), Layer.provideMerge(gameFilesLayer)));


const hotReloader = (services: Effect.Success<typeof hotServices>, data: readonly [string, string]) =>
  Layer.build(HotReload.layer(data, "smashcraft").pipe(Layer.provide(Layer.succeedContext(services)))).pipe(Effect.map((context) => Context.get(context, HotReload)));

export interface BatchOptions {
  readonly scripts: readonly string[];
  readonly helper: string;
  readonly build: string;
  readonly out: string;

  readonly headlessJobs: number;

  readonly retries: number;
}

export interface NativeBatchOptions extends BatchOptions {
  readonly pairs: readonly PadPair[];
  readonly map: string;
  readonly freshEach: boolean;

  readonly hot: boolean;
}


interface ScriptReport {
  readonly label: string;
  readonly script: string;
  readonly pair: string;
  game: number;
  reset: number;

  reload: number;

  run: number;
  attempts: number;
  headless: number;

  waited: number;
  compare: number;
  verdict: "PASS" | "FAIL" | "INVALID";
  summary: string;
}

interface ScriptRun {
  readonly script: string;
  readonly text: string;
  readonly steps: ReturnType<typeof parsePadScript>;
  readonly chat: string;
  readonly label: string;
  readonly dir: string;
}

const label = (script: string, taken: Set<string>) => {
  const base = basename(script, ".pad");
  let name = base;
  for (let index = 2; taken.has(name); index++) name = `${base}-${index}`;
  taken.add(name);
  return name;
};






const prepare = (options: BatchOptions, native = false) => Effect.gen(function*() {
  const batchScope = yield* Effect.scope;
  const taken = new Set<string>();
  const runs = yield* Effect.try({
    try: () => options.scripts.map((script): ScriptRun => {
      const text = readFileSync(script, "utf8");
      const chat = scriptChat(text);
      if (chat === undefined) throw new Error(`${script} has no \`#! chat\` line: a batch starts each match with its script's command`);
      const steps = comparisonSteps(text, script);
      const name = label(script, taken);
      const dir = join(options.out, name);
      mkdirSync(dir, { recursive: true });
      return { script, text, steps, chat, label: name, dir };
    }),
    catch: (cause) => new UsageFailure({ problem: describeCause(cause) }),
  });
  if (native) yield* requireCaptureLease(timingCheck(runs.map(({ steps }) => steps)));


  const references = new Map<string, Deferred.Deferred<{ code: number; seconds: number; ended: number }, IntegrityFailure>>();
  for (const run of runs) references.set(run.label, yield* Deferred.make<{ code: number; seconds: number; ended: number }, IntegrityFailure>());
  yield* Effect.forkScoped(Effect.forEach(runs, (run) => Effect.gen(function*() {
    const at = performance.now();
    let attempt = 0;
    const result = yield* Effect.exit(Effect.suspend(() => Effect.gen(function*() {
      const current = attempt++;
      yield* Effect.try({ try: () => { if (current > 0 && existsSync(join(run.dir, "headless"))) renameSync(join(run.dir, "headless"), join(run.dir, `headless-invalid-${current - 1}`)); }, catch: (cause) => new IntegrityFailure({ operation: "archive reference", path: run.dir, cause }) });
      yield* wisp(["pad", run.script, "--headless", "--helper", options.helper, "--out", join(run.dir, "headless"), `--chat=${run.chat}`], join(run.dir, current === 0 ? "headless.log" : `headless-${current}.log`));
      return 0;
    })).pipe(Effect.retry({ schedule: Schedule.recurs(2), while: (failure) => failure._tag === "BatchProcessFailure" }), Effect.catchTag("BatchProcessFailure", (failure) => Effect.succeed(failure.code)), Effect.map((code) => ({ code, seconds: seconds(at), ended: performance.now() }))));
    const reference = references.get(run.label);
    if (reference !== undefined) yield* Deferred.done(reference, result);
  }), { concurrency: options.headlessJobs, discard: true }));
  const reports: ScriptReport[] = [];
  const compares: Fiber.Fiber<void, IntegrityFailure>[] = [];
  const report = (run: ScriptRun, pair: string): ScriptReport => {
    const made: ScriptReport = { label: run.label, script: run.script, pair, game: 0, reset: 0, reload: 0, run: 0, attempts: 0, headless: 0, waited: 0, compare: 0, verdict: "INVALID", summary: "" };
    reports.push(made);
    return made;
  };

  const compareLater = (run: ScriptRun, made: ScriptReport, side: string, valid: boolean) => Effect.gen(function*() {
    const ended = performance.now();
    compares.push(yield* Effect.forkScoped(Effect.gen(function*() {
      const ready = references.get(run.label);
      const reference = ready === undefined ? { code: 1, seconds: 0, ended } : yield* Deferred.await(ready);
      made.headless = reference.seconds;
      made.waited = Math.max(0, (reference.ended - ended) / 1000);
      const at = performance.now();
      yield* Effect.try({ try: () => {
        const parity = compareRuns(side, join(run.dir, "headless"), run.text);
        writeFileSync(join(run.dir, "compare.log"), `${parity.lines.join("\n")}\n`);
        made.verdict = parity.passed && valid ? "PASS" : parity.invalid === true ? "INVALID" : "FAIL";
        made.summary = parity.lines.slice(-2).join(" ");
      }, catch: (cause) => new IntegrityFailure({ operation: "compare batch", path: side, cause }) }).pipe(Effect.catch((failure) => Effect.sync(() => {
        made.verdict = "FAIL";
        made.summary = `compare failed: ${describeCause(failure.cause)} (reference exit ${reference.code}, ${join(run.dir, "headless.log")})`;
      })));
      made.compare = seconds(at);
    })).pipe(Scope.provide(batchScope)));
  });
  return { runs, report, compareLater, reports, compares };
});


const summarize = (out: string, runs: readonly ScriptRun[], reports: ScriptReport[], pairs: readonly string[], started: number, extra: Record<string, unknown>) => Effect.gen(function*() {
  const total = seconds(started);
  const order = new Map(runs.map((run, index) => [run.label, index]));
  reports.sort((a, b) => (order.get(a.label) ?? 0) - (order.get(b.label) ?? 0));
  const f = (value: number) => value.toFixed(1);
  const header = ["script", "pair", "new_game_s", "reload_s", "reset_s", "run_s", "attempts", "headless_s", "waited_for_headless_s", "compare_s", "verdict", "summary"];
  const rows = reports.map((r) => [r.label, r.pair, f(r.game), f(r.reload), f(r.reset), f(r.run), String(r.attempts), f(r.headless), f(r.waited), f(r.compare), r.verdict, r.summary].join("\t"));
  writeFileSync(join(out, "batch.tsv"), `${header.join("\t")}\n${rows.join("\n")}\n`);
  writeFileSync(join(out, "batch.json"), `${JSON.stringify({ total_s: total, pairs, ...extra, scripts: reports }, null, 2)}\n`);
  for (const r of reports) {
    console.log(`${r.verdict.padEnd(7)} ${r.label.padEnd(22)} ${r.pair.padEnd(7)} game ${f(r.game).padStart(5)} s  reload ${f(r.reload).padStart(4)} s  reset ${f(r.reset).padStart(4)} s  run ${f(r.run).padStart(5)} s  headless ${f(r.headless).padStart(5)} s (waited ${f(r.waited)} s)  ${r.summary}`);
  }
  const sum = (key: "game" | "reload" | "reset" | "run") => f(reports.reduce((all, r) => all + r[key], 0));
  const count = (verdict: ScriptReport["verdict"]) => reports.filter((r) => r.verdict === verdict).length;
  console.log(`${reports.length} scripts on ${pairs.length} pair(s) in ${f(total)} s: new games ${sum("game")} s, reloads ${sum("reload")} s, resets ${sum("reset")} s, runs ${sum("run")} s; ${count("PASS")} PASS, ${count("FAIL")} FAIL, ${count("INVALID")} INVALID; ${join(out, "batch.tsv")}`);
  if (count("PASS") !== reports.length) return yield* new IntegrityFailure({ operation: "pad batch", path: out, cause: "not every script passed" });
});


export const padBatch = (options: NativeBatchOptions) => Effect.gen(function*() {
  const { pairs, build, map, retries, freshEach, hot } = options;
  if (hot && build !== INTEGRITY_BUILD.id) return yield* new UsageFailure({ problem: `--hot reloads the integrity map's TypeScript; --build ${build} is another map` });
  const started = performance.now();
  mkdirSync(options.out, { recursive: true });
  const { runs, report, compareLater, reports, compares } = yield* prepare(options, true);
  const quietWindow = captureLoad();
  let next = 0;
  const worker = (pair: PadPair) => Effect.scoped(Effect.gen(function*() {
    let previous: Parameters<typeof needsNewGame>[0] = "none";
    let session: NativeSession | undefined;
    let gameScope: Scope.Closeable | undefined;
    let gameNumber = 0;
    const services = hot ? yield* hotServices : undefined;

    const warm = services === undefined ? undefined : yield* Effect.forkScoped(Context.get(services, MapBuild).compile.pipe(Effect.ignore));
    let reloader: HotReload["Service"] | undefined;

    const ensureSession = Effect.gen(function*() {
      if (session !== undefined) return session;
      if (gameScope === undefined) return yield* new IntegrityFailure({ operation: "start native session", path: pair.name, cause: "no game scope" });
      session = yield* nativeSession(join(options.out, `${pair.name}-session-${gameNumber++}`), options.helper, build, pair.appIds, pair.clients).pipe(Scope.provide(gameScope));
      return session;
    });

    const reload = Effect.gen(function*() {
      if (services === undefined) return 0;
      if (warm !== undefined) yield* Fiber.join(warm);
      const current = yield* ensureSession;
      if (reloader === undefined) {
        if (gameScope === undefined) return yield* new IntegrityFailure({ operation: "hot reload", path: pair.name, cause: "no game scope" });
        reloader = yield* hotReloader(services, current.data).pipe(Scope.provide(gameScope));
      }
      return yield* reloader.publish.pipe(Effect.mapError((cause) => new IntegrityFailure({ operation: "hot reload", path: pair.name, cause: cause.message })));
    });
    const timedReload = (made: ScriptReport, dir: string) => Effect.gen(function*() {
      if (!hot) return true;
      const at = performance.now();
      const done = yield* Effect.exit(reload);
      made.reload += seconds(at);
      if (done._tag === "Failure") {
        made.summary = `hot reload failed on ${pair.name}: ${Cause.pretty(done.cause).split("\n")[0]}`;
        return false;
      }
      writeFileSync(join(dir, "reload.json"), `${JSON.stringify({ version: done.value, seconds: seconds(at) }, null, 2)}\n`);
      return true;
    });
    for (let index = next++; index < runs.length; index = next++) {
      const run = runs[index];
      if (run === undefined) break;
      const made = report(run, pair.name);
      const padOptions: PadOptions = { scriptPath: run.script, steps: run.steps, helper: options.helper, build, out: join(run.dir, "native"), chat: run.chat, candidate: options.map };
      let outcome: "valid" | "invalid" | "failed" | "broken" = "invalid";
      yield* Effect.suspend(() => Effect.gen(function*() {
        const attempt = made.attempts++;
        if (!needsNewGame(previous, freshEach)) {

          if (!(yield* timedReload(made, run.dir))) previous = "broken";
          else {
            const at = performance.now();
            const done = yield* Effect.exit(session === undefined ? Effect.fail(new IntegrityFailure({ operation: "reset", path: pair.name, cause: "no native session" })) : reset(session, build));
            made.reset += seconds(at);

            if (done._tag === "Failure") previous = "broken";
            else writeFileSync(join(run.dir, "reset.json"), `${JSON.stringify(done.value, null, 2)}\n`);
          }
        }
        let freshGame = false;
        if (needsNewGame(previous, freshEach)) {
          freshGame = true;
          if (gameScope !== undefined) yield* Scope.close(gameScope, Exit.void);
          gameScope = undefined;
          session = undefined;
          reloader = undefined;
          const at = performance.now();
          const log = join(run.dir, `game-${attempt}.log`);
          const made_ = yield* Effect.exit(newGame(pair, map, log));
          made.game += seconds(at);
          if (made_._tag === "Failure") {
            outcome = "broken";
            made.summary = `no new game on ${pair.name}: ${log}.1`;
            return;
          }
          gameScope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void));
        }

        if (freshGame && !(yield* timedReload(made, run.dir))) {
          outcome = "broken";
          previous = "broken";
          return yield* new BatchRetry({ script: run.script });
        }
        const at = performance.now();
        const play = Effect.gen(function*() {
          return yield* nativeScript(yield* ensureSession, padOptions);
        });
        const ran = yield* Effect.exit(pair.lan === undefined ? onHealthyClients(play, { retry: false, clientsFile: pair.clients }) : play);
        made.run += seconds(at);

        outcome = ran._tag === "Success" ? ran.value : replayFailure(ran.cause) ? "failed" : "broken";
        if (outcome === "broken" && ran._tag === "Failure") made.summary = Cause.pretty(ran.cause);
        previous = outcome;
        if (outcome === "invalid") {
          const resultPath = join(padOptions.out, "result.json");
          const result = yield* readResult(resultPath);
          if (result?.setup !== undefined) {
            made.summary = `INVALID setup: ${result.setup.boundary}`;
            return;
          }
        }

        if (outcome === "invalid" || (outcome === "failed" && (yield* slipped(padOptions.out)) && attempt < retries)) return yield* new BatchRetry({ script: run.script });
      })).pipe(Effect.retry({ schedule: Schedule.recurs(retries), while: (failure) => failure._tag === "BatchRetry" }), Effect.catchTag("BatchRetry", () => Effect.void));
      if (outcome === "invalid" || outcome === "broken") {
        if (outcome === "invalid") {
          const result = yield* readResult(join(padOptions.out, "result.json"));
          made.summary ||= result?.invalid?.[0] ?? `invalid on all ${made.attempts} attempts`;
        } else made.summary ||= `the native run broke on ${pair.name}`;
        continue;
      }
      yield* compareLater(run, made, join(run.dir, "native"), outcome === "valid");
    }
  }));
  yield* Effect.forEach(pairs, worker, { concurrency: Math.max(1, pairs.length), discard: true });
  yield* Effect.forEach(compares, Fiber.join, { concurrency: options.headlessJobs, discard: true });
  yield* summarize(options.out, runs, reports, pairs.map((pair) => pair.name), started, { fresh_each: freshEach, hot, ...quietWindow });
}).pipe(Effect.scoped);







export const headlessBatch = (options: BatchOptions) => Effect.gen(function*() {
  const started = performance.now();
  mkdirSync(options.out, { recursive: true });
  const { runs, report, compareLater, reports, compares } = yield* prepare(options);
  const made = runs.map((run) => report(run, "session"));





  const session = (start: number, number: number) => Effect.scoped(Effect.gen(function*() {
    const clients = yield* headlessSession(join(options.out, `session-${number}`), options.helper, options.build);
    for (let index = start; index < runs.length; index++) {
      const run = runs[index];
      const row = made[index];
      if (run === undefined || row === undefined) break;
      const out = join(run.dir, "session");
      const restart = yield* Effect.suspend(() => Effect.gen(function*() {
        if (index > start || row.attempts > 0) {
          const at = performance.now();
          const typedMs = Date.now();
          clients.clients.chat(0, RESET_COMMAND);
          yield* atSelection(clients.data.map((dir, slot) => join(dir, devCommandReceiptFile(options.build, slot))), typedMs);
          row.reset += seconds(at);
        }
        row.attempts++;
        const at = performance.now();
        const ran = yield* Effect.exit(headlessScript(clients, { scriptPath: run.script, steps: run.steps, helper: options.helper, build: options.build, out, chat: run.chat }));
        row.run += seconds(at);
        const offFrame = ran._tag === "Failure" && replayFailure(ran.cause);
        const again = row.attempts <= options.retries;
        if (ran._tag === "Failure" && !offFrame) {
          row.summary = `the session run broke: ${Cause.pretty(ran.cause).split("\n")[0]}`;
          return again ? index : index + 1;
        }
        if (yield* helperStopped(out)) {
          if (!again) yield* compareLater(run, row, out, false);
          return again ? index : index + 1;
        }
        if (offFrame && (yield* slipped(out)) && again) {
          return yield* new BatchRetry({ script: run.script });
        }
        yield* compareLater(run, row, out, ran._tag === "Success");
        return undefined;
      })).pipe(Effect.retry({ schedule: Schedule.recurs(options.retries), while: (failure) => failure._tag === "BatchRetry" }));
      if (restart !== undefined) return restart;
    }
    return runs.length;
  }));
  let next = 0;
  let number = 0;
  if (runs.length > 0) yield* Effect.suspend(() => session(next, number++).pipe(Effect.tap((index) => Effect.sync(() => { next = index; })))).pipe(Effect.repeat({ until: () => next >= runs.length }));
  yield* Effect.forEach(compares, Fiber.join, { concurrency: options.headlessJobs, discard: true });
  yield* summarize(options.out, runs, reports, ["session"], started, { headless_session: true });
}).pipe(Effect.scoped);


const helperStopped = (dir: string) => readResult(join(dir, "result.json")).pipe(Effect.map((result) => (result?.helpers_stopped?.length ?? 0) > 0));


const slipped = (dir: string) => readResult(join(dir, "result.json")).pipe(Effect.map((result) => result?.written_late !== undefined && result.written_late > 0 && result.written_late === result.off_frame));

const BatchResult = Schema.Struct({
  setup: Schema.optional(Schema.Struct({ boundary: Schema.String })),
  invalid: Schema.optional(Schema.Array(Schema.String)),
  helpers_stopped: Schema.optional(Schema.Array(Schema.Unknown)),
  written_late: Schema.optional(Schema.Int),
  off_frame: Schema.optional(Schema.Int),
});

const readResult = (path: string) => Effect.gen(function*() {
  const text = yield* Effect.try({ try: () => existsSync(path) ? readFileSync(path, "utf8") : undefined, catch: (cause) => new IntegrityFailure({ operation: "read batch result", path, cause }) });
  if (text === undefined) return undefined;
  return yield* Schema.decodeEffect(Schema.fromJsonString(BatchResult))(text).pipe(Effect.mapError((cause) => new IntegrityFailure({ operation: "decode batch result", path, cause })));
});

const replayFailure = (cause: Cause.Cause<unknown>) => {
  const error = Option.getOrUndefined(Cause.findErrorOption(cause));
  return typeof error === "object" && error !== null && "_tag" in error && error._tag === "PadReplayFailure";
};
