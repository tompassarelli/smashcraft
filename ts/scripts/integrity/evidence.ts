// Reads a capture directory into the reconciler's input and writes its tables.
// Every file the capture driver or the game wrote is decoded once, here.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { Effect, Schema } from "effect";
import type { GameFileKind } from "waygate/scripts/waygate/boundary";
import { INPUT_TRACE_FILE, JournalControl, InputTrace, ResponsePage, responsePageFile } from "../waygate/boundary";
import { at } from "waygate/src/runtime/lookup";
import type { Injection, KernelEvent, SourceEdge } from "./linuxInput";
import {
  type CaptureEvidence, type CaptureMetadata, type ClientExport, type EpochPair, type IntegrityResult, type JourneyEvent,
  SLOTS, SWEEP_HEADER, capturePair, integrityResult, integrityTable, summaryJson, sweepPairs, sweepRow,
} from "./reconcile";

export class IntegrityFailure extends Schema.TaggedError<IntegrityFailure>()("IntegrityFailure", {
  operation: Schema.String,
  path: Schema.String,
  cause: Schema.Unknown,
}) {
  override get message(): string {
    return `${this.operation} failed for ${this.path}: ${this.cause instanceof Error ? this.cause.message : String(this.cause)}`;
  }
}

export const tryIntegrity = <A>(operation: string, path: string, run: () => A) =>
  Effect.try({ try: run, catch: (cause) => new IntegrityFailure({ operation, path, cause }) });

export const tryIntegrityPromise = <A>(operation: string, path: string, run: () => PromiseLike<A>) =>
  Effect.tryPromise({ try: run, catch: (cause) => new IntegrityFailure({ operation, path, cause }) });

const decode = <S extends Schema.Top & { readonly DecodingServices: never }>(schema: S, path: string) => (value: unknown) =>
  Schema.decodeUnknownEffect(schema)(value).pipe(Effect.mapError((cause) => new IntegrityFailure({ operation: "decode", path, cause })));

const ProducerLine = Schema.Struct({
  phase: Schema.String,
  source: Schema.String,
  type: Schema.Int,
  code: Schema.Int,
  value: Schema.Int,
  injectedNs: Schema.optionalKey(Schema.Int),
  beforeNs: Schema.Int,
  afterNs: Schema.Int,
}).pipe(Schema.encodeKeys({
  source: "event",
  injectedNs: "producer_injected_monotonic_ns",
  beforeNs: "producer_before_write_monotonic_ns",
  afterNs: "producer_after_write_monotonic_ns",
}));

const KernelLine = Schema.Struct({ kernelNs: Schema.Int, type: Schema.Int, code: Schema.Int, value: Schema.Int })
  .pipe(Schema.encodeKeys({ kernelNs: "kernel_monotonic_ns" }));

/** One producer.jsonl line: the edge a pad wrote and the clock around the write. */
export function producerLine(phase: string, slot: number, { type, code, value }: SourceEdge, { injectedNs, beforeNs, afterNs }: Injection): string {
  return `${JSON.stringify({
    phase,
    event: `slot-${slot}`,
    type,
    code,
    value,
    producer_injected_monotonic_ns: injectedNs,
    producer_before_write_monotonic_ns: beforeNs,
    producer_after_write_monotonic_ns: afterNs,
  })}\n`;
}

/** One kernel-SLOT.jsonl line: an event as evdev reported it. */
export function kernelLine({ kernelNs, type, code, value }: KernelEvent): string {
  return `${JSON.stringify({ kernel_clock: "CLOCK_MONOTONIC", kernel_monotonic_ns: kernelNs, type, code, value })}\n`;
}

const Publication = Schema.Struct({ contents: Schema.String, estimateNs: Schema.Int })
  .pipe(Schema.encodeKeys({ estimateNs: "publication_monotonic_estimate_ns" }));
const SlotMode = Schema.Struct({ humanFighters: Schema.Int, computers: Schema.Int })
  .pipe(Schema.encodeKeys({ humanFighters: "human_fighters" }));
