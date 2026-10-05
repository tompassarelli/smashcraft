// A playable candidate's native match and rematch: both clients finish each
// one-stock match with the same winner, end frame and result checksum, and
// report no in-game error. Input timing remains issue #26's separate gate.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { Effect, Schema } from "effect";
import { IntegrityFailure, readEvidence, readMetadata, tryIntegrity, tryIntegrityPromise } from "./integrity/evidence";
import { type CaptureEvidence, SLOTS, capturePair } from "./integrity/reconcile";

/** What a playable capture records beyond the shared capture evidence. */
export interface PlayableRecord {
  /** Each match's result-screen text, by client. */
  readonly results: ReadonlyMap<number, readonly string[]>;
  /** In-game error reports the capture archived. */
  readonly errorReports: readonly string[];
}

const WINNER = /Player\s*([1-4])\s*wins/i;
const END_FRAME = / frame=(\d+)/;

/** The input trace's confirmed checksums by simulation frame. */
const confirmedStates = (trace: string | undefined) =>
  new Map([...(trace ?? "").matchAll(/confirmed frame (\d+) state (\S+)/g)].map((row) => [Number(row[1]), row[2] ?? ""] as const));

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
    const endFrames = end !== undefined && "publications" in end ? end.publications.map((publication) => Number(END_FRAME.exec(publication.contents)?.[1] ?? 0)) : [];
    const [endA = 0, endB = 0] = endFrames;
    require(endFrames.length === 2 && endA > 0 && endA === endB, `epoch ${epoch}: end frames differ or are absent`);
    // The first match's walking player is Player 1, the rematch's Player 2.
    const expected = epoch % 2 === 1 ? "2" : "1";
    const winners = (record.results.get(epoch) ?? []).map((text) => WINNER.exec(text.split(/\s+/).join(" "))?.[1]);
    require(winners.length === 2 && winners.every((winner) => winner === expected), `epoch ${epoch}: result screens do not both name Player ${expected}`);
    const [statesA, statesB] = SLOTS.map((client) => confirmedStates(evidence.exports.get(epoch)?.[client].trace));
    const common = [...(statesA?.keys() ?? [])].filter((frame) => statesB?.has(frame) === true);
    require(common.length > 0, `epoch ${epoch}: no confirmed frame in both result traces`);
    const differing = common.filter((frame) => statesA?.get(frame) !== statesB?.get(frame));
    require(differing.length === 0, `epoch ${epoch}: confirmed checksums differ at frames ${differing.join(", ")}`);
    return {
      epoch,
      winners: winners.map((winner) => (winner === undefined ? null : `Player ${winner}`)),
      end_frames: endFrames,
      result_checksums: common.map((frame) => ({ frame, checksum: statesA?.get(frame) ?? "" })),
    };
  });
  return { build: metadata.build, helper_sha256: metadata.helperSha256, epochs: pair, matches, error_reports: record.errorReports, failures, passed: failures.length === 0 };
}

const ResultsEvent = Schema.Struct({ event: Schema.Literal("results"), epoch: Schema.Int, texts: Schema.Array(Schema.String) });
const PlayableCapture = Schema.Struct({ playable: Schema.Boolean, events: Schema.Array(Schema.Unknown) });

const readRecord = (root: string) =>
  Effect.gen(function*() {
    const path = join(root, "capture.json");
    const decode = <S extends Schema.Top & { readonly DecodingServices: never }>(schema: S) => (value: unknown) =>
      Schema.decodeUnknownEffect(schema)(value).pipe(Effect.mapError((cause) => new IntegrityFailure({ operation: "decode", path, cause })));
    const capture = yield* decode(PlayableCapture)(yield* tryIntegrityPromise("read", path, () => Bun.file(path).json()));
    if (!capture.playable) return yield* new IntegrityFailure({ operation: "reconcile playable", path, cause: "not a playable capture" });
    const results = new Map<number, readonly string[]>();
    for (const raw of capture.events) {
      if ((raw as { readonly event?: unknown }).event !== "results") continue;
      const { epoch, texts } = yield* decode(ResultsEvent)(raw);
      results.set(epoch, texts);
    }
    const errorReports = yield* tryIntegrity("list error reports", root, () =>
      readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith("epoch-"))
        .flatMap((entry) => readdirSync(join(root, entry.name)).filter((name) => /smashcraft-error-p\d+\.txt$/.test(name)).map((name) => `${entry.name}/${name}`)));
    return { results, errorReports } satisfies PlayableRecord;
  });

/** Writes playable.json beside the capture and reports whether it passed. */
export const reconcilePlayable = (root: string) =>
  Effect.gen(function*() {
    const record = yield* readRecord(root);
    const metadata = yield* readMetadata(root);
    const result = playableResult(yield* readEvidence(root, metadata), record);
    yield* tryIntegrityPromise("write playable result", root, () => Bun.write(join(root, "playable.json"), `${JSON.stringify(result, undefined, 2)}\n`));
    yield* Effect.sync(() => console.log(JSON.stringify(result, undefined, 2)));
    return result.passed;
  });
