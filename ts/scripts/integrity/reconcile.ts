// Keep the aggregate reconciliation together: every count uses the same
// epoch anchors and matched source/native rows to produce one integrity result.
// Issue #26's reconciler. From the capture driver's own clock and both clients'
// native exports it counts lost, duplicated, reordered and stuck input edges,
// checks that each edge landed on the frame its injection time implies, and
// measures how late the local player and the opponent saw it.
import type { KernelEvent, SourceEdge } from "./linuxInput";

export type Slot = 0 | 1;
export const SLOTS = [0, 1] as const satisfies readonly Slot[];
export type EpochPair = readonly [number, number];

/** One edge the capture driver wrote to a pad (producer.jsonl). */
interface ProducerEdge extends SourceEdge {
  readonly phase: string;
  /** Which pad wrote it: "slot-0" or "slot-1". */
  readonly source: string;
  /** The CLOCK_MONOTONIC time stamped into the edge itself, when the driver stamped it. */
  readonly injectedNs?: number;
  readonly beforeNs: number;
  readonly afterNs: number;
}

/** A game file's content and the monotonic time it was published. */
interface Publication {
  readonly contents: string;
  readonly estimateNs: number;
}

interface SlotMode {
  readonly humanFighters: number;
  readonly computers: number;
}

/** The capture journey's events that the reconciler reads (capture.json). */
export type JourneyEvent =
  | { readonly event: "start" | "end" | "integrity-resume"; readonly epoch: number; readonly publications: readonly [Publication, Publication] }
  | { readonly event: "integrity-stall"; readonly epoch: number; readonly kind: string; readonly verifiedStoppedState: boolean; readonly stoppedNs: number; readonly continuedNs: number }
  | { readonly event: "integrity-pause"; readonly epoch: number | undefined }
  | { readonly event: "integrity-slot-change" | "four-fighter-setup"; readonly epoch: number | undefined; readonly changes: readonly SlotMode[] };

export interface CaptureMetadata {
  readonly scope: string;
  readonly build: string;
  readonly helperSha256: string;
  readonly inputIntegrity: boolean;
  readonly fourFighters: boolean;
  /** Commanded rollback windows and transport batches, one match and rematch each. */
  readonly sweep: readonly (readonly [window: number, batch: number])[];
  readonly epochs: readonly number[] | undefined;
  readonly events: readonly JourneyEvent[];
}

/** One client's archived native export for one match. */
export interface ClientExport {
  /** Response pages of the latest export run, in page order. */
  readonly pages: readonly string[];
  readonly trace: string | undefined;
}

export interface CaptureEvidence {
  readonly metadata: CaptureMetadata;
  readonly producer: readonly ProducerEdge[];
  readonly kernel: readonly [readonly KernelEvent[], readonly KernelEvent[]];
  /** Keyed by epoch, then client. */
  readonly exports: ReadonlyMap<number, readonly [ClientExport, ClientExport]>;
}

interface Distribution {
  readonly n: number;
  readonly p50: number | undefined;
  readonly p95: number | undefined;
  readonly max: number | undefined;
  /** Count of each value, in ascending value order. */
  readonly counts: readonly (readonly [value: number, count: number])[];
}

/** The final confirmed frame, its checksum and its match phase. */
type Endpoint = readonly [frame: number, checksum: string, phase: number];

export interface IntegrityResult {
  readonly scope: string;
  readonly build: string;
  readonly rollbackLimit: number | undefined;
  readonly fourFighters: boolean;
  readonly helperSha256: string;
  readonly injected: readonly [number, number];
  readonly lost: number;
  readonly duplicated: number;
  readonly reordered: number;
  readonly stuck: number;
  readonly expectedFrame: { readonly correct: number; readonly total: number; readonly percent: number | undefined };
  readonly localStart: Distribution;
  readonly legalActionEdges: number;
  readonly illegalActionEdges: number;
  readonly legalActionsMissingFirstPrediction: number;
  readonly opponentLateness: Distribution;
  readonly rollbackDepth: Distribution;
  readonly stalls: { readonly count: number; readonly longest: number };
  readonly sameFrameTaps: readonly [number, number];
  /** Keyed "epoch-E-client-C", in export order. */
  readonly checksums: ReadonlyMap<string, Endpoint>;
  readonly gates: { readonly edges: boolean; readonly expectedFrame: boolean; readonly localStart: boolean; readonly checksums: boolean };
  readonly failures: readonly string[];
  readonly passed: boolean;
}

