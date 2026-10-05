// The complete selection/match/rematch journey is one capture contract:
// controller event order and publication times feed the retained integrity oracle.
// The integrity capture's journey through two native clients: controller-only
// fighter and stage selection, an instrumented match, the results screen, a
// slot change, and the rematch. Everything it does to the clients goes through
// the Rig service, so a recording Rig can replay the journey without Warcraft.
import { Context, Effect } from "effect";
import { IntegrityFailure } from "./evidence";
import { ABS_X, BTN_SOUTH, BTN_START, EV_ABS, EV_KEY, type SourceEdge } from "./linuxInput";
import { SLOTS, type Slot } from "./reconcile";
import { PULSE_HOLD_MILLIS, STALL_MILLIS, type Pulse, type Send, type StallTarget, integritySchedule, pulseSends } from "./schedule";
import { INPUT_TRACE_FILE, devCommandReceiptFile, journalControlFile, journalLifecycleFile, journalMenuFile, responsePageFile } from "../../src/runtime/gameFiles";

/** A game file's text and modification time. */
export interface GameFile {
  readonly text: string;
  readonly mtimeNs: bigint;
}

/**
 * A game file read with the clocks sampled around the read, which places its
 * publication on the monotonic clock the pads stamp edges with.
 */
export interface PublicationRecord {
  readonly path: string;
  readonly contents: string;
  readonly mtime_realtime_ns: bigint;
  readonly sample_monotonic_before_ns: number;
  readonly sample_realtime_ns: bigint;
  readonly sample_monotonic_after_ns: number;
  readonly publication_monotonic_estimate_ns: number;
}

interface ModeReceipt {
  readonly human_fighters: number;
  readonly computers: number;
  readonly publications: readonly PublicationRecord[];
}

/** One journey event as capture.json stores it. */
export type JourneyRecord =
  | { readonly event: "menu"; readonly phase: string; readonly contents: readonly string[]; readonly observed_monotonic_ns: number }
  | { readonly event: "start" | "end"; readonly epoch: number; readonly publications: readonly PublicationRecord[]; readonly observed_monotonic_ns: number }
  | { readonly event: "integrity-pause" | "integrity-resume"; readonly epoch: number; readonly publications: readonly PublicationRecord[] }
  | {
    readonly event: "integrity-stall";
    readonly epoch: number;
    readonly kind: StallTarget["kind"];
    readonly slot: Slot;
    readonly pid: number;
    readonly stopped_monotonic_ns: number;
    readonly continued_monotonic_ns: number;
    readonly verified_stopped_state: true;
  }
  | { readonly event: "integrity-slot-change" | "four-fighter-setup"; readonly epoch: number; readonly changes: readonly ModeReceipt[] }
  | { readonly event: "dev-config"; readonly epoch: number; readonly command: string; readonly publications: readonly PublicationRecord[] }
  | { readonly event: "results"; readonly epoch: number; readonly texts: readonly string[] };

export interface Stopped {
  readonly target: StallTarget;
  readonly pid: number;
}

