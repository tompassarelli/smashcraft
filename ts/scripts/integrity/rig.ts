// The Rig on real clients: virtual pads and their observers, the persistent
// helpers, both clients' CustomMapData folders, and their screens and input
// through the desktop driver. Headless clients (headless.ts) share everything
// but the screens and the game process.
import { appendFileSync, copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, utimesSync, writeSync } from "node:fs";
import { join } from "node:path";
import type { Subprocess } from "bun";
import { Effect, Layer, Predicate } from "effect";
import { type Client, type DesktopFailure, click, keys, read, typeText, waitFor } from "wisp/scripts/warcraft/desktop";
import { Clients } from "wisp/scripts/wisp/clients";
import { checkPlayerView } from "wisp/scripts/wisp/playerView";
import { IntegrityFailure, producerLine, tryIntegrity } from "./evidence";
import type { GameFile, JourneyRecord, PublicationRecord, RigShape, Stopped } from "./journey";
import type { StallTarget } from "./schedule";
import { type Observer, type Pad, continueProcess, inject, monotonicNs, realtimeNs, stopProcess } from "./linux";
import { SLOTS, type Slot } from "./reconcile";
import { INPUT_TRACE_FILE, responsePageFile, decodeWrittenGameFile } from "../wisp/boundary";
import { smashcraftPlayerView } from "../wisp/playerView";
import { gameFilesLayer } from "../wisp/project";

/** What a capture drives the same way whatever runs the game. */
interface FileRigParts {
  /** Each client's CustomMapData folder. */
  readonly data: readonly [string, string];
  readonly out: string;
  readonly build: string;
  readonly startedNs: bigint;
  readonly pads: readonly [Pad, Pad];
  readonly observers: readonly Observer[];
  readonly helpers: readonly [Subprocess, Subprocess];
  /** producer.jsonl, open for writing. */
  readonly producerLog: number;
  readonly events: JourneyRecord[];
  /** Why the game stopped, if it did; the capture fails at its next check. */
  readonly gameFailure?: () => IntegrityFailure | undefined;
}

interface LiveRigParts extends FileRigParts {
  readonly clients: readonly [Client, Client];
  /** The desktop driver's clients file the clients were loaded from. */
  readonly clientsFile: string;
  readonly gamePids: readonly [number, number];
}

const UI_WAIT_SECONDS = 25;
const POLL_MILLIS = 20;

const fromDesktop = (failure: DesktopFailure) => new IntegrityFailure({ operation: failure.operation, path: failure.client, cause: failure.cause });

/**
 * Copies the files this capture's game wrote (journal receipts, response
 * pages, error reports and the input trace) from both clients into OUT/epoch-LABEL/, with
 * each name prefixed by its client's slot and with its times kept.
 */
export const archiveFiles = (parts: Pick<FileRigParts, "data" | "out" | "build" | "startedNs">, label: string) =>
  Effect.forEach(SLOTS, (client) =>
    tryIntegrity("archive", parts.data[client], () => {
      const target = join(parts.out, `epoch-${label}`);
      mkdirSync(target, { recursive: true });
      const journal = new Bun.Glob(`smashcraft-journal-*${parts.build}*`);
      const pages = new Bun.Glob(responsePageFile("*", "*", "*"));
      const errors = new Bun.Glob("smashcraft-error-p*.txt");
      const names = readdirSync(parts.data[client]).filter((name) => journal.match(name) || pages.match(name) || errors.match(name) || name === INPUT_TRACE_FILE);
      for (const name of names) {
        const source = join(parts.data[client], name);
        const stat = statSync(source, { bigint: true });
        if (!stat.isFile() || stat.mtimeNs < parts.startedNs) continue;
        const destination = join(target, `${client}-${name}`);
        copyFileSync(source, destination);
        utimesSync(destination, Number(stat.atimeNs) / 1e9, Number(stat.mtimeNs) / 1e9);
      }
    }), { concurrency: 2, discard: true });

/** Reads of the realtime clock bracketed by the monotonic one; the tightest bracket wins. */
const CLOCK_SAMPLES = 8;