const Boundary = Schema.Struct({
  event: Schema.Literals(["start", "end", "integrity-resume"]),
  epoch: Schema.Int,
  publications: Schema.Tuple([Publication, Publication]),
});
const Stall = Schema.Struct({
  event: Schema.Literal("integrity-stall"),
  epoch: Schema.Int,
  kind: Schema.String,
  verifiedStoppedState: Schema.Boolean,
  stoppedNs: Schema.Int,
  continuedNs: Schema.Int,
}).pipe(Schema.encodeKeys({ verifiedStoppedState: "verified_stopped_state", stoppedNs: "stopped_monotonic_ns", continuedNs: "continued_monotonic_ns" }));
const Pause = Schema.Struct({ event: Schema.Literal("integrity-pause"), epoch: Schema.optionalKey(Schema.Int) });
const ModeChange = Schema.Struct({
  event: Schema.Literals(["integrity-slot-change", "four-fighter-setup"]),
  epoch: Schema.optionalKey(Schema.Int),
  changes: Schema.Array(SlotMode),
});
const EventName = Schema.Struct({ event: Schema.String });
const READ_EVENTS = new Set(["start", "end", "integrity-resume", "integrity-stall", "integrity-pause", "integrity-slot-change", "four-fighter-setup"]);

const CaptureFile = Schema.Struct({
  scope: Schema.String,
  settings: Schema.Struct({ build: Schema.String }),
  helper_sha256: Schema.String,
  input_integrity: Schema.optionalKey(Schema.Boolean),
  four_fighters: Schema.optionalKey(Schema.Boolean),
  sweep: Schema.optionalKey(Schema.NullOr(Schema.Array(Schema.Tuple([Schema.Int, Schema.Int])))),
  epochs: Schema.optionalKey(Schema.Array(Schema.Int)),
  events: Schema.Array(Schema.Unknown),
});

const readText = (path: string) => tryIntegrityPromise("read", path, () => Bun.file(path).text());

/** Lines of a JSON-lines file, each decoded with `schema`. */
const readJsonLines = <S extends Schema.Top & { readonly DecodingServices: never }>(schema: S, path: string) =>
  Effect.gen(function*() {
    const lines = (yield* readText(path)).split(/\r?\n/);
    if (lines.at(-1) === "") lines.pop();
    const json = yield* tryIntegrity("parse JSON lines", path, () => lines.map((line): unknown => JSON.parse(line)));
    return yield* Effect.forEach(json, decode(schema, path));
  });

/** Only the events the reconciler reads; the journey also records menus, receipts and settings. */
const journeyEvent = (path: string) => (raw: unknown): Effect.Effect<readonly JourneyEvent[], IntegrityFailure> =>
  Effect.gen(function*() {
    const { event } = yield* decode(EventName, path)(raw);
    if (!READ_EVENTS.has(event)) return [];
    const decoded = event === "integrity-stall"
      ? yield* decode(Stall, path)(raw)
      : event === "integrity-pause"
      ? yield* decode(Pause, path)(raw)
      : event === "integrity-slot-change" || event === "four-fighter-setup"
      ? yield* decode(ModeChange, path)(raw)
      : yield* decode(Boundary, path)(raw);
    if ("publications" in decoded) {
      yield* Effect.forEach(decoded.publications, (publication, slot) =>
        JournalControl.decode(`${path}: ${event} slot ${slot}`, publication.contents).pipe(
          Effect.mapError((cause) => new IntegrityFailure({ operation: "decode game receipt", path, cause })),
        ));
    }
    return [{ epoch: undefined, ...decoded }];
  });

export const readMetadata = (root: string) =>
  Effect.gen(function*() {
    const path = join(root, "capture.json");
    const file = yield* decode(CaptureFile, path)(yield* tryIntegrityPromise("read", path, () => Bun.file(path).json()));
    const events = (yield* Effect.forEach(file.events, journeyEvent(path))).flat();
    return {
      scope: file.scope,
      build: file.settings.build,
      helperSha256: file.helper_sha256,
      inputIntegrity: file.input_integrity ?? false,
      fourFighters: file.four_fighters ?? false,
      sweep: file.sweep ?? [],
      epochs: file.epochs,
      events,
    } satisfies CaptureMetadata;
  });

