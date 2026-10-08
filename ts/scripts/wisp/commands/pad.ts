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
// against it (smashcraft:ts/scripts/integrity/padParity.ts); without --compare
// it checks the script's own `#!` expectations against the headless run.
//
// Several scripts, or a folder of them, run as one batch: one game per client
// pair with `-dev reset` between scripts, the headless runs alongside, and
// `--pairs N` sharding over the LAN pool (smashcraft:ts/scripts/wisp/padBatch.ts).
import { copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync, writeSync, closeSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { Effect, Fiber, Option, Schema } from "effect";
import { linePreloadFile, preloadLines } from "wisp/scripts/wisp/boundary";
import { at } from "wisp/src/runtime/lookup";
import { type Command, UsageFailure, describeCause } from "wisp/scripts/wisp/command";
import { type DesktopFailure, batch, capture, loadClients } from "wisp/scripts/warcraft/desktop";
import { ClientWatch } from "wisp/scripts/wisp/watch";
import { confirmedCommand, openObservedChat } from "wisp/scripts/wisp/chatSetup";
import { encodePpm } from "wisp/scripts/wisp/frameProbe";
import { installHeadless, type HeadlessRuntime } from "wisp/scripts/wisp/headless";
import { readReplay } from "../replayFiles";
import { RealtimeClients, type TypedInput, customMapData, typedFile } from "wisp/scripts/wisp/headlessInput";
import { step } from "wisp/scripts/wisp/timings";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import { INTEGRITY_BUILD } from "../../../src/game/shell/currentBuild";
import { gameProcess, json, startHelper } from "../../integrity/capture";
import { IntegrityFailure, producerLine, tryIntegrity } from "../../integrity/evidence";
import { loadEntry } from "../../integrity/headless";
import { type Pad, inject, monotonicNs, openPad } from "../../integrity/linux";
import { BTN_SELECT, PAD_BUTTONS } from "../../integrity/linuxInput";
import { MATCH_REPLAY_NAME, REPRO_NAME, TRACE_FILE, checkHeadlessRun, compareRuns, comparisonSteps, scriptChat } from "../../integrity/padParity";
import type { Schedule, ScheduleReply, ScheduledEdge } from "../../integrity/padScheduleWorker";
import { type PadStep, type SentEdge, deadlineOrder, frameWriteNs, landEdges, matchStart, parsePadScript, ruleFrame } from "../../integrity/padScript";
import { SLOTS } from "../../integrity/reconcile";
import { captureWhenDrawn, drawnFrom, visualCaptureCommand, visualCaptureToken } from "../../integrity/drawnCapture";
import { visualReleaseFile } from "../../../src/game/shell/visualCapture";
import { drawnFrameFile, nativeChatFile, RESPONSE_TRACE_CALLBACKS } from "../../../src/runtime/gameFiles";
import { PREDICTED_HEADLESS, SMASHCRAFT_HEADLESS } from "../headless";
type HeadlessClient = ReturnType<HeadlessRuntime["clients"]>["clients"][number];
import { sceneFile } from "wisp/src/runtime/scene";
import { clientState } from "../project";
import { onHealthyClients, readClientsFile } from "../doctor";
import { DevCommandReceipt } from "../boundary";
import { devCommandReceiptFile } from "../../../src/runtime/gameFiles";
import { Phase } from "../../../src/game/match/rules";
import { admitCaptures, captureLoad, requireCaptureLease, timingCheck, timingScripts } from "../captureCapacity";
import { quickMatchHero, quickMatchStage, quickPainHero, quickRecoveryHero, quickOffstageHero } from "../../../src/game/shell/devSettings";

type DevReceipt = Effect.Success<ReturnType<typeof DevCommandReceipt.decode>>;

/** The existing setup state identifies quick commands without a second receipt protocol. */
export function requestedSetup(command: string, receipt: DevReceipt): boolean {
  const original = command.split(" |capture ")[0] ?? command;
  if (original === "-dev reset") return receipt.phase === Phase.characterMenu;
  const hero = quickMatchHero(original) ?? quickRecoveryHero(original) ?? quickOffstageHero(original) ?? quickPainHero(original)?.character;
  if (hero !== undefined) return receipt.phase === Phase.match && receipt.characters.split(",").every((value, slot) => (receipt.humanFighters & (1 << slot)) === 0 || Number(value) === hero);
  const stage = quickMatchStage(original);
  return stage === undefined || receipt.phase === Phase.match && receipt.stage === stage;
}

/**
 * A client's setup receipt, written since `sinceMs`. An older one is absent:
 * it belongs to another session, or to an install the client's prefix was
 * copied from, and may be in an older format.
 */
export const setupReceipt = (path: string, clientName: string, sinceMs: number) =>
  tryIntegrity("read setup receipt", clientName, () => existsSync(path) && statSync(path).mtimeMs >= sinceMs ? { text: readFileSync(path, "latin1"), modified: statSync(path).mtimeMs } : undefined).pipe(Effect.flatMap((stored) => stored === undefined || preloadLines(stored.text) === undefined ? Effect.succeed(undefined) : DevCommandReceipt.decode(path, stored.text).pipe(Effect.map((value) => ({ value, modified: stored.modified })), Effect.mapError((cause) => new IntegrityFailure({ operation: "read setup receipt", path: clientName, cause })))));

const setupCommand = (session: NativeSession, command: string, send: Effect.Effect<void, IntegrityFailure>) => Effect.gen(function*() {
  const targets = session.clients.map((client, slot) => {
    const path = join(at(session.data, slot), devCommandReceiptFile(session.build, slot));
    const read = setupReceipt(path, client.name, session.startedMs);
    type Stored = Exclude<Effect.Success<typeof read>, undefined>;
    return { client, read, requested: (current: Stored, before: Stored | undefined) => current.modified > (before?.modified ?? -1) && current.value.build === session.build && requestedSetup(command, current.value) };
  });
  const received = yield* confirmedCommand(command, targets, send).pipe(Effect.mapError((cause) => cause instanceof IntegrityFailure ? cause : fromDesktop(cause)));
  if (!received.every((item) => item.value.receipt === received[0]?.value.receipt)) return yield* new IntegrityFailure({ operation: "confirm setup receipt", path: session.clients.map((client) => client.name).join(","), cause: "selected clients acknowledged different command counters" });
  return received.map((item, slot) => ({ client: session.clients[slot]?.name, modified: item.modified, ...item.value }));
});

const USAGE = "pad SCRIPT --helper BINARY --build BUILD --out DIR --app-id a=ID --app-id b=ID [--chat=TEXT] [--map MAP.w3x [--retries N]] [--clients-file FILE]\n"
  + "       bun wisp pad SCRIPT --headless --helper BINARY --out DIR [--chat=TEXT] [--compare NATIVE_DIR] [--render DIR --frames N...]\n"
  + "       bun wisp pad SCRIPT|DIR... --helper BINARY --out DIR --map MAP.w3x [--pairs N | --pair K... | --app-id a=ID --app-id b=ID] [--headless-jobs N] [--fresh-each] [--hot] [--clients-file FILE]\n"
  + "       bun wisp pad SCRIPT|DIR... --headless --helper BINARY --out DIR [--headless-jobs N]";

/** How long a capture waits for its client to draw its frame: about 3 s behind the helper's clock, past #156's worst lag (88 frames). */
const CAPTURE_WAIT_MS = 10_000;

/** A short script can finish before the integrity trace, so collection allows its full recording plus delivery time. */
const TRACE_WAIT_MS = RESPONSE_TRACE_CALLBACKS * 1000 / 60 + 25_000;

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
    if (starts.every((start) => start !== undefined && start.epochNs > startedNs)) return [starts[0]?.frameOneNs ?? 0, starts[1]?.frameOneNs ?? 0] as const;
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
  yield* tryIntegrity("write result", out, () => writeFileSync(join(out, "result.json"), json({ ...captureLoad(), script: scriptPath, build, frame_one_ns: epochs, match_starts: final.map(matchStart), edges: results, off_frame: off.length, written_late: lateWrites, helpers_stopped: stopped })));
  for (const edge of results) console.log(`line ${edge.line} ${edge.slot === 0 ? "a" : "b"} planned ${edge.planned} written ${edge.written} landed ${edge.frame} (${edge.confirmedBy}): ${edge.text}`);
  console.log(`${results.length} edges, ${off.length} off their frame (${lateWrites} of them written late)${stopped.length > 0 ? `; ${stopped.join("; ")}` : ""}; ${join(out, "result.json")}`);
  if (off.length > 0 || stopped.length > 0) return yield* new IntegrityFailure({ operation: "replay pad script", path: out, cause: `${off.length} edges off their frame, ${stopped.length} helpers stopped` });
});

