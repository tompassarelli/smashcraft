// Runs #26's integrity capture on the two signed-in clients: one virtual pad,
// kernel observer and persistent helper per player, the journey, then
// capture.json and events.json for the reconciler.
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import type { Subprocess } from "bun";
import { Effect, Exit, Option } from "effect";
import { clientState } from "../waygate/project";
import { type Client, type DesktopFailure, focus, loadClients, windowPid } from "waygate/scripts/warcraft/desktop";
import { IntegrityFailure, tryIntegrity, tryIntegrityPromise } from "./evidence";
import { type JourneyOptions, type JourneyRecord, Rig, runJourney } from "./journey";
import { type Observer, type Pad, observeDevice, openPad, realtimeNs } from "./linux";
import { PAD_BUTTONS } from "./linuxInput";
import { SLOTS, type Slot } from "./reconcile";
import { archiveFiles, liveRig } from "./rig";

interface CaptureOptions extends JourneyOptions {
  /** The persistent controller helper binary. */
  readonly helper: string;
  readonly out: string;
  /** The desktop driver's clients file; its default when undefined. */
  readonly clients: string | undefined;
  /** Each client's private-compositor app ID, by client name. */
  readonly appIds: ReadonlyMap<string, string>;
}

const CAPTURE_USAGE = "bun scripts/integrity.ts capture --helper BINARY --build BUILD --out DIR --app-id CLIENT=APP_ID --app-id CLIENT=APP_ID"
  + " [--sweep RB[:BATCH],...] [--first-epoch N] [--four-fighters] [--clients FILE]";

const SCOPE = "Same-host two-client native start/result/rematch with persistent Linux virtual-pad helpers; "
  + "controller game navigation (keyboard diagnostic trace toggle); issue 26 all-binding integrity run; "
  + "no physical or cross-machine alignment claim.";

function wholeNumber(text: string, option: string): number {
  if (!/^[+-]?\d+$/.test(text)) throw new Error(`${option} takes whole numbers, not ${text}`);
  return Number(text);
}

/** RB or RB:BATCH entries; the batch defaults to 2. */
export function parseSweep(text: string): readonly (readonly [window: number, batch: number])[] {
  return text.split(",").map((entry) => {
    const [window = "", batch = ""] = `${entry}:2`.split(":");
    return [wholeNumber(window, "--sweep"), wholeNumber(batch, "--sweep")] as const;
  });
}

/** One match and rematch, or one pair per sweep entry, numbered from the session's next match. */
export function captureEpochs(sweepEntries: number, firstEpoch: number): readonly number[] {
  return Array.from({ length: sweepEntries > 0 ? 2 * sweepEntries : 2 }, (_, index) => firstEpoch + index);
}

export function parseCaptureArguments(args: readonly string[]): CaptureOptions {
  const { values } = parseArgs({
    args: [...args],
    options: {
      helper: { type: "string" },
      build: { type: "string" },
      out: { type: "string" },
      "app-id": { type: "string", multiple: true },
      sweep: { type: "string" },
      "first-epoch": { type: "string" },
      "four-fighters": { type: "boolean" },
      clients: { type: "string" },
    },
    strict: true,
  });
  const { helper, build, out } = values;
  if (helper === undefined || build === undefined || out === undefined) throw new Error(`usage: ${CAPTURE_USAGE}`);
  const appIds = new Map((values["app-id"] ?? []).map((entry) => {
    const [name, id] = entry.split("=", 2);
    if (name === undefined || id === undefined || id === "") throw new Error(`--app-id takes CLIENT=APP_ID, not ${entry}`);
    return [name, id] as const;
  }));
  const sweep = values.sweep === undefined ? [] : parseSweep(values.sweep);
  const fourFighters = values["four-fighters"] ?? false;
  const firstEpoch = wholeNumber(values["first-epoch"] ?? "1", "--first-epoch");
  if (sweep.length > 0 && fourFighters) throw new Error("--sweep requires two fighters, not --four-fighters");
  if (firstEpoch < 1 || firstEpoch % 2 === 0) throw new Error("--first-epoch must be positive and odd");
  return { helper, build, out, clients: values.clients, appIds, sweep, fourFighters, epochs: captureEpochs(sweep.length, firstEpoch) };
}

declare global {
  // Bun implements JSON.rawJSON (ES2026); TypeScript's lib does not declare it yet.
  interface JSON {
    rawJSON(text: string): unknown;
  }
}

/** JSON with 64-bit nanosecond times written as exact integers. */
const json =(value: unknown) => `${JSON.stringify(value, (_key, item: unknown) => (typeof item === "bigint" ? JSON.rawJSON(String(item)) : item), 2)}\n`;

const fromDesktop = (failure: DesktopFailure) => new IntegrityFailure({ operation: failure.operation, path: failure.client, cause: failure.cause });

/** The client's game process, checked by name, with its window focused for the helper's focus gate. */
const gameProcess = (client: Client) =>
  Effect.gen(function*() {
    const pid = yield* windowPid(client).pipe(Effect.mapError(fromDesktop));
    const name = yield* tryIntegrity("read game process name", `/proc/${pid}/comm`, () => readFileSync(`/proc/${pid}/comm`, "utf8"));
    if (!name.includes("Warcraft")) return yield* new IntegrityFailure({ operation: "find game process", path: client.name, cause: `window process ${pid} is ${name.trim()}` });
    yield* focus(client).pipe(Effect.mapError(fromDesktop));
    return pid;
  });

