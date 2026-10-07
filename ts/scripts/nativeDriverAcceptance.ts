import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { Effect } from "effect";
import { selectClients, watchedClients } from "wisp/scripts/wisp/clientWatchCommand";
import { EngineFailure } from "wisp/scripts/wisp/commands/engine";
import { readRepro } from "wisp/scripts/wisp/commands/repro";
import { withAutopsy } from "wisp/scripts/wisp/engine/autopsy";
import { publishDriverCommand, readDriverStatus, waitDriverCommand, type DriverClient } from "wisp/scripts/wisp/engine/drive";
import { prefixOfDocuments } from "wisp/scripts/wisp/engine/memory";
import { dataDirectory } from "wisp/scripts/wisp/gameFiles";
import { preloadLines } from "wisp/scripts/wisp/boundary";
import { TRACE_FILE, parseExpectations, parseTrace, unmetExpectations } from "./integrity/padParity";
import { parsePadScript } from "./integrity/padScript";
import { replayRepro } from "../src/game/replay/moment";

const { values } = parseArgs({ options: {
  "clients-file": { type: "string" }, client: { type: "string" }, script: { type: "string" },
  "game-start-ms": { type: "string" },
  frames: { type: "string" }, runs: { type: "string", default: "50" }, out: { type: "string" },
} });
const { script, out } = values;
const clientsFile = values["clients-file"];
const frames = Number(values.frames);
const runs = Number(values.runs);
const gameStartedMs = values["game-start-ms"] === undefined ? undefined : Number(values["game-start-ms"]);
if (script === undefined || out === undefined || clientsFile === undefined || values.client === undefined
  || !Number.isInteger(frames) || frames < 1 || !Number.isInteger(runs) || runs < 1) {
  throw new Error("usage: bun scripts/nativeDriverAcceptance.ts --clients-file FILE --client lan0a,lan0b --script FILE.pad --frames N --runs 50 --out DIR");
}
const attempt = <A>(operation: string, run: () => A) => Effect.try({ try: run, catch: cause => new EngineFailure({ problem: `${operation}: ${String(cause)}` }) });
const send = (clients: readonly DriverClient[], text: string, frame?: number) => Effect.gen(function*() {
  const started = performance.now();
  const serial = yield* attempt("publish native command", () => publishDriverCommand(clients, "smashcraft", text));
  const status = yield* Effect.tryPromise({ try: () => waitDriverCommand(clients, "smashcraft", serial, 30000, frame), catch: cause => new EngineFailure({ problem: String(cause) }) });
  if (new Set(status.map(value => value.checksum)).size !== 1) return yield* new EngineFailure({ problem: `native clients disagree: ${JSON.stringify(status)}` });
  return { status, milliseconds: performance.now() - started };
});
const program = Effect.gen(function*() {
  const harnessStartedMs = Date.now();
  const selected = yield* selectClients(yield* watchedClients(clientsFile), values.client?.split(",") ?? []);
  if (selected.length !== 2) return yield* new EngineFailure({ problem: "native acceptance requires exactly one offline pair" });
  const clients = selected.map(client => ({ ...client, prefix: prefixOfDocuments(client.documents) }));
  yield* attempt("prepare driver folders", () => clients.forEach(client => mkdirSync(join(dataDirectory(client.documents), "smashcraft-hot"), { recursive: true })));
  yield* Effect.tryPromise({ try: async () => {
    const deadline = performance.now() + 30000;
    let observed = "no startup receipt";
    while (performance.now() < deadline) {
      try {
        const statuses = clients.map(client => readDriverStatus(client, "smashcraft"));
        if (statuses.every((status, index) => status.frame === 0 && status.paused && !status.refused && (gameStartedMs === undefined || statSync(join(dataDirectory(clients[index]?.documents ?? ""), "smashcraft-hot/driver-status.txt")).mtimeMs >= gameStartedMs))) return;
        observed = JSON.stringify(statuses);
      } catch (cause) { observed = String(cause); }
      await Bun.sleep(10);
    }
    throw new Error(`driver startup timed out: ${observed}; create smashcraft-hot on both clients before starting the map`);
  }, catch: cause => new EngineFailure({ problem: String(cause) }) });
  const payload = yield* attempt("read pad script", () => readFileSync(script, "utf8"));
  if (parsePadScript(payload).some(step => step.frame > frames)) return yield* new EngineFailure({ problem: `--frames ${frames} truncates the pad script` });
  yield* attempt("create result folder", () => mkdirSync(out, { recursive: true }));
  const errorsBefore = clients.map(client => {
    const errors = join(client.documents, "Errors");
    return new Set(existsSync(errors) ? readdirSync(errors) : []);
  });
  const results: { run: number; checksum: string; setupMs: readonly number[]; freeMs: number; steppedMs: number | undefined; replays: number }[] = [];
  let firstCheckMs: number | undefined;
  for (let run = 1; run <= runs; run++) {
    const checksums: string[] = [];
    const setupMs: number[] = [];
    const elapsed: number[] = [];
    let replays = 0;
    const modes: readonly ("free" | "stepped")[] = run === 1 ? ["free", "stepped"] : ["free"];
    for (const mode of modes) {
      const setup = yield* send(clients, payload, 0);
      setupMs.push(setup.milliseconds);
      const startedMs = Date.now();
      const held = mode === "stepped" && frames > 10 ? yield* send(clients, "step 10", 10) : undefined;
      const ended = yield* send(clients, mode === "free" ? `resume ${frames}` : `step ${held === undefined ? frames : frames - 10}`, frames);
      yield* send(clients, "capture", frames);
      elapsed.push(ended.milliseconds + (held?.milliseconds ?? 0));
      yield* attempt("retain completed native command", () => writeFileSync(join(out, `run-${run}-${mode}-command.json`), `${JSON.stringify({ run, mode, setupMs: setup.milliseconds, playMs: elapsed.at(-1), status: ended.status }, null, 2)}\n`));
      const checksum = ended.status[0]?.checksum ?? "";
      checksums.push(checksum);
      for (const [index, client] of clients.entries()) {
        const errors = join(client.documents, "Errors");
        const newErrors = existsSync(errors) ? readdirSync(errors).filter(name => !errorsBefore[index]?.has(name)) : [];
        if (newErrors.length > 0) return yield* new EngineFailure({ problem: `invalid native run ${run}: ${client.name} wrote ${newErrors.join(", ")}` });
        const data = dataDirectory(client.documents);
        const traceFile = join(data, TRACE_FILE);
        const trace = yield* attempt("read native pad trace", () => preloadLines(readFileSync(traceFile, "utf8")) ?? []);
        if (!trace.includes("dropped 0")) return yield* new EngineFailure({ problem: `${client.name}: native trace dropped lines or has no completed footer` });
        const problems = unmetExpectations(parseTrace(trace), parseExpectations(payload), "native");
        if (problems.length > 0) return yield* new EngineFailure({ problem: problems.join("; ") });
        yield* attempt("retain native trace", () => copyFileSync(traceFile, join(out, `run-${run}-${mode}-${client.name}-trace.txt`)));
        const saved = yield* attempt("find saved native moment", () => readdirSync(data)
          .filter(name => name.startsWith("smashcraft-repro-") && name.includes(`-f${frames}-`) && statSync(join(data, name)).mtimeMs >= startedMs)
          .sort((a, b) => statSync(join(data, b)).mtimeMs - statSync(join(data, a)).mtimeMs)[0]);
        if (saved === undefined) return yield* new EngineFailure({ problem: `${client.name}: no saved native moment at frame ${frames}` });
        const file = join(data, saved);
        const { repro } = yield* readRepro(file);
        const replay = yield* attempt("replay native moment headless", () => replayRepro(repro));
        if (repro.checksum !== checksum || replay.checksum !== checksum || replay.problems.length > 0) return yield* new EngineFailure({ problem: `${client.name}: native checksum ${checksum}, saved ${repro.checksum}, headless ${replay.checksum}: ${replay.problems.join("; ")}` });
        yield* attempt("retain native moment", () => copyFileSync(file, join(out, `run-${run}-${mode}-${client.name}.txt`)));
        replays++;
      }
      firstCheckMs ??= Date.now();
    }
    if (checksums.length > 1 && checksums[0] !== checksums[1]) return yield* new EngineFailure({ problem: `run ${run}: free ${checksums[0]} differs from stepped ${checksums[1]}` });
    results.push({ run, checksum: checksums[0] ?? "", setupMs, freeMs: elapsed[0] ?? 0, steppedMs: elapsed[1], replays });
    yield* attempt("write progress", () => writeFileSync(join(out, "result.json"), `${JSON.stringify({ script, frames, runs: results }, null, 2)}\n`));
    console.log(`run ${run}/${runs}: frame ${frames}, checksum ${checksums[0]}, ${replays} native moments replayed`);
  }
  const percentile = (numbers: readonly number[], quantile: number) => [...numbers].sort((a, b) => a - b)[Math.ceil(numbers.length * quantile) - 1] ?? 0;
  const setup = results.flatMap(result => result.setupMs);
  const elapsedMs = Date.now() - harnessStartedMs;
  const summary = { gameStartedMs, firstCheckMs, gameStartToFirstCheckMs: (firstCheckMs ?? Date.now()) - (gameStartedMs ?? harnessStartedMs), elapsedMs, checksPerHour: (results.length + 1) * 3600000 / elapsedMs, passed: true, runs: results.length, frames, nativeMatches: results.length + 1, replays: results.reduce((total, result) => total + result.replays, 0), setupP50Ms: percentile(setup, 0.5), setupP95Ms: percentile(setup, 0.95), results };
  yield* attempt("write final result", () => writeFileSync(join(out, "result.json"), `${JSON.stringify(summary, null, 2)}\n`));
  console.log(`PASS: ${summary.runs} full pad runs plus one stepped control, ${summary.replays} native moments match headless; setup p50 ${summary.setupP50Ms.toFixed(1)} ms, p95 ${summary.setupP95Ms.toFixed(1)} ms`);
});
await Effect.runPromise(withAutopsy({ clientsFile }, program));