/**
 * Copies each client's input trace (trace-a.txt, trace-b.txt) and the moments
 * it saved since `sinceMs` beside the result, waiting for the traces the
 * integrity build writes after its complete recording.
 */
const collect = (data: readonly [string, string], out: string, sinceMs: number) => Effect.gen(function*() {
  const fresh = (path: string) => existsSync(path) && statSync(path).mtimeMs >= sinceMs;
  const deadline = Date.now() + TRACE_WAIT_MS;
  while (!data.every((dir) => fresh(join(dir, TRACE_FILE))) && Date.now() < deadline) yield* Effect.sleep("250 millis");
  yield* tryIntegrity("collect traces and moments", out, () => {
    for (const name of readdirSync(out)) if (MATCH_REPLAY_NAME.test(name)) rmSync(join(out, name));
    data.forEach((dir, slot) => {
      const trace = join(dir, TRACE_FILE);
      if (fresh(trace)) copyFileSync(trace, join(out, `trace-${"ab"[slot]}.txt`));
      else console.error(`client ${"ab"[slot]}: no input trace written since the run began (${trace})`);
      const scene = join(dir, sceneFile(slot, SMASHCRAFT_HEADLESS.filePrefix));
      if (fresh(scene)) copyFileSync(scene, join(out, `scene-${"ab"[slot]}.txt`));
      for (const name of readdirSync(dir)) {
        if (!fresh(join(dir, name))) continue;
        if (REPRO_NAME.test(name)) copyFileSync(join(dir, name), join(out, name));
        const match = /^smashcraft-replay-(\d+)\.txt$/.exec(name);
        if (match !== null) {
          const lines = readReplay(join(dir, name));
          if (typeof lines === "string") throw new Error(lines);
          writeFileSync(join(out, `smashcraft-replay-p${slot}-${match[1]}.txt`), `${lines.join("\n")}\n`);
        }
      }
    });
  });
});

