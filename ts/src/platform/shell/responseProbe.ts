






import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { trampoline } from "wisp/src/platform/dispatch";
import { writeLines } from "wisp/src/platform/fileio";
import { edgeStampFile, responsePageFile } from "../../runtime/gameFiles";
import { PARTICIPANT_SLOTS, type ParticipantSlot, type Slots } from "../../game/input/participants";
import type { MatchCamera } from "../../game/sim/matchCamera";

const ROW_LIMIT = 7200;
const PAGE_ROWS = 150;
const EDGE_PAIR_LIMIT = 64;

const TRANSPORT_LIMIT = 8192;
const INTEGRITY_LIMIT = 32768;
export const EPOCH_CALLBACKS = 6000;
export const CHECKSUM_FRAMES = 600;
export const PROBE_EXPORT = "probe.exportPage";


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
  positionMask: number;
  presentedFrame: number;
  readonly positionX: Slots<number>;
  readonly positionZ: Slots<number>;
  cameraRecorded: boolean;
  readonly camera: number[];
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

  row: number | undefined;
  run: number;
  page: number;
  polls: number;
  captures: number;
  advances: number;
  presentations: number;
  readonly clock: timer;
  readonly exportTimer: timer;

  readonly marker: framehandle;
  readonly service: ServiceRow[];
  readonly integrity: string[];
  integrityDropped: number;
  serviceSerial: number;
  transportSent: number;
  transportReceived: number;
  transportUnmatched: number;
  transportDropped: number;
  waitingCallbacks: number;
  waitingOwnCallbacks: number;
  readonly transport: TransportStamp[];
  readonly transportOrder: number[];
  epoch: number | undefined;
  seenEpoch: number | undefined;
  readonly incomplete: number[];
}

function serviceRow(): ServiceRow {
  return {
    entryMs: 0.0, pollMs: 0.0, captureMs: 0.0, advanceMs: 0.0, presentMs: 0.0, frameBefore: 0, frameAfter: 0,
    speculativeBefore: 0, speculativeAfter: 0, known: 0, target: 0, held: 0, pressed: 0, released: 0, captureResult: 0,
    phase: 0, confirmedShield: 0, predictedShield: 0, poseSerial: 0, correction: 0, fileReadMs: 0.0, fileReads: 0,
    fileBytes: 0, sendCallMs: 0.0, sendCalls: 0,
    positionMask: 0, presentedFrame: 0, positionX: [0.0, 0.0, 0.0, 0.0], positionZ: [0.0, 0.0, 0.0, 0.0],
    cameraRecorded: false, camera: Array.from({ length: 12 }, () => 0.0),
  };
}

const vacantStamp = (): TransportStamp => ({ epoch: undefined, frame: 0, sendMs: undefined, receiveMs: undefined });


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
    waitingCallbacks: 0, waitingOwnCallbacks: 0,
    transport: Array.from({ length: TRANSPORT_LIMIT }, () => vacantStamp()), transportOrder: [],
    epoch: undefined, seenEpoch: undefined, incomplete: [],
  };
}

export const probeRecording = (probe: ResponseProbe | undefined): probe is ResponseProbe => probe?.recording === true;

const nowMs = (probe: ResponseProbe) => TimerGetElapsed(probe.clock) * 1000.0;

function currentRow(probe: ResponseProbe | undefined): ServiceRow | undefined {
  return probe?.row === undefined ? undefined : probe.service[probe.row];
}


export function probeIntegrity(probe: ResponseProbe | undefined, entry: string): void {
  if (!probeRecording(probe)) return;
  if (probe.integrity.length >= INTEGRITY_LIMIT) probe.integrityDropped++;
  else probe.integrity.push(`${probe.serviceSerial} ${entry}`);
}


export function probeInput(probe: ResponseProbe | undefined, stage: string, epoch: number, slot: number, frame: number, held: number, pressed: number, released: number, frontier: number): void {
  if (pressed !== 0 || released !== 0) probeIntegrity(probe, `${stage} ${epoch} ${slot} ${frame} ${held} ${pressed} ${released} ${frontier}`);
}

export function startProbe(probe: ResponseProbe, edgeStamps: boolean, epoch?: number): void {
  if (probe.exporting) return;
  probe.epoch = epoch;
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
  probe.waitingCallbacks = 0;
  probe.waitingOwnCallbacks = 0;
  probe.transportOrder.length = 0;
  for (const stamp of probe.transport) Object.assign(stamp, vacantStamp());
  probe.run++;

  TimerStart(probe.clock, 120.0, false, () => {});
  BlzFrameSetVisible(probe.marker, true);
}


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
  row.positionMask = 0;
  row.cameraRecorded = false;
  row.fileReadMs = 0.0;
  row.fileReads = 0;
  row.fileBytes = 0;
  row.sendCallMs = 0.0;
  row.sendCalls = 0;
}


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


