





import { Context, Effect } from "effect";
import { RULE_BUTTONS } from "../../src/game/ui/ruleButtons";
import { STAGE_CATALOG } from "../../src/game/menu/stageCatalog";
import { Character } from "../../src/game/sim/codes";
import { fighterName } from "../../src/game/sim/heroes/registry";
import { MATCH_TICKS_PER_SECOND, START_HOLD_FRAMES } from "../../src/game/match/rules";
import type { Region } from "wisp/scripts/warcraft/desktop";
import { openObservedChat } from "wisp/scripts/wisp/chatSetup";
import { IntegrityFailure } from "./evidence";
import { ABS_RX, ABS_RY, ABS_X, ABS_Y, ABS_Z, BTN_A, BTN_SELECT, BTN_START, BTN_X, BTN_Y, EV_ABS, EV_KEY, type SourceEdge } from "./linuxInput";
import { SLOTS, type Slot } from "./reconcile";
import { type PadLayout, PULSE_HOLD_MILLIS, STALL_MILLIS, type Pulse, type Send, type StallTarget, integritySchedule, pulseSends } from "./schedule";
import { INPUT_TRACE_FILE, devCommandReceiptFile, journalControlFile, journalLifecycleFile, journalMenuFile, nativeChatFile, responsePageFile, stageReceiptFile } from "../../src/runtime/gameFiles";


export interface GameFile {
  readonly text: string;
  readonly mtimeNs: bigint;
}





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
  | { readonly event: "integrity-slot-change" | "four-fighter-setup" | "bot-setup"; readonly epoch: number; readonly changes: readonly ModeReceipt[] }
  | {
    readonly event: "bot-stall";
    readonly epoch: number;
    readonly trial: number;
    readonly slot: Slot;
    readonly pid: number;
    readonly stopped_monotonic_ns: number;
    readonly continued_monotonic_ns: number;
  }
  | { readonly event: "bot-moment"; readonly epoch: number; readonly pressed_monotonic_ns: number; readonly released_monotonic_ns: number }
  | { readonly event: "dev-config"; readonly epoch: number; readonly command: string; readonly publications: readonly PublicationRecord[] }
  | { readonly event: "results"; readonly epoch: number; readonly texts: readonly string[]; readonly notices?: readonly string[] }

  | { readonly event: "perf-overlay"; readonly epoch: number; readonly observed_monotonic_ns: number; readonly text: string }

  | { readonly event: "player-view"; readonly epoch: number; readonly at: PlayerViewMoment; readonly failure: string | undefined };


type PlayerViewMoment = "start" | "result";

export interface Stopped {
  readonly target: StallTarget;
  readonly pid: number;
}

export interface RigShape {

  readonly send: (send: Send) => Effect.Effect<void, IntegrityFailure>;
  readonly sleep: (millis: number) => Effect.Effect<void>;
  readonly monotonicNs: Effect.Effect<number>;
  readonly realtimeNs: Effect.Effect<bigint>;

  readonly startedNs: bigint;

  readonly until: (what: string, check: Effect.Effect<boolean, IntegrityFailure>, seconds?: number) => Effect.Effect<void, IntegrityFailure>;

  readonly healthy: Effect.Effect<void, IntegrityFailure>;

  readonly file: (client: Slot, name: string) => Effect.Effect<GameFile | undefined, IntegrityFailure>;

  readonly files: (client: Slot, pattern: string) => Effect.Effect<readonly string[], IntegrityFailure>;
  readonly helperLog: (slot: Slot) => Effect.Effect<string, IntegrityFailure>;
  readonly boundary: (client: Slot, name: string) => Effect.Effect<PublicationRecord, IntegrityFailure>;

  readonly stop: (target: StallTarget) => Effect.Effect<Stopped, IntegrityFailure>;
  readonly resume: (stopped: Stopped) => Effect.Effect<void>;

  readonly waitText: (client: Slot, pattern: RegExp, region?: Region) => Effect.Effect<string, IntegrityFailure>;

  readonly readText: (client: Slot, region: Region) => Effect.Effect<string, IntegrityFailure>;
  readonly click: (client: Slot, x: number, y: number) => Effect.Effect<void, IntegrityFailure>;
  readonly key: (client: Slot, key: string) => Effect.Effect<void, IntegrityFailure>;
  readonly type: (client: Slot, text: string) => Effect.Effect<void, IntegrityFailure>;

  readonly archive: (label: string) => Effect.Effect<void, IntegrityFailure>;

  readonly playerView: (epoch: number, checks: { readonly frame: boolean; readonly scene: boolean }) => Effect.Effect<void, IntegrityFailure>;
  readonly record: (event: JourneyRecord) => Effect.Effect<void>;
  readonly progress: (message: string) => Effect.Effect<void>;
}