export interface PadOptions {
  readonly scriptPath: string;
  readonly steps: readonly PadStep[];
  readonly helper: string;
  readonly build: string;
  readonly out: string;
  readonly chat: string | undefined;
  readonly candidate?: string | undefined;
  readonly render?: string | undefined;
  readonly renderFrames?: readonly number[] | undefined;
}

/** Helpers and virtual pads belong to one game, across all of its scripted matches. */
export const nativeSession = (out: string, helper: string, build: string, appIds: ReadonlyMap<string, string>, clientsFile: string = clientState) => Effect.gen(function*() {
  const startedMs = Date.now();
  const loaded = yield* loadClients(clientsFile).pipe(Effect.mapError(fromDesktop));
  if (loaded.length !== 2) return yield* new IntegrityFailure({ operation: "load clients", path: clientsFile, cause: `${loaded.length} clients, need 2` });
  const clients = [at(loaded, 0), at(loaded, 1)] as const;
  yield* tryIntegrity("create session directory", out, () => mkdirSync(out, { recursive: true }));
  const data = [join(clients[0].documents, "CustomMapData"), join(clients[1].documents, "CustomMapData")] as const;
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
  return { clients, data, pads, build, logs, startedMs };
});

export type NativeSession = Effect.Success<ReturnType<typeof nativeSession>>;

const ChatReceipt = Schema.Struct({ epoch: Schema.FiniteFromString, revision: Schema.FiniteFromString, chat: Schema.FiniteFromString, chatState: Schema.FiniteFromString });

/** Only complete game receipts may advance a keyboard hand-off. */
export function nativeChatReceipt(text: string) {
  const line = preloadLines(text)?.find((line) => line.startsWith("SMASHCRAFT TEXT ACK v=1 "));
  if (line === undefined) return undefined;
  return Option.getOrUndefined(Schema.decodeUnknownOption(ChatReceipt)(Object.fromEntries(line.split(" ").map((field) => field.split("=")))));
}

const ChatEntryReceipt = Schema.Struct({ revision: Schema.FiniteFromString, available: Schema.Literals(["0", "1"]), open: Schema.Literals(["0", "1"]) });

export function nativeChatEntryReceipt(text: string) {
  const line = preloadLines(text)?.find((line) => line.startsWith("SMASHCRAFT CHAT v=1 "));
  if (line === undefined) return undefined;
  return Option.getOrUndefined(Schema.decodeUnknownOption(ChatEntryReceipt)(Object.fromEntries(line.split(" ").map((field) => field.split("=")))));
}

/** Selection has no journal epoch: observe Warcraft's own chat entry before sending any text. */
const selectionChat = (session: NativeSession, text: string, timing: boolean) => setupCommand(session, text, Effect.gen(function*() {
  const path = join(session.data[0], nativeChatFile(session.build, 0));
  const receipt = () => existsSync(path) ? nativeChatEntryReceipt(readFileSync(path, "latin1")) : undefined;
  const entry = tryIntegrity("read chat entry", session.clients[0].name, () => {
    const current = receipt();
    return current === undefined ? undefined : { available: current.available === "1", open: current.open === "1", modified: statSync(path).mtimeMs };
  });
  yield* openObservedChat(session.clients[0], entry, requireCaptureLease(timing).pipe(Effect.andThen(batch(session.clients[0], [{ kind: "wait", millis: 250 }, { kind: "keys", keys: ["Return"] }]).pipe(Effect.provide(ClientWatch.layer({ filePrefix: "smashcraft" })), Effect.mapError(fromDesktop))), Effect.asVoid)).pipe(Effect.mapError((cause) => cause instanceof IntegrityFailure ? cause : fromDesktop(cause)));
  yield* batch(session.clients[0], [{ kind: "text", text, delayMillis: 35 }, { kind: "keys", keys: ["Return"], settleMillis: 0 }]).pipe(Effect.provide(ClientWatch.layer({ filePrefix: "smashcraft" })), Effect.mapError(fromDesktop));
}));

