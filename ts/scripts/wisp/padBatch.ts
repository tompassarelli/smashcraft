// `bun wisp pad SCRIPT|DIR... --helper BINARY --out DIR --map MAP.w3x [--pairs N]`:
// many pad scripts in ONE game per client pair (smashcraft:docs/native-bot-session.md,
// "Many scripts in one game"). A pair starts the map once; between scripts
// it types `-dev reset`, which puts every client back at fighter selection
// exactly as the map started it (test/dev-reset.test.ts), so each script's
// `-dev quick` match equals a new game's first match. A new game is started
// only after an invalid run (desync, crash, early results) or a run that
// broke. Every script's headless run starts at once in the background, a few
// at a time, so the native runs never wait for them; each compare runs as
// soon as both sides of its script exist. `--pairs N` shards the scripts
// over the first N pairs of Wisp's offline LAN pool (`wisp lan pool`).
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { Cause, Effect, Exit, Option, Schema, Scope } from "effect";
import { preloadLines } from "wisp/scripts/wisp/boundary";
import { UsageFailure, describeCause } from "wisp/scripts/wisp/command";
import { loadClients } from "wisp/scripts/warcraft/desktop";
import { readyAfter } from "./commands/fresh";
import { gameFilesLayer } from "./project";
import { RESET_COMMAND } from "../../src/game/shell/devSettings";
import { devCommandReceiptFile } from "../../src/runtime/gameFiles";
import { IntegrityFailure } from "../integrity/evidence";
import { monotonicNs } from "../integrity/linux";
import { compareRuns, comparisonSteps, scriptChat } from "../integrity/padParity";
import { parsePadScript } from "../integrity/padScript";
import { onHealthyClients } from "./doctor";
import { type PadOptions, type NativeSession, headlessScript, headlessSession, nativeChat, nativeScript, nativeSession } from "./commands/pad";

/** A pair of clients one share of the batch plays on. */
export interface PadPair {
  readonly name: string;
  /** A clients file in the schema of ~/.local/state/smashcraft/clients.json. */
  readonly clients: string;
  readonly appIds: ReadonlyMap<string, string>;
  /** The pair's index in the LAN pool; undefined for the signed-in clients A and B. */
  readonly lan?: number;
}

/** Where `wisp lan pool` writes pool.json: {pairs:[{id, clients, appIds:{a,b}}]}. */
export const LAN_POOL_FILE = join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"), "wisp/lan/pool.json");

const LanPool = Schema.Struct({ pairs: Schema.Array(Schema.Struct({ id: Schema.Finite, clients: Schema.String, appIds: Schema.optional(Schema.Record(Schema.String, Schema.String)) })) });

/**
 * The pool's pairs a batch plays on: the first `count`, or the pairs `ids` names
 * (`--pair K`, for a share of the pool other runners also use).
 */