function stampEdge(probe: ResponseProbe, stage: "poll" | "present"): void {
  const row = currentRow(probe);
  if (!probe.recording || !probe.edgeStamps || probe.exporting || row === undefined || probe.row === undefined) return;
  const slot = GetPlayerId(GetLocalPlayer());
  writeLines(edgeStampFile(slot, probe.run, probe.row, stage), [
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


export function probeAdvance(probe: ResponseProbe | undefined, frame: number, speculative: number, correction: number): void {
  const row = currentRow(probe);
  if (probe === undefined || row === undefined) return;
  probe.advances++;
  row.advanceMs = nowMs(probe);
  row.frameAfter = frame;
  row.speculativeAfter = speculative;
  row.correction = correction;
}

export function probeFighterPosition(probe: ResponseProbe | undefined, slot: ParticipantSlot, frame: number, x: number, z: number): void {
  const row = currentRow(probe);
  if (row === undefined) return;
  row.positionMask |= 1 << slot;
  row.presentedFrame = frame;
  row.positionX[slot] = x;
  row.positionZ[slot] = z;
}


export function probeWaiting(probe: ResponseProbe | undefined, waiting: number, slot: number): void {
  if (!probeRecording(probe) || currentRow(probe) === undefined || waiting === 0) return;
  probe.waitingCallbacks++;
  if ((waiting & (1 << slot)) !== 0) probe.waitingOwnCallbacks++;
}


export function probeCamera(probe: ResponseProbe | undefined, simulated: Readonly<MatchCamera>, projected: Readonly<MatchCamera>, originX: number, floor: number): void {
  const row = currentRow(probe);
  if (row === undefined) return;
  row.cameraRecorded = true;
  const values = row.camera;
  values[0] = simulated.x;
  values[1] = simulated.z;
  values[2] = simulated.distance;
  values[3] = simulated.tangent;
  values[4] = projected.x;
  values[5] = projected.z;
  values[6] = projected.distance;
  values[7] = projected.tangent;
  values[8] = GetCameraTargetPositionX() - originX;
  values[9] = GetCameraField(CAMERA_FIELD_ZOFFSET) - floor;
  values[10] = GetCameraField(CAMERA_FIELD_TARGET_DISTANCE);
  values[11] = GetCameraField(CAMERA_FIELD_FIELD_OF_VIEW);
}

export function probePresent(probe: ResponseProbe | undefined, confirmedShield: boolean, predictedShield: boolean, poseSerial: number): void {
  const row = currentRow(probe);
  if (probe === undefined || row === undefined || probe.row === undefined) return;
  probe.presentations++;
  row.presentMs = nowMs(probe);
  row.confirmedShield = confirmedShield ? 1 : 0;
  row.predictedShield = predictedShield ? 1 : 0;
  row.poseSerial = poseSerial;
  // Separate grid cells survive native rasterization; adjacent positions in one strip alias.
  const column = floorMod(probe.row, 32);
  const line = floorMod(floorDiv(probe.row, 32), 4);
  BlzFrameSetAbsPoint(probe.marker, FRAMEPOINT_TOPLEFT, f32(0.04) + column * f32(0.0032), f32(0.595) - line * f32(0.01));
  if (probe.pendingEdgeRow === probe.row) {
    stampEdge(probe, "present");
    probe.pendingEdgeRow = undefined;
  }
}


export function exportProbePage(probe: ResponseProbe): void {
  const slot = GetPlayerId(GetLocalPlayer());
  const first = probe.page * PAGE_ROWS;
  const last = first + PAGE_ROWS;
  const lines = [
    `RS v=3 build=${probe.build} local=${slot} run=${probe.run} page=${probe.page} rows=${probe.rows} mode=${probe.edgeStamps ? "edge-stamp" : "clean"} edge_pairs=${probe.edgePairs} edge_limit=${EDGE_PAIR_LIMIT} edge_dropped=${probe.edgeDropped}`,
    `integrity retained=${probe.integrity.length} dropped=${probe.integrityDropped}`,
    `epoch recorded=${probe.epoch ?? -1} incomplete=${probe.incomplete.length === 0 ? "none" : probe.incomplete.join(",")}`,
    `counts poll=${probe.polls} capture_attempt=${probe.captures} advance=${probe.advances} present=${probe.presentations}`,
    `waiting callbacks=${probe.waitingCallbacks} own_callbacks=${probe.waitingOwnCallbacks}`,
    `transport sent_frames=${probe.transportSent} received_frames=${probe.transportReceived} unmatched_receipts=${probe.transportUnmatched} dropped_from_export=${probe.transportDropped} retained=${probe.transportOrder.length}`,
    "clock=native-game-ms not-host-wall; row=zero-based-service; marker_x=0.04+(row%32)*0.0032 y=0.595-((row/32)%4)*0.01",
    "A row entry_ms poll_ms capture_ms advance_ms present_ms frame_before frame_after F_before F_after K_before target",
    "B row held pressed released capture_result phase confirmed_shield predicted_shield pose_serial correction",
    "C row journal_read_count journal_read_bytes journal_read_ms sync_send_count sync_send_ms",
    "D epoch frame sync_send_ms local_echo_ms echo_age_ms; echo=-1 means not observed before export",
    "P row slot presented_frame x z; correlate row with actual framebuffer marker, not callback count",
    "Q row sim_x sim_z sim_distance sim_tangent local_x local_z local_distance local_tangent native_x native_z native_distance native_fov_radians; native sampled before camera request, not per drawn frame",
  ];
  for (const entry of probe.integrity.slice(first, last)) lines.push(`I ${entry}`);
  for (let index = first; index < Math.min(probe.rows, last); index++) {
    const r = probe.service[index];
    if (r === undefined) continue;
    lines.push(`A ${index} ${R2S(r.entryMs)} ${R2S(r.pollMs ?? -1)} ${R2S(r.captureMs ?? -1)} ${R2S(r.advanceMs ?? -1)} ${R2S(r.presentMs ?? -1)} ${r.frameBefore} ${r.frameAfter ?? -1} ${r.speculativeBefore} ${r.speculativeAfter ?? -1} ${r.known} ${r.target ?? -1}`);
    lines.push(`B ${index} ${r.held ?? -1} ${r.pressed ?? -1} ${r.released ?? -1} ${r.captureResult ?? -1} ${r.phase} ${r.confirmedShield ?? -1} ${r.predictedShield ?? -1} ${r.poseSerial ?? -1} ${r.correction ?? -1}`);
    lines.push(`C ${index} ${r.fileReads} ${r.fileBytes} ${R2S(r.fileReadMs)} ${r.sendCalls} ${R2S(r.sendCallMs)}`);
    if (r.cameraRecorded) lines.push(`Q ${index} ${r.camera.map(value => R2S(value)).join(" ")}`);
    for (const fighter of PARTICIPANT_SLOTS) {
      if ((r.positionMask & (1 << fighter)) !== 0) lines.push(`P ${index} ${fighter} ${r.presentedFrame} ${R2S(r.positionX[fighter])} ${R2S(r.positionZ[fighter])}`);
    }
  }
  for (const index of probe.transportOrder.slice(first, last)) {
    const stamp = probe.transport[index];
    if (stamp === undefined) continue;
    const age = stamp.receiveMs === undefined || stamp.sendMs === undefined ? -1.0 : stamp.receiveMs - stamp.sendMs;
    lines.push(`D ${stamp.epoch ?? -1} ${stamp.frame} ${R2S(stamp.sendMs ?? -1)} ${R2S(stamp.receiveMs ?? -1)} ${R2S(age)}`);
  }
  writeLines(responsePageFile(slot, probe.run, probe.page), lines);
  probe.page++;
  if (probe.page * PAGE_ROWS >= Math.max(probe.integrity.length, probe.rows, probe.transportOrder.length)) {
    probe.exporting = false;
    PauseTimer(probe.exportTimer);
  }
}


export function exportProbe(probe: ResponseProbe): void {
  if (probe.exporting || probe.run === 0) return;
  probe.recording = false;
  probe.row = undefined;
  probe.pendingEdgeRow = undefined;
  probe.exporting = true;
  probe.page = 0;
  TimerStart(probe.exportTimer, f32(0.1), true, trampoline(PROBE_EXPORT));
}


export const epochChecksumDue = (probe: ResponseProbe | undefined, frame: number): boolean => probeRecording(probe) && probe.epoch !== undefined && floorMod(frame, CHECKSUM_FRAMES) === 0;


export function serviceEpochProbe(probe: ResponseProbe, epoch: number | undefined, checksum: () => string): void {
  if (probe.recording && probe.epoch !== undefined && (epoch !== probe.epoch || probe.rows >= EPOCH_CALLBACKS)) {
    probeIntegrity(probe, checksum());
    exportProbe(probe);
  }
  if (epoch === undefined || epoch === probe.seenEpoch) return;
  probe.seenEpoch = epoch;
  if (probe.exporting || probe.recording) probe.incomplete.push(epoch);
  else startProbe(probe, false, epoch);
}
