// The developer input trace (Ctrl+T, or the response probe's first journal
// row): timestamped lines kept in memory and written to
// wc3-melee-input-trace.txt when the trace ends. The integrity harness parses
// several of its lines. Local measurements here never feed the accepted
// ledger, prediction or snapshots.
import { INPUT_TRACE_FILE, traceEndLines } from "../../runtime/gameFiles";
import { floorMod } from "../../sim/intMath";
import type { ParticipantSlot, Slots } from "../../game/input/participants";
import { writeLines } from "../fileio";

const ECHO_CAPACITY = 256;
const ECHO_BIN_LIMITS = [3, 6, 9, 12, 18] as const;

/** Capture-to-send waits of batched local rows. */
export interface WaitSpread {
  samples: number;
  sumCallbacks: number;
  maxCallbacks: number;
  sumSeconds: number;
  maxSeconds: number;
}

/** Local send-to-echo ages: how long the synchronized channel took to return this client's own rows. */
export interface EchoSpread {
  samples: number;
  minCallbacks: number;
  maxCallbacks: number;
  sumCallbacks: number;
  minSeconds: number;
  maxSeconds: number;
  sumSeconds: number;
  overwritten: number;
  /** Ages in callbacks: 0-3, 4-6, 7-9, 10-12, 13-18, 19+. */
  readonly bins: number[];
}

/** Counts summarized and reset once a second of trace. */
export interface TraceWindow {
  readonly accepted: Slots<number>;
  readonly receivedRows: Slots<number>;
  readonly keyDown: Slots<number>;
  readonly keyUp: Slots<number>;
  rejected: number;
  waitTicks: number;
  confirmedSteps: number;
  speculativeSteps: number;
  speculativeFailures: number;
  corrections: number;
  replayedFrames: number;
  maxReplayDepth: number;
  localPolls: number;
  localCaptures: number;
  localSends: number;
  sentRows: number;
  singletons: number;
  sameTargetSkips: number;
  windowBlocks: number;
  readonly batchWait: WaitSpread;
  readonly echo: EchoSpread;
}

interface EchoSend {
  epoch: number;
  /** Undefined while the ring slot is free. */
  frame: number | undefined;
  callback: number;
  seconds: number;
}

export interface InputTrace {
  /** Native game seconds since the trace started. */
  clock: timer | undefined;
  active: boolean;
  /** Game callbacks since the trace started. */
  ticks: number;
  pausedTicks: number;
  readonly capacity: number;
  readonly lines: string[];
  dropped: number;
  lastAxes: number | undefined;
  lastDodge: number | undefined;
  lastLandingLag: number | undefined;
  /** Synchronized messages received since the trace started, counted while inactive too. */
  rawSyncEvents: number;
  window: TraceWindow;
  readonly echoes: EchoSend[];
  echoPending: number;
}

function traceWindow(): TraceWindow {
  return {
    accepted: [0, 0, 0, 0], receivedRows: [0, 0, 0, 0], keyDown: [0, 0, 0, 0], keyUp: [0, 0, 0, 0],
    rejected: 0, waitTicks: 0, confirmedSteps: 0, speculativeSteps: 0, speculativeFailures: 0, corrections: 0,
    replayedFrames: 0, maxReplayDepth: 0, localPolls: 0, localCaptures: 0, localSends: 0, sentRows: 0, singletons: 0,
    sameTargetSkips: 0, windowBlocks: 0,
    batchWait: { samples: 0, sumCallbacks: 0, maxCallbacks: 0, sumSeconds: 0.0, maxSeconds: 0.0 },
    echo: { samples: 0, minCallbacks: 0, maxCallbacks: 0, sumCallbacks: 0, minSeconds: 0.0, maxSeconds: 0.0, sumSeconds: 0.0, overwritten: 0, bins: [0, 0, 0, 0, 0, 0] },
  };
}

/** The probe build keeps a longer trace. */
export function inputTrace(capacity: number): InputTrace {
  return {
    clock: undefined, active: false, ticks: 0, pausedTicks: 0, capacity, lines: [], dropped: 0,
    lastAxes: undefined, lastDodge: undefined, lastLandingLag: undefined, rawSyncEvents: 0, window: traceWindow(),
    echoes: Array.from({ length: ECHO_CAPACITY }, () => ({ epoch: -1, frame: undefined, callback: 0, seconds: 0.0 })),
    echoPending: 0,
  };
}

export function traceSeconds(trace: Readonly<InputTrace>): number {
  return trace.clock === undefined ? 0.0 : TimerGetElapsed(trace.clock);
}

export function traceInput(trace: InputTrace, entry: string): void {
  if (!trace.active) return;
  if (trace.lines.length < trace.capacity) trace.lines.push(`${trace.ticks} ${R2S(traceSeconds(trace))} ${entry}`);
  else trace.dropped++;
}

function clearEchoRing(trace: InputTrace): void {
  trace.echoPending = 0;
  for (const send of trace.echoes) {
    send.epoch = -1;
    send.frame = undefined;
  }
}

/** Starts the clock and clears every count; the caller writes the opening lines. */
export function beginInputTrace(trace: InputTrace): void {
  trace.clock ??= CreateTimer();
  trace.ticks = 0;
  trace.pausedTicks = 0;
  trace.lines.length = 0;
  trace.dropped = 0;
  trace.lastAxes = undefined;
  trace.lastDodge = undefined;
  trace.lastLandingLag = undefined;
  trace.rawSyncEvents = 0;
  trace.window = traceWindow();
  clearEchoRing(trace);
  trace.active = true;
  TimerStart(trace.clock, 1000.0, false, () => {});
}