export function lanPairs(poolFile: string, select: { readonly count: number } | { readonly ids: readonly number[] }): PadPair[] {
  const pool = Schema.decodeUnknownSync(LanPool)(JSON.parse(readFileSync(poolFile, "utf8")));
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

/**
 * A pool pair's clients file with the desktop tools Wisp's client driver needs,
 * taken from `toolsFrom` (Smashcraft's clients.json) when the pair's file has none.
 */
export function withTools(pair: PadPair, toolsFrom: string, dir: string): PadPair {
  const clients: unknown = JSON.parse(readFileSync(pair.clients, "utf8"));
  if (typeof clients === "object" && clients !== null && "tools" in clients) return pair;
  const { tools } = Schema.decodeUnknownSync(ToolsOnly)(JSON.parse(readFileSync(toolsFrom, "utf8")));
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${pair.name}-clients.json`);
  writeFileSync(path, `${JSON.stringify({ ...(typeof clients === "object" ? clients : {}), tools }, null, 2)}\n`);
  return { ...pair, clients: path };
}

/** The .pad files the arguments name: files as given, directories' own .pad files in name order. */
export function batchScripts(paths: readonly string[]): string[] {
  return paths.flatMap((path) => statSync(path).isDirectory()
    ? readdirSync(path).filter((name) => name.endsWith(".pad")).sort().map((name) => join(path, name))
    : [path]);
}

/**
 * Whether a pair starts a new game before its next script. Only the first
 * script of a session, the rerun after an invalid run and the script after a
 * run that broke get one: a valid run's match ends with `-dev reset`.
 * `freshEach` is the old one-game-per-script loop, kept for measuring it.
 */
export function needsNewGame(previous: "none" | "valid" | "failed" | "invalid" | "broken", freshEach: boolean): boolean {
  return freshEach || previous === "none" || previous === "invalid" || previous === "broken";
}

const seconds = (since: number) => (performance.now() - since) / 1000;

/** At most `limit` of the tasks run at once, in the order they were asked for. */
function limiter(limit: number) {
  let running = 0;
  const waiting: (() => void)[] = [];
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (running >= limit) await new Promise<void>((resolve) => waiting.push(resolve));
    running++;
    try {
      return await task();
    } finally {
      running--;
      waiting.shift()?.();
    }
  };
}

const wispProgram = join(import.meta.dir, "../wisp.ts");

/** Runs `bun wisp ARGS`, its output into `log`; resolves with the exit code. */
async function wisp(args: readonly string[], log: string): Promise<number> {
  const file = Bun.file(log);
  const child = Bun.spawn([process.execPath, wispProgram, ...args], { stdout: file, stderr: file, cwd: join(import.meta.dir, "../..") });
  return child.exited;
}

/** A new game on the pair, stopped at fighter selection: `bun wisp fresh MAP --no-quick`, or `bun wisp lan fresh MAP --pair K`. */
const newGame = (pair: PadPair, map: string, log: string) => Effect.gen(function*() {
  const args = pair.lan === undefined ? ["fresh", map, "--no-quick", "--clients-file", pair.clients] : ["lan", "fresh", map, "--pair", String(pair.lan)];
  for (let attempt = 0; attempt < 2; attempt++) {
    const started = Date.now();
    if ((yield* Effect.promise(() => wisp(args, `${log}.${attempt}`))) === 0) {
      const clients = yield* loadClients(pair.clients).pipe(Effect.mapError((cause) => new IntegrityFailure({ operation: "binding-ready clients", path: pair.name, cause })));
      yield* Effect.forEach(clients, (client) => readyAfter(client, started), { concurrency: "unbounded" }).pipe(Effect.provide(gameFilesLayer), Effect.mapError((cause) => new IntegrityFailure({ operation: "binding-ready receipt", path: pair.name, cause })));
      return;
    }
  }
  return yield* new IntegrityFailure({ operation: "start a new game", path: map, cause: `bun wisp ${args.join(" ")} failed twice on ${pair.name} (${log}.1)` });
});


/** Waits until every receipt file was written since `sinceMs` and shows fighter selection, the `-dev reset` receipt. */
const atSelection = (receipts: readonly string[], sinceMs: number) => Effect.gen(function*() {
  const reset = (path: string) => existsSync(path) && statSync(path).mtimeMs >= sinceMs
    && (preloadLines(readFileSync(path, "latin1")) ?? []).some((line) => line.startsWith("SETUP phase=0 "));
  const deadline = Date.now() + 8000;
  while (!receipts.every(reset)) {
    if (Date.now() > deadline) return yield* new IntegrityFailure({ operation: "reset", path: receipts.join(", "), cause: `no fighter-selection receipt from every client within 8 s of ${RESET_COMMAND}` });
    yield* Effect.sleep("50 millis");
  }
});

/** Types `-dev reset` into the pair's client A and waits for both clients' receipts. */
const reset = (session: NativeSession, build: string) => Effect.gen(function*() {
  const typedMs = Date.now();
  const received = yield* nativeChat(session, RESET_COMMAND);
  yield* atSelection(session.data.map((dir, slot) => join(dir, devCommandReceiptFile(build, slot))), typedMs);
  return { command: RESET_COMMAND, clients: received, confirmed_monotonic_ns: monotonicNs() };
});

export interface BatchOptions {
  readonly scripts: readonly string[];
  readonly helper: string;
  readonly build: string;
  readonly out: string;
  /** Headless runs at once; each is two real-time clients and two helpers. */
  readonly headlessJobs: number;
  /** Reruns of a script whose run was invalid or slipped. */
  readonly retries: number;
}

export interface NativeBatchOptions extends BatchOptions {
  readonly pairs: readonly PadPair[];
  readonly map: string;
  readonly freshEach: boolean;
}

/** Seconds of each phase of one script, and its verdict. */
interface ScriptReport {
  readonly label: string;
  readonly script: string;
  readonly pair: string;
  game: number;
  reset: number;
  /** The script's own run: native, or the headless session's. */
  run: number;
  attempts: number;
  headless: number;
  /** Seconds the compare waited for the headless run after the script's run ended. */
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

/**
 * The batch's scripts, each with its folder, and the reference headless run
 * of each (`pad SCRIPT --headless`, new clients), all started now a few at a
 * time: they need nothing from the side they are compared with.
 */
const prepare = (options: BatchOptions) => Effect.gen(function*() {
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
  const limit = limiter(options.headlessJobs);
  // A reference that slipped (an edge written late on a loaded host, a helper that
  // saw the match late) proves nothing about the other side: it runs again, twice at most.
  const references = new Map(runs.map((run) => [run.label, limit(async () => {
    const at = performance.now();
    let code = 1;
    for (let attempt = 0; attempt < 3 && code !== 0; attempt++) {
      if (attempt > 0 && existsSync(join(run.dir, "headless"))) renameSync(join(run.dir, "headless"), join(run.dir, `headless-invalid-${attempt - 1}`));
      code = await wisp(["pad", run.script, "--headless", "--helper", options.helper, "--out", join(run.dir, "headless"), `--chat=${run.chat}`], join(run.dir, attempt === 0 ? "headless.log" : `headless-${attempt}.log`));
    }
    return { code, seconds: seconds(at), ended: performance.now() };
  })] as const));
  const reports: ScriptReport[] = [];
  const compares: Promise<void>[] = [];
  const report = (run: ScriptRun, pair: string): ScriptReport => {
    const made: ScriptReport = { label: run.label, script: run.script, pair, game: 0, reset: 0, run: 0, attempts: 0, headless: 0, waited: 0, compare: 0, verdict: "INVALID", summary: "" };
    reports.push(made);
    return made;
  };
  /** Compares `side` with the script's reference run once that has ended, in the background. */
  const compareLater = (run: ScriptRun, made: ScriptReport, side: string, valid: boolean) => {
    const ended = performance.now();
    compares.push((async () => {
      const reference = await (references.get(run.label) ?? Promise.resolve({ code: 1, seconds: 0, ended: ended }));
      made.headless = reference.seconds;
      made.waited = Math.max(0, (reference.ended - ended) / 1000);
      const at = performance.now();
      try {
        const parity = compareRuns(side, join(run.dir, "headless"), run.text);
        writeFileSync(join(run.dir, "compare.log"), `${parity.lines.join("\n")}\n`);
        made.verdict = parity.passed && valid ? "PASS" : parity.invalid === true ? "INVALID" : "FAIL";
        made.summary = parity.lines.slice(-2).join(" ");
      } catch (cause) {
        made.verdict = "FAIL";
        made.summary = `compare failed: ${describeCause(cause)} (reference exit ${reference.code}, ${join(run.dir, "headless.log")})`;
      }
      made.compare = seconds(at);
    })());
  };
  return { runs, report, compareLater, reports, compares };
});

/** Writes batch.tsv and batch.json, prints a line a script and the totals; fails unless every script passed. */
const summarize = (out: string, runs: readonly ScriptRun[], reports: ScriptReport[], pairs: readonly string[], started: number, extra: Record<string, unknown>) => Effect.gen(function*() {
  const total = seconds(started);
  const order = new Map(runs.map((run, index) => [run.label, index]));
  reports.sort((a, b) => (order.get(a.label) ?? 0) - (order.get(b.label) ?? 0));
  const f = (value: number) => value.toFixed(1);
  const header = ["script", "pair", "new_game_s", "reset_s", "run_s", "attempts", "headless_s", "waited_for_headless_s", "compare_s", "verdict", "summary"];
  const rows = reports.map((r) => [r.label, r.pair, f(r.game), f(r.reset), f(r.run), String(r.attempts), f(r.headless), f(r.waited), f(r.compare), r.verdict, r.summary].join("\t"));
  writeFileSync(join(out, "batch.tsv"), `${header.join("\t")}\n${rows.join("\n")}\n`);
  writeFileSync(join(out, "batch.json"), `${JSON.stringify({ total_s: total, pairs, ...extra, scripts: reports }, null, 2)}\n`);
  for (const r of reports) {
    console.log(`${r.verdict.padEnd(7)} ${r.label.padEnd(22)} ${r.pair.padEnd(7)} game ${f(r.game).padStart(5)} s  reset ${f(r.reset).padStart(4)} s  run ${f(r.run).padStart(5)} s  headless ${f(r.headless).padStart(5)} s (waited ${f(r.waited)} s)  ${r.summary}`);
  }
  const sum = (key: "game" | "reset" | "run") => f(reports.reduce((all, r) => all + r[key], 0));
  const count = (verdict: ScriptReport["verdict"]) => reports.filter((r) => r.verdict === verdict).length;
  console.log(`${reports.length} scripts on ${pairs.length} pair(s) in ${f(total)} s: new games ${sum("game")} s, resets ${sum("reset")} s, runs ${sum("run")} s; ${count("PASS")} PASS, ${count("FAIL")} FAIL, ${count("INVALID")} INVALID; ${join(out, "batch.tsv")}`);
  if (count("PASS") !== reports.length) return yield* new IntegrityFailure({ operation: "pad batch", path: out, cause: "not every script passed" });
});

/** Native scripts on every pair at once, each pair taking the next script when it is free. */
export const padBatch = (options: NativeBatchOptions) => Effect.gen(function*() {
  const { pairs, build, map, retries, freshEach } = options;
  const started = performance.now();
  mkdirSync(options.out, { recursive: true });
  const { runs, report, compareLater, reports, compares } = yield* prepare(options);
  let next = 0;
  const worker = (pair: PadPair) => Effect.scoped(Effect.gen(function*() {
    let previous: Parameters<typeof needsNewGame>[0] = "none";
    let session: NativeSession | undefined;
    let gameScope: Scope.Closeable | undefined;
    let gameNumber = 0;
    for (let index = next++; index < runs.length; index = next++) {
      const run = runs[index];
      if (run === undefined) break;
      const made = report(run, pair.name);
      const padOptions: PadOptions = { scriptPath: run.script, steps: run.steps, helper: options.helper, build, out: join(run.dir, "native"), chat: run.chat, candidate: options.map };
      let outcome: "valid" | "invalid" | "failed" | "broken" = "invalid";
      for (let attempt = 0; attempt <= retries; attempt++) {
        made.attempts = attempt + 1;
        if (!needsNewGame(previous, freshEach)) {
          const at = performance.now();
          const done = yield* Effect.exit(session === undefined ? Effect.fail(new IntegrityFailure({ operation: "reset", path: pair.name, cause: "no native session" })) : reset(session, build));
          made.reset += seconds(at);
          // A pair that didn't reset gets a new game for the same attempt.
          if (done._tag === "Failure") previous = "broken";
          else writeFileSync(join(run.dir, "reset.json"), `${JSON.stringify(done.value, null, 2)}\n`);
        }
        if (needsNewGame(previous, freshEach)) {
          if (gameScope !== undefined) yield* Scope.close(gameScope, Exit.void);
          gameScope = undefined;
          session = undefined;
          const at = performance.now();
          const log = join(run.dir, `game-${attempt}.log`);
          const made_ = yield* Effect.exit(newGame(pair, map, log));
          made.game += seconds(at);
          if (made_._tag === "Failure") {
            outcome = "broken";
            made.summary = `no new game on ${pair.name}: ${log}.1`;
            break;
          }
          gameScope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void));
        }
        const at = performance.now();
        const play = Effect.gen(function*() {
          if (session === undefined) {
            if (gameScope === undefined) return yield* new IntegrityFailure({ operation: "start native session", path: pair.name, cause: "no game scope" });
            session = yield* nativeSession(join(options.out, `${pair.name}-session-${gameNumber++}`), options.helper, build, pair.appIds, pair.clients).pipe(Scope.provide(gameScope));
          }
          return yield* nativeScript(session, padOptions);
        });
        const ran = yield* Effect.exit(pair.lan === undefined ? onHealthyClients(play, { retry: false, clientsFile: pair.clients }) : play);
        made.run += seconds(at);
        // An edge off its frame or a stopped helper still leaves a match the next script can reset; anything else may not.
        outcome = ran._tag === "Success" ? ran.value : Cause.pretty(ran.cause).includes("edges off their frame") ? "failed" : "broken";
        if (outcome === "broken" && ran._tag === "Failure") made.summary = Cause.pretty(ran.cause);
        previous = outcome;
        if (outcome === "invalid") {
          const resultPath = join(padOptions.out, "result.json");
          const setup = existsSync(resultPath) ? Option.getOrUndefined(Schema.decodeUnknownOption(Schema.Struct({ setup: Schema.Struct({ boundary: Schema.String }) }))(JSON.parse(readFileSync(resultPath, "utf8")))) : undefined;
          if (setup !== undefined) {
            made.summary = `INVALID setup: ${setup.setup.boundary}`;
            break;
          }
        }
        // Edges written late are the harness's slip on a loaded host, not the game's: reset and play the script again.
        if (outcome === "failed" && slipped(padOptions.out) && attempt < retries) continue;
        if (outcome !== "invalid") break;
      }
      if (outcome === "invalid" || outcome === "broken") {
        if (outcome === "invalid") {
          const result = JSON.parse(readFileSync(join(padOptions.out, "result.json"), "utf8"));
          made.summary ||= Schema.decodeUnknownSync(Schema.Struct({ invalid: Schema.Array(Schema.String) }))(result).invalid[0] ?? `invalid on all ${made.attempts} attempts`;
        } else made.summary ||= `the native run broke on ${pair.name}`;
        continue;
      }
      compareLater(run, made, join(run.dir, "native"), outcome === "valid");
    }
  }));
  yield* Effect.forEach(pairs, worker, { concurrency: "unbounded", discard: true });
  yield* Effect.promise(() => Promise.all(compares));
  yield* summarize(options.out, runs, reports, pairs.map((pair) => pair.name), started, { fresh_each: freshEach });
});

/**
 * `pad --batch --headless`: the native batch's flow in headless clients. One
 * session of two integrity-build clients and their real helpers plays every
 * script, with `-dev reset` between them, and each script is compared with
 * its reference run in new clients, as a native run would be.
 */
export const headlessBatch = (options: BatchOptions) => Effect.gen(function*() {
  const started = performance.now();
  mkdirSync(options.out, { recursive: true });
  const { runs, report, compareLater, reports, compares } = yield* prepare(options);
  const made = runs.map((run) => report(run, "session"));
  /**
   * One session from script `start`: its first script needs no reset. Returns
   * the script the next session starts at, after a helper stopped (its journal
   * ends for every later match) or a run broke the session.
   */
  const session = (start: number, number: number) => Effect.scoped(Effect.gen(function*() {
    const clients = yield* headlessSession(join(options.out, `session-${number}`), options.helper, options.build);
    for (let index = start; index < runs.length; index++) {
      const run = runs[index];
      const row = made[index];
      if (run === undefined || row === undefined) break;
      const out = join(run.dir, "session");
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
      const offFrame = ran._tag === "Failure" && Cause.pretty(ran.cause).includes("edges off their frame");
      const again = row.attempts <= options.retries;
      if (ran._tag === "Failure" && !offFrame) {
        row.summary = `the session run broke: ${Cause.pretty(ran.cause).split("\n")[0]}`;
        return again ? index : index + 1;
      }
      if (helperStopped(out)) return again ? index : (compareLater(run, row, out, false), index + 1);
      if (offFrame && slipped(out) && again) {
        index--;
        continue;
      }
      compareLater(run, row, out, ran._tag === "Success");
    }
    return runs.length;
  }));
  for (let next = 0, number = 0; next < runs.length; number++) next = yield* session(next, number);
  yield* Effect.promise(() => Promise.all(compares));
  yield* summarize(options.out, runs, reports, ["session"], started, { headless_session: true });
});

/** Whether a helper's journal stopped during the run (result.json helpers_stopped): it plays no later match. */
function helperStopped(dir: string): boolean {
  const path = join(dir, "result.json");
  if (!existsSync(path)) return false;
  const result: unknown = JSON.parse(readFileSync(path, "utf8"));
  return typeof result === "object" && result !== null && "helpers_stopped" in result && Array.isArray(result.helpers_stopped) && result.helpers_stopped.length > 0;
}

/** Whether a run's off-frame edges were all written late: the producer slipped on a loaded host, not the game. */
function slipped(dir: string): boolean {
  const path = join(dir, "result.json");
  if (!existsSync(path)) return false;
  const result: unknown = JSON.parse(readFileSync(path, "utf8"));
  return typeof result === "object" && result !== null && "written_late" in result && "off_frame" in result
    && typeof result.written_late === "number" && result.written_late > 0 && result.written_late === result.off_frame;
}