/** Thrown when an export row or receipt does not have the shape every capture writes. */
class MalformedEvidence extends Error {}

const REQUIRED_BINDINGS = ["move-left", "move-right", "move-down", "jump-stick", "jump-b", "jump-y", "attack", "special", "shield-lt", "shield-rt", "grab", "walk"] as const;
const START_BUTTON = 0x13b;
const NS_PER_SECOND = 1_000_000_000;

function integer(text: string | undefined, what: string): number {
  if (text === undefined || !/^[+-]?\d+$/.test(text)) throw new MalformedEvidence(`${what}: ${text ?? "missing"} is not an integer`);
  return Number(text);
}

function at(values: readonly number[], index: number, what: string): number {
  const value = values[index];
  if (value === undefined) throw new MalformedEvidence(`${what}: field ${index} missing`);
  return value;
}

/** Floor division for non-negative safe integers, exact where `a / b` would round. */
function floorDiv(a: number, b: number): number {
  return (a - (a % b)) / b;
}

function popcount(value: number): number {
  let rest = Math.abs(value);
  let count = 0;
  while (rest > 0) {
    count += rest % 2;
    rest = (rest - (rest % 2)) / 2;
  }
  return count;
}

/** The single-bit masks set among the 15 action bits. */
function bits(mask: number): number[] {
  const set: number[] = [];
  for (let n = 0; n < 15; n++) if (mask & (1 << n)) set.push(1 << n);
  return set;
}

/**
 * The action bits a source holds after this edge: A attack, B/Y or stick-up
 * jump, X special, LB walk, RB grab, either trigger shield, stick move.
 */
function sourceMask({ type, code, value }: SourceEdge): number {
  if (value === 0) return 0;
  if (type === 1) return ({ 0x130: 32, 0x131: 16, 0x133: 16, 0x134: 64, 0x136: 16384, 0x137: 128 } as Record<number, number>)[code] ?? 0;
  if (type === 3) {
    if (code === 0) return value < 0 ? 1 : 2;
    if (code === 1) return value < 0 ? 24 : 4;
    return ({ 2: 256, 5: 512 } as Record<number, number>)[code] ?? 0;
  }
  return 0;
}

function distribution(values: readonly number[]): Distribution {
  if (values.length === 0) return { n: 0, p50: undefined, p95: undefined, max: undefined, counts: [] };
  const ordered = [...values].sort((a, b) => a - b);
  const counts = new Map<number, number>();
  for (const value of ordered) counts.set(value, (counts.get(value) ?? 0) + 1);
  return {
    n: ordered.length,
    p50: ordered[floorDiv(ordered.length - 1, 2)],
    p95: ordered[floorDiv(ordered.length * 95 - 1, 100)],
    max: ordered[ordered.length - 1],
    counts: [...counts],
  };
}

/** A multiset of (frame, action bit, pressed) edges. */
class EdgeCounts {
  readonly counts = new Map<string, number>();
  static key(frame: number, bit: number, pressed: boolean): string {
    return `${frame}:${bit}:${pressed ? 1 : 0}`;
  }
  add(key: string): void {
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }
  get(key: string): number {
    return this.counts.get(key) ?? 0;
  }
  /** Total count by which this multiset exceeds `other`. */
  excess(other: EdgeCounts): number {
    let total = 0;
    for (const [key, count] of this.counts) total += Math.max(0, count - other.get(key));
    return total;
  }
}

function frameEdges(frame: number, pressed: number, released: number): string[] {
  return [...bits(pressed).map((bit) => EdgeCounts.key(frame, bit, true)), ...bits(released).map((bit) => EdgeCounts.key(frame, bit, false))];
}

interface NativeRow {
  readonly serial: number;
  readonly stage: string;
  readonly values: readonly number[];
}

function compareSegments(a: readonly [number, number], b: readonly [number, number]): number {
  return a[0] - b[0] || a[1] - b[1];
}

