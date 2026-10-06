// Runs #26's integrity capture on the two signed-in clients: one virtual pad,
// kernel observer and persistent helper per player, the journey, then
// capture.json and events.json for the reconciler.
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import type { Subprocess } from "bun";
import { Effect, Exit, Option } from "effect";
import { at } from "wisp/src/runtime/lookup";
import { DEFAULT_BATCH } from "../../src/game/netcode/journal/transport";
import { clientState } from "../wisp/project";
import { type Client, type DesktopFailure, focus, loadClients, windowPid } from "wisp/scripts/warcraft/desktop";
import { IntegrityFailure, tryIntegrity, tryIntegrityPromise } from "./evidence";
import { type JourneyOptions, type JourneyRecord, Rig, runJourney } from "./journey";
import { type Observer, type Pad, observeDevice, openPad, realtimeNs } from "./linux";
import { BTN_SELECT, PAD_BUTTONS } from "./linuxInput";
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
  + " [--sweep RB[:BATCH],...] [--first-epoch N] [--four-fighters] [--bot [--bot-four] [--bot-perf] [--pad49]] [--clients FILE]";

const SCOPE = "Same-host two-client native start/result/rematch with persistent Linux virtual-pad helpers; "
  + "controller game navigation (keyboard diagnostic trace toggle); issue 26 all-binding integrity run; "
  + "no physical or cross-machine alignment claim.";

function wholeNumber(text: string, option: string): number {
  if (!/^[+-]?\d+$/.test(text)) throw new Error(`${option} takes whole numbers, not ${text}`);
  return Number(text);
}

/** RB or RB:BATCH entries: rollback window and callbacks per input message, by default the map's. */
export function parseSweep(text: string): readonly (readonly [window: number, batch: number])[] {
  return text.split(",").map((entry) => {
    const [window = "", batch = ""] = `${entry}:${DEFAULT_BATCH}`.split(":");
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
      bot: { type: "boolean" },
      "bot-four": { type: "boolean" },
      "bot-perf": { type: "boolean" },
      "pad49": { type: "boolean" },
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
  if (values.bot === true && (sweep.length > 0 || fourFighters)) throw new Error("--bot takes neither --sweep nor --four-fighters");
  if ((values["bot-four"] === true || values["bot-perf"] === true || values.pad49 === true) && values.bot !== true) throw new Error("--bot-four, --bot-perf and --pad49 need --bot");
  return { helper, build, out, clients: values.clients, appIds, sweep, fourFighters, epochs: captureEpochs(sweep.length, firstEpoch), ...(values.bot === true ? { workload: "bot" as const, botFour: values["bot-four"] === true, botPerf: values["bot-perf"] === true, pad49: values.pad49 === true } : {}) };
}

declare global {
  // Bun implements JSON.rawJSON (ES2026); TypeScript's lib does not declare it yet.
  interface JSON {
    rawJSON(text: string): unknown;
  }
}

/** JSON with 64-bit nanosecond times written as exact integers. */
export const json = (value: unknown) => `${JSON.stringify(value, (_key, item: unknown) => (typeof item === "bigint" ? JSON.rawJSON(String(item)) : item), 2)}\n`;

const fromDesktop = (failure: DesktopFailure) => new IntegrityFailure({ operation: failure.operation, path: failure.client, cause: failure.cause });

/** The client's game process, checked by name, with its window focused for the helper's focus gate. */
const gameProcess = (client: Client, checkDisplay: boolean) =>
  Effect.gen(function*() {
    const pid = yield* windowPid(client).pipe(Effect.mapError(fromDesktop));
    const name = yield* tryIntegrity("read game process name", `/proc/${pid}/comm`, () => readFileSync(`/proc/${pid}/comm`, "utf8"));
    if (!name.includes("Warcraft")) return yield* new IntegrityFailure({ operation: "find game process", path: client.name, cause: `window process ${pid} is ${name.trim()}` });
    // A bot session stops this process: it must be the one running on the client's own display.
    if (checkDisplay) {
      const display = yield* tryIntegrity("read game process display", `/proc/${pid}/environ`, () =>
        readFileSync(`/proc/${pid}/environ`, "utf8").split("\0").find((entry) => entry.startsWith("DISPLAY="))?.slice("DISPLAY=".length));
      if (display === undefined || display !== client.x11.DISPLAY) return yield* new IntegrityFailure({ operation: "find game process", path: client.name, cause: `process ${pid} runs on DISPLAY ${display ?? "unset"}, not ${client.x11.DISPLAY ?? "unset"}` });
      console.log(`client ${client.name}: Warcraft III pid ${pid} on DISPLAY ${display}`);
    }
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
export const startHelper = (command: readonly string[], env: Record<string, string | undefined>, logPath: string) =>
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
    const clients = [loaded[0], at(loaded, 1)] as const;
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
      const gamePids = yield* Effect.forEach(clients, (client) => gameProcess(client, options.workload === "bot"));
      const pads: Pad[] = [];
      const observers: Observer[] = [];
      const helpers: Subprocess[] = [];
      for (const slot of SLOTS) {
        const client = clients[slot];
        // A bot session's pads also hold View, which asks the helper for a moment.
        const pad = yield* openPad(options.workload === "bot" ? [...PAD_BUTTONS, BTN_SELECT] : PAD_BUTTONS);
        pads.push(pad);
        observers.push(yield* observeDevice(pad.device, join(out, `kernel-${slot}.jsonl`)));
        // A playable candidate's helper runs exactly as its player guide starts it.
        helpers.push(yield* startHelper([
          options.helper, "--follow-matches", "--build", build, "--slot", String(slot), "--device", pad.device, "--out", data[slot],
          "--editbox-display", client.x11.DISPLAY ?? "", "--x11-window", client.window, "--pid", String(gamePids[slot]), "--private-wlr-app-id", appIds[slot],
          ...(options.workload === "playable" ? [] : ["--trace"]),
        ], { ...Bun.env, ...client.x11, ...client.wayland }, join(out, `helper-${slot}.log`)));
      }
      const producerPath = join(out, "producer.jsonl");
      const producerLog = yield* Effect.acquireRelease(tryIntegrity("open producer log", producerPath, () => openSync(producerPath, "w")), (fd) => Effect.sync(() => closeSync(fd)));
      const rig = liveRig({
        clients,
        clientsFile: options.clients ?? clientState,
        data,
        out,
        build,
        startedNs,
        gamePids: [at(gamePids, 0), at(gamePids, 1)],
        pads: [at(pads, 0), at(pads, 1)],
        observers,
        helpers: [at(helpers, 0), at(helpers, 1)],
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
        input_integrity: options.workload === undefined,
        pad_layout: options.padLayout ?? "xpad",
        four_fighters: options.fourFighters,
        playable: options.workload === "playable",
        bot: options.workload === "bot",
        sweep: options.sweep.length > 0 ? options.sweep : null,
        epochs: options.epochs,
        helper_pids: helpers.map((helper) => helper.pid),
        events,
        helper_sha256: helperSha256,
        scope: options.workload === "match"
          ? "Same-host two-client native one-minute match/rematch with two players and two CPUs, slot change and final checksums; persistent Linux virtual-pad helpers."
          : options.workload === "bot"
          ? "Same-host two-client native match/rematch: two players on virtual pads through persistent helpers and a computer Demon Hunter, one-minute timer, three 2 s stops of client B's game a match and a View-held moment request on both pads."
          : options.workload === "playable"
          ? "Same-host two-client native one-stock match/rematch of a playable candidate; each match ends when one player walks off; persistent Linux virtual-pad helpers started as the player guide describes."
          : SCOPE,
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
