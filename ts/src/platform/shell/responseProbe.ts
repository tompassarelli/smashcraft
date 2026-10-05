// The response probe (probe builds, Ctrl+G or Ctrl+J to record, Ctrl+H to
// export): per-callback service timings, transport echo ages and the
// integrity rows the #26 harness reconciles (capture, receive, confirmed,
// predict, action, legal, rollback, stall, checksum). Pages are written as
// smashcraft-response-p<slot>-run<run>-page<page>.txt; their lines are the
// harness's format. Times are native game milliseconds, not host time, and
// nothing here feeds synchronized state.
import { f32 } from "waygate/src/sim/f32";
import { floorDiv, floorMod } from "waygate/src/sim/intMath";
import { trampoline } from "waygate/src/platform/dispatch";
import { writeLines } from "waygate/src/platform/fileio";

const ROW_LIMIT = 7200;
const PAGE_ROWS = 150;
const EDGE_PAIR_LIMIT = 64;
/** Original-frame send stamps; 8192 cover a full 2700-callback capture with headroom. */
const TRANSPORT_LIMIT = 8192;
const INTEGRITY_LIMIT = 8192;
export const PROBE_EXPORT = "probe.exportPage";

/** One game callback's service. -1 is "not recorded" in the page format. */
interface ServiceRow {
  entryMs: number;
  pollMs: number | undefined;
  captureMs: number | undefined;
  advanceMs: number | undefined;
  presentMs: number | undefined;
  frameBefore: number;
  frameAfter: number | undefined;
  speculativeBefore: number;
  speculativeAfter: number | undefined;
  known: number;
  target: number | undefined;
  held: number | undefined;
  pressed: number | undefined;
  released: number | undefined;
  captureResult: number | undefined;
  phase: number;
  confirmedShield: number | undefined;
  predictedShield: number | undefined;
  poseSerial: number | undefined;
  correction: number | undefined;
  fileReadMs: number;
  fileReads: number;
  fileBytes: number;
  sendCallMs: number;
  sendCalls: number;
}

interface TransportStamp {
  epoch: number | undefined;
  frame: number;
  sendMs: number | undefined;
  receiveMs: number | undefined;
}

export interface ResponseProbe {
  readonly build: string;
  recording: boolean;
  exporting: boolean;
  edgeStamps: boolean;
  previousHeld: number | undefined;
  edgePairs: number;
  edgeDropped: number;
  pendingEdgeRow: number | undefined;
  rows: number;
  /** The current callback's row, while recording. */
  row: number | undefined;
  run: number;
  page: number;
  polls: number;
  captures: number;
  advances: number;
  presentations: number;
  readonly clock: timer;
  readonly exportTimer: timer;
  /** A visible mark whose position encodes the row, to correlate with screen captures. */
  readonly marker: framehandle;
  readonly service: ServiceRow[];
  readonly integrity: string[];
  integrityDropped: number;
  serviceSerial: number;
  transportSent: number;
  transportReceived: number;
  transportUnmatched: number;
  transportDropped: number;
  readonly transport: TransportStamp[];
  readonly transportOrder: number[];
}

function serviceRow(): ServiceRow {
  return {
    entryMs: 0.0, pollMs: 0.0, captureMs: 0.0, advanceMs: 0.0, presentMs: 0.0, frameBefore: 0, frameAfter: 0,
    speculativeBefore: 0, speculativeAfter: 0, known: 0, target: 0, held: 0, pressed: 0, released: 0, captureResult: 0,
    phase: 0, confirmedShield: 0, predictedShield: 0, poseSerial: 0, correction: 0, fileReadMs: 0.0, fileReads: 0,
    fileBytes: 0, sendCallMs: 0.0, sendCalls: 0,
  };
}

const vacantStamp = (): TransportStamp => ({ epoch: undefined, frame: 0, sendMs: undefined, receiveMs: undefined });

/** Creates the probe's timers, marker and every row before measurement, so recording only overwrites. */
export function createResponseProbe(build: string): ResponseProbe {
  const marker = BlzCreateFrameByType("TEXT", "ResponseServiceMarker", BlzGetOriginFrame(ORIGIN_FRAME_GAME_UI, 0), "", 966);
  BlzFrameSetText(marker, "|cffff00ffI|r");
  BlzFrameSetSize(marker, f32(0.012), f32(0.016));
  BlzFrameSetAbsPoint(marker, FRAMEPOINT_TOPLEFT, f32(0.04), f32(0.595));
  BlzFrameSetVisible(marker, false);
  return {
    build, recording: false, exporting: false, edgeStamps: false, previousHeld: undefined, edgePairs: 0, edgeDropped: 0,
    pendingEdgeRow: undefined, rows: 0, row: undefined, run: 0, page: 0, polls: 0, captures: 0, advances: 0, presentations: 0,
    clock: CreateTimer(), exportTimer: CreateTimer(), marker,
    service: Array.from({ length: ROW_LIMIT }, () => serviceRow()),
    integrity: [], integrityDropped: 0, serviceSerial: 0,
    transportSent: 0, transportReceived: 0, transportUnmatched: 0, transportDropped: 0,
    transport: Array.from({ length: TRANSPORT_LIMIT }, () => vacantStamp()), transportOrder: [],
  };
}