/**
 * The realtime clock placed on the monotonic one: a busy thread can pause
 * between the reads and widen the bracket, which offsets every edge's
 * expected frame by up to half its width, so the narrowest of several is kept.
 */
function clockSample(): { readonly before: number; readonly wall: bigint; readonly after: number } {
  let best = { before: 0, wall: 0n, after: Number.MAX_SAFE_INTEGER };
  for (let sample = 0; sample < CLOCK_SAMPLES; sample++) {
    const before = monotonicNs();
    const wall = realtimeNs();
    const after = monotonicNs();
    if (after - before < best.after - best.before) best = { before, wall, after };
  }
  return best;
}

/** Appends a client's screen operation to ui.txt. */
export const uiLogger = (out: string, names: readonly [string, string]) => {
  const uiLog = join(out, "ui.txt");
  return (client: Slot, operation: string, detail: string) =>
    tryIntegrity("log screen operation", uiLog, () => appendFileSync(uiLog, `${names[client]} ${operation} ${detail}\n`));
};

/** The pads, helpers, clocks, game files and journey record a capture shares whatever runs the game. */
export function fileRig(parts: FileRigParts): Omit<RigShape, "stop" | "resume" | "waitText" | "click" | "key" | "type" | "playerView"> {
  const { data, out, startedNs } = parts;

  const healthy = Effect.gen(function*() {
    const exited = parts.helpers.flatMap((helper, slot) => (helper.exitCode === null && helper.signalCode === null ? [] : [`${slot}: ${helper.exitCode ?? helper.signalCode}`]));
    if (exited.length > 0) return yield* new IntegrityFailure({ operation: "watch helpers", path: out, cause: `persistent helpers exited: ${exited.join(", ")}` });
    const failure = parts.observers.map((observer) => observer.failure()).find((failure) => failure !== undefined) ?? parts.gameFailure?.();
    if (failure !== undefined) return yield* failure;
  });

  const file = (client: Slot, name: string) =>
    tryIntegrity("read game file", join(data[client], name), (): GameFile | undefined => {
      const path = join(data[client], name);
      try {
        const { mtimeNs } = statSync(path, { bigint: true });
        return { text: readFileSync(path, "utf8"), mtimeNs };
      } catch (error) {
        if (Predicate.isObject(error) && error.code === "ENOENT") return undefined;
        throw error;
      }
    }).pipe(Effect.tap((stored) => {
      // A concurrent PreloadGenEnd write may still be incomplete. Completed
      // records enter the capture only after boundary decoding succeeds.
      if (stored === undefined || stored.mtimeNs < startedNs || !stored.text.trimEnd().endsWith("endfunction")) return Effect.void;
      return decodeWrittenGameFile(name, join(data[client], name), stored.text).pipe(
        Effect.mapError((cause) => new IntegrityFailure({ operation: "decode game file", path: join(data[client], name), cause })),
      );
    }));

  return {
    send: ({ slot, edge, phase }) =>
      tryIntegrity("send pad edge", phase, () => {
        // Logged after the write, so logging never delays the edge.
        const injection = inject(parts.pads[slot], edge);
        writeSync(parts.producerLog, producerLine(phase, slot, edge, injection));
      }),
    sleep: (millis) => Effect.sleep(millis),
    monotonicNs: Effect.sync(monotonicNs),
    realtimeNs: Effect.sync(realtimeNs),
    startedNs,
    until: (what, check, seconds = 30) =>
      Effect.gen(function*() {
        const deadline = performance.now() + seconds * 1000;
        while (!(yield* check)) {
          yield* healthy;
          if (performance.now() > deadline) return yield* new IntegrityFailure({ operation: what, path: out, cause: `not observed within ${seconds} s` });
          yield* Effect.sleep(POLL_MILLIS);
        }
      }),
    healthy,
    file,
    files: (client, pattern) =>
      tryIntegrity("list game files", data[client], () => {
        const glob = new Bun.Glob(pattern);
        return readdirSync(data[client]).filter((name) => glob.match(name));
      }),
    helperLog: (slot) => tryIntegrity("read helper log", join(out, `helper-${slot}.log`), () => readFileSync(join(out, `helper-${slot}.log`), "utf8")),
    boundary: (client, name) =>
      tryIntegrity("read game receipt", join(data[client], name), (): PublicationRecord => {
        const path = join(data[client], name);
        const { before, wall, after } = clockSample();
        const stamp = statSync(path, { bigint: true }).mtimeNs;
        return {
          path,
          contents: readFileSync(path, "utf8"),
          mtime_realtime_ns: stamp,
          sample_monotonic_before_ns: before,
          sample_realtime_ns: wall,
          sample_monotonic_after_ns: after,
          publication_monotonic_estimate_ns: Number(stamp - wall) + Number((BigInt(before) + BigInt(after)) / 2n),
        };
      }).pipe(Effect.tap((publication) => decodeWrittenGameFile(name, publication.path, publication.contents).pipe(
        Effect.mapError((cause) => new IntegrityFailure({ operation: "decode game receipt", path: publication.path, cause })),
      ))),
    archive: (label) => archiveFiles(parts, label),
    record: (event) => Effect.sync(() => {
      parts.events.push(event);
    }),
    progress: (message) => Effect.sync(() => console.log(message)),
  };
}