/** Return requests chat in the journal box; the helper opens chat after its quiescence handshake. */
export const nativeChat = (session: NativeSession, text: string) => setupCommand(session, text, Effect.gen(function*() {
  const host = session.clients[0];
  const epoch = matchStart(session.logs()[0])?.epoch;
  if (epoch === undefined) return yield* new IntegrityFailure({ operation: "open chat", path: host.name, cause: "no current journal match" });
  const path = join(session.data[0], `smashcraft-journal-text-ack-${session.build}-e${epoch}-p0.txt`);
  const receipt = () => existsSync(path) ? nativeChatReceipt(readFileSync(path, "latin1")) : undefined;
  const before = receipt();
  if (before === undefined || before.epoch !== epoch || before.chatState !== 0) return yield* new IntegrityFailure({ operation: "open chat", path, cause: "journal is not receiving input" });
  yield* batch(host, [{ kind: "wait", millis: 250 }, { kind: "keys", keys: ["Return"] }]).pipe(Effect.provide(ClientWatch.layer({ filePrefix: "smashcraft" })), Effect.mapError(fromDesktop));
  const deadline = Date.now() + 8000;
  for (;;) {
    const current = receipt();
    if (current !== undefined && current.epoch === epoch && current.revision > before.revision && current.chat > before.chat && current.chatState === 3) break;
    if (Date.now() > deadline) return yield* new IntegrityFailure({ operation: "open chat", path, cause: "no chatting receipt within 8 s of Return" });
    yield* Effect.sleep("20 millis");
  }
  yield* batch(host, [{ kind: "text", text, delayMillis: 35 }, { kind: "keys", keys: ["Return"], settleMillis: 0 }]).pipe(Effect.provide(ClientWatch.layer({ filePrefix: "smashcraft" })), Effect.mapError(fromDesktop));
}));