export const probeRecording = (probe: ResponseProbe | undefined): probe is ResponseProbe => probe?.recording === true;

const nowMs = (probe: ResponseProbe) => TimerGetElapsed(probe.clock) * 1000.0;

function currentRow(probe: ResponseProbe | undefined): ServiceRow | undefined {
  return probe?.row === undefined ? undefined : probe.service[probe.row];
}

/** An integrity row; these describe execution, not reconstructed original-frame tags. */
export function probeIntegrity(probe: ResponseProbe | undefined, entry: string): void {
  if (!probeRecording(probe)) return;
  if (probe.integrity.length >= INTEGRITY_LIMIT) probe.integrityDropped++;
  else probe.integrity.push(`${probe.serviceSerial} ${entry}`);
}

/** A row with edges, at one pipeline stage; rows without edges are not recorded. */
export function probeInput(probe: ResponseProbe | undefined, stage: string, epoch: number, slot: number, frame: number, held: number, pressed: number, released: number, frontier: number): void {
  if (pressed !== 0 || released !== 0) probeIntegrity(probe, `${stage} ${epoch} ${slot} ${frame} ${held} ${pressed} ${released} ${frontier}`);
}

export function startProbe(probe: ResponseProbe, edgeStamps: boolean): void {
  if (probe.exporting) return;
  probe.integrity.length = 0;
  probe.integrityDropped = 0;
  probe.serviceSerial = 0;
  probe.edgeStamps = edgeStamps;
  probe.previousHeld = undefined;
  probe.edgePairs = 0;
  probe.edgeDropped = 0;
  probe.pendingEdgeRow = undefined;
  probe.recording = true;
  probe.rows = 0;
  probe.row = undefined;
  probe.polls = 0;
  probe.captures = 0;
  probe.advances = 0;
  probe.presentations = 0;
  probe.transportSent = 0;
  probe.transportReceived = 0;
  probe.transportUnmatched = 0;
  probe.transportDropped = 0;
  probe.transportOrder.length = 0;
  for (const stamp of probe.transport) Object.assign(stamp, vacantStamp());
  probe.run++;
  // Native game time is not host time; the marker correlates rows with screen captures.
  TimerStart(probe.clock, 120.0, false, () => {});
  BlzFrameSetVisible(probe.marker, true);
}

/** Opens this callback's row. */
export function probeBegin(probe: ResponseProbe | undefined, frame: number, speculative: number, known: number, phase: number): void {
  if (probe === undefined) return;
  probe.row = undefined;
  probe.pendingEdgeRow = undefined;
  if (!probe.recording) return;
  if (probe.rows === ROW_LIMIT) {
    probe.recording = false;
    return;
  }
  probe.serviceSerial++;
  const index = probe.rows++;
  const row = probe.service[index];
  if (row === undefined) return;
  probe.row = index;
  // Preallocated: assigned field by field so recording allocates nothing.
  row.entryMs = nowMs(probe);
  row.frameBefore = frame;
  row.speculativeBefore = speculative;
  row.known = known;
  row.phase = phase;
  row.pollMs = undefined;
  row.captureMs = undefined;
  row.advanceMs = undefined;
  row.presentMs = undefined;
  row.frameAfter = undefined;
  row.speculativeAfter = undefined;
  row.target = undefined;
  row.held = undefined;
  row.pressed = undefined;
  row.released = undefined;
  row.captureResult = undefined;
  row.confirmedShield = undefined;
  row.predictedShield = undefined;
  row.poseSerial = undefined;
  row.correction = undefined;
  row.fileReadMs = 0.0;
  row.fileReads = 0;
  row.fileBytes = 0;
  row.sendCallMs = 0.0;
  row.sendCalls = 0;
}

/** Native milliseconds for timing a call, or undefined while not recording. */
export function probeClockMs(probe: ResponseProbe | undefined): number | undefined {
  return probeRecording(probe) ? nowMs(probe) : undefined;
}