/** The latest export run's response pages, in page order, and the native trace. */
const clientExport = (root: string, epoch: number, client: number) =>
  Effect.gen(function*() {
    const directory = join(root, `epoch-${epoch}`);
    const names = yield* tryIntegrity("list native export", directory, () => {
      try { return readdirSync(directory); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw error;
      }
    });
    const pageGlob = new Bun.Glob(`${client}-${responsePageFile(client, "*", "*")}`);
    const pages = names.filter((name) => pageGlob.match(name)).flatMap((name) => {
      const run = /-run(\d+)-/.exec(name)?.[1];
      const page = /-page(\d+)/.exec(name)?.[1];
      return run === undefined || page === undefined ? [] : [{ name, run: Number(run), page: Number(page) }];
    });
    const latest = Math.max(...pages.map((page) => page.run));
    const traceName = `${client}-${INPUT_TRACE_FILE}`;
    const text = <A>(name: string, kind: GameFileKind<A>) => Effect.gen(function*() {
      const path = join(directory, name);
      const contents = yield* readText(path);
      yield* kind.decode(path, contents).pipe(Effect.mapError((cause) => new IntegrityFailure({ operation: "decode native export", path, cause })));
      return contents;
    });
    return {
      pages: yield* Effect.forEach(pages.filter((page) => page.run === latest).sort((a, b) => a.page - b.page), (page) => text(page.name, ResponsePage)),
      trace: names.includes(traceName) ? yield* text(traceName, InputTrace) : undefined,
    } satisfies ClientExport;
  });

export const readEvidence = (root: string, metadata: CaptureMetadata) =>
  Effect.gen(function*() {
    const producer = yield* readJsonLines(ProducerLine, join(root, "producer.jsonl"));
    const kernel = yield* Effect.forEach(SLOTS, (slot) => readJsonLines(KernelLine, join(root, `kernel-${slot}.jsonl`)), { concurrency: 2 });
    const pairs = metadata.sweep.length > 0 ? sweepPairs(metadata).map(({ pair }) => pair) : [capturePair(metadata)];
    const epochs = [...new Set(pairs.flat())];
    const exports = new Map<number, readonly [ClientExport, ClientExport]>();
    for (const epoch of epochs) exports.set(epoch, [yield* clientExport(root, epoch, 0), yield* clientExport(root, epoch, 1)]);
    return { metadata, producer, kernel: [at(kernel, 0), at(kernel, 1)], exports } satisfies CaptureEvidence;
  });

const reconcile = (root: string, evidence: CaptureEvidence, pair: EpochPair, window?: number) =>
  tryIntegrity("reconcile", root, () => integrityResult(evidence, pair, window));

const writeResult = (root: string, result: IntegrityResult, tag: string) =>
  Effect.gen(function*() {
    const suffix = tag === "" ? "" : `-${tag}`;
    const table = integrityTable(result);
    yield* tryIntegrityPromise("write summary", root, () => Bun.write(join(root, `summary${suffix}.json`), `${JSON.stringify(summaryJson(result), undefined, 2)}\n`));
    yield* tryIntegrityPromise("write table", root, () => Bun.write(join(root, `integrity-table${suffix}.md`), `${table.join("\n")}\n`));
    yield* Effect.sync(() => {
      console.log(table.join("\n"));
      console.log(JSON.stringify({ passed: result.passed, gates: summaryJson(result).gates, evidence_failures: result.failures }, undefined, 2));
    });
  });

/**
 * Reconciles a capture directory, writes summary.json and the #26 table next
 * to it (one pair per sweep entry, plus sweep-table.md), and reports whether
 * every gate passed.
 */
export const reconcileCapture = (root: string) =>
  Effect.gen(function*() {
    const metadata = yield* readMetadata(root);
    if (metadata.sweep.length === 0 && !metadata.inputIntegrity) {
      return yield* new IntegrityFailure({ operation: "reconcile", path: root, cause: "not an input-integrity capture" });
    }
    const evidence = yield* readEvidence(root, metadata);
    if (metadata.sweep.length === 0) {
      const result = yield* reconcile(root, evidence, capturePair(metadata));
      yield* writeResult(root, result, "");
      return result.passed;
    }
    const rows: string[] = [...SWEEP_HEADER];
    let passed = true;
    for (const { pair, window, batch } of sweepPairs(metadata)) {
      yield* Effect.sync(() => console.log(`## R${window} batch ${batch}: epochs (${pair[0]}, ${pair[1]})`));
      const result = yield* reconcile(root, evidence, pair, window);
      yield* writeResult(root, result, `rb${window}-b${batch}`);
      passed &&= result.passed;
      rows.push(sweepRow(window, batch, result));
    }
    yield* tryIntegrityPromise("write sweep table", root, () => Bun.write(join(root, "sweep-table.md"), `${rows.join("\n")}\n`));
    yield* Effect.sync(() => console.log(rows.join("\n")));
    return passed;
  });
