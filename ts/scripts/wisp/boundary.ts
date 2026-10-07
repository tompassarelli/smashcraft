// Smashcraft's selection, developer-command and input-trace records.
import { Effect, Schema } from "effect";
import { preloadRecord, Count, Seconds, type GameFileKind } from "wisp/scripts/wisp/boundary";
import { MAX_BATCH } from "../../src/game/netcode/journal/transport";
import * as files from "../../src/runtime/gameFiles";
export * from "../../src/runtime/gameFiles";

/** wc3-melee-ready.txt: the build and match setup when the local player reaches character selection. */
export const MeleeReady = preloadRecord(
  {
    head: ["BUILD {build}", "INPUT {input} PRESENTATION {presentation}", "SCENARIO {scenario}", "BINDINGS {bindings}", "HUMANS {humans} FIGHTERS {fighters}"],
    rest: "slotBindings",
  },
  Schema.Struct({
    build: Schema.NonEmptyString,
    input: Schema.NonEmptyString,
    presentation: Schema.NonEmptyString,
    scenario: Schema.NonEmptyString,
    bindings: Schema.NonEmptyString,
    humans: Count,
    fighters: Count,
    /** `BINDINGSn KEYS` or `BINDINGSn BOT` for each active slot n. */
    slotBindings: Schema.Array(Schema.String.check(Schema.isPattern(/^BINDINGS\d+ \S+$/))),
  }),
);

/** smashcraft-dev-BUILD-pN.txt: confirmation a client handled a developer chat command. */
export const DevCommandReceipt = preloadRecord(
  {
    head: [
      "SMASHCRAFT DEV v=1 build={build} receipt={receipt} epoch={epoch} rb={rollback} delay={delay} batch={batch} rematchSeconds={rematchSeconds} ",
      "SETUP phase={phase} human-fighters={humanFighters} computers={computers} characters={characters} stocks={stocks} minutes={minutes} automatic-rematch={automaticRematch} stage={stage} ",
    ],
  },
  Schema.Struct({
    build: Schema.NonEmptyString,
    receipt: Count.check(Schema.isGreaterThanOrEqualTo(1)),
    epoch: Count,
    rollback: Count.check(Schema.isGreaterThanOrEqualTo(1)),
    delay: Count,
    batch: Count.check(Schema.isGreaterThanOrEqualTo(1)).check(Schema.isLessThanOrEqualTo(MAX_BATCH)),
    rematchSeconds: Count.check(Schema.isGreaterThanOrEqualTo(1)),
    phase: Count,
    humanFighters: Count,
    computers: Count,
    /** Each slot's fighter, comma-separated. */
    characters: Schema.String.check(Schema.isPattern(/^\d+,\d+,\d+,\d+$/)),
    stocks: Count,
    minutes: Count,
    automaticRematch: Count,
    stage: Count,
  }),
);

/** smashcraft-stage-BUILD-pN.txt: the stage a client drew at a match start. */
export const StageReceipt = preloadRecord(
  { head: ["SMASHCRAFT STAGE v=1 build={build} epoch={epoch} stage={stage} decks={decks} "] },
  Schema.Struct({ build: Schema.NonEmptyString, epoch: Count, stage: Count, decks: Count.check(Schema.isGreaterThanOrEqualTo(1)) }),
);

/** wc3-melee-input-start.txt: the developer input trace started. */
export const InputTraceStart = preloadRecord(
  { head: ["TRACE START {build}"] },
  Schema.Struct({ build: Schema.NonEmptyString }),
);

/**
 * wc3-melee-input-trace.txt: the developer input trace. Its lines stay text
 * for the tools that read particular ones; the summary is decoded.
 */
export const InputTrace = preloadRecord(
  { rest: "lines", tail: ["dropped {dropped}", "{ticks} {seconds} end"] },
  Schema.Struct({ lines: Schema.Array(Schema.String), dropped: Count, ticks: Count, seconds: Seconds }),
);

const Identity = { build: Schema.NonEmptyString, epoch: Count, slot: Count };

/**
 * Sequenced pause/resume requests and the start/end receipts share this
 * record. An end receipt names the match's winner (P1-P4 or none); end
 * receipts of builds before 0.0.46 have no winner field.
 */
export const JournalControl = preloadRecord(
  { head: ["SMASHCRAFT JOURNAL CONTROL v=1 build={build} epoch={epoch} slot={slot} sequence={sequence} state={state} frame={frame} winner={winner}"] },
  Schema.Struct({
    ...Identity,
    sequence: Count,
    state: Schema.Literals(["START", "END", "PAUSE", "PAUSE_COMMIT", "RESUME"]),
    frame: Count,
    winner: Schema.optionalKey(Schema.String.check(Schema.isPattern(/^(?:P[1-4]|none)$/))),
  }),
);

