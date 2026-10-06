// Runs #26's integrity capture without Warcraft (wisp#12): the integrity
// build's TypeScript in two of Wisp's headless clients, run in real time, and
// the real input path into them: one virtual pad, kernel observer and
// persistent wc3-journal helper per player, each helper typing its journal
// into its client's edit box through --text-out and reading the files its
// client writes in a real CustomMapData folder. The journey and the
// reconciler are the native capture's (journey.ts, reconcile.ts).
import { appendFileSync, closeSync, mkdirSync, openSync, writeFileSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import type { Subprocess } from "bun";
import { Effect, Exit } from "effect";
import type { MapEntry } from "wisp/src/headless/client";
import { at } from "wisp/src/runtime/lookup";
import { sceneFile } from "wisp/src/runtime/scene";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { RealtimeClients, type TypedInput, customMapData, typedFile } from "wisp/scripts/wisp/headlessInput";
import { readSceneLines, sceneProblems } from "wisp/scripts/wisp/scene";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/scripts/wisp/syncChannel";
import { INTEGRITY_BUILD } from "../../src/game/shell/currentBuild";
import { PREDICTED_HEADLESS, SMASHCRAFT_HEADLESS } from "../wisp/headless";
import { SMASHCRAFT_SCENE } from "../wisp/playerView";
import { tsDirectory } from "../wisp/project";
import { json, startHelper } from "./capture";
import { IntegrityFailure, producerLine, tryIntegrity, tryIntegrityPromise } from "./evidence";
import { type JourneyRecord, Rig, type RigShape, type Stopped, runJourney } from "./journey";
import { type Observer, type Pad, continueProcess, observeDevice, openPad, realtimeNs } from "./linux";
import { type Injection, PAD_BUTTONS, type SourceEdge } from "./linuxInput";
import { SLOTS, type Slot } from "./reconcile";
import { archiveFiles, fileRig, stopHelperProcess, uiLogger } from "./rig";

interface HeadlessCaptureOptions {
  /** The persistent controller helper binary, built with --text-out. */
  readonly helper: string;
  readonly out: string;
}

const USAGE = "bun wisp parity headless --helper BINARY --out DIR";

const SCOPE = "Same-process two-client headless start/result/rematch: Wisp's headless runtime runs the integrity build's TypeScript in real time "
  + "(60 frames a second; sync messages arrive with Battle.net's measured latency, wisp:docs/network-model.md, no client lag); persistent Linux "
  + "virtual-pad wc3-journal helpers type into each client's edit box (--text-out) and read its CustomMapData folder; issue 26 all-binding "
  + "integrity run; no Warcraft engine, rendering, edit-box focus or network claim.";

export function parseHeadlessArguments(args: readonly string[]): HeadlessCaptureOptions {
  const { values } = parseArgs({ args: [...args], options: { helper: { type: "string" }, out: { type: "string" } }, strict: true });
  if (values.helper === undefined || values.out === undefined) throw new Error(`usage: ${USAGE}`);
  return { helper: values.helper, out: values.out };
}

/** The native capture's desktop: 2560x1440 with Warcraft's 4:3 UI centered, 0.8 by 0.6 units high. */
const DESKTOP_WIDTH = 2560;
const DESKTOP_HEIGHT = 1440;
const UI_PIXELS = (DESKTOP_HEIGHT * 4) / 3;

/** A native desktop click's point in Warcraft's UI coordinates. */
const uiPoint = (x: number, y: number): readonly [number, number] => [
  ((x - (DESKTOP_WIDTH - UI_PIXELS) / 2) / UI_PIXELS) * 0.8,
  ((DESKTOP_HEIGHT - y) / DESKTOP_HEIGHT) * 0.6,
];

const MODIFIERS: Readonly<Record<string, number>> = { shift: 1, ctrl: 2, alt: 4 };

/** A desktop key chord, such as ctrl+g, as Warcraft's key code and modifiers. */
function keyChord(chord: string): readonly [key: number, meta: number] | undefined {
  const parts = chord.toLowerCase().split("+");
  const key = parts.pop() ?? "";
  let meta = 0;
  for (const part of parts) {
    const modifier = MODIFIERS[part];
    if (modifier === undefined) return undefined;
    meta |= modifier;
  }
  return /^[a-z0-9]$/.test(key) ? [key.toUpperCase().charCodeAt(0), meta] : undefined;
}

const UI_WAIT_MILLIS = 25_000;
const POLL_MILLIS = 20;
/** Seeds the measured sync-message latency, so its delays repeat from run to run. */
const DELIVERY_SEED = 1;
/** Native calls each headless client keeps after the clients compared them: a desync's context. */
const KEPT_CALLS = 64;

type PadReply = { readonly injection: Injection } | { readonly error: string };

/** Pad writes in padWorker.ts's thread, in order, each answered with its injection times. */
const padThread = Effect.acquireRelease(
  Effect.sync(() => {
    const worker = new Worker(join(import.meta.dir, "padWorker.ts"));
    const waiting: ((reply: PadReply) => void)[] = [];
    worker.onmessage = (event: MessageEvent<PadReply>) => waiting.shift()?.(event.data);
    const write = (pad: Pad, edge: SourceEdge) =>
      Effect.callback<Injection, IntegrityFailure>((resume) => {
        waiting.push((reply) => resume("error" in reply ? Effect.fail(new IntegrityFailure({ operation: "write pad edge", path: pad.device, cause: reply.error })) : Effect.succeed(reply.injection)));
        worker.postMessage({ pad, edge });
      });
    return { worker, write };
  }),
  ({ worker }) => Effect.sync(() => worker.terminate()),
);

const loadEntry = tryIntegrityPromise("load the integrity entry", "src/platform/integrityMain.ts", async (): Promise<MapEntry> => {
  // Loaded at run time, so the host type check never reads map code.
  const module: unknown = await import(join(tsDirectory, "src/platform/integrityMain.ts"));
  if (typeof module !== "object" || module === null || !("start" in module) || !("install" in module)) throw new Error("no start() and install()");
  const { start, install } = module;
  if (typeof start !== "function" || typeof install !== "function") throw new Error("start and install aren't functions");
  return { start: () => start(), install: () => install() };
});

export const captureHeadless = (options: HeadlessCaptureOptions) =>
  Effect.gen(function*() {
    const { out } = options;
    const build = INTEGRITY_BUILD.id;
    const epochs = [1, 2];
    yield* tryIntegrity("create capture directory", out, () => {
      mkdirSync(dirname(out), { recursive: true });
      mkdirSync(out);
    });
    const startedNs = realtimeNs();
    const data = [join(out, "client-0", "CustomMapData"), join(out, "client-1", "CustomMapData")] as const;
    const events: JourneyRecord[] = [];
    /** What each client shows at the end, kept in screens.txt as the native capture keeps ui.txt. */
    let screens = () => "";
    const entry = yield* loadEntry;

    const run = Effect.scoped(Effect.gen(function*() {
      const runtime = yield* Effect.acquireRelease(Effect.sync(() => installHeadless(PREDICTED_HEADLESS)), (runtime) => Effect.sync(runtime.restore));
      const typed = new Map<number, TypedInput>();
      const pads: Pad[] = [];
      const observers: Observer[] = [];
      const helpers: Subprocess[] = [];
      for (const slot of SLOTS) {
        const textPath = join(out, `typed-${slot}.txt`);
        typed.set(slot, yield* Effect.acquireRelease(tryIntegrity("open typed text", textPath, () => typedFile(textPath)), (input) => Effect.sync(input.close)));
        const pad = yield* openPad(PAD_BUTTONS);
        pads.push(pad);
        observers.push(yield* observeDevice(pad.device, join(out, `kernel-${slot}.jsonl`)));
        helpers.push(yield* startHelper([
          options.helper, "--follow-matches", "--build", build, "--slot", String(slot), "--device", pad.device, "--out", at(data, slot),
          "--text-out", textPath, "--trace",
        ], Bun.env, join(out, `helper-${slot}.log`)));
      }
      const clients = runtime.clients(entry, SLOTS, {
        files: (slot) => customMapData(at(data, slot)),
        delivery: syncDelivery(MEASURED_BATTLE_NET, DELIVERY_SEED),
        keepCalls: KEPT_CALLS,
      });
      const padPair = [at(pads, 0), at(pads, 1)] as const;
      const padWrites = yield* padThread;
      const realtime = new RealtimeClients(clients, typed);
      let stopped: IntegrityFailure | undefined;
      const gameFailure = () => {
        if (stopped !== undefined) return stopped;
        const errors = clients.clients.flatMap((client) => client.errors.map((error) => `p${client.slot}: ${error}`));
        return errors.length === 0 ? undefined : new IntegrityFailure({ operation: "run headless clients", path: out, cause: errors.join("; ") });
      };
      yield* tryIntegrity("start headless clients", out, () => realtime.start());
      yield* Effect.forkScoped(Effect.forever(Effect.suspend(() => Effect.sleep(Math.max(0, realtime.advance())))).pipe(
        Effect.catchDefect((cause) => Effect.sync(() => {
          stopped = new IntegrityFailure({ operation: "run headless clients", path: out, cause });
        })),
      ));

      const producerPath = join(out, "producer.jsonl");
      const producerLog = yield* Effect.acquireRelease(tryIntegrity("open producer log", producerPath, () => openSync(producerPath, "w")), (fd) => Effect.sync(() => closeSync(fd)));
      const names = ["headless-0", "headless-1"] as const;
      const logUi = uiLogger(out, names);
      /** Warcraft's chat entry on each client: the line typed since Return opened it. */
      const chatting: (string | undefined)[] = [undefined, undefined];
      const helperPair = [at(helpers, 0), at(helpers, 1)] as const;
      const shared = fileRig({ data, out, build, startedNs, pads: padPair, observers, helpers: helperPair, producerLog, events, gameFailure });
      const screen = (client: Slot) => clients.client(client).frames.shownText().join("\n");
      screens = () => SLOTS.map((slot) => `${names[slot]} after frame ${clients.frame}:\n${screen(slot)}\n`).join("\n");
      const rig: RigShape = {
        ...shared,
        send: ({ slot, edge, phase }) =>
          padWrites.write(padPair[slot], edge).pipe(Effect.flatMap((injection) =>
            tryIntegrity("log pad edge", producerPath, () => writeSync(producerLog, producerLine(phase, slot, edge, injection))))),
        stop: (target) => target.kind === "helper"
          ? stopHelperProcess(helperPair, target)
          : Effect.sync((): Stopped => {
            realtime.hold(target.slot);
            return { target, pid: process.pid };
          }),
        resume: ({ target, pid }) => target.kind === "helper" ? continueProcess(pid) : Effect.sync(() => realtime.release(target.slot)),
        waitText: (client, pattern) =>
          Effect.gen(function*() {
            const deadline = performance.now() + UI_WAIT_MILLIS;
            for (;;) {
              const text = screen(client);
              if (pattern.test(text.split(/\s+/).join(" ")) || pattern.test(text)) {
                yield* logUi(client, "wait", `${pattern.source}\n${text}`);
                return text;
              }
              yield* shared.healthy;
              if (performance.now() > deadline) {
                yield* logUi(client, "wait expired", `${pattern.source}\n${text}`);
                return yield* new IntegrityFailure({ operation: `text ${pattern.source}`, path: names[client], cause: `not shown within ${UI_WAIT_MILLIS / 1000} s` });
              }
              yield* Effect.sleep(POLL_MILLIS);
            }
          }),
        // The headless screen is the client's whole shown text; a region narrows nothing.
        readText: (client, region) =>
          Effect.sync(() => screen(client)).pipe(
            Effect.tap((text) => logUi(client, "read", `${region.x},${region.y} ${region.width}x${region.height}\n${text}`)),
          ),
        click: (client, x, y) =>
          Effect.suspend(() => {
            const [uiX, uiY] = uiPoint(x, y);
            const took = clients.click(client, uiX, uiY);
            return logUi(client, "click", `${x} ${y}${took ? "" : " (no frame)"}`);
          }),
        key: (client, key) =>
          Effect.gen(function*() {
            if (key === "Return") {
              const line = chatting[client];
              chatting[client] = line === undefined ? "" : undefined;
              if (line !== undefined && line !== "") clients.chat(client, line);
              return;
            }
            const chord = keyChord(key);
            if (chord === undefined) return yield* new IntegrityFailure({ operation: "press key", path: names[client], cause: `no Warcraft key for ${key}` });
            clients.press(client, chord[0], chord[1]);
          }),
        type: (client, text) =>
          Effect.sync(() => {
            const line = chatting[client];
            if (line === undefined) clients.type(client, text);
            else chatting[client] = line + text;
          }),
        // Nothing is rendered, and what reaches the screen keeps its native
        // check: the scene each client's map reports under emulated effects
        // is kept in player-view-EPOCH.txt as a lead, not a capture result.
        playerView: (epoch, checks) =>
          Effect.forEach(SLOTS, (client) =>
            Effect.gen(function*() {
              if (!checks.scene) return;
              const lines = clients.client(client).files.get(sceneFile(client, SMASHCRAFT_HEADLESS.filePrefix));
              const report = lines === undefined ? undefined : readSceneLines(lines);
              const problems = report === undefined ? ["no scene report"]
                : "problem" in report ? [`scene report line ${report.line}: ${report.problem}`]
                : sceneProblems(report, SMASHCRAFT_SCENE).map(({ seen, evidence }) => `would see ${seen} (${evidence})`);
              if (problems.length === 0) return;
              const path = join(out, `player-view-${epoch}.txt`);
              yield* tryIntegrity("record player view", path, () => appendFileSync(path, problems.map((problem) => `${names[client]} ${problem}\n`).join("")));
              yield* shared.progress(`Epoch ${epoch}: ${names[client]} scene report: ${problems.length} problem${problems.length === 1 ? "" : "s"} (${path})`);
            }), { discard: true }),
      };
      yield* runJourney({ build, epochs, fourFighters: false, sweep: [] }).pipe(Effect.provideService(Rig, rig));
      // Presentation and diagnostics may call natives on one client only; the
      // table's confirmed checksums decide synchronization, so a difference is a lead.
      const divergence = clients.firstDivergence();
      if (divergence !== undefined) yield* shared.progress(`Headless clients' native calls differ ${divergence.split("\n")[0] ?? ""} (capture.json)`);
      const helperSha256 = new Bun.CryptoHasher("sha256").update(yield* tryIntegrityPromise("hash helper", options.helper, () => Bun.file(options.helper).bytes())).digest("hex");
      yield* tryIntegrity("write capture.json", out, () => writeFileSync(join(out, "capture.json"), json({
        settings: {
          binary: options.helper,
          out,
          build,
          clients: SLOTS.map((slot) => ({ name: names[slot], data: data[slot] })),
          headless: {
            frames: clients.frame,
            calls: clients.clients.map((client) => client.callCount()),
            checksums: clients.clients.map((client) => client.checksum()),
            divergence: divergence ?? null,
          },
        },
        input_integrity: true,
        pad_layout: "xpad",
        four_fighters: false,
        playable: false,
        sweep: null,
        epochs,
        helper_pids: helpers.map((helper) => helper.pid),
        events,
        helper_sha256: helperSha256,
        scope: SCOPE,
      })));
    }));

    const exit = yield* Effect.exit(run);
    const keep = Effect.gen(function*() {
      yield* tryIntegrity("write events.json", out, () => writeFileSync(join(out, "events.json"), json(events)));
      yield* tryIntegrity("write screens.txt", out, () => writeFileSync(join(out, "screens.txt"), screens()));
      yield* archiveFiles({ data, out, build, startedNs }, "final");
    });
    if (Exit.isFailure(exit)) {
      yield* keep.pipe(Effect.catch((failure) => Effect.sync(() => console.error(failure.message))));
      return yield* exit;
    }
    yield* keep;
  });