export function probeFileRead(probe: ResponseProbe | undefined, startedMs: number | undefined, bytes: number): void {
  const row = currentRow(probe);
  if (probe === undefined || row === undefined || startedMs === undefined) return;
  row.fileReads++;
  row.fileReadMs += nowMs(probe) - startedMs;
  row.fileBytes += bytes;
}

export function probeSendFinished(probe: ResponseProbe | undefined, startedMs: number | undefined): void {
  const row = currentRow(probe);
  if (probe === undefined || row === undefined || startedMs === undefined) return;
  row.sendCalls++;
  row.sendCallMs += nowMs(probe) - startedMs;
}

export function probeTransportSend(probe: ResponseProbe | undefined, epoch: number, frame: number): void {
  if (!probeRecording(probe)) return;
  const index = floorMod(frame, TRANSPORT_LIMIT);
  const stamp = probe.transport[index];
  if (stamp === undefined) return;
  stamp.epoch = epoch;
  stamp.frame = frame;
  stamp.sendMs = nowMs(probe);
  stamp.receiveMs = undefined;
  probe.transportSent++;
  if (probe.transportOrder.length < TRANSPORT_LIMIT) probe.transportOrder.push(index);
  else probe.transportDropped++;
}

export function probeTransportReceive(probe: ResponseProbe | undefined, epoch: number, frame: number): void {
  if (!probeRecording(probe)) return;
  const stamp = probe.transport[floorMod(frame, TRANSPORT_LIMIT)];
  if (stamp === undefined || stamp.epoch !== epoch || stamp.frame !== frame || stamp.sendMs === undefined) {
    probe.transportUnmatched++;
    return;
  }
  if (stamp.receiveMs === undefined) {
    stamp.receiveMs = nowMs(probe);
    probe.transportReceived++;
  }
}

/** Edge-stamp mode writes a file per edge; it perturbs service, so only clean runs measure performance. */
function stampEdge(probe: ResponseProbe, stage: "poll" | "present"): void {
  const row = currentRow(probe);
  if (!probe.recording || !probe.edgeStamps || probe.exporting || row === undefined || probe.row === undefined) return;
  const slot = GetPlayerId(GetLocalPlayer());
  writeLines(`smashcraft-edge-p${slot}-run${probe.run}-row${probe.row}-${stage}.txt`, [
    `EDGE v=1 build=${probe.build} local=${slot} run=${probe.run} row=${probe.row} stage=${stage} held=${row.held ?? -1} pressed=${row.pressed ?? -1} released=${row.released ?? -1} active=${BlzIsLocalClientActive() ? 1 : 0} native_ms=${R2S(nowMs(probe))}`,
  ]);
}

export function probePoll(probe: ResponseProbe | undefined, held: number, pressed: number, released: number, target: number | undefined): void {
  const row = currentRow(probe);
  if (probe === undefined || row === undefined) return;
  probe.polls++;
  row.pollMs = nowMs(probe);
  row.held = held;
  row.pressed = pressed;
  row.released = released;
  row.target = target ?? 0;
  if (!probe.edgeStamps || !probe.recording) return;
  if (probe.previousHeld !== undefined && held !== probe.previousHeld) {
    if (probe.edgePairs < EDGE_PAIR_LIMIT) {
      probe.edgePairs++;
      probe.pendingEdgeRow = probe.row;
      stampEdge(probe, "poll");
    } else probe.edgeDropped++;
  }
  probe.previousHeld = held;
}

export function probeCapture(probe: ResponseProbe | undefined, result: number): void {
  const row = currentRow(probe);
  if (probe === undefined || row === undefined) return;
  probe.captures++;
  row.captureMs = nowMs(probe);
  row.captureResult = result;
}

/** correction: 0 unchanged, -1 refused, else the first replayed frame. */
export function probeAdvance(probe: ResponseProbe | undefined, frame: number, speculative: number, correction: number): void {
  const row = currentRow(probe);
  if (probe === undefined || row === undefined) return;
  probe.advances++;
  row.advanceMs = nowMs(probe);
  row.frameAfter = frame;
  row.speculativeAfter = speculative;
  row.correction = correction;
}

export function probePresent(probe: ResponseProbe | undefined, confirmedShield: boolean, predictedShield: boolean, poseSerial: number): void {
  const row = currentRow(probe);
  if (probe === undefined || row === undefined || probe.row === undefined) return;
  probe.presentations++;
  row.presentMs = nowMs(probe);
  row.confirmedShield = confirmedShield ? 1 : 0;
  row.predictedShield = predictedShield ? 1 : 0;
  row.poseSerial = poseSerial;
  // Separate grid cells survive native low-resolution rasterization; adjacent positions in one strip alias.
  const column = floorMod(probe.row, 32);
  const line = floorMod(floorDiv(probe.row, 32), 4);
  BlzFrameSetAbsPoint(probe.marker, FRAMEPOINT_TOPLEFT, f32(0.04) + column * f32(0.0032), f32(0.595) - line * f32(0.01));
  if (probe.pendingEdgeRow === probe.row) {
    stampEdge(probe, "present");
    probe.pendingEdgeRow = undefined;
  }
}

