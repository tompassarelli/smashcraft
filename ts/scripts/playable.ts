// A playable candidate's native match and rematch: both clients finish each
// one-stock match with the same winner, end frame and result checksum, and
// report no in-game error. Input timing remains issue #26's separate gate.
//
// The winner is the one both clients' end receipts name. Each client's result
// screen is read as a second check: a screen that names another player fails,
// one the reader cannot make out does not. Receipts of builds before 0.0.46
// name no winner; their captures take it from the screens, which must then
// both name it.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { Effect, Schema } from "effect";
import { IntegrityFailure, readEvidence, readMetadata, tryIntegrity, tryIntegrityPromise } from "./integrity/evidence";
import { type CaptureEvidence, SLOTS, capturePair } from "./integrity/reconcile";

/** One match's result screens, by client. */
interface ResultScreens {
  /** The whole screen, read when it first showed a result. */
  readonly texts: readonly string[];
  /** The result announcement alone, when the capture read it. */
  readonly notices?: readonly string[];
}

/** What a playable capture records beyond the shared capture evidence. */
export interface PlayableRecord {
  readonly results: ReadonlyMap<number, ResultScreens>;
  /** In-game error reports the capture archived. */
  readonly errorReports: readonly string[];
}

const END_FRAME = / frame=(\d+)/;
const RECEIPT_WINNER = / winner=(P[1-4]|none)(?:\s|"|$)/;
const SCREEN_WINNER = /player\s*(\S)\s*wins/gi;
/** The reader takes the digit 1 for these; no other digit looks like them. */
const READ_AS_ONE = new Set(["|", "l", "I"]);
const CLIENT_NAMES = ["A", "B"] as const;

/** The input trace's confirmed checksums by simulation frame. */
const confirmedStates = (trace: string | undefined) =>
  new Map([...(trace ?? "").matchAll(/confirmed frame (\d+) state ([^\s"]+)/g)].map((row) => [Number(row[1]), row[2] ?? ""] as const));

/** Every winner a result-screen read names, as "Player N". */
function screenWinners(text: string): string[] {
  const names = new Set<string>();
  for (const [, glyph = ""] of text.split(/\s+/).join(" ").matchAll(SCREEN_WINNER)) {
    if (/^[1-4]$/.test(glyph)) names.add(`Player ${glyph}`);
    else if (READ_AS_ONE.has(glyph)) names.add("Player 1");
  }
  return [...names];
}

/** The winner an end receipt names: "Player N" or "nobody"; undefined when the receipt has no winner field. */
function receiptWinner(contents: string): string | undefined {
  const named = RECEIPT_WINNER.exec(contents)?.[1];
  return named === undefined ? undefined : named === "none" ? "nobody" : `Player ${named.slice(1)}`;
}

export function playableResult(evidence: CaptureEvidence, record: PlayableRecord) {
  const { metadata } = evidence;
  const pair = capturePair(metadata);
  const failures: string[] = [];
  const require = (condition: boolean, message: string) => { if (!condition) failures.push(message); };
  require(metadata.epochs?.length === 2 && pair[0] % 2 === 1 && pair[1] === pair[0] + 1, "capture is not one match and its rematch");
  require(record.errorReports.length === 0, `in-game error reports: ${record.errorReports.join(", ")}`);
  const matches = pair.map((epoch) => {
    const boundaries = (kind: "start" | "end") => metadata.events.filter((event) => event.event === kind && event.epoch === epoch);
    for (const kind of ["start", "end"] as const) require(boundaries(kind).length === 1, `epoch ${epoch}: one native ${kind} boundary required`);
    const end = boundaries("end")[0];
    const receipts = end !== undefined && "publications" in end ? end.publications.map((publication) => publication.contents) : [];
    const endFrames = receipts.map((contents) => Number(END_FRAME.exec(contents)?.[1] ?? 0));
    const [endA = 0, endB = 0] = endFrames;
    require(endFrames.length === 2 && endA > 0 && endA === endB, `epoch ${epoch}: end frames differ or are absent`);

    // The first match's walking player is Player 1, the rematch's Player 2.
    const expected = `Player ${epoch % 2 === 1 ? 2 : 1}`;
    const screens = record.results.get(epoch);
    require(screens?.texts.length === 2, `epoch ${epoch}: both result screens required`);
    const shown = SLOTS.map((client) => [...new Set([screens?.notices?.[client] ?? "", screens?.texts[client] ?? ""].flatMap(screenWinners))]);
    const receipted = receipts.map(receiptWinner);
    const fromReceipts = receipted.some((named) => named !== undefined);
    let winner: string | undefined;
    if (fromReceipts) {
      winner = receipted[0];
      require(receipted.length === 2 && receipted.every((named) => named !== undefined && named === winner),
        `epoch ${epoch}: end receipts name different winners: ${receipted.map((named) => named ?? "no winner field").join(" / ")}`);
      for (const client of SLOTS) {
        for (const name of shown[client] ?? []) require(name === winner, `epoch ${epoch}: client ${CLIENT_NAMES[client]}'s result screen names ${name}, the game ${winner ?? "nobody"}`);
      }
    } else {
      const named = shown.map((names) => (names.length === 1 ? names[0] : undefined));
      winner = named[0];
      require(named.every((name) => name !== undefined && name === winner), `epoch ${epoch}: result screens do not both name one winner: ${shown.map((names) => names.join(" and ") || "none read").join(" / ")}`);
    }
    require(winner === expected, `epoch ${epoch}: ${winner ?? "nobody"} won, expected ${expected}`);

    const [statesA, statesB] = SLOTS.map((client) => confirmedStates(evidence.exports.get(epoch)?.[client].trace));
    const common = [...(statesA?.keys() ?? [])].filter((frame) => statesB?.has(frame) === true);
    require(common.length > 0, `epoch ${epoch}: no confirmed frame in both result traces`);
    const differing = common.filter((frame) => statesA?.get(frame) !== statesB?.get(frame));
    require(differing.length === 0, `epoch ${epoch}: confirmed checksums differ at frames ${differing.join(", ")}`);
    return {
      epoch,
      winner: winner ?? null,
      winner_source: fromReceipts ? "end receipts" : "result screens",
      receipt_winners: receipted.map((named) => named ?? null),
      winners: shown.map((names) => (names.length === 0 ? null : names.join(" and "))),
      end_frames: endFrames,
      result_checksums: common.map((frame) => ({ frame, checksum: statesA?.get(frame) ?? "" })),
    };
  });
  return { build: metadata.build, helper_sha256: metadata.helperSha256, epochs: pair, matches, error_reports: record.errorReports, failures, passed: failures.length === 0 };
}

const ResultsEvent = Schema.Struct({
  event: Schema.Literal("results"),
  epoch: Schema.Int,
  texts: Schema.Array(Schema.String),
  notices: Schema.optionalKey(Schema.Array(Schema.String)),
});
const PlayableCapture = Schema.Struct({ playable: Schema.Boolean, events: Schema.Array(Schema.Unknown) });

const readRecord = (root: string) =>
  Effect.gen(function*() {
    const path = join(root, "capture.json");
    const decode = <S extends Schema.Top & { readonly DecodingServices: never }>(schema: S) => (value: unknown) =>
      Schema.decodeUnknownEffect(schema)(value).pipe(Effect.mapError((cause) => new IntegrityFailure({ operation: "decode", path, cause })));
    const capture = yield* decode(PlayableCapture)(yield* tryIntegrityPromise("read", path, () => Bun.file(path).json()));
    if (!capture.playable) return yield* new IntegrityFailure({ operation: "reconcile playable", path, cause: "not a playable capture" });
    const results = new Map<number, ResultScreens>();
    for (const raw of capture.events) {
      if (typeof raw !== "object" || raw === null || !("event" in raw) || raw.event !== "results") continue;
      const { epoch, texts, notices } = yield* decode(ResultsEvent)(raw);
      results.set(epoch, notices === undefined ? { texts } : { texts, notices });
    }
    const errorReports = yield* tryIntegrity("list error reports", root, () =>
      readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith("epoch-"))
        .flatMap((entry) => readdirSync(join(root, entry.name)).filter((name) => /smashcraft-error-p\d+\.txt$/.test(name)).map((name) => `${entry.name}/${name}`)));
    return { results, errorReports } satisfies PlayableRecord;
  });

/** The gate's result for a capture directory. */
export const playableVerdict = (root: string) =>
  Effect.gen(function*() {
    const record = yield* readRecord(root);
    const metadata = yield* readMetadata(root);
    return playableResult(yield* readEvidence(root, metadata), record);
  });

/** Writes playable.json beside the capture and reports whether it passed. */
export const reconcilePlayable = (root: string) =>
  Effect.gen(function*() {
    const result = yield* playableVerdict(root);
    yield* tryIntegrityPromise("write playable result", root, () => Bun.write(join(root, "playable.json"), `${JSON.stringify(result, undefined, 2)}\n`));
    yield* Effect.sync(() => console.log(JSON.stringify(result, undefined, 2)));
    return result.passed;
  });