export interface RigShape {
  /** Writes an edge and its SYN_REPORT to a slot's pad, and logs it in producer.jsonl. */
  readonly send: (send: Send) => Effect.Effect<void, IntegrityFailure>;
  readonly sleep: (millis: number) => Effect.Effect<void>;
  readonly monotonicNs: Effect.Effect<number>;
  readonly realtimeNs: Effect.Effect<bigint>;
  /** When the capture started: game files written earlier are left over from before it. */
  readonly startedNs: bigint;
  /** Polls `check` until it holds; fails with `what` after `seconds`, or as soon as a helper or pad observer stops. */
  readonly until: (what: string, check: Effect.Effect<boolean, IntegrityFailure>, seconds?: number) => Effect.Effect<void, IntegrityFailure>;
  /** Fails if a helper or pad observer has stopped. */
  readonly healthy: Effect.Effect<void, IntegrityFailure>;
  /** A file in a client's CustomMapData, when it exists. */
  readonly file: (client: Slot, name: string) => Effect.Effect<GameFile | undefined, IntegrityFailure>;
  /** Names of a client's CustomMapData files matching a glob. */
  readonly files: (client: Slot, pattern: string) => Effect.Effect<readonly string[], IntegrityFailure>;
  readonly helperLog: (slot: Slot) => Effect.Effect<string, IntegrityFailure>;
  readonly boundary: (client: Slot, name: string) => Effect.Effect<PublicationRecord, IntegrityFailure>;
  /** Stops a process and waits until the kernel reports it stopped. */
  readonly stop: (target: StallTarget) => Effect.Effect<Stopped, IntegrityFailure>;
  readonly resume: (stopped: Stopped) => Effect.Effect<void>;
  /** Waits until a client's screen shows text matching `pattern`, and returns the text read. */
  readonly waitText: (client: Slot, pattern: RegExp) => Effect.Effect<string, IntegrityFailure>;
  readonly click: (client: Slot, x: number, y: number) => Effect.Effect<void, IntegrityFailure>;
  readonly key: (client: Slot, key: string) => Effect.Effect<void, IntegrityFailure>;
  readonly type: (client: Slot, text: string) => Effect.Effect<void, IntegrityFailure>;
  /** Copies this capture's game files from both clients into epoch-LABEL/. */
  readonly archive: (label: string) => Effect.Effect<void, IntegrityFailure>;
  /** Checks what each player sees in a match: one captured frame each, and the scene report of a build that writes one. */
  readonly playerView: (epoch: number, checks: { readonly frame: boolean; readonly scene: boolean }) => Effect.Effect<void, IntegrityFailure>;
  readonly record: (event: JourneyRecord) => Effect.Effect<void>;
  readonly progress: (message: string) => Effect.Effect<void>;
}

export class Rig extends Context.Service<Rig, RigShape>()("smashcraft/integrity/Rig") {}

export interface JourneyOptions {
  readonly build: string;
  /** Map match numbers; integrity runs start at an odd one and alternate match and rematch. */
  readonly epochs: readonly number[];
  readonly fourFighters: boolean;
  /** Rollback windows and transport batches, each commanded before its match. */
  readonly sweep: readonly (readonly [window: number, batch: number])[];
  /**
   * #17 uses normal timed combat; a playable candidate plays one-stock
   * matches that end when a player walks off; the default retains #26's
   * complete input workload.
   */
  readonly workload?: "match" | "playable";
}

const CONTROLS = /CONTROLS/i;
const RESULTS = /wins|rematch/i;
const PAUSED = /PAUSED.*Press.*Start.*resume|Paused.*press.*Start.*resume/i;
const TWO_HUMANS = "connected=3 human-fighters=3 computers=0 fighters=3";
const TRACE = INPUT_TRACE_FILE;
/** Callbacks an input trace records: with the response probe, and in every other normal build. */
const PROBE_TRACE_TICKS = 1200;
const PLAYABLE_TRACE_TICKS = 300;

const stocks = (count: number) => new RegExp(`${count} Stock`, "i");
const signature = (humans: number, computers: number) => `connected=3 human-fighters=${humans} computers=${computers} fighters=${humans + computers}`;
const both = <A, E>(each: (client: Slot) => Effect.Effect<A, E>) => Effect.forEach(SLOTS, each, { concurrency: 2 });

