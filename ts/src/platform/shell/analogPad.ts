import { f32 } from "wisp/src/sim/f32";
import { writeLines } from "wisp/src/platform/fileio";
import { trampoline } from "wisp/src/platform/dispatch";
import { PAD_ACTIVE_KEY, PAD_PRESENT_KEY, cursorWorldPacket, decodePad, padKeyPacket, type CursorCalibration } from "../../game/input/padCapture";
import type { InputRow } from "../../game/input/inputRow";
import { encodePacket, inputPacket } from "../../game/input/wire";
import { humanActive, humanFighterActive } from "../../game/match/rules";
import { PARTICIPANT_SLOTS } from "../../game/input/participants";
import { type ShellState, localSlot } from "./state";

export const PAD_MOUSE = "shell.padMouse";

export interface NativePadCapture {
  readonly calibration: CursorCalibration;
  packet: number | undefined;
  mouseEvents: number;
  syncEvents: number;
  startedAt: number;
  readonly rows: string[];
  readonly mouse: string[];
}

const pressed = (key: number) => BlzIsKeyPressed(ConvertOsKeyType(key));

/** Both comparison builds create the same mouse event registrations. */
export function createPadTriggers(s: ShellState): void {
  if (s.pad === undefined || (s.build.analogPadDiagnostic !== true && s.build.analogPad !== "cursor")) return;
  const trigger = CreateTrigger();
  for (const slot of PARTICIPANT_SLOTS) {
    if (humanActive(s.game, slot)) TriggerRegisterPlayerEvent(trigger, Player(slot), EVENT_PLAYER_MOUSE_MOVE);
  }
  TriggerAddAction(trigger, trampoline(PAD_MOUSE));
}

export function padMouse(s: ShellState): void {
  const pad = s.pad;
  if (pad === undefined) return;
  if (s.build.analogPadDiagnostic === true) {
    pad.mouseEvents++;
    pad.mouse.push(`mouse ${pad.mouseEvents} ${s.trace.clockPeriods * 1000.0 + TimerGetElapsed(s.trace.clock)} ${pad.syncEvents}`);
  }
  // Calibration and capture are local; only the resulting input rows are sent.
  if (GetTriggerPlayer() !== GetLocalPlayer() || !pressed(PAD_ACTIVE_KEY)) return;
  const point = { x: f32(BlzGetTriggerPlayerMouseX()), y: f32(BlzGetTriggerPlayerMouseY()) };
  if (pressed(0x21)) {
    pad.calibration.first = point;
    pad.calibration.last = undefined;
    pad.packet = undefined;
    if (s.build.analogPadDiagnostic === true) writeLines(`smashcraft-pad-calibration-p${localSlot()}.txt`, [`corner start ${point.x} ${point.y} native-seconds ${s.trace.clockPeriods * 1000.0 + TimerGetElapsed(s.trace.clock)} mouse-events ${pad.mouseEvents} sync-events ${pad.syncEvents}`]);
  } else if (pressed(0x22)) {
    pad.calibration.last = point;
    pad.packet = undefined;
    if (s.build.analogPadDiagnostic === true) writeLines(`smashcraft-pad-calibration-p${localSlot()}.txt`, [`corner end ${point.x} ${point.y} native-seconds ${s.trace.clockPeriods * 1000.0 + TimerGetElapsed(s.trace.clock)} mouse-events ${pad.mouseEvents} sync-events ${pad.syncEvents}`]);
  } else if (s.build.analogPad === "cursor") {
    pad.packet = cursorWorldPacket(pad.calibration, point.x, point.y);
  }
}

export function pollPad(s: Readonly<ShellState>): number | undefined {
  const pad = s.pad;
  if (pad === undefined) return undefined;
  if (!BlzIsLocalClientActive() || !pressed(PAD_PRESENT_KEY)) {
    pad.packet = undefined;
    return undefined;
  }
  if (s.session.paused || !humanFighterActive(s.game, localSlot())) return undefined;
  if (s.build.analogPad === "keys") {
    const packet = padKeyPacket(pressed);
    if (packet !== undefined && decodePad(packet) !== undefined) pad.packet = packet;
  }
  return pad.packet ?? (8 | 8 << 5);
}

export function recordPadRow(s: ShellState, epoch: number, frame: number, row: Readonly<InputRow>): void {
  const pad = s.pad;
  if (pad === undefined || s.build.analogPadDiagnostic !== true) return;
  const packet = pollPad(s);
  const valid = packet === undefined ? undefined : decodePad(packet);
  const wire = inputPacket(epoch, frame, [row]);
  if (wire !== undefined) pad.rows.push(`row ${epoch} ${frame} ${valid === undefined ? -1 : packet} ${encodePacket(wire)} ${s.trace.clockPeriods * 1000.0 + TimerGetElapsed(s.trace.clock)}`);
}

/** Exported with the finished match, so the runner need not stop gameplay. */
export function exportPad(s: ShellState): void {
  const pad = s.pad;
  if (pad === undefined || s.build.analogPadDiagnostic !== true) return;
  const epoch = s.rollback?.epoch ?? 0;
  writeLines(`smashcraft-pad-${s.build.analogPad}-e${epoch}-p${localSlot()}.txt`, [
    `pad ${s.build.id} epoch ${epoch} mouse-events ${pad.mouseEvents} sync-events ${pad.syncEvents} rows ${pad.rows.length} started ${pad.startedAt} finished ${s.trace.clockPeriods * 1000.0 + TimerGetElapsed(s.trace.clock)}`,
    ...pad.rows,
    ...pad.mouse,
  ]);
}