/** smashcraft-journal-menu-BUILD-sN.txt: the menu phase and slot modes the map last showed. */
export const JournalMenu = preloadRecord(
  { head: ["SMASHCRAFT JOURNAL MENU v=1 build={build} epoch={epoch} slot={slot} phase={phase}", "connected={connected} human-fighters={humanFighters} computers={computers} fighters={fighters}"] },
  Schema.Struct({ ...Identity, phase: Schema.Literals(["CHARACTER", "STAGE", "RESULT", "BLOCKED"]), connected: Count, humanFighters: Count, computers: Count, fighters: Count }),
);

const JournalReady = preloadRecord(
  { head: ["SMASHCRAFT JOURNAL v=1 build={build} epoch={epoch} slot={slot}", "input={input} delay={delay} rollback={rollback} first_frame={firstFrame}"], rest: "instructions" },
  Schema.Struct({ ...Identity, input: Schema.NonEmptyString, delay: Count, rollback: Count, firstFrame: Count, instructions: Schema.Array(Schema.NonEmptyString).check(Schema.isMinLength(4)) }),
);

const JournalTransportReady = preloadRecord(
  { head: ["build={build} epoch={epoch} slot={slot} received-mask={receivedMask} before-journal-reads=yes"] },
  Schema.Struct({ ...Identity, receivedMask: Count }),
);

const JournalFailure = preloadRecord(
  { head: ["build={build} epoch={epoch} slot={slot}", "reason={reason} sequence={sequence} frame={frame}"] },
  Schema.Struct({ ...Identity, reason: Schema.NonEmptyString, sequence: Count, frame: Count }),
);

const integer = "[+-]?\\d+";
const real = "[+-]?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?";
/** Object fields read back from the retained native handles after a bundle install. */
const ObjectDataReceipt = preloadRecord(
  { head: ["object-data frame {frame} objects {objects} state {state}"], rest: "units" },
  Schema.Struct({ frame: Count, objects: Schema.String.check(Schema.isPattern(/^\d+:\d+$/)), state: Schema.String.check(Schema.isPattern(/^\d+:\d+$/)),
    units: Schema.Array(Schema.String.check(Schema.isPattern(new RegExp(`^slot \\d+ unit \\d+ handle \\d+ speed ${real} cooldown ${real}$`)))) }),
);
// Response pages retain their text for the pure reconciler, after checking
// the numeric fields and column counts of every exported row here.
const ResponseLine = Schema.String.check(Schema.isPattern(new RegExp(
  `^(?:clock=.+|[ABCDPQ] (?:row|epoch) .+|A(?: ${real}){6}(?: ${integer}){6}|B(?: ${integer}){10}|C(?: ${integer}){3} ${real} ${integer} ${real}|D(?: ${integer}){2}(?: ${real}){3}|P(?: ${integer}){3}(?: ${real}){2}|Q ${integer}(?: ${real}){12}|I ${integer} (?:(?:capture|receive|confirmed|predict)(?: ${integer}){7}|(?:action|legal)(?: ${integer}){6}|rollback(?: ${integer}){2}|(?:stall|held)(?: ${integer}){3}|checksum(?: ${integer}){2} \\d+:\\d+ ${integer}))$`,
)));

export const ResponsePage = preloadRecord(
  { head: [
    "RS v=3 build={build} local={slot} run={run} page={page} rows={rows} mode={mode} edge_pairs={edgePairs} edge_limit={edgeLimit} edge_dropped={edgeDropped}",
    "integrity retained={integrityRetained} dropped={integrityDropped}",
    "counts poll={polls} capture_attempt={captures} advance={advances} present={presentations}",
    "transport sent_frames={sentFrames} received_frames={receivedFrames} unmatched_receipts={unmatchedReceipts} dropped_from_export={transportDropped} retained={transportRetained}",
  ], rest: "lines" },
  Schema.Struct({ build: Schema.NonEmptyString, slot: Count, run: Count, page: Count, rows: Count, mode: Schema.Literals(["clean", "edge-stamp"]), edgePairs: Count, edgeLimit: Count, edgeDropped: Count,
    integrityRetained: Count, integrityDropped: Count, polls: Count, captures: Count, advances: Count, presentations: Count,
    sentFrames: Count, receivedFrames: Count, unmatchedReceipts: Count, transportDropped: Count, transportRetained: Count, lines: Schema.Array(ResponseLine) }),
);

