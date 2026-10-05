// The Rig on real clients: virtual pads and their observers, the persistent
// helpers, both clients' CustomMapData folders, and their screens and input
// through the desktop driver.
import { appendFileSync, copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, utimesSync, writeSync } from "node:fs";
import { join } from "node:path";
import type { Subprocess } from "bun";
import { Effect } from "effect";
import { type Client, type DesktopFailure, click, keys, read, typeText, waitFor } from "../warcraft/desktop";
import { IntegrityFailure, producerLine, tryIntegrity } from "./evidence";
import type { GameFile, JourneyRecord, PublicationRecord, RigShape, Stopped } from "./journey";
import { type Observer, type Pad, continueProcess, inject, monotonicNs, realtimeNs, stopProcess } from "./linux";
import { SLOTS, type Slot } from "./reconcile";

export interface LiveRigParts {
  readonly clients: readonly [Client, Client];
  /** Each client's CustomMapData folder. */
  readonly data: readonly [string, string];
  readonly out: string;
  readonly build: string;
  readonly startedNs: bigint;
  readonly gamePids: readonly [number, number];
  readonly pads: readonly [Pad, Pad];
  readonly observers: readonly Observer[];
  readonly helpers: readonly [Subprocess, Subprocess];
  /** producer.jsonl, open for writing. */
  readonly producerLog: number;
  readonly events: JourneyRecord[];
}

const UI_WAIT_SECONDS = 25;
const POLL_MILLIS = 20;

const fromDesktop = (failure: DesktopFailure) => new IntegrityFailure({ operation: failure.operation, path: failure.client, cause: failure.cause });

/**
 * Copies the files this capture's game wrote (journal receipts, response
 * pages and the input trace) from both clients into OUT/epoch-LABEL/, with
 * each name prefixed by its client's slot and with its times kept.
 */
export const archiveFiles = (parts: Pick<LiveRigParts, "data" | "out" | "build" | "startedNs">, label: string) =>
  Effect.forEach(SLOTS, (client) =>
    tryIntegrity("archive", parts.data[client], () => {
      const target = join(parts.out, `epoch-${label}`);
      mkdirSync(target, { recursive: true });
      const journal = new Bun.Glob(`smashcraft-journal-*${parts.build}*`);
      const pages = new Bun.Glob("smashcraft-response-p*-run*-page*.txt");
      const names = readdirSync(parts.data[client]).filter((name) => journal.match(name) || pages.match(name) || name === "wc3-melee-input-trace.txt");
      for (const name of names) {
        const source = join(parts.data[client], name);
        const stat = statSync(source, { bigint: true });
        if (!stat.isFile() || stat.mtimeNs < parts.startedNs) continue;
        const destination = join(target, `${client}-${name}`);
        copyFileSync(source, destination);
        utimesSync(destination, Number(stat.atimeNs) / 1e9, Number(stat.mtimeNs) / 1e9);
      }
    }), { concurrency: 2, discard: true });

export function liveRig(parts: LiveRigParts): RigShape {
  const { clients, data, out, startedNs } = parts;
  const uiLog = join(out, "ui.txt");
  const logUi = (client: Slot, operation: string, detail: string) =>
    tryIntegrity("log screen operation", uiLog, () => appendFileSync(uiLog, `${clients[client].name} ${operation} ${detail}\n`));

  const healthy = Effect.gen(function*() {
    const exited = parts.helpers.flatMap((helper, slot) => (helper.exitCode === null && helper.signalCode === null ? [] : [`${slot}: ${helper.exitCode ?? helper.signalCode}`]));
    if (exited.length > 0) return yield* new IntegrityFailure({ operation: "watch helpers", path: out, cause: `persistent helpers exited: ${exited.join(", ")}` });
    const failure = parts.observers.map((observer) => observer.failure()).find((failure) => failure !== undefined);
    if (failure !== undefined) return yield* failure;
  });

  const file = (client: Slot, name: string) =>
    tryIntegrity("read game file", join(data[client], name), (): GameFile | undefined => {
      const path = join(data[client], name);
      try {
        const { mtimeNs } = statSync(path, { bigint: true });
        return { text: readFileSync(path, "utf8"), mtimeNs };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
      }
    });

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
        const before = monotonicNs();
        const wall = realtimeNs();
        const after = monotonicNs();
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
      }),
    stop: (target) => {
      const pid = target.kind === "helper" ? parts.helpers[target.slot].pid : parts.gamePids[target.slot];
      return stopProcess(pid).pipe(Effect.as({ target, pid } satisfies Stopped));
    },
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
    archive: (label) => archiveFiles(parts, label),
    record: (event) => Effect.sync(() => {
      parts.events.push(event);
    }),
    progress: (message) => Effect.sync(() => console.log(message)),
  };
}