/** Writes one page per export tick, so no single callback writes the whole run. */
export function exportProbePage(probe: ResponseProbe): void {
  const slot = GetPlayerId(GetLocalPlayer());
  const first = probe.page * PAGE_ROWS;
  const last = first + PAGE_ROWS;
  const lines = [
    `RS v=3 build=${probe.build} local=${slot} run=${probe.run} page=${probe.page} rows=${probe.rows} mode=${probe.edgeStamps ? "edge-stamp" : "clean"} edge_pairs=${probe.edgePairs} edge_limit=${EDGE_PAIR_LIMIT} edge_dropped=${probe.edgeDropped}`,
    `integrity retained=${probe.integrity.length} dropped=${probe.integrityDropped}`,
    `counts poll=${probe.polls} capture_attempt=${probe.captures} advance=${probe.advances} present=${probe.presentations}`,
    `transport sent_frames=${probe.transportSent} received_frames=${probe.transportReceived} unmatched_receipts=${probe.transportUnmatched} dropped_from_export=${probe.transportDropped} retained=${probe.transportOrder.length}`,
    "clock=native-game-ms not-host-wall; row=zero-based-service; marker_x=0.04+(row%32)*0.0032 y=0.595-((row/32)%4)*0.01",
    "A row entry_ms poll_ms capture_ms advance_ms present_ms frame_before frame_after F_before F_after K_before target",
    "B row held pressed released capture_result phase confirmed_shield predicted_shield pose_serial correction",
    "C row journal_read_count journal_read_bytes journal_read_ms sync_send_count sync_send_ms",
    "D epoch frame sync_send_ms local_echo_ms echo_age_ms; echo=-1 means not observed before export",
  ];
  for (const entry of probe.integrity.slice(first, last)) lines.push(`I ${entry}`);
  for (let index = first; index < Math.min(probe.rows, last); index++) {
    const r = probe.service[index];
    if (r === undefined) continue;
    lines.push(`A ${index} ${R2S(r.entryMs)} ${R2S(r.pollMs ?? -1)} ${R2S(r.captureMs ?? -1)} ${R2S(r.advanceMs ?? -1)} ${R2S(r.presentMs ?? -1)} ${r.frameBefore} ${r.frameAfter ?? -1} ${r.speculativeBefore} ${r.speculativeAfter ?? -1} ${r.known} ${r.target ?? -1}`);
    lines.push(`B ${index} ${r.held ?? -1} ${r.pressed ?? -1} ${r.released ?? -1} ${r.captureResult ?? -1} ${r.phase} ${r.confirmedShield ?? -1} ${r.predictedShield ?? -1} ${r.poseSerial ?? -1} ${r.correction ?? -1}`);
    lines.push(`C ${index} ${r.fileReads} ${r.fileBytes} ${R2S(r.fileReadMs)} ${r.sendCalls} ${R2S(r.sendCallMs)}`);
  }
  for (const index of probe.transportOrder.slice(first, last)) {
    const stamp = probe.transport[index];
    if (stamp === undefined) continue;
    const age = stamp.receiveMs === undefined || stamp.sendMs === undefined ? -1.0 : stamp.receiveMs - stamp.sendMs;
    lines.push(`D ${stamp.epoch ?? -1} ${stamp.frame} ${R2S(stamp.sendMs ?? -1)} ${R2S(stamp.receiveMs ?? -1)} ${R2S(age)}`);
  }
  writeLines(`smashcraft-response-p${slot}-run${probe.run}-page${probe.page}.txt`, lines);
  probe.page++;
  if (probe.page * PAGE_ROWS >= Math.max(probe.integrity.length, probe.rows, probe.transportOrder.length)) {
    probe.exporting = false;
    PauseTimer(probe.exportTimer);
  }
}

/** Stops recording and writes the run's pages, one per tenth of a second. */
export function exportProbe(probe: ResponseProbe): void {
  if (probe.exporting || probe.run === 0) return;
  probe.recording = false;
  probe.row = undefined;
  probe.pendingEdgeRow = undefined;
  probe.exporting = true;
  probe.page = 0;
  TimerStart(probe.exportTimer, f32(0.1), true, trampoline(PROBE_EXPORT));
}