function sameEndpoint(a: Endpoint | undefined, b: Endpoint | undefined): boolean {
  return a !== undefined && b !== undefined && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function sameModes(changes: readonly SlotMode[], expected: readonly (readonly [number, number])[]): boolean {
  return changes.length === expected.length && changes.every((mode, i) => mode.humanFighters === expected[i]![0] && mode.computers === expected[i]![1]);
}

/**
 * Reconciles one match and its rematch. `window` is the rollback window the
 * run commanded, when it commanded one.
 */
export function integrityResult(evidence: CaptureEvidence, pair: EpochPair, window?: number): IntegrityResult {
  const { metadata, producer } = evidence;
  const failures: string[] = [];
  const require = (condition: boolean, message: string): boolean => {
    if (!condition) failures.push(message);
    return condition;
  };
  const journey = metadata.events.filter((event) => event.epoch === undefined || pair.includes(event.epoch));

  for (const slot of SLOTS) {
    const sent = producer.filter((edge) => edge.source === `slot-${slot}`);
    const kernel = evidence.kernel[slot].filter((event) => event.type !== 0);
    require(sent.length === kernel.length, `slot ${slot}: producer/kernel edge count differs`);
    for (let i = 0; i < Math.min(sent.length, kernel.length); i++) {
      const edge = sent[i]!;
      const observed = kernel[i]!;
      require(edge.type === observed.type && edge.code === observed.code && edge.value === observed.value, `slot ${slot}: producer/kernel source order differs`);
      if (edge.injectedNs !== undefined) require(edge.injectedNs === observed.kernelNs, `slot ${slot}: uinput did not preserve the producer timestamp`);
    }
  }

  const injected: [number, number] = [0, 0];
  let lost = 0, duplicated = 0, reordered = 0, stuck = 0, correct = 0, total = 0;
  const localDelays: number[] = [], opponentLateness: number[] = [], rollbackDepths: number[] = [], stallLengths: number[] = [];
  let missingLocal = 0, illegalPresses = 0, legalPresses = 0;
  const native = new Map<string, NativeRow[]>();
  const rollbackLimits = new Set<number>();
  const endpoints = new Map<string, Endpoint>();
  const coverage = [new Set<string>(), new Set<string>()] as const;
  const sameFrameTaps: [number, number] = [0, 0];
  const clientKey = (epoch: number, client: Slot) => `epoch-${epoch}-client-${client}`;

  for (const epoch of pair) {
    for (const client of SLOTS) {
      const exported = evidence.exports.get(epoch)?.[client];
      if (!require(exported !== undefined && exported.pages.length > 0, `epoch ${epoch} client ${client}: response pages absent`) || exported === undefined) continue;
      const text = exported.pages.join("\n");
      const retained = /integrity retained=(\d+) dropped=(\d+)/.exec(exported.pages[0]!);
      if (!require(retained !== null, `epoch ${epoch} client ${client}: integrity header absent`) || retained === null) continue;
      require(Number(retained[2]) === 0, `epoch ${epoch} client ${client}: integrity rows dropped`);
      const rows = [...text.matchAll(/Preload\( "I ([^"\r\n]+)/g)].map((match) => match[1]!.split(/\s+/).filter((field) => field !== ""));
      require(rows.length === Number(retained[1]), `epoch ${epoch} client ${client}: incomplete integrity export`);
      const what = `epoch ${epoch} client ${client} integrity row`;
      const events: NativeRow[] = [];
      for (const row of rows) {
        const serial = integer(row[0], what);
        const stage = row[1];
        if (stage === undefined) throw new MalformedEvidence(`${what} ${serial}: stage missing`);
        if (stage === "checksum") {
          if (integer(row[2], what) !== epoch) continue;
          const checksum = row[4];
          if (checksum === undefined) throw new MalformedEvidence(`${what} ${serial}: checksum missing`);
          endpoints.set(clientKey(epoch, client), [integer(row[3], what), checksum, integer(row[5], what)]);
          continue;
        }
        const values = row.slice(2).map((field) => integer(field, what));
        if (!require(values.length > 0 && values[0] === epoch, `epoch ${epoch} client ${client}: wrong trace epoch`)) continue;
        events.push({ serial, stage, values });
        if (stage === "rollback") rollbackDepths.push(at(values, 1, what));
      }
      native.set(clientKey(epoch, client), events);
      const stalls = events.filter((event) => event.stage === "stall").map((event) => event.serial);
      if (stalls.length > 0) {
        let length = 1;
        for (let i = 1; i < stalls.length; i++) {
          if (stalls[i] === stalls[i - 1]! + 1) {
            length++;
          } else {
            stallLengths.push(length);
            length = 1;
          }
        }
        stallLengths.push(length);
      }
      const trace = exported.trace;
      require(trace !== undefined && !trace.includes("journal input fail"), `epoch ${epoch} client ${client}: missing trace or journal failure`);
      for (const match of trace?.matchAll(/common K \d+ confirmed \d+ R (\d+)/g) ?? []) rollbackLimits.add(Number(match[1]));
      // Final checksums are captured at export, after the result boundary,
      // even when the ordinary 20-second trace ended earlier in the match.
      require(endpoints.get(clientKey(epoch, client))?.[2] === 3, `epoch ${epoch} client ${client}: final result checksum absent`);
    }
    require(sameEndpoint(endpoints.get(clientKey(epoch, 0)), endpoints.get(clientKey(epoch, 1))), `epoch ${epoch}: final checksums differ`);

    const boundary = journey.find((event) => event.event === "start" && event.epoch === epoch);
    const end = journey.find((event) => event.event === "end" && event.epoch === epoch);
    if (boundary?.event !== "start" || end?.event !== "end") throw new MalformedEvidence(`epoch ${epoch}: start or end receipt absent`);
    const resumes = journey.flatMap((event) => (event.event === "integrity-resume" && event.epoch === epoch ? [event.publications] : []));
    for (const slot of SLOTS) {
      const segments = [boundary.publications[slot], ...resumes.map((publications) => publications[slot])]
        .map((publication): readonly [number, number] => [publication.estimateNs, integer(/frame=(\d+)/.exec(publication.contents)?.[1], `epoch ${epoch} receipt frame`)])
        .sort(compareSegments);
      const finalNs = end.publications[slot].estimateNs;
      const expected = new EdgeCounts();
      const expectedHeld = new Map<number, number>();
      const sourceStates = new Map<string, number>();
      const sourceEdges: string[][] = [];
      const previousDown = new Map<string, readonly [frame: number, ns: number]>();
      for (const edge of producer) {
        if (edge.source !== `slot-${slot}` || !edge.phase.startsWith(`match-${epoch}-`)) continue;
        if (edge.type === 1 && edge.code === START_BUTTON) continue;
        const before = edge.injectedNs ?? edge.beforeNs;
        const after = edge.injectedNs ?? edge.afterNs;
        if (before >= finalNs || before < segments[0]![0]) continue;
        const [anchor, first] = segments.filter((segment) => segment[0] <= before).reduce((a, b) => (compareSegments(a, b) >= 0 ? a : b));
        const frame = first + floorDiv((before - anchor) * 60, NS_PER_SECOND);
        require(frame === first + floorDiv((after - anchor) * 60, NS_PER_SECOND), `epoch ${epoch} slot ${slot}: injection crossed frame boundary at ${before}`);
        let old = 0;
        for (const mask of sourceStates.values()) old |= mask;
        const source = `${edge.type}:${edge.code}`;
        sourceStates.set(source, sourceMask(edge));
        let held = 0;
        for (const mask of sourceStates.values()) held |= mask;
        expectedHeld.set(frame, held);
        const edgeKeys = frameEdges(frame, held & ~old, old & ~held);
        for (const key of edgeKeys) expected.add(key);
        if (!edge.phase.includes("-integrity-")) continue;
        injected[slot]++;
        coverage[slot].add(edge.phase.split(":").at(-1)!);
        require(edgeKeys.length > 0, `epoch ${epoch} slot ${slot}: source transition has no action edge`);
        sourceEdges.push(edgeKeys);
        const down = previousDown.get(source);
        if (edge.value !== 0) {
          previousDown.set(source, [frame, before]);
        } else if (down !== undefined) {
          previousDown.delete(source);
          if (frame === down[0] && before - down[1] >= 4_000_000 && before - down[1] <= 12_000_000) sameFrameTaps[slot]++;
        }
      }

      const observedClients: EdgeCounts[] = [];
      for (const client of SLOTS) {
        const events = native.get(clientKey(epoch, client)) ?? [];
        const what = `epoch ${epoch} client ${client} confirmed row`;
        const observed = new EdgeCounts();
        const frames: number[] = [];
        for (const { stage, values } of events) {
          if (stage !== "confirmed" || values[1] !== slot) continue;
          if (values.length !== 7) throw new MalformedEvidence(`${what}: ${values.length} fields`);
          const [, , frame, held, pressed, released] = values as readonly [number, number, number, number, number, number, number];
          frames.push(frame);
          for (const key of frameEdges(frame, pressed, released)) observed.add(key);
          const expectedMask = expectedHeld.get(frame);
          if (expectedMask !== undefined && held !== expectedMask) stuck++;
        }
        lost += expected.excess(observed);
        duplicated += observed.excess(expected);
        for (let i = 1; i < frames.length; i++) if (frames[i]! <= frames[i - 1]!) reordered++;
        observedClients.push(observed);
        if (client === slot) continue;
        for (const { stage, values } of events) {
          if (stage !== "receive" || values[1] !== slot) continue;
          const what = `epoch ${epoch} client ${client} receive row`;
          const lateness = Math.max(0, at(values, 6, what) - 1 - at(values, 2, what));
          const edges = popcount(at(values, 4, what)) + popcount(at(values, 5, what));
          for (let i = 0; i < edges; i++) opponentLateness.push(lateness);
        }
      }
      for (const keys of sourceEdges) {
        total++;
        if (keys.length > 0 && observedClients.every((observed) => keys.every((key) => observed.get(key) === expected.get(key) && expected.get(key) === 1))) correct++;
      }

      const local = native.get(clientKey(epoch, slot)) ?? [];
      const what = `epoch ${epoch} slot ${slot} local row`;
      const captures = new Map<number, number>();
      const predicted = new Map<number, readonly [serial: number, actions: number]>();
      for (const { serial, stage, values } of local) {
        if (stage === "capture" && values[1] === slot) captures.set(at(values, 2, what), serial);
        if (stage === "action" && values[1] === slot) predicted.set(at(values, 2, what), [serial, at(values, 5, what)]);
      }
      for (const { stage, values } of local) {
        if (stage !== "legal" || values[1] !== slot) continue;
        if (values.length !== 6) throw new MalformedEvidence(`${what}: ${values.length} fields`);
        const [, , frame, pressed, legal, started] = values as readonly [number, number, number, number, number, number];
        legalPresses += popcount(legal);
        illegalPresses += popcount(pressed & ~legal);
        require((started & legal) === legal, `epoch ${epoch} slot ${slot} frame ${frame}: legal confirmed action failed`);
        if (legal === 0) continue;
        const prediction = predicted.get(frame);
        const capture = captures.get(frame);
        if (capture === undefined || prediction === undefined || (prediction[1] & legal) !== legal) {
          missingLocal += popcount(legal);
          continue;
        }
        // The callback that FIRST executed prediction is compared to the
        // admission callback. A later rollback replay never creates this row.
        for (let i = popcount(legal); i > 0; i--) localDelays.push(prediction[0] - capture);
      }
    }
  }

  for (const slot of SLOTS) {
    require(injected[slot] >= 500, `slot ${slot}: fewer than 500 injected edges`);
    require(REQUIRED_BINDINGS.every((binding) => coverage[slot].has(binding)), `slot ${slot}: missing binding coverage`);
    require(sameFrameTaps[slot] > 0, `slot ${slot}: no observed same-frame 5 ms tap`);
  }
  const stalls = journey.flatMap((event) => (event.event === "integrity-stall" ? [event] : []));
  const stallKinds = stalls.map((stall) => stall.kind).sort();
  require(stallKinds.length === 2 && stallKinds[0] === "game" && stallKinds[1] === "helper", "required process stalls absent");
  for (const stall of stalls) {
    const stopped = stall.continuedNs - stall.stoppedNs;
    require(stall.verifiedStoppedState && stopped >= 240_000_000 && stopped <= 350_000_000, `${stall.kind} stall duration/state unproven`);
  }
  require(journey.some((event) => event.event === "integrity-pause") && journey.some((event) => event.event === "integrity-resume"), "Start pause/resume absent");
  const change = journey.find((event) => event.event === "integrity-slot-change");
  const fourFighters = metadata.fourFighters;
  const expectedModes = fourFighters ? [[3, 8], [7, 8], [3, 12]] as const : [[7, 0], [3, 4]] as const;
  require(change?.event === "integrity-slot-change" && sameModes(change.changes, expectedModes), "rematch slot change absent");
  if (fourFighters) {
    const setup = journey.find((event) => event.event === "four-fighter-setup");
    require(setup?.event === "four-fighter-setup" && sameModes(setup.changes, [[7, 0], [3, 4], [11, 4], [3, 12]]), "two-human two-CPU setup absent");
    for (const epoch of pair) {
      for (const client of SLOTS) {
        const trace = evidence.exports.get(epoch)?.[client].trace;
        require(trace?.includes("connected 3 human-fighters 3 computers 12 fighters 15") === true, `epoch ${epoch} client ${client}: native four-fighter roster absent`);
      }
    }
  }

  const gates = {
    edges: lost === 0 && duplicated === 0 && reordered === 0 && stuck === 0,
    expectedFrame: total > 0 && correct === total,
    localStart: legalPresses > 0 && missingLocal === 0 && localDelays.length > 0 && Math.min(...localDelays) >= 0 && Math.max(...localDelays) <= 1,
    checksums: endpoints.size === 4 && pair.every((epoch) => sameEndpoint(endpoints.get(clientKey(epoch, 0)), endpoints.get(clientKey(epoch, 1)))),
  };
  require(rollbackLimits.size === 1, "native rollback limit absent or inconsistent");
  const rollbackLimit = rollbackLimits.size === 0 ? undefined : Math.min(...rollbackLimits);
  if (window !== undefined) require(rollbackLimit === window, `native rollback limit ${rollbackLimit ?? "None"} is not the commanded ${window}`);
  return {
    scope: metadata.scope,
    build: metadata.build,
    rollbackLimit,
    fourFighters,
    helperSha256: metadata.helperSha256,
    injected,
    lost,
    duplicated,
    reordered,
    stuck,
    expectedFrame: { correct, total, percent: total > 0 ? (100 * correct) / total : undefined },
    localStart: distribution(localDelays),
    legalActionEdges: legalPresses,
    illegalActionEdges: illegalPresses,
    legalActionsMissingFirstPrediction: missingLocal,
    opponentLateness: distribution(opponentLateness),
    rollbackDepth: distribution(rollbackDepths),
    stalls: { count: stallLengths.length, longest: Math.max(0, ...stallLengths) },
    sameFrameTaps,
    checksums: endpoints,
    gates,
    failures,
    passed: Object.values(gates).every(Boolean) && failures.length === 0,
  };
}