/** Starts a new epoch's echo matching; rows sent in an earlier epoch never match. */
export function resetEchoRing(trace: InputTrace): void {
  clearEchoRing(trace);
}

export function finishInputTrace(trace: InputTrace): void {
  trace.active = false;
  if (trace.clock !== undefined) PauseTimer(trace.clock);
  writeLines(INPUT_TRACE_FILE, [...trace.lines, ...traceEndLines(trace.dropped, trace.ticks, R2S(traceSeconds(trace)))]);
}

/** A local row handed to the synchronized channel. */
export function recordSend(trace: InputTrace, epoch: number, frame: number): void {
  const send = trace.echoes[floorMod(frame, ECHO_CAPACITY)];
  if (send === undefined) return;
  if (send.frame !== undefined) trace.window.echo.overwritten++;
  else trace.echoPending++;
  send.epoch = epoch;
  send.frame = frame;
  send.callback = trace.ticks;
  send.seconds = traceSeconds(trace);
}

/** This client's own row came back through the synchronized channel. */
export function recordEcho(trace: InputTrace, epoch: number, frame: number, callback: number, seconds: number): void {
  const send = trace.echoes[floorMod(frame, ECHO_CAPACITY)];
  if (send === undefined || send.frame !== frame || send.epoch !== epoch) return;
  const ageCallbacks = callback - send.callback;
  const ageSeconds = seconds - send.seconds;
  send.frame = undefined;
  trace.echoPending--;
  const { echo } = trace.window;
  if (echo.samples === 0) {
    echo.minCallbacks = ageCallbacks;
    echo.minSeconds = ageSeconds;
  }
  echo.samples++;
  echo.minCallbacks = Math.min(echo.minCallbacks, ageCallbacks);
  echo.maxCallbacks = Math.max(echo.maxCallbacks, ageCallbacks);
  echo.sumCallbacks += ageCallbacks;
  echo.minSeconds = Math.min(echo.minSeconds, ageSeconds);
  echo.maxSeconds = Math.max(echo.maxSeconds, ageSeconds);
  echo.sumSeconds += ageSeconds;
  const bin = ECHO_BIN_LIMITS.findIndex(limit => ageCallbacks <= limit);
  const index = bin < 0 ? ECHO_BIN_LIMITS.length : bin;
  echo.bins[index] = (echo.bins[index] ?? 0) + 1;
}

/** A batched local row waited this long between its capture and its send. */
export function recordBatchWait(trace: InputTrace, callbacks: number, seconds: number): void {
  const wait = trace.window.batchWait;
  wait.samples++;
  wait.sumCallbacks += callbacks;
  wait.maxCallbacks = Math.max(wait.maxCallbacks, callbacks);
  wait.sumSeconds += seconds;
  wait.maxSeconds = Math.max(wait.maxSeconds, seconds);
}

export function traceParticipantWindow(trace: InputTrace, slot: ParticipantSlot): void {
  const w = trace.window;
  traceInput(trace, `participant ${slot} received-packets ${w.accepted[slot]} received-rows ${w.receivedRows[slot]} key-down ${w.keyDown[slot]} key-up ${w.keyUp[slot]}`);
}

export interface ScheduleSummary {
  readonly known: number;
  readonly confirmed: number;
  readonly rollback: number;
  readonly speculative: number;
  readonly target: number | undefined;
  readonly batchPending: number;
}

/** The window's summary lines, after which its counts start again. */
export function closeTraceWindow(trace: InputTrace, schedule: ScheduleSummary, journalReadyMask: number): void {
  const w = trace.window;
  traceInput(trace, `common K ${schedule.known} confirmed ${schedule.confirmed} R ${schedule.rollback}`);
  traceInput(trace, `raw sync events since trace start ${trace.rawSyncEvents} journal-start-mask ${journalReadyMask}`);
  traceInput(trace, `local callbacks ${trace.ticks} F ${schedule.speculative} rejected ${w.rejected} no-confirmed ${w.waitTicks} confirmed-steps ${w.confirmedSteps} speculative-steps ${w.speculativeSteps} failed ${w.speculativeFailures} corrections ${w.corrections} replayed-frames ${w.replayedFrames} max-replay-depth ${w.maxReplayDepth}`);
  traceInput(trace, `local target ${schedule.target ?? 0} polls ${w.localPolls} captures ${w.localCaptures} sent-packets ${w.localSends} same-target ${w.sameTargetSkips} window-blocks ${w.windowBlocks}`);
  traceInput(trace, `local sent-rows ${w.sentRows} singleton-packets ${w.singletons} batch-pending ${schedule.batchPending}`);
  const wait = w.batchWait;
  const waitDivisor = Math.max(1, wait.samples);
  traceInput(trace, `local capture-send samples ${wait.samples} callbacks mean-max ${R2S(wait.sumCallbacks / waitDivisor)}:${wait.maxCallbacks} native-ms mean-max ${R2S(wait.sumSeconds * 1000.0 / waitDivisor)}:${R2S(wait.maxSeconds * 1000.0)}`);
  const echo = w.echo;
  const echoDivisor = Math.max(1, echo.samples);
  traceInput(trace, `local echo samples ${echo.samples} pending ${trace.echoPending} overwritten ${echo.overwritten} callbacks min-mean-max ${echo.minCallbacks}:${R2S(echo.sumCallbacks / echoDivisor)}:${echo.maxCallbacks}`);
  traceInput(trace, `local echo native-ms min-mean-max ${R2S(echo.minSeconds * 1000.0)}:${R2S(echo.sumSeconds * 1000.0 / echoDivisor)}:${R2S(echo.maxSeconds * 1000.0)} callbacks bins 0-3,4-6,7-9,10-12,13-18,19+ ${echo.bins.join(":")}`);
  trace.window = traceWindow();
}