const EdgeStamp = preloadRecord(
  { head: ["EDGE v=1 build={build} local={slot} run={run} row={row} stage={stage} held={held} pressed={pressed} released={released} active={active} native_ms={nativeMs}"] },
  Schema.Struct({ build: Schema.NonEmptyString, slot: Count, run: Count, row: Count, stage: Schema.Literals(["poll", "present"]), held: Count, pressed: Count, released: Count, active: Count.check(Schema.isLessThanOrEqualTo(1)), nativeMs: Seconds }),
);

export const FrameCost = preloadRecord(
  { head: ["SOURCE {source}", "frames={frames}", "total_seconds={totalSeconds}", "mean_seconds={meanSeconds}", "initial_checksum={initialChecksum}", "final_checksum={finalChecksum}"], rest: "state" },
  Schema.Struct({ source: Schema.NonEmptyString, frames: Count.check(Schema.isGreaterThanOrEqualTo(4096), Schema.isLessThanOrEqualTo(4096)), totalSeconds: Seconds.check(Schema.isGreaterThan(0)), meanSeconds: Seconds.check(Schema.isGreaterThan(0)),
    initialChecksum: Schema.String.check(Schema.isPattern(/^\d+:\d+$/)), finalChecksum: Schema.String.check(Schema.isPattern(/^\d+:\d+$/)), state: Schema.NonEmptyArray(Schema.String.check(Schema.isPattern(/^state=.+$/))) }),
);

const MaybeSeconds = Schema.Union([Seconds, Schema.Literal("n/a")]);
const FrameCostClock = preloadRecord(
  { head: ["frame-cost-clock os={os} os.clock={clock} os.delta={osDelta} timer.before={timerBefore} timer.after={timerAfter} timer.delta={timerDelta} work={work}"] },
  Schema.Struct({ os: Schema.Literals(["present", "missing"]), clock: Schema.Literals(["present", "missing"]), osDelta: MaybeSeconds, timerBefore: Seconds, timerAfter: Seconds, timerDelta: Seconds, work: Schema.FiniteFromString.check(Schema.isInt()) }),
);

const PhysicsReport = preloadRecord(
  { head: ["SOURCE {source}"], rest: "lines", tail: ["MESSAGES {messages}", "{result}"] },
  Schema.Struct({ source: Schema.NonEmptyString, messages: Count, result: Schema.Literals(["NATIVE_PHYSICS_COMPLETED", "NATIVE_PHYSICS_FAIL"]), lines: Schema.Array(Schema.NonEmptyString) }),
);

/** Selects a game's written-file kind; companion input files are a separate boundary. */
export function writtenGameFileKind(name: string): GameFileKind<unknown> | undefined {
  if (name === files.MELEE_READY_FILE) return MeleeReady;
  if (name === files.INPUT_START_FILE) return InputTraceStart;
  if (name === files.INPUT_TRACE_FILE) return InputTrace;
  if (name === files.PHYSICS_REPORT_FILE) return PhysicsReport;
  if (/^smashcraft-object-data-p\d+\.txt$/.test(name)) return ObjectDataReceipt;
  if (/^smashcraft-dev-.*-p\d+\.txt$/.test(name)) return DevCommandReceipt;
  if (/^smashcraft-stage-.*-p\d+\.txt$/.test(name)) return StageReceipt;
  if (/^smashcraft-journal-(?:control|start|end)-.*\.txt$/.test(name)) return JournalControl;
  if (/^smashcraft-journal-menu-.*\.txt$/.test(name)) return JournalMenu;
  if (/^smashcraft-journal-ready-.*\.txt$/.test(name)) return JournalReady;
  if (/^smashcraft-journal-transport-ready-.*\.txt$/.test(name)) return JournalTransportReady;
  if (/^smashcraft-journal-failure-.*\.txt$/.test(name)) return JournalFailure;
  if (/^smashcraft-response-p\d+-run\d+-page\d+\.txt$/.test(name)) return ResponsePage;
  if (/^smashcraft-edge-p\d+-run\d+-row\d+-(?:poll|present)\.txt$/.test(name)) return EdgeStamp;
  if (/^smashcraft-frame-cost-clock-p\d+\.txt$/.test(name)) return FrameCostClock;
  if (/^smashcraft-frame-cost-.*-p\d+-(?:typescript|wurst)\.txt$/.test(name)) return FrameCost;
  return undefined;
}

/** Checks complete live records before their text enters capture algorithms. */
export const decodeWrittenGameFile = (name: string, path: string, text: string) => {
  const kind = writtenGameFileKind(name);
  return kind === undefined ? Effect.void : kind.decode(path, text).pipe(Effect.asVoid);
};