export class Rig extends Context.Service<Rig, RigShape>()("smashcraft/integrity/Rig") {}

export interface JourneyOptions {
  readonly build: string;

  readonly epochs: readonly number[];
  readonly fourFighters: boolean;

  readonly sweep: readonly (readonly [window: number, batch: number])[];





  readonly workload?: "match" | "playable" | "bot";

  readonly botFour?: boolean;

  readonly botPerf?: boolean;

  readonly pad49?: boolean;

  readonly padLayout?: PadLayout;
}

const CONTROLS = /CONTROLS/i;

const SELECTION_HELP: Region = { x: 350, y: 1000, width: 1850, height: 400 };

const STAGE_NAME: Region = { x: 420, y: 965, width: 900, height: 110 };
const SKY_DECK = /Sky Deck/i;
const REMATCH_SETTING: Region = { x: 390, y: 655, width: 555, height: 90 };
const RESULTS = /wins|rematch/i;






const RESULT_NOTICE: Region = { x: 944, y: 312, width: 1008, height: 168 };
const PAUSED = /PAUSED.*Press.*Start.*resume|Paused.*press.*Start.*resume/i;
const TWO_HUMANS = "connected=3 human-fighters=3 computers=0 fighters=3";
const TRACE = INPUT_TRACE_FILE;

const PROBE_TRACE_TICKS = 1200;
const PLAYABLE_TRACE_TICKS = 300;


const BOT_STALLS = [6000, 14000, 22000] as const;
const BOT_STALL_MILLIS = 2000;

const BOT_MOMENTS = [12000, 30000] as const;
const BOT_MOMENT_HOLD_MILLIS = 1300;
const BOT_PLAY_MILLIS = 58000;
const BOT_BEAT_MILLIS = 400;





const BOT_BEATS = [
  { kind: "tap", code: BTN_A, name: "attack" },
  { kind: "hold", code: ABS_RX, value: 32767, holdMillis: 100, name: "c-right" },
  { kind: "tap", code: BTN_Y, name: "jump" },
  { kind: "hold", code: ABS_RY, value: -32768, holdMillis: 100, name: "c-up" },
  { kind: "tap", code: BTN_X, name: "special" },
  { kind: "hold", code: ABS_Z, value: 32767, holdMillis: 200, name: "shield" },
  { kind: "hold", code: ABS_RX, value: -32768, holdMillis: 100, name: "c-left" },
  { kind: "hold", code: ABS_X, value: 32767, holdMillis: 300, name: "dash-right" },
  { kind: "hold", code: ABS_RY, value: 32767, holdMillis: 100, name: "c-down" },
  { kind: "hold", code: ABS_X, value: -32768, holdMillis: 300, name: "dash-left" },
] as const;

const PAD49_BELOW_DOWN = 21299;
const PAD49_PAST_DOWN = 21954;





const BOT_CAPTURE = "-dev capture 1800";





const INTEGRITY_STOCKS = 3;
const stocks = (count: number) => new RegExp(`${count} Stock`, "i");
const signature = (humans: number, computers: number) => `connected=3 human-fighters=${humans} computers=${computers} fighters=${humans + computers}`;

const BOT_STAGE = 0;

const BOT_COMPUTERS = [[3, Character.demonHunter], [4, Character.warden]] as const;