/** Stops a slot's helper process, as both capture kinds stall it. */
export const stopHelperProcess = (helpers: readonly [Subprocess, Subprocess], target: StallTarget & { readonly kind: "helper" }) =>
  stopProcess(helpers[target.slot].pid).pipe(Effect.as({ target, pid: helpers[target.slot].pid } satisfies Stopped));

export function liveRig(parts: LiveRigParts): RigShape {
  const { clients, out } = parts;
  const logUi = uiLogger(out, [clients[0].name, clients[1].name]);
  return {
    ...fileRig(parts),
    stop: (target) => target.kind === "helper"
      ? stopHelperProcess(parts.helpers, target)
      : stopProcess(parts.gamePids[target.slot]).pipe(Effect.as({ target, pid: parts.gamePids[target.slot] } satisfies Stopped)),
    resume: ({ pid }) => continueProcess(pid),
    waitText: (client, pattern) =>
      Effect.gen(function*() {
        // Light labels and the gold menu labels each read only after separating their ink.
        const screen = Effect.all([read(clients[client], undefined, "light"), read(clients[client], undefined, "gold")], { concurrency: 2 }).pipe(
          Effect.map(([light, gold]) => `${light}\n${gold}`),
        );
        let last = "";
        const seen = yield* waitFor(clients[client], `text ${pattern.source}`, UI_WAIT_SECONDS, screen.pipe(Effect.map((text) => {
          last = text;
          return pattern.test(text.split(/\s+/).join(" ")) || pattern.test(text) ? text : undefined;
        }))).pipe(Effect.tapError(() => logUi(client, "wait expired", `${pattern.source}\n${last}`).pipe(Effect.ignore)), Effect.mapError((failure) => failure instanceof IntegrityFailure ? failure : fromDesktop(failure)));
        yield* logUi(client, "wait", `${pattern.source}\n${seen}`);
        return seen;
      }),
    click: (client, x, y) => click(clients[client], x, y).pipe(Effect.mapError(fromDesktop), Effect.andThen(logUi(client, "click", `${x} ${y}`))),
    key: (client, key) => keys(clients[client], key).pipe(Effect.mapError(fromDesktop)),
    type: (client, text) => typeText(clients[client], text, 35).pipe(Effect.mapError(fromDesktop)),
    playerView: (epoch, checks) => Effect.suspend(() => checkPlayerView(smashcraftPlayerView(checks), Date.now(), join(out, `player-view-${epoch}`))).pipe(
      Effect.provide(Layer.merge(Clients.layer(parts.clientsFile), gameFilesLayer)),
      Effect.mapError((failure) => new IntegrityFailure({ operation: `check player view in match ${epoch}`, path: out, cause: failure.message })),
    ),
  };
}