/** The journey's steps over one Rig; `run` is the whole capture. */
export function journey(rig: RigShape, options: JourneyOptions) {
  const { build, epochs, fourFighters, sweep } = options;
  const matchOnly = options.workload === "match";
  const playable = options.workload === "playable";
  const firstEpoch = epochs[0] ?? 1;
  const lastEpoch = epochs.at(-1) ?? firstEpoch;

  const complete = (file: GameFile | undefined): file is GameFile =>
    file !== undefined && file.mtimeNs >= rig.startedNs && file.text.trimEnd().endsWith("endfunction");
  const menuName = (client: Slot) => journalMenuFile(build, client);
  const controlName = (state: "start" | "end", epoch: number, client: Slot) => journalLifecycleFile(build, epoch, client, state);
  const menus = Effect.forEach(SLOTS, (client) => rig.file(client, menuName(client)));
  const menusShow = (text: string) => menus.pipe(Effect.map((files) => files.every((file) => complete(file) && file.text.includes(text))));
  const boundaries = (name: (client: Slot) => string) => Effect.forEach(SLOTS, (client) => rig.boundary(client, name(client)));
  const failed = (operation: string, cause: string) => new IntegrityFailure({ operation, path: build, cause });

  const send = (slot: Slot, edge: SourceEdge, phase: string) => rig.send({ slot, edge, phase });
  const button = (code: number, value: number): SourceEdge => ({ type: EV_KEY, code, value });
  const tap = (slot: Slot, phase: string) =>
    Effect.gen(function*() {
      yield* send(slot, button(BTN_SOUTH, 1), phase);
      yield* rig.sleep(PULSE_HOLD_MILLIS);
      yield* send(slot, button(BTN_SOUTH, 0), phase);
    });
  const menuButton = (slot: Slot, code: number, phase: string) =>
    Effect.gen(function*() {
      yield* send(slot, button(code, 1), phase);
      yield* rig.sleep(120);
      yield* send(slot, button(code, 0), phase);
    });

  const menuPhase = (phase: string) =>
    Effect.gen(function*() {
      yield* rig.until(`live controller menu phase ${phase} absent`, menusShow(`phase=${phase}`));
      const contents = (yield* menus).map((file) => file?.text ?? "");
      yield* rig.record({ event: "menu", phase, contents, observed_monotonic_ns: yield* rig.monotonicNs });
    });

  const characterScreen = Effect.gen(function*() {
    yield* menuPhase("CHARACTER");
    yield* rig.waitText(0, CONTROLS);
  });

  /** Both pads pick their highlighted fighter; A's Start picks the stage. */
  const controllerSelect = Effect.gen(function*() {
    yield* characterScreen;
    for (const slot of SLOTS) yield* menuButton(slot, BTN_SOUTH, "menu-character-select");
    yield* menuButton(0, BTN_START, "menu-character-confirm");
    yield* menuPhase("STAGE");
  });

  /** Native slot tags use WC3's centered 4:3 coordinates on the 2560x1440 desktop. */
  const clickSlotTag = (x: number) =>
    Effect.gen(function*() {
      // Mouse focus on the inert widescreen margin first; the menu receipts decide delivery.
      yield* rig.click(0, 2400, 200);
      yield* rig.click(0, x, 824);
    });

  const modeChanges = (what: string, changes: readonly (readonly [x: number, humans: number, computers: number])[]) =>
    Effect.forEach(changes, ([x, humans, computers]) =>
      Effect.gen(function*() {
        yield* clickSlotTag(x);
        yield* rig.until(what, menusShow(signature(humans, computers)));
        return { human_fighters: humans, computers, publications: yield* boundaries(menuName) } satisfies ModeReceipt;
      }));

  /** Issue #17's two humans and two CPUs. */
  const fourFighterSetup = Effect.gen(function*() {
    yield* characterScreen;
    const changes = yield* modeChanges("four-fighter setup absent on one client", [[1484, 7, 0], [1484, 3, 4], [1904, 11, 4], [1904, 3, 12]]);
    yield* rig.record({ event: "four-fighter-setup", epoch: firstEpoch, changes });
  });

  /** Exercises the slot-mode UI while both human fighters keep playing the rematch. */
  const slotChange = (epoch: number) =>
    Effect.gen(function*() {
      yield* characterScreen;
      const modes = fourFighters ? [[3, 8], [7, 8], [3, 12]] as const : [[7, 0], [3, 4]] as const;
      const changes = yield* modeChanges("integrity rematch slot change absent", modes.map(([humans, computers]) => [1484, humans, computers] as const));
      yield* rig.record({ event: "integrity-slot-change", epoch, changes });
    });

  /** The rematch left slot C as CPU; one tag click returns it to EMPTY. */
  const slotRestore = Effect.gen(function*() {
    yield* characterScreen;
    yield* clickSlotTag(1484);
    yield* rig.until("slot C was not restored to EMPTY", menusShow(TWO_HUMANS));
  });

  /** Chained runs start from two humans with slots C and D EMPTY; tags cycle HMN, CPU, EMPTY. */
  const restoreTwoHumans = Effect.gen(function*() {
    for (const [bit, x] of [[4, 1484], [8, 1904]] as const) {
      for (let click = 0; click < 2; click++) {
        const text = (yield* rig.file(0, menuName(0)))?.text ?? "";
        const humans = /human-fighters=(\d+)/.exec(text)?.[1];
        const computers = / computers=(\d+)/.exec(text)?.[1];
        if (humans === undefined || computers === undefined) return yield* failed("restore two humans", `no slot modes in ${menuName(0)}`);
        if (((Number(humans) | Number(computers)) & bit) === 0) break;
        yield* clickSlotTag(x);
        yield* rig.until("slot tag click not observed", rig.file(0, menuName(0)).pipe(Effect.map((file) => complete(file) && file.text !== text)));
      }
    }
    yield* rig.until("slots C/D were not restored to EMPTY", menusShow(TWO_HUMANS));
  });

  /** Stock count on B's stage screen, one click at a time. */
  const reduceStocks = Effect.gen(function*() {
    const text = yield* rig.waitText(1, /[1-9] Stock/i);
    const shown = /([1-9])\s+Stock/i.exec(text)?.[1];
    if (shown === undefined) return yield* failed("read stocks", text);
    for (let count = Number(shown); count > 1;) {
      yield* rig.click(1, 250, 900);
      yield* rig.click(1, 1380, 155);
      count--;
      yield* rig.waitText(1, stocks(count));
    }
  });

  /** A normal one-minute match bounds the CPU journey without changing combat rules. */
  const oneMinute = Effect.gen(function*() {
    const text = yield* rig.waitText(1, /(?:[0-9]+:00|No time limit)/i);
    const shown = /([0-9]+):00/.exec(text)?.[1];
    let minutes = shown === undefined ? 0 : Number(shown);
    if (minutes > 10) return yield* failed("read match time", text);
    while (minutes !== 1) {
      yield* rig.click(1, 250, 900);
      yield* rig.click(1, minutes === 0 ? 2110 : 1807, 155);
      minutes += minutes === 0 ? 1 : -1;
      yield* rig.waitText(1, new RegExp(`${minutes}:00`));
    }
  });

  const setStocks = (x: number, counts: readonly number[]) =>
    Effect.forEach(counts, (count) =>
      Effect.gen(function*() {
        yield* rig.click(1, 250, 900);
        yield* rig.click(1, x, 155);
        yield* rig.waitText(1, stocks(count));
      }), { discard: true });

  /** A synchronized player chat command; both clients' receipts must show the value. */
  const devCommand = (epoch: number, command: string, expected: string) =>
    Effect.gen(function*() {
      const name = (client: Slot) => devCommandReceiptFile(build, client);
      const before = (yield* Effect.forEach(SLOTS, (client) => rig.file(client, name(client)))).map((file) => file?.text ?? "");
      // The map hides Warcraft's chat box; both clients' receipts confirm the command.
      yield* rig.key(0, "Return");
      yield* rig.type(0, command);
      yield* rig.key(0, "Return");
      yield* rig.until(`dev command not confirmed: ${command}`, Effect.forEach(SLOTS, (client) => rig.file(client, name(client))).pipe(
        Effect.map((files) => files.every((file, client) => complete(file) && file.text !== before[client] && file.text.includes(expected))),
      ));
      yield* rig.record({ event: "dev-config", epoch, command, publications: yield* boundaries(name) });
    });

  const runPulse = (epoch: number, pulse: Pulse) =>
    Effect.gen(function*() {
      const { presses, releases } = pulseSends(epoch, pulse);
      for (const press of presses) yield* rig.send(press);
      yield* rig.sleep(PULSE_HOLD_MILLIS);
      for (const release of releases) yield* rig.send(release);
      yield* rig.sleep(pulse.settleMillis);
    });

  const stall = (epoch: number, target: StallTarget, pulses: readonly Pulse[]) =>
    Effect.gen(function*() {
      let continuedNs = 0;
      const { stopped, stoppedNs } = yield* Effect.acquireUseRelease(
        Effect.all({ stopped: rig.stop(target), stoppedNs: rig.monotonicNs }),
        (held) =>
          Effect.gen(function*() {
            for (const pulse of pulses) yield* runPulse(epoch, pulse);
            yield* rig.sleep(Math.max(0, (held.stoppedNs + STALL_MILLIS * 1_000_000 - (yield* rig.monotonicNs)) / 1_000_000));
            return held;
          }),
        ({ stopped }) =>
          Effect.gen(function*() {
            continuedNs = yield* rig.monotonicNs;
            yield* rig.resume(stopped);
          }),
      );
      yield* rig.record({
        event: "integrity-stall",
        epoch,
        kind: target.kind,
        slot: target.slot,
        pid: stopped.pid,
        stopped_monotonic_ns: stoppedNs,
        continued_monotonic_ns: continuedNs,
        verified_stopped_state: true,
      });
    });

  /** Start pauses both clients and Start resumes them; each side commits through one control receipt. */
  const pause = (epoch: number) =>
    Effect.gen(function*() {
      const prefix = `match-${epoch}-integrity-`;
      const committed = (state: string) =>
        Effect.forEach(SLOTS, (client) =>
          Effect.gen(function*() {
            const names = yield* rig.files(client, journalControlFile(build, epoch, client, "*"));
            const files = yield* Effect.forEach(names, (name) => rig.file(client, name).pipe(Effect.map((file) => ({ name, file }))));
            const matching = files.filter(({ file }) => complete(file) && file.text.includes(` state=${state} `));
            return matching.length === 1 ? matching[0]?.name : undefined;
          })).pipe(Effect.map(([a, b]) => (a !== undefined && b !== undefined ? [a, b] as const : undefined)));
      const receipts = (state: string) =>
        Effect.gen(function*() {
          const names = yield* committed(state);
          if (names === undefined) return yield* failed(`${state} receipts`, "not exactly one per client");
          return yield* Effect.forEach(SLOTS, (client) => rig.boundary(client, names[client]));
        });
      const helpersShow = (pattern: RegExp) => Effect.forEach(SLOTS, rig.helperLog).pipe(Effect.map((logs) => logs.every((log) => pattern.test(log))));

      yield* menuButton(0, BTN_START, `${prefix}pause`);
      yield* rig.until("integrity pause was not committed", committed("PAUSE_COMMIT").pipe(Effect.map((names) => names !== undefined)));
      yield* rig.record({ event: "integrity-pause", epoch, publications: yield* receipts("PAUSE_COMMIT") });
      yield* rig.until("helpers did not reach integrity pause", helpersShow(/control sequence=\d+ state=PAUSE frame=/));
      yield* both((client) => rig.waitText(client, PAUSED));
      yield* menuButton(0, BTN_START, `${prefix}resume`);
      yield* rig.until("integrity resume was not committed", committed("RESUME").pipe(Effect.map((names) => names !== undefined)));
      yield* rig.record({ event: "integrity-resume", epoch, publications: yield* receipts("RESUME") });
      yield* rig.until("helpers did not accept integrity resume", helpersShow(/ state=RESUME /));
    });

  /** The match's integrity workload, from its schedule. */
  const integrity = (epoch: number) =>
    Effect.forEach(integritySchedule(epoch), (step) => {
      switch (step.kind) {
        case "sleep":
          return rig.sleep(step.millis);
        case "pulse":
          return runPulse(epoch, step);
        case "stall":
          return stall(epoch, step.target, step.pulses);
        case "pause":
          return pause(epoch);
      }
    }, { discard: true });

  const traceComplete = (client: Slot, afterNs: bigint, ticks = PROBE_TRACE_TICKS) =>
    rig.file(client, TRACE).pipe(Effect.map((file) => {
      if (!complete(file) || file.mtimeNs < afterNs) return false;
      const end = /(\d+) [0-9.]+ end/.exec(file.text);
      return end !== null && Number(end[1]) >= ticks;
    }));

  /** Ctrl+H exports every client's response pages; each page holds 150 rows. */
  const exportResponse = (epoch: number, afterNs: bigint) =>
    Effect.gen(function*() {
      yield* rig.key(0, "ctrl+h");
      for (const client of SLOTS) {
        yield* rig.until(`epoch ${epoch}: response export incomplete`, Effect.gen(function*() {
          const names = yield* rig.files(client, responsePageFile(client, "*", "*"));
          const pages = (yield* Effect.forEach(names, (name) => rig.file(client, name))).filter((file) => complete(file) && file.mtimeNs >= afterNs);
          const header = pages[0]?.text;
          if (header === undefined) return false;
          const rows = / rows=(\d+)/.exec(header)?.[1];
          const retained = / retained=(\d+)/.exec(header)?.[1];
          if (rows === undefined || retained === undefined) return yield* failed("read response page header", header);
          const integrityRows = Number(/integrity retained=(\d+)/.exec(header)?.[1] ?? 0);
          return pages.length === Math.floor((Math.max(Number(rows), Number(retained), integrityRows) + 149) / 150);
        }));
      }
    });

  const match = (epoch: number) =>
    Effect.gen(function*() {
      const odd = epoch % 2 === 1;
      if (matchOnly || playable) yield* reduceStocks;
      // #26's named integrity workload keeps three stocks in its rematch so
      // the complete edge sample finishes before ordinary stock loss.
      else {
        if (!fourFighters && !odd) yield* setStocks(1675, [2, 3]);
        if (!fourFighters && epoch > firstEpoch && odd) yield* setStocks(1380, [2, 1]);
      }
      const commanded = sweep[(epoch - firstEpoch) / 2];
      if (odd && commanded !== undefined) {
        const [window, batch] = commanded;
        yield* devCommand(epoch, `-dev batch ${batch}`, ` batch=${batch} `);
        yield* devCommand(epoch, `-dev rb ${window}`, ` rb=${window} `);
      }
      const traceAfterNs = yield* rig.realtimeNs;
      // Ctrl+G only enables the diagnostic trace; the pads choose, start and rematch.
      if (!playable) yield* rig.key(0, "ctrl+g");
      yield* menuButton(0, BTN_START, `menu-match-${epoch}-start`);
      const start = (client: Slot) => controlName("start", epoch, client);
      yield* rig.until(`epoch ${epoch}: game-controlled start absent`, Effect.forEach(SLOTS, (client) => rig.file(client, start(client))).pipe(Effect.map((files) => files.every(complete))));
      const started = yield* boundaries(start);
      yield* rig.record({ event: "start", epoch, publications: started, observed_monotonic_ns: yield* rig.monotonicNs });
      const deadline = Math.max(...started.map((publication) => publication.publication_monotonic_estimate_ns)) + 300_000_000;
      yield* rig.sleep(Math.max(0, (deadline - (yield* rig.monotonicNs)) / 1_000_000));
      yield* rig.sleep(700);
      // The playable build starts no scene recorder.
      yield* rig.playerView(epoch, { frame: true, scene: !playable });
      if (matchOnly || playable) {
        for (let attack = 0; attack < 4; attack++) {
          for (const slot of SLOTS) yield* tap(slot, `match-${epoch}-combat`);
          yield* rig.sleep(500);
        }
      } else yield* integrity(epoch);

      const stockLoss = `match-${epoch}-stock-loss`;
      // Each player walks off their own side. A playable one-stock match loses
      // Player 1's stock, its rematch Player 2's.
      const walkers: readonly Slot[] = matchOnly ? [] : playable ? [odd ? 0 : 1] : odd ? [0] : [0, 1];
      for (const slot of walkers) yield* send(slot, { type: EV_ABS, code: ABS_X, value: slot === 0 ? -32768 : 32767 }, stockLoss);
      const end = (client: Slot) => controlName("end", epoch, client);
      yield* rig.until(`epoch ${epoch}: result did not stop capture`, Effect.forEach(SLOTS, (client) => rig.file(client, end(client))).pipe(Effect.map((files) => files.every(complete))), matchOnly ? 120 : 75);
      for (const slot of walkers) yield* send(slot, { type: EV_ABS, code: ABS_X, value: 0 }, stockLoss);
      const quiescent = new RegExp(`match_quiescent epoch=${epoch}(?:\\s|$)`);
      yield* rig.until(`epoch ${epoch}: helpers did not quiesce`, Effect.forEach(SLOTS, rig.helperLog).pipe(Effect.map((logs) => logs.every((log) => quiescent.test(log)))));
      yield* rig.record({ event: "end", epoch, publications: yield* boundaries(end), observed_monotonic_ns: yield* rig.monotonicNs });
      // At the result every stay in view is complete; the screen no longer shows the arena.
      if (!playable) yield* rig.playerView(epoch, { frame: false, scene: true });
      const results = yield* both((client) => rig.waitText(client, RESULTS));
      if (playable) {
        // The playable build has no response probe: its results are the
        // result screens and a stationary confirmed-checksum trace.
        yield* rig.record({ event: "results", epoch, texts: results });
        const resultAfterNs = yield* rig.realtimeNs;
        yield* rig.key(0, "ctrl+t");
        for (const client of SLOTS) yield* rig.until(`epoch ${epoch}: result trace incomplete`, traceComplete(client, resultAfterNs, PLAYABLE_TRACE_TICKS), 35);
        yield* rig.archive(String(epoch));
      } else {
        for (const client of SLOTS) yield* rig.until(`epoch ${epoch}: trace did not complete`, traceComplete(client, traceAfterNs), 30);
        yield* rig.archive(String(epoch));
        yield* exportResponse(epoch, traceAfterNs);
        yield* rig.archive(String(epoch));
        // A match can outlast the first trace. Keep it intact and capture a
        // stationary result endpoint only when necessary.
        const traces = yield* Effect.forEach(SLOTS, (client) => rig.file(client, TRACE));
        if (!traces.every((trace) => /participant \d+ frame \d+ phase 3 /.test(trace?.text ?? ""))) {
          const finalAfterNs = yield* rig.realtimeNs;
          yield* rig.key(0, "ctrl+t");
          for (const client of SLOTS) yield* rig.until(`epoch ${epoch}: result trace incomplete`, traceComplete(client, finalAfterNs), 35);
          yield* rig.archive(`${epoch}-result`);
        }
      }
      yield* rig.healthy;
      if (epoch !== lastEpoch) {
        // A results-screen tap must not become a new-match action.
        yield* menuPhase("RESULT");
        yield* tap(0, "results-only");
        yield* menuButton(1, BTN_START, "menu-results-confirm");
        if (!playable) yield* (epoch + 1) % 2 === 0 ? slotChange(epoch + 1) : slotRestore;
        yield* controllerSelect;
      }
      yield* rig.progress(`Epoch ${epoch}: ${matchOnly ? "four-fighter combat and results" : playable ? "one-stock combat, stock loss and results" : "game start, tap, stock loss and results"} observed`);
    });

  const run = Effect.gen(function*() {
    if (fourFighters) yield* fourFighterSetup;
    yield* controllerSelect;
    if (matchOnly) yield* oneMinute;
    if (!matchOnly && !playable && !fourFighters) yield* reduceStocks;
    for (const epoch of epochs) yield* match(epoch);
    yield* menuPhase("RESULT");
    yield* tap(0, "results-only");
    yield* menuButton(1, BTN_START, "menu-results-confirm");
    yield* characterScreen;
    yield* restoreTwoHumans;
  });

  return { integrity, run };
}

/** The whole capture journey against the provided Rig. */
export const runJourney = (options: JourneyOptions) =>
  Effect.gen(function*() {
    yield* journey(yield* Rig, options).run;
  });