/** One script in the persistent native session's next match. */
export const nativeScript = (session: NativeSession, options: PadOptions) => Effect.scoped(Effect.gen(function*() {
  const { scriptPath, steps, build, out, chat } = options;
  const { clients, data, pads } = session;
  yield* tryIntegrity("create pad directory", out, () => {
    mkdirSync(out, { recursive: true });
    for (const name of readdirSync(out)) if (/^(trace-[ab]\.txt|scene-[ab]\.txt|result\.json|captures\.json|frame-\d+-\w+(-drawn-\d+)?\.ppm)$/.test(name) || REPRO_NAME.test(name)) rmSync(join(out, name));
  });
  const startedMs = Date.now();
  const startedNs = monotonicNs();
  const captureToken = chat !== undefined && steps.some(step => step.kind === "capture") ? visualCaptureToken(startedMs) : undefined;
  const from = session.logs().map((text) => text.length);
  const logs = (): [string, string] => {
    const [a, b] = session.logs();
    return [a.slice(from[0]), b.slice(from[1])];
  };
  if (chat !== undefined) {
    yield* Effect.sleep("1 second");
    const command = yield* tryIntegrity("prepare visual capture", scriptPath, () => captureToken === undefined ? chat : visualCaptureCommand(chat, captureToken, steps));
    const setup = yield* Effect.exit(selectionChat(session, command, timingCheck([steps])));
    if (setup._tag === "Failure") {
      const boundary = describeCause(setup.cause);
      yield* tryIntegrity("write invalid setup", out, () => writeFileSync(join(out, "result.json"), json({ ...captureLoad(), status: "INVALID", script: scriptPath, build, invalid: [boundary], setup: { command: chat, clients: clients.map((client) => client.name), boundary }, edges: [] })));
      console.log(`INVALID setup: ${boundary}; ${out}`);
      return "invalid" as const;
    }
    yield* tryIntegrity("write setup receipts", out, () => writeFileSync(join(out, "setup.json"), json({ command: chat, clients: setup.value, confirmed_monotonic_ns: monotonicNs() })));
  }
  yield* requireCaptureLease(timingCheck([steps]));
  const epochs = yield* matchEpochs(logs, startedNs, out);
  const matchIds = logs().map((text) => matchStart(text)?.epoch ?? 0);
  const captures: Record<string, unknown>[] = [];
  const captureFailures: { frame: number; message: string }[] = [];
  const shots: Fiber.Fiber<void>[] = [];
  yield* checkFirstEdge(steps, epochs, scriptPath);
  const producerPath = join(out, "producer.jsonl");
  const producer = yield* Effect.acquireRelease(tryIntegrity("open producer log", producerPath, () => openSync(producerPath, "w")), (fd) => Effect.sync(() => closeSync(fd)));
  const sent: SentEdge[] = [];
  for (const item of deadlineOrder(steps, epochs)) {
    yield* until(frameWriteNs(at(epochs, item.slot), item.frame));
    if (item.kind === "capture") {
      // Taken once the client has drawn the frame (scripts/integrity/drawnCapture.ts), named by the frame it showed.
      const client = clients[item.slot];
      const shot = captureWhenDrawn(drawnFrom(join(at(data, item.slot), drawnFrameFile(build, item.slot))), at(matchIds, item.slot), item.frame, CAPTURE_WAIT_MS, capture(client).pipe(Effect.mapError(fromDesktop)), out).pipe(
        Effect.flatMap(({ shot: frame, before, after, waitedMs }) => tryIntegrity("save frame", out, () => {
          const name = `frame-${item.frame}-${client.name}-drawn-${before}.ppm`;
          writeFileSync(join(out, name), encodePpm(frame));
          captures.push({ status: "PASS", mode: captureToken === undefined ? "live" : "held visual", candidate: options.candidate ?? build, build, epoch: at(matchIds, item.slot), line: item.line, client: client.name, planned: item.frame, drawn_before: before, drawn_after: after, waited_ms: Math.round(waitedMs), file: name });
        })),
        Effect.catch((failure) => Effect.sync(() => {
          console.error(`capture at frame ${item.frame}: ${failure.message}`);
          captures.push({ status: "INVALID", candidate: options.candidate ?? build, build, epoch: at(matchIds, item.slot), line: item.line, client: client.name, planned: item.frame, failed: failure.message });
          captureFailures.push({ frame: item.frame, message: failure.message });
        })),
        Effect.ensuring(Effect.sync(() => {
          if (captureToken !== undefined) {
            const path = join(at(data, item.slot), visualReleaseFile(captureToken, item.slot, item.frame));
            writeFileSync(`${path}.next`, linePreloadFile(captureToken));
            renameSync(`${path}.next`, path);
          }
        })),
      );
      shots.push(yield* Effect.forkScoped(shot));
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
  yield* Fiber.joinAll(shots);
  if (captures.length > 0) yield* tryIntegrity("write captures", out, () => writeFileSync(join(out, "captures.json"), json(captures)));
  const finished = yield* Effect.exit(finish(out, scriptPath, build, epochs, sent, logs()));
  yield* tryIntegrity("save script helper logs", out, () => logs().forEach((text, slot) => writeFileSync(join(out, `helper-${slot}.log`), text)));
  yield* collect(data, out, startedMs);
  const invalid = [...captureFailures.sort((a, b) => a.frame - b.frame).map(({ message }) => message), ...invalidRun(clients.map((client) => client.name), clients.map((client) => client.documents), data, startedMs)];
  if (captures.length > 0) console.log(`captures ${invalid.length === 0 ? "PASS" : "INVALID"}: ${captures.length - captureFailures.length}/${captures.length} retained; ${join(out, "captures.json")}`);
  if (invalid.length > 0) {
    yield* tryIntegrity("mark result invalid", out, () => {
      const path = join(out, "result.json");
      const result: unknown = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
      writeFileSync(path, json({ ...(typeof result === "object" && result !== null ? result : {}), invalid }));
    });
    console.log(`INVALID: ${invalid[0]}; retained evidence: ${out}`);
    return "invalid" as const;
  }
  yield* finished;
  return "valid" as const;
}));

/** A standalone script owns and closes its one-game session. */
export const native = (options: PadOptions, appIds: ReadonlyMap<string, string>, clientsFile: string = clientState) => Effect.scoped(Effect.gen(function*() {
  const session = yield* nativeSession(join(options.out, "session"), options.helper, options.build, appIds, clientsFile);
  return yield* nativeScript(session, options);
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
const freshGame = (map: string, clientsFile: string) => Effect.gen(function*() {
  console.log(`starting a new game of ${map} for the rerun`);
  const code = yield* Effect.promise(() => Bun.spawn(["bun", join(import.meta.dir, "../../wisp.ts"), "fresh", map, "--no-quick", "--clients-file", clientsFile], { stdout: "inherit", stderr: "inherit" }).exited);
  if (code !== 0) return yield* new IntegrityFailure({ operation: "start a new game", path: map, cause: `bun wisp fresh exited ${code}` });
});

/** The thread padScheduleWorker.ts runs in, started before the match so its module has loaded by the first edge. */
const scheduleThread = Effect.acquireRelease(
  Effect.sync(() => new Worker(join(import.meta.dir, "../../integrity/padScheduleWorker.ts"))),
  (worker) => Effect.sync(() => worker.terminate()),
);

/** Writes the schedule from that thread, so the headless clients' frames keep their time. */
const scheduled = (worker: Worker, schedule: Schedule) => Effect.callback<readonly SentEdge[], IntegrityFailure>((resume) => {
  const sent: SentEdge[] = [];
  worker.onmessage = (event: MessageEvent<ScheduleReply>) => {
    const reply = event.data;
    if (reply.kind === "sent") sent.push({ line: reply.line, text: reply.text, slot: reply.slot, planned: reply.planned, injectedNs: reply.injectedNs });
    else resume(reply.kind === "done" ? Effect.succeed(sent) : Effect.fail(new IntegrityFailure({ operation: "write pad edges", path: "padScheduleWorker", cause: reply.error })));
  };
  worker.postMessage(schedule);
});

/**
 * Two headless clients of the integrity build with their real helpers, run
 * in real time until the scope closes. The helpers follow every match, so a
 * session can play one script after another (`pad SCRIPT SCRIPT... --headless`).
 */
export const headlessSession = (dir: string, helper: string, build: string, afterFrame?: (clients: readonly HeadlessClient[]) => void) => Effect.gen(function*() {
  yield* tryIntegrity("create pad directory", dir, () => mkdirSync(dir, { recursive: true }));
  const entry = yield* loadEntry;
  const runtime = yield* Effect.acquireRelease(Effect.sync(() => installHeadless(PREDICTED_HEADLESS)), (installed) => Effect.sync(installed.restore));
  const data = [join(dir, "client-0", "CustomMapData"), join(dir, "client-1", "CustomMapData")] as const;
  const typed = new Map<number, TypedInput>();
  const pads: Pad[] = [];
  for (const slot of SLOTS) {
    const textPath = join(dir, `typed-${slot}.txt`);
    typed.set(slot, yield* Effect.acquireRelease(tryIntegrity("open typed text", textPath, () => typedFile(textPath)), (input) => Effect.sync(input.close)));
    const device = yield* openPad([...PAD_BUTTONS, BTN_SELECT]);
    pads.push(device);
    yield* startHelper([
      helper, "--follow-matches", "--build", build, "--slot", String(slot), "--device", device.device, "--out", at(data, slot), "--text-out", textPath, "--trace",
    ], Bun.env, join(dir, `helper-${slot}.log`));
  }
  const worker = yield* scheduleThread;
  const clients = runtime.clients(entry, SLOTS, { files: (slot) => customMapData(at(data, slot)), delivery: syncDelivery(MEASURED_BATTLE_NET, 1), keepCalls: 64 });
  const realtime = new RealtimeClients(clients, typed, undefined, () => afterFrame?.(clients.clients));
  const state: { crashed: unknown } = { crashed: undefined };
  yield* tryIntegrity("start headless clients", dir, () => realtime.start());
  yield* Effect.forkScoped(Effect.forever(Effect.suspend(() => Effect.sleep(Math.max(0, realtime.advance())))).pipe(
    Effect.catchDefect((cause) => Effect.sync(() => {
      state.crashed = cause;
    })),
  ));
  const log = (slot: number) => readFileSync(join(dir, `helper-${slot}.log`), "utf8");
  return { dir, build, data, pads, worker, clients, state, logs: (): [string, string] => [log(SLOTS[0]), log(SLOTS[1])] };
});

export type HeadlessSession = Effect.Success<ReturnType<typeof headlessSession>>;

/** One script in a session's next match: its chat starts the match, the result and traces go to options.out. */
export const headlessScript = (session: HeadlessSession, options: PadOptions) => Effect.gen(function*() {
  const { scriptPath, steps, build, out, chat } = options;
  yield* tryIntegrity("create pad directory", out, () => mkdirSync(out, { recursive: true }));
  const { clients, pads, worker, data } = session;
  const startedMs = Date.now();
  const startedNs = monotonicNs();
  // This script's part of each helper log: the session's helpers log every match.
  const from = session.logs().map((text) => text.length);
  const logs = (): [string, string] => {
    const [a, b] = session.logs();
    return [a.slice(from[0]), b.slice(from[1])];
  };
  const errorsBefore = clients.clients.map((client) => client.errors.length);
  if (chat !== undefined) {
    yield* Effect.sleep("1 second");
    clients.chat(0, chat);
  }
  const epochs = yield* matchEpochs(logs, startedNs, out);
  yield* checkFirstEdge(steps, epochs, scriptPath);
  const edges: ScheduledEdge[] = steps.flatMap((item) => item.kind === "edge" ? item.edges.map((edge) => ({ slot: item.slot, frame: item.frame, edge, line: item.line, text: item.text })) : []);
  const sent = yield* scheduled(worker, { pads: [at(pads, 0), at(pads, 1)], epochs, edges });
  const last = steps.at(-1)?.frame ?? 0;
  yield* until(frameWriteNs(Math.max(...epochs), last + 30));
  const finished = yield* Effect.exit(finish(out, scriptPath, build, epochs, sent, logs()));
  yield* collect(data, out, startedMs);
  const errors = clients.clients.flatMap((client, index) => client.errors.slice(errorsBefore[index]).map((error) => `p${client.slot}: ${error}`));
  if (session.state.crashed !== undefined) errors.push(`headless clients stopped: ${describeCause(session.state.crashed)}`);
  if (errors.length > 0) return yield* new IntegrityFailure({ operation: "run headless clients", path: out, cause: errors.join("; ") });
  return yield* finished;
});

const headless = (options: PadOptions) => Effect.gen(function*() {
  const token = visualCaptureToken();
  if (options.render !== undefined && options.chat === undefined) return yield* new UsageFailure({ problem: "rendered pad scripts need a #! chat setup command" });
  const captures = options.chat !== undefined && options.steps.some((step) => step.kind === "capture");
  const frames = !captures ? undefined : (yield* Effect.promise(() => import("../padRender"))).padRender(options.out, options.build, options.steps, token, options.render === undefined ? [] : options.renderFrames);
  const result = yield* Effect.scoped(Effect.gen(function*() {
    const session = yield* headlessSession(options.out, options.helper, options.build, frames?.afterFrame);
    return yield* headlessScript(session, frames === undefined || options.chat === undefined ? options : { ...options, chat: visualCaptureCommand(options.chat, token, options.steps) });
  }));
  if (frames !== undefined && options.render !== undefined) {
    yield* Effect.suspend(() => frames.render(options.render ?? options.out)).pipe(
      Effect.mapError((cause) => new IntegrityFailure({ operation: "render pad frames", path: options.render ?? options.out, cause: describeCause(cause) })),
    );
  }
  return result;
});

export const pad: Command = (args) => Effect.gen(function*() {
  const parsed = yield* Effect.try({
    try: () => parseArgs({ args: [...args], allowPositionals: true, options: {
      helper: { type: "string" }, build: { type: "string" }, out: { type: "string" }, chat: { type: "string" }, "app-id": { type: "string", multiple: true },
      headless: { type: "boolean" }, compare: { type: "string" }, retries: { type: "string" }, map: { type: "string" },
      render: { type: "string" }, frames: { type: "string" },
      pairs: { type: "string" }, pair: { type: "string", multiple: true }, pool: { type: "string" }, "fresh-each": { type: "boolean" }, hot: { type: "boolean" }, "headless-jobs": { type: "string" },
      "clients-file": { type: "string" },
    } }),
    catch: (cause) => new UsageFailure({ problem: describeCause(cause) }),
  });
  if (parsed.values.headless !== true) {
    const clientsFile = parsed.values["clients-file"] ?? clientState;
    yield* Effect.try({ try: () => readClientsFile(clientsFile), catch: (cause) => new UsageFailure({ problem: `can't read the clients from ${clientsFile}: ${describeCause(cause)}` }) });
    const { batchScripts } = yield* Effect.promise(() => import("../padBatch"));
    const timing = yield* Effect.sync(() => {
      try {
        return timingScripts(batchScripts(parsed.positionals));
      } catch {
        return true;
      }
    });
    if (yield* admitCaptures(args, timing)) return;
  }
  const { helper, out, chat, compare } = parsed.values;
  const clientsFile = parsed.values["clients-file"] ?? clientState;
  const renderFrames = parsed.values.frames?.split(",").map(Number);
  if (renderFrames !== undefined && (parsed.values.render === undefined || renderFrames.length === 0 || renderFrames.some((frame) => !Number.isInteger(frame) || frame < 0))) return yield* new UsageFailure({ problem: "--frames takes comma-separated whole frame numbers and needs --render DIR" });
  if (parsed.values.render !== undefined && (parsed.values.headless !== true || parsed.values.pairs !== undefined || (parsed.values.pair?.length ?? 0) > 0 || parsed.positionals.length !== 1 || parsed.positionals[0] === undefined || !existsSync(parsed.positionals[0]) || statSync(parsed.positionals[0]).isDirectory())) return yield* new UsageFailure({ problem: "pad --render DIR takes one existing script with --headless" });
  // Several scripts, or a folder of them, are one batch: one game per pair (scripts/wisp/padBatch.ts).
  if (parsed.values.pairs !== undefined || (parsed.values.pair?.length ?? 0) > 0 || parsed.positionals.length > 1 || (parsed.positionals[0] !== undefined && existsSync(parsed.positionals[0]) && statSync(parsed.positionals[0]).isDirectory())) return yield* scriptBatch(parsed.values, parsed.positionals);
  const isHeadless = parsed.values.headless === true;
  const build = parsed.values.build ?? (isHeadless ? INTEGRITY_BUILD.id : undefined);
  const [scriptPath] = parsed.positionals;
  if (scriptPath === undefined || helper === undefined || build === undefined || out === undefined) return yield* new UsageFailure({ problem: `usage: bun wisp ${USAGE}` });
  if (isHeadless && build !== INTEGRITY_BUILD.id) return yield* new UsageFailure({ problem: `--headless runs the integrity build (${INTEGRITY_BUILD.id}), not ${build}` });
  if (compare !== undefined && !isHeadless) return yield* new UsageFailure({ problem: "--compare NATIVE_DIR goes with --headless" });
  const script = yield* Effect.try({ try: () => readFileSync(scriptPath, "utf8"), catch: (cause) => new UsageFailure({ problem: describeCause(cause) }) });
  const steps = yield* Effect.try({ try: () => compare === undefined ? parsePadScript(script) : comparisonSteps(script, scriptPath), catch: (cause) => new UsageFailure({ problem: describeCause(cause) }) });
  if (renderFrames !== undefined && renderFrames.some((frame) => !steps.some((step) => step.kind === "capture" && step.frame === frame))) return yield* new UsageFailure({ problem: "every --frames value must name a capture in the pad script" });
  const options: PadOptions = { scriptPath, steps, helper, build, out, chat: chat ?? scriptChat(script), candidate: parsed.values.map, render: parsed.values.render, renderFrames };
  if (!isHeadless) {
    const appIds = new Map<string, string>();
    for (const entry of parsed.values["app-id"] ?? []) {
      const separator = entry.indexOf("=");
      if (separator > 0) appIds.set(entry.slice(0, separator), entry.slice(separator + 1));
    }
    const retries = Number(parsed.values.retries ?? "3");
    const map = parsed.values.map;
    for (let attempt = 0; ; attempt++) {
      const ran = yield* onHealthyClients(native(options, appIds, clientsFile).pipe(step("pad script")), { retry: false, clientsFile });
      if (ran === "valid") return;
      if (map === undefined || attempt >= retries) {
        return yield* new IntegrityFailure({ operation: INVALID_RUN, path: out, cause: `desynced, rerun (${attempt + 1} attempt${attempt === 0 ? "" : "s"}${map === undefined ? "; --map MAP.w3x reruns it automatically" : ""})` });
      }
      console.log(`rerun ${attempt + 1} of ${retries}`);
      yield* freshGame(map, clientsFile);
    }
  }
  const ran = yield* Effect.exit(headless(options).pipe(step("headless pad script")));
  if (compare !== undefined) {
    const report = yield* tryIntegrity("compare with the native run", compare, () => compareRuns(compare, out, script));
    for (const line of report.lines) console.log(line);
    if (!report.passed) return yield* new IntegrityFailure({ operation: "pad parity", path: compare, cause: report.invalid === true ? "desynced, rerun the native run" : "the native run differs from the headless run" });
    return yield* ran;
  }
  yield* ran;
  // Alone, the headless run holds the script's own expectations (bun wisp farm pads).
  const report = yield* tryIntegrity("check the script's expectations", out, () => checkHeadlessRun(out, script));
  for (const line of report.lines) console.log(line);
  if (!report.passed) return yield* new IntegrityFailure({ operation: "pad expectations", path: out, cause: "the script's expectations don't hold headless" });
});

/** `pad SCRIPT|DIR...`: many scripts in one game per pair (scripts/wisp/padBatch.ts). */
const scriptBatch = (values: { readonly [name: string]: string | boolean | readonly string[] | undefined }, positionals: readonly string[]) => Effect.gen(function*() {
  const text = (name: string) => (typeof values[name] === "string" ? values[name] : undefined);
  const { padBatch, headlessBatch, batchScripts, lanPairs, withTools, LAN_POOL_FILE } = yield* Effect.promise(() => import("../padBatch"));
  const helper = text("helper");
  const out = text("out");
  const map = text("map");
  const build = text("build") ?? INTEGRITY_BUILD.id;
  const headlessJobs = Number(text("headless-jobs") ?? "3");
  if (values.headless === true && helper !== undefined && out !== undefined && positionals.length > 0) {
    const scripts = yield* Effect.try({ try: () => batchScripts(positionals), catch: (cause) => new UsageFailure({ problem: describeCause(cause) }) });
    return yield* headlessBatch({ scripts, helper, build, out, headlessJobs, retries: Number(text("retries") ?? "2") });
  }
  if (helper === undefined || out === undefined || map === undefined || positionals.length === 0) {
    return yield* new UsageFailure({ problem: "usage: bun wisp pad SCRIPT|DIR... --helper BINARY --out DIR (--map MAP.w3x | --headless) [--build BUILD] [--pairs N | --pair K... [--pool POOL.json] | --app-id a=ID --app-id b=ID] [--clients-file FILE] [--retries N] [--headless-jobs N] [--fresh-each] [--hot]" });
  }
  const pairCount = text("pairs");
  const clientsFile = text("clients-file") ?? clientState;
  const appIds = new Map<string, string>();
  for (const entry of Array.isArray(values["app-id"]) ? values["app-id"] : []) {
    const separator = entry.indexOf("=");
    if (separator > 0) appIds.set(entry.slice(0, separator), entry.slice(separator + 1));
  }
  const pairs = yield* Effect.try({
    try: () => {
      const ids = (Array.isArray(values.pair) ? values.pair : []).map(Number);
      if (pairCount === undefined && ids.length === 0) return [{ name: "a+b", clients: clientsFile, appIds }];
      return lanPairs(text("pool") ?? LAN_POOL_FILE, ids.length > 0 ? { ids } : { count: Number(pairCount) }).map((pair) => withTools(pair, clientsFile, out));
    },
    catch: (cause) => new UsageFailure({ problem: describeCause(cause) }),
  });
  const scripts = yield* Effect.try({ try: () => batchScripts(positionals), catch: (cause) => new UsageFailure({ problem: describeCause(cause) }) });
  return yield* padBatch({
    scripts, pairs, helper, build, out, map,
    retries: Number(text("retries") ?? "2"), freshEach: values["fresh-each"] === true, hot: values.hot === true, headlessJobs,
  });
});
