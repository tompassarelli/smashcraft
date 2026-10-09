




import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";
import type { ReplayedArrival } from "wisp/src/headless/syncChannel";
import { CONTROL_ACK_PREFIX, PAUSE_REQUEST_PREFIX } from "../../src/game/shell/pauseBarrier";

const START = 315;

const decodeProducerEvent = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Struct({ type: Schema.Number, code: Schema.Number, value: Schema.Number, producer_injected_monotonic_ns: Schema.Number })));


export interface PauseArrivals {

  readonly pauseRequestMs: number;

  readonly prepareAcksMs: number;

  readonly resumeRequestMs: number;
}


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


const ackStage = (data: string) => data.length === 35 && data.startsWith("JC1") ? data.charAt(24) : undefined;


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