const receiptFields = (text: string): ReadonlyMap<string, string> => new Map([...text.matchAll(/([A-Za-z-]+)=([^\s"]+)/g)].map(([, name, value]) => [name ?? "", value ?? ""]));
const both = <A, E>(each: (client: Slot) => Effect.Effect<A, E>) => Effect.forEach(SLOTS, each, { concurrency: 2 });


function journey(rig: RigShape, options: JourneyOptions) {
  const { build, epochs, fourFighters, sweep } = options;
  const matchOnly = options.workload === "match";
  const playable = options.workload === "playable";
  const bot = options.workload === "bot";

  const diagnosticBuild = !bot || !build.startsWith("playable");





  const commands = !playable && diagnosticBuild;
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
      yield* send(slot, button(BTN_A, 1), phase);
      yield* rig.sleep(PULSE_HOLD_MILLIS);
      yield* send(slot, button(BTN_A, 0), phase);
    });
  const menuButton = (slot: Slot, code: number, phase: string) =>
    Effect.gen(function*() {
      yield* send(slot, button(code, 1), phase);
      yield* rig.sleep(120);
      yield* send(slot, button(code, 0), phase);
    });






  const playerView = (epoch: number, at: PlayerViewMoment, checks: { readonly frame: boolean; readonly scene: boolean }) =>
    matchOnly || playable || bot
      ? rig.playerView(epoch, checks)
      : rig.playerView(epoch, checks).pipe(
        Effect.as<string | undefined>(undefined),
        Effect.catch((failure) => Effect.succeed(failure.message)),
        Effect.tap((failure) => rig.record({ event: "player-view", epoch, at, failure })),
        Effect.tap((failure) => failure === undefined ? Effect.void : rig.progress(`Epoch ${epoch}: player view at ${at} failed, recorded: ${failure}`)),
        Effect.asVoid,
      );

  const menuPhase = (phase: string) =>
    Effect.gen(function*() {
      yield* rig.until(`live controller menu phase ${phase} absent`, menusShow(`phase=${phase}`));
      const contents = (yield* menus).map((file) => file?.text ?? "");
      yield* rig.record({ event: "menu", phase, contents, observed_monotonic_ns: yield* rig.monotonicNs });
    });








  const command = (text: string, expected: Readonly<Record<string, string | number | RegExp>>) =>
    Effect.gen(function*() {
      const name = (client: Slot) => devCommandReceiptFile(build, client);
      const receipts = Effect.forEach(SLOTS, (client) => rig.file(client, name(client)));
      const count = (file: GameFile | undefined) => Number(receiptFields(file?.text ?? "").get("receipt") ?? -1);
      const before = (yield* receipts).map((file) => ({ mtimeNs: file?.mtimeNs ?? -1n, count: complete(file) ? count(file) : -1 }));

      const floor = Math.max(...before.map((receipt) => receipt.count));
      const entry = rig.file(0, nativeChatFile(build, 0)).pipe(Effect.map((file) => {
        if (file === undefined || !file.text.trimEnd().endsWith("endfunction")) return undefined;
        const fields = receiptFields(file.text);
        return { available: fields.get("available") === "1", open: fields.get("open") === "1", modified: Number(file.mtimeNs) };
      }));
      yield* openObservedChat({ name: "client 0" }, entry, rig.key(0, "Return")).pipe(
        Effect.mapError((failure) => failure instanceof IntegrityFailure ? failure : failed("open setup chat", failure.message)),
      );
      yield* rig.type(0, text);
      yield* rig.key(0, "Return");
      yield* rig.until(`dev command not confirmed: ${text}`, receipts.pipe(Effect.map((files) => {
        const counts = files.map(count);
        return files.every((file, client) => complete(file) && file.mtimeNs > (before[client]?.mtimeNs ?? -1n)) && counts[0] === counts[1] && (counts[0] ?? -1) > floor;
      })));
      const confirmed = yield* receipts;
      for (const [client, file] of confirmed.entries()) {
        const fields = receiptFields(file?.text ?? "");
        const wrong = Object.entries(expected).filter(([field, value]) => (value instanceof RegExp ? !value.test(fields.get(field) ?? "") : fields.get(field) !== String(value)));
        if (wrong.length > 0) return yield* failed(`dev command ${text}`, `client ${client} receipt has ${wrong.map(([field]) => `${field}=${fields.get(field)}`).join(" ")}, wanted ${wrong.map(([field, value]) => `${field}=${value}`).join(" ")}:\n${file?.text ?? ""}`);
      }
    });


  const devCommand = (epoch: number, text: string, expected: Readonly<Record<string, string | number | RegExp>>) =>
    Effect.gen(function*() {
      yield* command(text, expected);
      yield* rig.record({ event: "dev-config", epoch, command: text, publications: yield* boundaries((client) => devCommandReceiptFile(build, client)) });
    });


  const journalChat = (epoch: number, text: string) => Effect.gen(function*() {
    const name = `smashcraft-journal-text-ack-${build}-e${epoch}-p0.txt`;
    const read = rig.file(0, name);
    const fields = (file: GameFile | undefined) => receiptFields(file?.text ?? "");
    const before = fields(yield* read);
    yield* rig.key(0, "Return");
    yield* rig.until(`epoch ${epoch}: ${text} chat entry not open`, read.pipe(Effect.map((file) => {
      const current = fields(file);
      return complete(file) && current.get("epoch") === String(epoch) && Number(current.get("revision")) > Number(before.get("revision")) && Number(current.get("chat")) > Number(before.get("chat")) && current.get("chatState") === "3";
    })), 8);
    const opened = fields(yield* read);
    yield* rig.type(0, text);
    yield* rig.key(0, "Return");
    yield* rig.until(`epoch ${epoch}: ${text} chat has not returned keyboard focus`, read.pipe(Effect.map((file) => {
      const current = fields(file);
      return complete(file) && current.get("epoch") === String(epoch) && Number(current.get("revision")) > Number(opened.get("revision")) && current.get("chat") === opened.get("chat") && current.get("chatState") === "0";
    })), 8);
  });


  const resumeAfterChat = (epoch: number) => Effect.gen(function*() {
    const from = yield* Effect.forEach(SLOTS, (slot) => rig.helperLog(slot).pipe(Effect.map((text) => text.length)));
    yield* menuButton(0, BTN_START, `match-${epoch}-chat-resume`);
    yield* rig.until(`epoch ${epoch}: chat resume not acknowledged by both helpers`, Effect.forEach(SLOTS, (slot) => rig.helperLog(slot)).pipe(Effect.map((logs) => logs.every((log, slot) => / state=RESUME /.test(log.slice(from[slot]))))), 8);
    yield* rig.record({ event: "integrity-resume", epoch, publications: yield* Effect.forEach(SLOTS, (slot) => Effect.gen(function*() {
      const names = yield* rig.files(slot, journalControlFile(build, epoch, slot, "*"));
      for (const name of names) {
        const file = yield* rig.file(slot, name);
        if (complete(file) && file.text.includes(" state=RESUME ")) return yield* rig.boundary(slot, name);
      }
      return yield* failed(`epoch ${epoch}: chat resume receipt`, `client ${slot} has no RESUME receipt`);
    })) });
  });


  const characterScreen = Effect.gen(function*() {
    yield* menuPhase("CHARACTER");
    if (!commands) yield* rig.waitText(0, CONTROLS, SELECTION_HELP);
  });


  const controllerSelect = Effect.gen(function*() {
    yield* characterScreen;
    for (const slot of SLOTS) yield* menuButton(slot, BTN_A, "menu-character-select");
    yield* menuButton(0, BTN_START, "menu-character-confirm");
    yield* menuPhase("STAGE");
    if (bot && !commands) {



      for (let step = 0; step < STAGE_CATALOG.length && !SKY_DECK.test(yield* rig.readText(0, STAGE_NAME)); step++) {
        yield* send(0, { type: EV_ABS, code: ABS_X, value: -32768 }, "menu-stage-left");
        yield* rig.sleep(120);
        yield* send(0, { type: EV_ABS, code: ABS_X, value: 0 }, "menu-stage-left");
        yield* rig.sleep(200);
      }
      yield* rig.waitText(0, SKY_DECK, STAGE_NAME);
    }
  });


  const clickSlotTag = (x: number) =>
    Effect.gen(function*() {

      yield* rig.click(0, 2400, 200);
      yield* rig.click(0, x, 824);
    });


  const setSlots = (x: number, humans: number, computers: number) =>
    commands ? command(`-dev slots ${humans} ${computers}`, { "human-fighters": humans, computers }) : clickSlotTag(x);

  const modeChanges = (what: string, changes: readonly (readonly [x: number, humans: number, computers: number])[]) =>
    Effect.forEach(changes, ([x, humans, computers]) =>
      Effect.gen(function*() {
        yield* setSlots(x, humans, computers);
        yield* rig.until(what, menusShow(signature(humans, computers)));
        return { human_fighters: humans, computers, publications: yield* boundaries(menuName) } satisfies ModeReceipt;
      }));


  const fourFighterSetup = Effect.gen(function*() {
    yield* characterScreen;
    const changes = yield* modeChanges("four-fighter setup absent on one client", [[1484, 7, 0], [1484, 3, 4], [1904, 11, 4], [1904, 3, 12]]);
    yield* rig.record({ event: "four-fighter-setup", epoch: firstEpoch, changes });
  });


  const botSetup = Effect.gen(function*() {
    yield* characterScreen;
    const changes = yield* modeChanges("bot session computer absent on one client", options.botFour === true ? [[1484, 7, 0], [1484, 3, 4], [1904, 11, 4], [1904, 3, 12]] : [[1484, 7, 0], [1484, 3, 4]]);
    yield* rig.record({ event: "bot-setup", epoch: firstEpoch, changes });
    if (commands) {

      for (const [player, character] of BOT_COMPUTERS.slice(0, options.botFour === true ? 2 : 1)) {
        yield* command(`-dev fighter ${player} ${fighterName(character)}`, { characters: new RegExp(`^(?:\\d+,){${player - 1}}${character}(?:,|$)`) });
      }
      yield* command(`-dev stage ${BOT_STAGE}`, { stage: BOT_STAGE });
    }
  });













  const pad49 = (epoch: number, startNs: number) =>
    Effect.gen(function*() {
      const at = (offsetMs: number) => Effect.gen(function*() {
        yield* rig.sleep(Math.max(0, (startNs + offsetMs * 1_000_000 - (yield* rig.monotonicNs)) / 1_000_000));
      });
      const stick = (x: number, y: number, phase: string) => Effect.gen(function*() {
        yield* send(0, { type: EV_ABS, code: ABS_X, value: x }, `pad49-${phase}`);
        yield* send(0, { type: EV_ABS, code: ABS_Y, value: y }, `pad49-${phase}`);
      });
      const press = (code: number, phase: string) => Effect.gen(function*() {
        yield* send(0, button(code, 1), `pad49-${phase}`);
        yield* rig.sleep(100);
        yield* send(0, button(code, 0), `pad49-${phase}`);
      });
      yield* at(3000);
      yield* stick(0, 0, "rest");
      yield* at(4500);
      yield* stick(8000, -8000, "drift-a");
      yield* at(6000);
      yield* stick(-9000, 9000, "drift-b");
      yield* at(7500);
      yield* stick(0, 0, "rest-b");
      yield* at(8500);
      yield* press(BTN_X, "x");
      yield* at(9500);
      yield* press(BTN_Y, "y");
      yield* at(10500);
      yield* stick(0, PAD49_BELOW_DOWN, "down-below");
      yield* at(12000);
      yield* stick(0, 0, "rest-c");
      yield* at(13000);
      yield* stick(0, PAD49_PAST_DOWN, "down-past");
      yield* at(14500);
      yield* stick(0, 0, "rest-d");
      yield* at(15500);
      yield* stick(32767, 0, "right-hold");
      yield* at(16500);
      yield* rig.progress("pad49: focus blip");
      yield* at(19000);
      yield* stick(0, 0, "rest-e");
      yield* at(20000);
    });

  const botMatch = (epoch: number, startNs: number) =>
    Effect.gen(function*() {
      if (options.pad49 === true && epoch === firstEpoch) yield* pad49(epoch, startNs);
      const ended = Effect.forEach(SLOTS, (client) => rig.file(client, controlName("end", epoch, client))).pipe(Effect.map((files) => files.some(complete)));
      let beat = 0;

      const beatOnce = Effect.gen(function*() {
        const step = BOT_BEATS[beat % BOT_BEATS.length] ?? BOT_BEATS[0];
        beat++;
        const phase = `bot-${epoch}-beat:${step.name}`;
        for (const slot of SLOTS) yield* send(slot, step.kind === "tap" ? button(step.code, 1) : { type: EV_ABS, code: step.code, value: step.value }, phase);
        yield* rig.sleep(step.kind === "tap" ? PULSE_HOLD_MILLIS : step.holdMillis);
        for (const slot of SLOTS) yield* send(slot, step.kind === "tap" ? button(step.code, 0) : { type: EV_ABS, code: step.code, value: 0 }, phase);
        yield* rig.sleep(BOT_BEAT_MILLIS);
      });

      const playUntil = (offsetMs: number) =>
        Effect.gen(function*() {
          while ((yield* rig.monotonicNs) < startNs + offsetMs * 1_000_000) {
            if (yield* ended) return false;
            yield* beatOnce;
          }
          return !(yield* ended);
        });

      const stallTimes = ((options.botFour === true || options.botPerf === true) && epoch % 2 === 0) || (options.pad49 === true && epoch === firstEpoch) ? [] : BOT_STALLS;
      const timeline = [
        ...stallTimes.map((at, index) => ({ at, kind: "stall" as const, trial: index + 1 })),
        ...BOT_MOMENTS.map((at) => ({ at, kind: "moment" as const, trial: 0 })),
      ].sort((a, b) => a.at - b.at);
      for (const { at, kind, trial } of timeline) {
        if (!(yield* playUntil(at))) return;
        if (kind === "moment") {
          const pressedNs = yield* rig.monotonicNs;
          for (const slot of SLOTS) yield* send(slot, button(BTN_SELECT, 1), `bot-${epoch}-moment`);
          yield* rig.sleep(BOT_MOMENT_HOLD_MILLIS);
          for (const slot of SLOTS) yield* send(slot, button(BTN_SELECT, 0), `bot-${epoch}-moment`);
          yield* rig.record({ event: "bot-moment", epoch, pressed_monotonic_ns: pressedNs, released_monotonic_ns: yield* rig.monotonicNs });
          yield* rig.progress(`Epoch ${epoch}: both pads held View for a moment`);
          continue;
        }
        const stopped = yield* rig.stop({ kind: "game", slot: 1 });
        const stoppedNs = yield* rig.monotonicNs;
        yield* rig.progress(`Epoch ${epoch}: trial ${trial}: stopped client B's game, pid ${stopped.pid}`);
        yield* Effect.gen(function*() {
          yield* rig.sleep(Math.max(0, (stoppedNs + BOT_STALL_MILLIS * 1_000_000 - (yield* rig.monotonicNs)) / 1_000_000));
        }).pipe(
          Effect.ensuring(Effect.gen(function*() {
            const continuedNs = yield* rig.monotonicNs;
            yield* rig.resume(stopped);
            yield* rig.record({ event: "bot-stall", epoch, trial, slot: 1, pid: stopped.pid, stopped_monotonic_ns: stoppedNs, continued_monotonic_ns: continuedNs });
          })),
        );
      }
      yield* playUntil(BOT_PLAY_MILLIS);
    });


  const slotChange = (epoch: number) =>
    Effect.gen(function*() {
      yield* characterScreen;
      const modes = fourFighters ? [[3, 8], [7, 8], [3, 12]] as const : [[7, 0], [3, 4]] as const;
      const changes = yield* modeChanges("integrity rematch slot change absent", modes.map(([humans, computers]) => [1484, humans, computers] as const));
      yield* rig.record({ event: "integrity-slot-change", epoch, changes });
    });


  const slotRestore = Effect.gen(function*() {
    yield* characterScreen;
    yield* setSlots(1484, 3, 0);
    yield* rig.until("slot C was not restored to EMPTY", menusShow(TWO_HUMANS));
  });


  const restoreTwoHumans = Effect.gen(function*() {
    if (commands) {
      yield* command("-dev slots 3 0", { "human-fighters": 3, computers: 0 });
      return yield* rig.until("slots C/D were not restored to EMPTY", menusShow(TWO_HUMANS));
    }
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


  const clickRule = Effect.fnUntraced(function*(name: keyof typeof RULE_BUTTONS) {
    const box = RULE_BUTTONS[name];
    yield* rig.click(1, 250, 900);
    yield* rig.click(1, Math.round(320 + 2400 * (box.x + box.width / 2)), Math.round(1440 - 2400 * (box.y - box.height / 2)));
  });


  const stockCount = (target: number) => Effect.gen(function*() {
    if (commands) return yield* command(`-dev stocks ${target}`, { stocks: target });
    const text = yield* rig.waitText(1, /[1-9] Stock/i);
    const shown = /([1-9])\s+Stock/i.exec(text)?.[1];
    if (shown === undefined) return yield* failed("read stocks", text);
    for (let count = Number(shown); count !== target;) {
      yield* clickRule(count > target ? "fewerStocks" : "moreStocks");
      count += count > target ? -1 : 1;
      yield* rig.waitText(1, stocks(count));
    }
  });
  const reduceStocks = stockCount(1);


  const oneMinute = Effect.gen(function*() {
    if (commands) return yield* command("-dev time 1", { minutes: 1 });
    const text = yield* rig.waitText(1, /(?:[0-9]+:00|No time limit)/i);
    const shown = /([0-9]+):00/.exec(text)?.[1];
    let minutes = shown === undefined ? 0 : Number(shown);
    if (minutes > 10) return yield* failed("read match time", text);
    while (minutes !== 1) {
      yield* clickRule(minutes === 0 ? "moreTime" : "lessTime");
      minutes += minutes === 0 ? 1 : -1;
      yield* rig.waitText(1, new RegExp(`${minutes}:00`));
    }
  });





  const stageDrawn = (epoch: number) =>
    Effect.gen(function*() {
      const receipts = Effect.forEach(SLOTS, (client) => rig.file(client, stageReceiptFile(build, client)));
      yield* rig.until(`epoch ${epoch}: stage drawn receipts absent`, receipts.pipe(Effect.map((files) => files.every((file) => complete(file) && receiptFields(file.text).get("epoch") === String(epoch)))));
      if (!bot) return;
      for (const [client, file] of (yield* receipts).entries()) {
        const stage = receiptFields(file?.text ?? "").get("stage");
        if (stage !== String(BOT_STAGE)) return yield* failed(`epoch ${epoch}: stage drawn`, `client ${client} drew stage ${stage}, wanted ${BOT_STAGE}`);
      }
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


  const integrity = (epoch: number) =>
    Effect.forEach(integritySchedule(epoch, options.padLayout ?? "xpad"), (step) => {
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

      const commanded = sweep[(epoch - firstEpoch) / 2];
      if (odd && commanded !== undefined) {
        const [window, batch] = commanded;
        yield* devCommand(epoch, `-dev batch ${batch}`, { batch });
        yield* devCommand(epoch, `-dev rb ${window}`, { rb: window });
      }

      const traceAfterNs = yield* rig.realtimeNs;

      if (!playable && diagnosticBuild) yield* rig.key(0, "ctrl+g");
      const start = (client: Slot) => controlName("start", epoch, client);
      const startsShown = Effect.forEach(SLOTS, (client) => rig.file(client, start(client))).pipe(Effect.map((files) => files.every(complete)));
      if (!bot || epoch === firstEpoch) {
        yield* menuButton(0, BTN_START, `menu-match-${epoch}-start`);

        yield* rig.until(`epoch ${epoch}: stage selection absent`, Effect.gen(function*() {
          return (yield* menusShow("phase=STAGE")) || (yield* startsShown);
        }));
        if (yield* menusShow("phase=STAGE")) yield* menuButton(0, BTN_START, `menu-match-${epoch}-stage`);
      }
      yield* rig.until(`epoch ${epoch}: game-controlled start absent`, startsShown);
      const started = yield* boundaries(start);
      yield* rig.record({ event: "start", epoch, publications: started, observed_monotonic_ns: yield* rig.monotonicNs });
      if (bot && (options.botFour === true || options.botPerf === true) && !odd) {
        yield* journalChat(epoch, BOT_CAPTURE);
        yield* resumeAfterChat(epoch);
      }
      const deadline = Math.max(...started.map((publication) => publication.publication_monotonic_estimate_ns)) + 300_000_000;
      yield* rig.sleep(Math.max(0, (deadline - (yield* rig.monotonicNs)) / 1_000_000));
      yield* rig.sleep(700);
      if (commands) yield* stageDrawn(epoch);

      yield* playerView(epoch, "start", { frame: true, scene: !playable && diagnosticBuild });

      const goNs = deadline - 300_000_000 + START_HOLD_FRAMES * 1_000_000_000 / MATCH_TICKS_PER_SECOND;
      yield* rig.sleep(Math.max(0, (goNs - (yield* rig.monotonicNs)) / 1_000_000));
      if (bot) {
        yield* botMatch(epoch, goNs);
      }
      else if (matchOnly || playable) {
        for (let attack = 0; attack < 4; attack++) {
          for (const slot of SLOTS) yield* tap(slot, `match-${epoch}-combat`);
          yield* rig.sleep(500);
        }
      } else yield* integrity(epoch);

      const stockLoss = `match-${epoch}-stock-loss`;


      const walkers: readonly Slot[] = matchOnly || bot ? [] : playable ? [odd ? 0 : 1] : odd ? [0] : [0, 1];
      for (const slot of walkers) yield* send(slot, { type: EV_ABS, code: ABS_X, value: slot === 0 ? -32768 : 32767 }, stockLoss);
      const end = (client: Slot) => controlName("end", epoch, client);
      yield* rig.until(`epoch ${epoch}: result did not stop capture`, Effect.forEach(SLOTS, (client) => rig.file(client, end(client))).pipe(Effect.map((files) => files.every(complete))), matchOnly || bot ? 120 : 75);
      for (const slot of walkers) yield* send(slot, { type: EV_ABS, code: ABS_X, value: 0 }, stockLoss);
      const quiescent = new RegExp(`match_quiescent epoch=${epoch}(?:\\s|$)`);
      yield* rig.until(`epoch ${epoch}: helpers did not quiesce`, Effect.forEach(SLOTS, rig.helperLog).pipe(Effect.map((logs) => logs.every((log) => quiescent.test(log)))));
      if (bot && epoch === lastEpoch) yield* rig.key(0, "Escape");
      yield* rig.record({ event: "end", epoch, publications: yield* boundaries(end), observed_monotonic_ns: yield* rig.monotonicNs });

      if (!playable && diagnosticBuild) yield* playerView(epoch, "result", { frame: false, scene: true });
      const results = yield* both((client) => rig.waitText(client, RESULTS));
      if (playable || bot) {


        const notices = yield* both((client) => rig.readText(client, RESULT_NOTICE));
        yield* rig.record({ event: "results", epoch, texts: results, notices });
        if (bot && diagnosticBuild) {


          for (const client of SLOTS) yield* rig.until(`epoch ${epoch}: trace did not complete`, traceComplete(client, traceAfterNs), 30);
          yield* rig.archive(String(epoch));
          yield* exportResponse(epoch, traceAfterNs);
        } else {
          const resultAfterNs = yield* rig.realtimeNs;
          yield* rig.key(0, "ctrl+t");
          for (const client of SLOTS) yield* rig.until(`epoch ${epoch}: result trace incomplete`, traceComplete(client, resultAfterNs, PLAYABLE_TRACE_TICKS), 35);
        }
        yield* rig.archive(String(epoch));
      } else {
        for (const client of SLOTS) yield* rig.until(`epoch ${epoch}: trace did not complete`, traceComplete(client, traceAfterNs), 30);
        yield* rig.archive(String(epoch));
        yield* exportResponse(epoch, traceAfterNs);
        yield* rig.archive(String(epoch));


        const traces = yield* Effect.forEach(SLOTS, (client) => rig.file(client, TRACE));
        if (!traces.every((trace) => /participant \d+ frame \d+ phase 3 /.test(trace?.text ?? ""))) {
          const finalAfterNs = yield* rig.realtimeNs;
          yield* rig.key(0, "ctrl+t");
          for (const client of SLOTS) yield* rig.until(`epoch ${epoch}: result trace incomplete`, traceComplete(client, finalAfterNs), 35);
          yield* rig.archive(`${epoch}-result`);
        }
      }
      yield* rig.healthy;
      if (epoch !== lastEpoch && !bot) {

        yield* menuPhase("RESULT");
        yield* tap(0, "results-only");
        yield* menuButton(1, BTN_START, "menu-results-confirm");
        if (!playable && !bot) yield* (epoch + 1) % 2 === 0 ? slotChange(epoch + 1) : slotRestore;
        if (matchOnly || playable) yield* reduceStocks;
        yield* controllerSelect;
      }
      yield* rig.progress(`Epoch ${epoch}: ${bot ? "bot combat, stalls, moment and results" : matchOnly ? "four-fighter combat and results" : playable ? "one-stock combat, stock loss and results" : "game start, tap, stock loss and results"} observed`);
    });

  const run = Effect.gen(function*() {


    yield* rig.until("live controller menu phase CHARACTER absent", menusShow("phase=CHARACTER"));
    yield* restoreTwoHumans;
    if (fourFighters) yield* fourFighterSetup;
    if (bot) yield* botSetup;
    if (matchOnly || playable || bot) yield* characterScreen;
    if (matchOnly || bot) yield* oneMinute;
    if (matchOnly || playable) yield* reduceStocks;
    if (bot) yield* stockCount(3);
    if (bot && commands) {
      yield* command("-dev auto-rematch on", { "automatic-rematch": 1 });
      yield* devCommand(firstEpoch, "-dev rematch 20", { rematchSeconds: 20 });
    } else if (bot) {
      const rematch = yield* rig.readText(1, REMATCH_SETTING);
      if (!/Automatic rematch: On/i.test(rematch)) yield* clickRule("automaticRematch");
      yield* both(client => rig.waitText(client, /Automatic rematch: On/i, REMATCH_SETTING));
    }


    if (!matchOnly && !playable && !fourFighters && !bot) yield* stockCount(INTEGRITY_STOCKS);
    yield* controllerSelect;
    for (const epoch of epochs) yield* match(epoch);
    yield* menuPhase("RESULT");
    yield* tap(0, "results-only");
    yield* menuButton(1, BTN_START, "menu-results-confirm");
    yield* characterScreen;
    yield* restoreTwoHumans;
  });

  return { integrity, run };
}






export const nextMatchEpoch = (build: string) =>
  Effect.gen(function*() {
    const rig = yield* Rig;
    const receipts = Effect.forEach(SLOTS, (client) => rig.file(client, journalMenuFile(build, client))).pipe(Effect.map((files) => files.map((file) => {
      if (file === undefined || file.mtimeNs < rig.startedNs || !file.text.trimEnd().endsWith("endfunction")) return undefined;
      const epoch = / epoch=(\d+) /.exec(file.text)?.[1];
      return epoch === undefined ? undefined : Number(epoch);
    })));
    yield* rig.until("menu receipts naming the game's last match absent", receipts.pipe(Effect.map((last) => last.every((epoch) => epoch !== undefined))));
    const [a, b] = yield* receipts;
    if (a === undefined || a !== b) return yield* new IntegrityFailure({ operation: "read the next match", path: build, cause: `menu receipts name last matches ${a} and ${b}` });
    if ((a + 1) % 2 === 0) return yield* new IntegrityFailure({ operation: "read the next match", path: build, cause: `the game's next match is ${a + 1}, a rematch; start the capture in a new game (bun wisp fresh MAP --no-quick)` });
    yield* rig.progress(`Menu receipts: last match ${a}; the capture starts at match ${a + 1}`);
    return a + 1;
  });


export const runJourney = (options: JourneyOptions) =>
  Effect.gen(function*() {
    yield* journey(yield* Rig, options).run;
  });