/** The match and rematch a capture without a sweep reconciles. */
export function capturePair(metadata: CaptureMetadata): EpochPair {
  const [first = 1, second = 2] = metadata.epochs ?? [];
  return [first, second];
}

interface SweepEntry {
  readonly pair: EpochPair;
  readonly window: number;
  readonly batch: number;
}

/** One match and rematch per commanded rollback window, in run order. */
export function sweepPairs(metadata: CaptureMetadata): readonly SweepEntry[] {
  const first = metadata.epochs?.[0] ?? 1;
  return metadata.sweep.map(([window, batch], index) => ({ pair: [first + 2 * index, first + 2 * index + 1], window, batch }));
}

function shown(value: number | undefined): string {
  return value === undefined ? "None" : String(value);
}

function percent(value: number | undefined): string {
  if (value === undefined) return "None";
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
}

function brief(d: Distribution): string {
  return `${shown(d.p50)} / ${shown(d.p95)} / ${shown(d.max)}`;
}

/** #26's claim table. */
export function integrityTable(r: IntegrityResult): string[] {
  return [
    "| Metric | Result |",
    "|---|---|",
    `| Edges injected per player | ${r.injected[0]} / ${r.injected[1]} |`,
    `| Lost / duplicated / reordered / stuck edges | ${r.lost} / ${r.duplicated} / ${r.reordered} / ${r.stuck} |`,
    `| Edges applied at expected frame, both clients | ${r.expectedFrame.correct}/${r.expectedFrame.total} (${percent(r.expectedFrame.percent)}%) |`,
    `| Local start − capture, frames | ${brief(r.localStart)} (n=${r.localStart.n}); missing first prediction ${r.legalActionsMissingFirstPrediction} |`,
    `| Opponent input lateness, frames: p50 / p95 / max | ${brief(r.opponentLateness)} (n=${r.opponentLateness.n}) |`,
    `| Rollback depth, frames: p50 / p95 / max | ${brief(r.rollbackDepth)} (n=${r.rollbackDepth.n}) |`,
    `| Prediction stalls at ${shown(r.rollbackLimit)}-frame limit | ${r.stalls.count}; longest ${r.stalls.longest} callbacks |`,
    "| Injected input → screen, ms | Not captured in this session |",
    `| Final checksums match | ${r.gates.checksums ? "Yes" : "No"} |`,
  ];
}

