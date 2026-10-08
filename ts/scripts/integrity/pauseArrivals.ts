// Native pause-control arrivals, measured from a native pad run's helper
// journals and replayed through a headless run's real map and helpers
// (wisp#86, wisp:docs/network-model.md "Replayed arrivals"). Times are taken
// from each Start press the producer injected, so the headless run replays
// them from its own presses.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";
import type { ReplayedArrival } from "wisp/src/headless/syncChannel";
import { CONTROL_ACK_PREFIX, PAUSE_REQUEST_PREFIX } from "../../src/game/shell/pauseBarrier";

const START = 315;

const decodeProducerEvent = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Struct({ type: Schema.Number, code: Schema.Number, value: Schema.Number, producer_injected_monotonic_ns: Schema.Number })));

/** Milliseconds after the Start press at which every client had the message the helpers then acted on. */
export interface PauseArrivals {
  /** The pause request: the first helper reading PREPARE. */
  readonly pauseRequestMs: number;
  /** Both PREPARE acknowledgments: the first helper reading PAUSE_COMMIT. */
  readonly prepareAcksMs: number;
  /** The resume request, after the second Start press: the first helper reading RESUME. */
  readonly resumeRequestMs: number;
}

/** Start presses in the order the producer injected them, in monotonic nanoseconds. */
export function startPresses(producerJsonl: string): number[] {
  return producerJsonl.split("\n").filter((line) => line.trim() !== "").map((line) => decodeProducerEvent(line))
    .filter((event) => event.type === 1 && event.code === START && event.value === 1).map((event) => event.producer_injected_monotonic_ns);
}

function firstControl(logs: readonly string[], state: string): number {
  const stamps = logs.flatMap((log) => [...log.matchAll(new RegExp(`^control sequence=\\d+ state=${state} .*?epoch_ns=(\\d+)`, "gm"))].slice(0, 1).map((match) => Number(match[1])));
  if (stamps.length === 0) throw new Error(`no helper read ${state}`);
  return Math.min(...stamps);
}

export function measuredPauseArrivals(nativeDir: string): PauseArrivals {
  const presses = startPresses(readFileSync(join(nativeDir, "producer.jsonl"), "utf8"));
  const [pause, resume] = presses;
  if (pause === undefined || resume === undefined) throw new Error(`${nativeDir} has fewer than two Start presses`);
  const logs = [0, 1].map((slot) => readFileSync(join(nativeDir, `helper-${slot}.log`), "utf8"));
  return {
    pauseRequestMs: (firstControl(logs, "PREPARE") - pause) / 1e6,
    prepareAcksMs: (firstControl(logs, "PAUSE_COMMIT") - pause) / 1e6,
    resumeRequestMs: (firstControl(logs, "RESUME") - resume) / 1e6,
  };
}

/** A pause acknowledgment's stage code (wire from pauseBarrier.encodeControlAck). */
const ackStage = (data: string) => data.length === 35 && data.startsWith("JC1") ? data.charAt(24) : undefined;

/** The replayed arrivals once the headless run's Start presses (monotonic ms) went in. */
export function replayedPauseArrivals(measured: PauseArrivals, pressesMs: readonly number[]): ReplayedArrival[] {
  const [pause, resume] = pressesMs;
  if (pause === undefined) return [];
  const ack = (atMs: number): ReplayedArrival => ({ accepts: (message) => message.prefix === CONTROL_ACK_PREFIX && ackStage(message.data) === "Q", atMs });
  const arrivals: ReplayedArrival[] = [
    { accepts: (message) => message.prefix === PAUSE_REQUEST_PREFIX && !message.data.endsWith("R"), atMs: pause + measured.pauseRequestMs },
    ack(pause + measured.prepareAcksMs),
    ack(pause + measured.prepareAcksMs),
  ];
  if (resume !== undefined) arrivals.push({ accepts: (message) => message.prefix === PAUSE_REQUEST_PREFIX && message.data.endsWith("R"), atMs: resume + measured.resumeRequestMs });
  return arrivals;
}