/** Interrupts a helper with SIGINT (continuing it first, in case a stall stopped it), then kills it after 3 s. */
const stopHelper = (helper: Subprocess) =>
  Effect.gen(function*() {
    if (helper.exitCode !== null || helper.signalCode !== null) return;
    helper.kill("SIGCONT");
    helper.kill("SIGINT");
    if (Option.isSome(yield* Effect.promise(() => helper.exited).pipe(Effect.timeoutOption("3 seconds")))) return;
    helper.kill("SIGKILL");
    yield* Effect.promise(() => helper.exited).pipe(Effect.timeoutOption("2 seconds"));
  });

/** A persistent helper following matches on one pad, logging to helper-SLOT.log, stopped with its scope. */
const startHelper = (command: readonly string[], env: Record<string, string | undefined>, logPath: string) =>
  Effect.gen(function*() {
    const log = yield* Effect.acquireRelease(tryIntegrity("open helper log", logPath, () => openSync(logPath, "w")), (fd) => Effect.sync(() => closeSync(fd)));
    return yield* Effect.acquireRelease(
      tryIntegrity("start helper", command[0] ?? "", () => Bun.spawn([...command], { env, stdin: "ignore", stdout: log, stderr: log })),
      stopHelper,
    );
  });

export const captureMatches = (options: CaptureOptions) =>
  Effect.gen(function*() {
    const { build, out } = options;
    const loaded = yield* loadClients(options.clients ?? clientState).pipe(Effect.mapError(fromDesktop));
    if (loaded.length !== 2) return yield* new IntegrityFailure({ operation: "load clients", path: options.clients ?? "default clients file", cause: `${loaded.length} clients, need 2` });
    const clients = [loaded[0], loaded[1]!] as const;
    const [appA, appB] = clients.map((client) => options.appIds.get(client.name));
    if (appA === undefined || appB === undefined) return yield* new IntegrityFailure({ operation: "read app IDs", path: "--app-id", cause: `need one for each of ${clients.map((c) => c.name).join(", ")}` });
    const appIds = [appA, appB] as const;
    yield* tryIntegrity("create capture directory", out, () => {
      mkdirSync(dirname(out), { recursive: true });
      mkdirSync(out);
    });
    const startedNs = realtimeNs();
    const data = [join(clients[0].documents, "CustomMapData"), join(clients[1].documents, "CustomMapData")] as const;
    const events: JourneyRecord[] = [];

    const run = Effect.scoped(Effect.gen(function*() {
      const gamePids = yield* Effect.forEach(clients, gameProcess);
      const pads: Pad[] = [];
      const observers: Observer[] = [];
      const helpers: Subprocess[] = [];
      for (const slot of SLOTS) {
        const client = clients[slot];
        const pad = yield* openPad(PAD_BUTTONS);
        pads.push(pad);
        observers.push(yield* observeDevice(pad.device, join(out, `kernel-${slot}.jsonl`)));
        helpers.push(yield* startHelper([
          options.helper, "--device", pad.device, "--out", data[slot], "--follow-matches", "--build", build, "--slot", String(slot), "--trace",
          "--editbox-display", client.x11.DISPLAY ?? "", "--x11-window", client.window, "--pid", String(gamePids[slot]), "--private-wlr-app-id", appIds[slot],
        ], { ...Bun.env, ...client.x11, ...client.wayland }, join(out, `helper-${slot}.log`)));
      }
      const producerPath = join(out, "producer.jsonl");
      const producerLog = yield* Effect.acquireRelease(tryIntegrity("open producer log", producerPath, () => openSync(producerPath, "w")), (fd) => Effect.sync(() => closeSync(fd)));
      const rig = liveRig({
        clients,
        data,
        out,
        build,
        startedNs,
        gamePids: [gamePids[0]!, gamePids[1]!],
        pads: [pads[0]!, pads[1]!],
        observers,
        helpers: [helpers[0]!, helpers[1]!],
        producerLog,
        events,
      });
      yield* runJourney(options).pipe(Effect.provideService(Rig, rig));
      const helperSha256 = new Bun.CryptoHasher("sha256").update(yield* tryIntegrityPromise("hash helper", options.helper, () => Bun.file(options.helper).bytes())).digest("hex");
      yield* tryIntegrity("write capture.json", out, () => writeFileSync(join(out, "capture.json"), json({
        settings: {
          binary: options.helper,
          out,
          build,
          clients: SLOTS.map((slot) => ({ name: clients[slot].name, data: data[slot], window: clients[slot].window, pid: gamePids[slot], app_id: appIds[slot] })),
        },
        input_integrity: true,
        four_fighters: options.fourFighters,
        sweep: options.sweep.length > 0 ? options.sweep : null,
        epochs: options.epochs,
        helper_pids: helpers.map((helper) => helper.pid),
        events,
        helper_sha256: helperSha256,
        scope: SCOPE,
      })));
    }));

    // The journey's events and every file the game wrote are kept even when the capture fails.
    const keep = Effect.gen(function*() {
      yield* tryIntegrity("write events.json", out, () => writeFileSync(join(out, "events.json"), json(events)));
      yield* archiveFiles({ data, out, build, startedNs }, "final");
    });
    const exit = yield* Effect.exit(run);
    if (Exit.isFailure(exit)) {
      yield* keep.pipe(Effect.catch((failure) => Effect.sync(() => console.error(failure.message))));
      return yield* exit;
    }
    yield* keep;
  });