export const SWEEP_HEADER = [
  "| Window | Edges lost/dup/reord/stuck | Expected frame | Local start p50/p95/max | Opponent lateness p50/p95/max | Rollback depth p50/p95/max | Stalls (longest) | Checksums | Passed |",
  "|---|---|---|---|---|---|---|---|---|",
] as const;

/** One row of the rollback-window sweep table. */
export function sweepRow(window: number, batch: number, r: IntegrityResult): string {
  return `| R${window} batch ${batch} | ${r.lost}/${r.duplicated}/${r.reordered}/${r.stuck} | ${percent(r.expectedFrame.percent)}% | ${brief(r.localStart)} | `
    + `${brief(r.opponentLateness)} | ${brief(r.rollbackDepth)} | ${r.stalls.count} (${r.stalls.longest}) | ${r.gates.checksums ? "Yes" : "No"} | ${r.passed ? "Yes" : "No"} |`;
}

const LOCAL_FRAME_BASIS = "60 Hz service callbacks from map admission to first forward prediction; rollback replay excluded";

function distributionJson(d: Distribution) {
  return { n: d.n, p50: d.p50 ?? null, p95: d.p95 ?? null, max: d.max ?? null, distribution: Object.fromEntries(d.counts) };
}

/** summary.json, in the stored format's keys and order. */
export function summaryJson(r: IntegrityResult) {
  return {
    scope: r.scope,
    build: r.build,
    rollback_limit_frames: r.rollbackLimit ?? null,
    four_fighters: r.fourFighters,
    helper_sha256: r.helperSha256,
    edges_injected_per_player: r.injected,
    lost: r.lost,
    duplicated: r.duplicated,
    reordered: r.reordered,
    stuck: r.stuck,
    expected_frame_both_clients: { correct: r.expectedFrame.correct, total: r.expectedFrame.total, percent: r.expectedFrame.percent ?? null },
    local_start_minus_capture_frames: distributionJson(r.localStart),
    local_frame_basis: LOCAL_FRAME_BASIS,
    legal_action_edges: r.legalActionEdges,
    illegal_action_edges: r.illegalActionEdges,
    legal_actions_missing_first_prediction: r.legalActionsMissingFirstPrediction,
    opponent_input_lateness_frames: distributionJson(r.opponentLateness),
    rollback_depth_frames: distributionJson(r.rollbackDepth),
    prediction_stalls: { count: r.stalls.count, longest_callbacks: r.stalls.longest },
    injected_to_screen_ms: null,
    same_frame_5ms_taps: r.sameFrameTaps,
    final_checksums: Object.fromEntries(r.checksums),
    gates: { edges: r.gates.edges, expected_frame: r.gates.expectedFrame, local_start: r.gates.localStart, checksums: r.gates.checksums },
    evidence_failures: r.failures,
    passed: r.passed,
  };
}
