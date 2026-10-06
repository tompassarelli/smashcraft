// `bun wisp pad SCRIPT --helper BINARY --build BUILD --out DIR --app-id a=ID --app-id b=ID [--chat=TEXT]`:
// a virtual pad and the real helper for each client, as the integrity
// capture runs them; `--chat` types a developer command into client A (such
// as `-dev quick hero lich`); each script edge is written a fifth into its
// frame on the helper's own clock, and result.json gives the frame each one
// landed on. Script syntax: smashcraft:ts/scripts/integrity/padScript.ts.
// The clients' input traces and saved moments (integrity build) are copied
// beside the result, with their scene reports (scene-a.txt, scene-b.txt).
//
// `bun wisp pad SCRIPT --headless --helper BINARY --out DIR [--chat=TEXT] [--compare NATIVE_DIR]`
// plays the same script through the same helper into two headless clients
// of the integrity build, and with --compare checks a native run's folder
// against it (smashcraft:ts/scripts/integrity/padParity.ts).
import { copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, writeSync, closeSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { Effect } from "effect";
import { at } from "wisp/src/runtime/lookup";
import { type Command, UsageFailure, describeCause } from "wisp/scripts/wisp/command";
import { type DesktopFailure, capture, keys, loadClients, typeText } from "wisp/scripts/warcraft/desktop";
import { encodePpm } from "wisp/scripts/wisp/frameProbe";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { RealtimeClients, type TypedInput, customMapData, typedFile } from "wisp/scripts/wisp/headlessInput";
import { step } from "wisp/scripts/wisp/timings";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import { INTEGRITY_BUILD } from "../../../src/game/shell/currentBuild";
import { gameProcess, json, startHelper } from "../../integrity/capture";
import { IntegrityFailure, producerLine, tryIntegrity } from "../../integrity/evidence";
import { loadEntry } from "../../integrity/headless";
import { type Pad, inject, monotonicNs, openPad } from "../../integrity/linux";
import { BTN_SELECT, PAD_BUTTONS } from "../../integrity/linuxInput";
import { REPRO_NAME, TRACE_FILE, compareRuns, scriptChat } from "../../integrity/padParity";
import type { Schedule, ScheduleReply, ScheduledEdge } from "../../integrity/padScheduleWorker";
import { type PadStep, type SentEdge, frameWriteNs, landEdges, matchStart, parsePadScript, ruleFrame } from "../../integrity/padScript";
import { SLOTS } from "../../integrity/reconcile";
import { PREDICTED_HEADLESS, SMASHCRAFT_HEADLESS } from "../headless";
import { sceneFile } from "wisp/src/runtime/scene";
import { clientState } from "../project";
import { onHealthyClients } from "../doctor";

const USAGE = "pad SCRIPT --helper BINARY --build BUILD --out DIR --app-id a=ID --app-id b=ID [--chat=TEXT] [--map MAP.w3x [--retries N]]\n"
  + "       bun wisp pad SCRIPT --headless --helper BINARY --out DIR [--chat=TEXT] [--compare NATIVE_DIR]";

/** The integrity build writes its input trace 1200 callbacks after the first journal row: about 20 s after the match starts. */
const TRACE_WAIT_MS = 45_000;

const fromDesktop = (failure: DesktopFailure) => new IntegrityFailure({ operation: failure.operation, path: failure.client, cause: failure.cause });

/** Sleeps to `targetNs` on CLOCK_MONOTONIC: a coarse sleep, then a spin for the last 5 ms. */
const until = (targetNs: number) => Effect.gen(function*() {
  const coarse = (targetNs - monotonicNs()) / 1e6 - 5;
  if (coarse > 0) yield* Effect.sleep(coarse);
  while (monotonicNs() < targetNs) { /* spin */ }
});

/** Both helpers' match start, written after this run began. */
const matchEpochs = (logs: () => [string, string], startedNs: number, out: string) => Effect.gen(function*() {
  const deadline = Date.now() + 60_000;
  for (;;) {
    const starts = logs().map(matchStart);
    if (starts.every((start) => start !== undefined && start.epochNs > startedNs)) return [starts[0]?.epochNs ?? 0, starts[1]?.epochNs ?? 0] as const;
    if (Date.now() > deadline) return yield* new IntegrityFailure({ operation: "wait for match start", path: out, cause: "a helper reported no match start within 60 s" });
    yield* Effect.sleep("20 millis");
  }
});

/** The helpers report the match a few frames after it starts: an edge meant for an earlier frame can't land on it. */
const checkFirstEdge = (steps: readonly PadStep[], epochs: readonly [number, number], scriptPath: string) => Effect.gen(function*() {
  const first = steps.find((item) => item.kind === "edge");
  const seen = Math.max(...epochs.map((epoch) => ruleFrame(epoch, monotonicNs())));
  if (first !== undefined && first.frame <= seen) {
    return yield* new IntegrityFailure({ operation: "replay pad script", path: scriptPath, cause: `line ${first.line} is meant for frame ${first.frame}, but the helpers reported the match at frame ${seen}; start scripts at frame ${seen + 10} or later` });
  }
});

/** result.json and the per-edge lines; fails when an edge landed off its frame or a helper stopped. */
const finish = (out: string, scriptPath: string, build: string, epochs: readonly [number, number], sent: readonly SentEdge[], final: [string, string]) => Effect.gen(function*() {
  const results = landEdges(sent, final).map((edge) => ({
    ...edge,
    // Stick and trigger edges have no event line; the helper's frame rule places them.
    frame: edge.landed ?? ruleFrame(at(epochs, edge.slot), edge.injectedNs),
    confirmedBy: edge.landed === undefined ? "frame rule" : "helper event",
    // The frame the write itself fell in: a late write is the producer's slip, not the helper's.
    written: ruleFrame(at(epochs, edge.slot), edge.injectedNs),
  }));
  const stopped = final.flatMap((log, slot) => (/late kernel event|journal stopped/.test(log) ? [`helper ${slot}: ${/^wc3-journal: .*$/m.exec(log)?.[0] ?? "stopped"}`] : []));
  const off = results.filter((edge) => edge.frame !== edge.planned);
  const lateWrites = off.filter((edge) => edge.written !== edge.planned).length;
  yield* tryIntegrity("write result", out, () => writeFileSync(join(out, "result.json"), json({ script: scriptPath, build, epochs_ns: epochs, edges: results, off_frame: off.length, written_late: lateWrites, helpers_stopped: stopped })));
  for (const edge of results) console.log(`line ${edge.line} ${edge.slot === 0 ? "a" : "b"} planned ${edge.planned} written ${edge.written} landed ${edge.frame} (${edge.confirmedBy}): ${edge.text}`);
  console.log(`${results.length} edges, ${off.length} off their frame (${lateWrites} of them written late)${stopped.length > 0 ? `; ${stopped.join("; ")}` : ""}; ${join(out, "result.json")}`);
  if (off.length > 0 || stopped.length > 0) return yield* new IntegrityFailure({ operation: "replay pad script", path: out, cause: `${off.length} edges off their frame, ${stopped.length} helpers stopped` });
});

/**
 * Copies each client's input trace (trace-a.txt, trace-b.txt) and the moments
 * it saved since `sinceMs` beside the result, waiting for the traces the
 * integrity build writes about 20 s into the match.
 */
const collect = (data: readonly [string, string], out: string, sinceMs: number) => Effect.gen(function*() {
  const fresh = (path: string) => existsSync(path) && statSync(path).mtimeMs >= sinceMs;
  const deadline = Date.now() + TRACE_WAIT_MS;
  while (!data.every((dir) => fresh(join(dir, TRACE_FILE))) && Date.now() < deadline) yield* Effect.sleep("250 millis");
  yield* tryIntegrity("collect traces and moments", out, () => {
    data.forEach((dir, slot) => {
      const trace = join(dir, TRACE_FILE);
      if (fresh(trace)) copyFileSync(trace, join(out, `trace-${"ab"[slot]}.txt`));
      else console.error(`client ${"ab"[slot]}: no input trace written since the run began (${trace})`);
      const scene = join(dir, sceneFile(slot, SMASHCRAFT_HEADLESS.filePrefix));
      if (fresh(scene)) copyFileSync(scene, join(out, `scene-${"ab"[slot]}.txt`));
      for (const name of readdirSync(dir)) if (REPRO_NAME.test(name) && fresh(join(dir, name))) copyFileSync(join(dir, name), join(out, name));
    });
  });
});

interface PadOptions {
  readonly scriptPath: string;
  readonly steps: readonly PadStep[];
  readonly helper: string;
  readonly build: string;
  readonly out: string;
  readonly chat: string | undefined;
}

const native = (options: PadOptions, appIds: ReadonlyMap<string, string>) => Effect.scoped(Effect.gen(function*() {
  const { scriptPath, steps, helper, build, out, chat } = options;
  const loaded = yield* loadClients(clientState).pipe(Effect.mapError(fromDesktop));
  if (loaded.length !== 2) return yield* new IntegrityFailure({ operation: "load clients", path: clientState, cause: `${loaded.length} clients, need 2` });
  const clients = [at(loaded, 0), at(loaded, 1)] as const;
  yield* tryIntegrity("create pad directory", out, () => {
    mkdirSync(out, { recursive: true });
    // A rerun leaves nothing of the attempt before it.
    for (const name of readdirSync(out)) if (/^(trace-[ab]\.txt|scene-[ab]\.txt|result\.json)$/.test(name) || REPRO_NAME.test(name)) rmSync(join(out, name));
  });
  const data = [join(clients[0].documents, "CustomMapData"), join(clients[1].documents, "CustomMapData")] as const;
  const startedMs = Date.now();
  const startedNs = monotonicNs();
  const pads = [];
  for (const slot of SLOTS) {
    const client = clients[slot];
    const appId = appIds.get(client.name);
    if (appId === undefined) return yield* new UsageFailure({ problem: `--app-id ${client.name}=ID is missing` });
    const pid = yield* gameProcess(client, false);
    const device = yield* openPad([...PAD_BUTTONS, BTN_SELECT]);
    pads.push(device);
    yield* startHelper([
      helper, "--follow-matches", "--build", build, "--slot", String(slot), "--device", device.device, "--out", at(data, slot),
      "--editbox-display", client.x11.DISPLAY ?? "", "--x11-window", client.window, "--pid", String(pid), "--private-wlr-app-id", appId, "--trace",
    ], { ...Bun.env, ...client.x11, ...client.wayland }, join(out, `helper-${slot}.log`));
  }
  const log = (slot: number) => readFileSync(join(out, `helper-${slot}.log`), "utf8");
  const logs = (): [string, string] => [log(SLOTS[0]), log(SLOTS[1])];
  if (chat !== undefined) {
    yield* Effect.sleep("1 second");
    yield* keys(clients[0], "Return").pipe(Effect.andThen(typeText(clients[0], chat, 35)), Effect.andThen(keys(clients[0], "Return")), Effect.mapError(fromDesktop));
  }
  const epochs = yield* matchEpochs(logs, startedNs, out);
  yield* checkFirstEdge(steps, epochs, scriptPath);
  const producerPath = join(out, "producer.jsonl");
  const producer = yield* Effect.acquireRelease(tryIntegrity("open producer log", producerPath, () => openSync(producerPath, "w")), (fd) => Effect.sync(() => closeSync(fd)));
  const sent: SentEdge[] = [];
  for (const item of steps) {
    yield* until(frameWriteNs(at(epochs, item.slot), item.frame));
    if (item.kind === "capture") {
      const client = clients[item.slot];
      yield* Effect.forkScoped(capture(client).pipe(
        Effect.flatMap((frame) => tryIntegrity("save frame", out, () => writeFileSync(join(out, `frame-${item.frame}-${client.name}.ppm`), encodePpm(frame)))),
        Effect.catch((failure) => Effect.sync(() => console.error(`capture at frame ${item.frame}: ${failure.message}`))),
      ));
      continue;
    }
    for (const edge of item.edges) {
      const injection = inject(at(pads, item.slot), edge);
      writeSync(producer, producerLine(`line-${item.line}`, item.slot, edge, injection));
      sent.push({ line: item.line, text: item.text, slot: item.slot, planned: item.frame, injectedNs: injection.injectedNs });
    }
  }
  const last = steps.at(-1)?.frame ?? 0;
  yield* until(frameWriteNs(Math.max(...epochs), last + 30));
  const finished = yield* Effect.exit(finish(out, scriptPath, build, epochs, sent, logs()));
  yield* collect(data, out, startedMs);
  const invalid = invalidRun(clients.map((client) => client.name), clients.map((client) => client.documents), data, startedMs);
  if (invalid.length > 0) {
    yield* tryIntegrity("mark result invalid", out, () => {
      const path = join(out, "result.json");
      const result: unknown = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
      writeFileSync(path, json({ ...(typeof result === "object" && result !== null ? result : {}), invalid }));
    });
    console.log(`INVALID: desynced, rerun: ${invalid.join("; ")}`);
    return "invalid" as const;
  }
  yield* finished;
  return "valid" as const;
}));

/** A native run that proves nothing either way: the game desynced, a client crashed, or the match ended early. */
const INVALID_RUN = "invalid native run";

/** Why a native run is invalid: a desync report or crash in a client's Errors folder, or a match record (the match reached its results) since `sinceMs`. */
function invalidRun(names: readonly string[], documents: readonly string[], data: readonly string[], sinceMs: number): string[] {
  const reasons: string[] = [];
  const fresh = (path: string) => existsSync(path) && statSync(path).mtimeMs >= sinceMs;
  documents.forEach((dir, index) => {
    const errors = join(dir, "Errors");
    const folders = existsSync(errors) ? readdirSync(errors).filter((folder) => fresh(join(errors, folder))) : [];
    for (const folder of folders) reasons.push(`client ${names[index] ?? index} ${existsSync(join(errors, folder, "Crash.txt")) ? "crashed" : "wrote a desync report"} (Errors/${folder})`);
    const records = existsSync(at(data, index)) ? readdirSync(at(data, index)).filter((name) => /^smashcraft-match-\d+\.txt$/.test(name) && fresh(join(at(data, index), name))) : [];
    if (records.length > 0) reasons.push(`client ${names[index] ?? index} reached the match results (${records.join(", ")})`);
  });
  return reasons;
}

/** `bun wisp fresh MAP --no-quick`: a new game at fighter selection after a desynced run. */
const freshGame = (map: string) => Effect.gen(function*() {
  console.log(`starting a new game of ${map} for the rerun`);
  const code = yield* Effect.promise(() => Bun.spawn(["bun", join(import.meta.dir, "../../wisp.ts"), "fresh", map, "--no-quick"], { stdout: "inherit", stderr: "inherit" }).exited);
  if (code !== 0) return yield* new IntegrityFailure({ operation: "start a new game", path: map, cause: `bun wisp fresh exited ${code}` });
});

/** Writes the schedule from padScheduleWorker.ts's thread, so the headless clients' frames keep their time. */
const scheduled = (schedule: Schedule) => Effect.callback<readonly SentEdge[], IntegrityFailure>((resume) => {
  const worker = new Worker(join(import.meta.dir, "../../integrity/padScheduleWorker.ts"));
  const sent: SentEdge[] = [];
  worker.onmessage = (event: MessageEvent<ScheduleReply>) => {
    const reply = event.data;
    if (reply.kind === "sent") sent.push({ line: reply.line, text: reply.text, slot: reply.slot, planned: reply.planned, injectedNs: reply.injectedNs });
    else {
      worker.terminate();
      resume(reply.kind === "done" ? Effect.succeed(sent) : Effect.fail(new IntegrityFailure({ operation: "write pad edges", path: "padScheduleWorker", cause: reply.error })));
    }
  };
  worker.postMessage(schedule);
  return Effect.sync(() => worker.terminate());
});

const headless = (options: PadOptions) => Effect.scoped(Effect.gen(function*() {
  const { scriptPath, steps, helper, build, out, chat } = options;
  yield* tryIntegrity("create pad directory", out, () => mkdirSync(out, { recursive: true }));
  const entry = yield* loadEntry;
  const runtime = yield* Effect.acquireRelease(Effect.sync(() => installHeadless(PREDICTED_HEADLESS)), (installed) => Effect.sync(installed.restore));
  const data = [join(out, "client-0", "CustomMapData"), join(out, "client-1", "CustomMapData")] as const;
  const startedMs = Date.now();
  const startedNs = monotonicNs();
  const typed = new Map<number, TypedInput>();
  const pads: Pad[] = [];
  for (const slot of SLOTS) {
    const textPath = join(out, `typed-${slot}.txt`);
    typed.set(slot, yield* Effect.acquireRelease(tryIntegrity("open typed text", textPath, () => typedFile(textPath)), (input) => Effect.sync(input.close)));
    const device = yield* openPad([...PAD_BUTTONS, BTN_SELECT]);
    pads.push(device);
    yield* startHelper([
      helper, "--follow-matches", "--build", build, "--slot", String(slot), "--device", device.device, "--out", at(data, slot), "--text-out", textPath, "--trace",
    ], Bun.env, join(out, `helper-${slot}.log`));
  }
  const clients = runtime.clients(entry, SLOTS, { files: (slot) => customMapData(at(data, slot)), delivery: syncDelivery(MEASURED_BATTLE_NET, 1), keepCalls: 64 });
  const realtime = new RealtimeClients(clients, typed);
  let crashed: unknown;
  yield* tryIntegrity("start headless clients", out, () => realtime.start());
  yield* Effect.forkScoped(Effect.forever(Effect.suspend(() => Effect.sleep(Math.max(0, realtime.advance())))).pipe(
    Effect.catchDefect((cause) => Effect.sync(() => {
      crashed = cause;
    })),
  ));
  const log = (slot: number) => readFileSync(join(out, `helper-${slot}.log`), "utf8");
  const logs = (): [string, string] => [log(SLOTS[0]), log(SLOTS[1])];
  if (chat !== undefined) {
    yield* Effect.sleep("1 second");
    clients.chat(0, chat);
  }
  const epochs = yield* matchEpochs(logs, startedNs, out);
  yield* checkFirstEdge(steps, epochs, scriptPath);
  const edges: ScheduledEdge[] = steps.flatMap((item) => item.kind === "edge" ? item.edges.map((edge) => ({ slot: item.slot, frame: item.frame, edge, line: item.line, text: item.text })) : []);
  const sent = yield* scheduled({ pads: [at(pads, 0), at(pads, 1)], epochs, edges });
  const last = steps.at(-1)?.frame ?? 0;
  yield* until(frameWriteNs(Math.max(...epochs), last + 30));
  const finished = yield* Effect.exit(finish(out, scriptPath, build, epochs, sent, logs()));
  yield* collect(data, out, startedMs);
  const errors = clients.clients.flatMap((client) => client.errors.map((error) => `p${client.slot}: ${error}`));
  if (crashed !== undefined) errors.push(`headless clients stopped: ${describeCause(crashed)}`);
  if (errors.length > 0) return yield* new IntegrityFailure({ operation: "run headless clients", path: out, cause: errors.join("; ") });
  return yield* finished;
}));

export const pad: Command = (args) => Effect.gen(function*() {
  const parsed = yield* Effect.try({
    try: () => parseArgs({ args: [...args], allowPositionals: true, options: {
      helper: { type: "string" }, build: { type: "string" }, out: { type: "string" }, chat: { type: "string" }, "app-id": { type: "string", multiple: true },
      headless: { type: "boolean" }, compare: { type: "string" }, retries: { type: "string" }, map: { type: "string" },
    } }),
    catch: (cause) => new UsageFailure({ problem: describeCause(cause) }),
  });
  const { helper, out, chat, compare } = parsed.values;
  const isHeadless = parsed.values.headless === true;
  const build = parsed.values.build ?? (isHeadless ? INTEGRITY_BUILD.id : undefined);
  const [scriptPath] = parsed.positionals;
  if (scriptPath === undefined || helper === undefined || build === undefined || out === undefined) return yield* new UsageFailure({ problem: `usage: bun wisp ${USAGE}` });
  if (isHeadless && build !== INTEGRITY_BUILD.id) return yield* new UsageFailure({ problem: `--headless runs the integrity build (${INTEGRITY_BUILD.id}), not ${build}` });
  if (compare !== undefined && !isHeadless) return yield* new UsageFailure({ problem: "--compare NATIVE_DIR goes with --headless" });
  const script = yield* Effect.try({ try: () => readFileSync(scriptPath, "utf8"), catch: (cause) => new UsageFailure({ problem: describeCause(cause) }) });
  const steps = yield* Effect.try({ try: () => parsePadScript(script), catch: (cause) => new UsageFailure({ problem: describeCause(cause) }) });
  const options: PadOptions = { scriptPath, steps, helper, build, out, chat: chat ?? scriptChat(script) };
  if (!isHeadless) {
    const appIds = new Map<string, string>();
    for (const entry of parsed.values["app-id"] ?? []) {
      const separator = entry.indexOf("=");
      if (separator > 0) appIds.set(entry.slice(0, separator), entry.slice(separator + 1));
    }
    const retries = Number(parsed.values.retries ?? "3");
    const map = parsed.values.map;
    for (let attempt = 0; ; attempt++) {
      const ran = yield* onHealthyClients(native(options, appIds).pipe(step("pad script")), { retry: false });
      if (ran === "valid") return;
      if (map === undefined || attempt >= retries) {
        return yield* new IntegrityFailure({ operation: INVALID_RUN, path: out, cause: `desynced, rerun (${attempt + 1} attempt${attempt === 0 ? "" : "s"}${map === undefined ? "; --map MAP.w3x reruns it automatically" : ""})` });
      }
      console.log(`rerun ${attempt + 1} of ${retries}`);
      yield* freshGame(map);
    }
  }
  const ran = yield* Effect.exit(headless(options).pipe(step("headless pad script")));
  if (compare !== undefined) {
    const report = yield* tryIntegrity("compare with the native run", compare, () => compareRuns(compare, out, script));
    for (const line of report.lines) console.log(line);
    if (!report.passed) return yield* new IntegrityFailure({ operation: "pad parity", path: compare, cause: report.invalid === true ? "desynced, rerun the native run" : "the native run differs from the headless run" });
  }
  return yield* ran;
});
