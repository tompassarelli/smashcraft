import { Action, bit } from "../game/input/actions";
import { sampleKeys, commitEdges, keyboardCapture, type KeyboardCapture } from "../game/input/keyboardCapture";
import { PARTICIPANT_SLOTS, isParticipantSlot } from "../game/input/participants";
import { copyInput } from "../game/input/inputRow";
import { startKeyUp } from "../game/match/controls";
import { Phase } from "../game/match/rules";
import { parseDecimal } from "../game/netcode/journal/decimal";
import { beginMomentSave, continueMomentSave, momentInput } from "../game/replay/moment";
import { writeRepro } from "wisp/src/platform/repro";
import { reproFile } from "wisp/src/runtime/repro";
import { installNativeDriver, startNativeDriver, serviceNativeDriver, publishNativeDriverStatus } from "wisp/src/platform/nativeDriver";
import { squareRootFloat32 } from "wisp/src/sim/binary32";
import { f32 } from "wisp/src/sim/f32";
import { finishInputTrace } from "./shell/trace";
import { confirmedChecksum, startInputTrace } from "./shell/diagnostics";
import { pauseMatchPresentation } from "./shell/view";
import { applyDeveloperCommand, startDown } from "./shell/keys";
import { shell, type ShellState, localSlot } from "./shell/state";

interface Pad {
  buttons: number;
  x: number;
  z: number;
  cx: number;
  cz: number;
  shield: number;
  viewSince: number | undefined;
  viewSaved: boolean;
  readonly capture: KeyboardCapture;
}
interface Edge {
  readonly order: number;
  readonly frame: number;
  readonly slot: number;
  readonly action: string;
  readonly args: readonly string[];
}
interface Driver {
  edges: readonly Edge[];
  next: number;
  captures: number[];
  paused: boolean;
  target: number | undefined;
  readonly pads: readonly Pad[];
}
declare global { var __smashcraftNativeDriver: Driver | undefined; }

const neutralPad = (): Pad => ({ buttons: 0, x: 0.0, z: 0.0, cx: 0.0, cz: 0.0, shield: 0.0, viewSince: undefined, viewSaved: false, capture: keyboardCapture() });
const state = (): Driver => globalThis.__smashcraftNativeDriver ??= { edges: [], next: 0, captures: [], paused: true, target: undefined, pads: PARTICIPANT_SLOTS.map(() => neutralPad()) };
const BUTTONS: Readonly<Record<string, number>> = { A: 1, B: 2, X: 4, Y: 8, LB: 16, TL: 16, RB: 32, TR: 32, START: 64, VIEW: 128 };

function whole(text: string): number {
  const result = parseDecimal(text);
  if (result === undefined || `${result}` !== text) throw new Error(`native driver: expected a whole frame count, got ${text}`);
  return result;
}
function real(text: string | undefined, low: number, high: number): number {
  const value = text === undefined ? undefined : Number(text);
  if (value === undefined || value !== value || value < low || value > high) throw new Error("native driver: pad value outside its range");
  return f32(value);
}

/** The existing pad file syntax, including relative frames and taps expanded to releases. */
function parseScript(text: string): { readonly setup: string; readonly edges: readonly Edge[] } {
  let setup = "-dev quick";
  let previous = 0;
  const edges: Edge[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("#! chat ")) { setup = line.substring(8); continue; }
    const source = line.split("#")[0]?.trim() ?? "";
    if (source === "") continue;
    const [frameText, player, action, ...args] = source.split("\t").join(" ").split(" ").filter(word => word !== "");
    if (frameText === undefined || action === undefined || (player !== "a" && player !== "b")) throw new Error(`native driver: invalid pad line ${source}`);
    const frame = frameText.startsWith("+") ? previous + whole(frameText.substring(1)) : whole(frameText);
    if (frame < previous) throw new Error("native driver: pad frames must be ordered");
    previous = frame;
    const slot = player === "a" ? 0 : 1;
    if (action === "capture") { edges.push({ order: edges.length, frame, slot, action, args }); continue; }
    if (action === "press" || action === "release" || action === "tap") {
      if (BUTTONS[(args[0] ?? "").toUpperCase()] === undefined) throw new Error("native driver: unknown pad button");
      const held = action === "tap" ? args[1] === undefined ? 1 : whole(args[1]) : 0;
      if (action === "tap" && (held < 1 || held > 600)) throw new Error("native driver: tap length must be 1..600");
      edges.push({ order: edges.length, frame, slot, action: action === "tap" ? "press" : action, args });
      if (action === "tap") edges.push({ order: edges.length, frame: frame + held, slot, action: "release", args });
    } else if (action === "stick" || action === "cstick") {
      real(args[0], -1.0, 1.0); real(args[1], -1.0, 1.0);
      edges.push({ order: edges.length, frame, slot, action, args });
    } else if (action === "shield") {
      real(args[0], 0.0, 1.0);
      edges.push({ order: edges.length, frame, slot, action, args });
    } else throw new Error(`native driver: unknown pad action ${action}`);
  }
  return { setup, edges: edges.sort((a, b) => a.frame - b.frame || a.order - b.order) };
}

function stick(x: number, z: number): readonly [number, number] {
  const radius = squareRootFloat32(f32(f32(x * x) + f32(z * z)));
  if (radius > 1.0) { x = f32(x / radius); z = f32(z / radius); }
  return [Math.abs(x) <= f32(0.28) ? 0.0 : x, Math.abs(z) <= f32(0.28) ? 0.0 : z];
}
function padSample(pad: Pad): void {
  const [x = 0.0, z = 0.0] = stick(pad.x, pad.z);
  const [cx = 0.0, cz = 0.0] = stick(pad.cx, pad.cz);
  let held = 0;
  const set = (action: Action, active: boolean) => { if (active) held |= bit(action); };
  set(Action.attack, (pad.buttons & 1) !== 0);
  set(Action.jump, (pad.buttons & 10) !== 0);
  set(Action.special, (pad.buttons & 4) !== 0);
  set(Action.walk, (pad.buttons & 16) !== 0);
  set(Action.grab, (pad.buttons & 32) !== 0);
  set(Action.leftTrigger, pad.shield > f32(4000.0 / 32767.0));
  set(Action.moveLeft, x < 0.0); set(Action.moveRight, x > 0.0);
  set(Action.moveDown, z <= -f32(0.6625)); set(Action.moveUp, z > 0.0);
  set(Action.smashLeft, cx <= -f32(0.8)); set(Action.smashRight, cx >= f32(0.8));
  set(Action.smashDown, cz <= -f32(0.6625)); set(Action.smashUp, cz >= f32(0.6625));
  const row = pad.capture.row;
  const special = (held & bit(Action.special)) !== 0 && (row.held & bit(Action.special)) === 0 && (row.pressed & bit(Action.special)) === 0;
  const dodge = (held & bit(Action.leftTrigger)) !== 0 && (row.held & bit(Action.leftTrigger)) === 0;
  sampleKeys(pad.capture, held);
  const direction = (value: number) => value > 0.0 ? 1 : value < 0.0 ? -1 : 0;
  if (special) { row.specialX = direction(x); row.specialZ = direction(z); }
  if (dodge) { row.dodgeX = direction(x); row.dodgeZ = direction(z); }
  row.axisX = Math.trunc(f32(x * 127.0));
  row.axisZ = Math.trunc(f32(z * 127.0));
  row.triggerLeft = (held & bit(Action.leftTrigger)) !== 0 ? 77 : 0;
}
function applyEdge(s: ShellState, pad: Pad, edge: Edge): void {
  const button = BUTTONS[(edge.args[0] ?? "").toUpperCase()] ?? 0;
  if ((edge.action === "press" || edge.action === "release") && button === 64 && isParticipantSlot(edge.slot)) {
    if (edge.action === "press") startDown(s, edge.slot);
    else startKeyUp(s.session, edge.slot);
  }
  if (button === 128 && edge.action === "press" && (pad.buttons & button) === 0) { pad.viewSince = edge.frame; pad.viewSaved = false; }
  if (button === 128 && edge.action === "release") { pad.viewSince = undefined; pad.viewSaved = false; }
  if (edge.action === "press") pad.buttons |= button;
  else if (edge.action === "release") pad.buttons &= ~button;
  else if (edge.action === "stick") { pad.x = real(edge.args[0], -1.0, 1.0); pad.z = real(edge.args[1], -1.0, 1.0); }
  else if (edge.action === "cstick") { pad.cx = real(edge.args[0], -1.0, 1.0); pad.cz = real(edge.args[1], -1.0, 1.0); }
  else pad.shield = real(edge.args[0], 0.0, 1.0);
  padSample(pad);
}
function saveFrame(s: ShellState): void {
  if (s.runtime.simulationFrame === 0) return;
  if (!beginMomentSave(s.moment.recorder, momentInput(s.build), s.world, s.game, s.controls, s.runtime)) throw new Error("native driver: could not save held frame");
  let saved = continueMomentSave(s.moment.recorder, s.diagnostic);
  while (saved === undefined) saved = continueMomentSave(s.moment.recorder, s.diagnostic);
  writeRepro(reproFile(localSlot(), saved.frame, ++s.moment.saved, "smashcraft"), { build: s.build.id, frame: saved.frame, checksum: saved.checksum }, saved.lines);
}
function publish(s: ShellState): void {
  publishNativeDriverStatus(s.runtime.simulationFrame, confirmedChecksum(s), state().paused);
}

/** Only a predeclared synchronized driver event calls this on the native clients. */
export function nativeDriverCommand(text: string): void {
  const s = shell();
  const driver = state();
  const command = text.trim();
  if (command === "reset") {
    applyDeveloperCommand(s, 0, "-dev reset");
    globalThis.__smashcraftNativeDriver = { edges: [], next: 0, captures: [], paused: true, target: undefined, pads: PARTICIPANT_SLOTS.map(() => neutralPad()) };
    publish(s);
    return;
  }
  if (command === "capture") { driver.paused = true; driver.target = undefined; saveFrame(s); finishInputTrace(s.trace); publish(s); return; }
  if (command === "pause") { driver.paused = true; driver.target = undefined; publish(s); return; }
  if (command === "resume" || command.startsWith("resume ") || command.startsWith("step ")) {
    if (s.session.paused) { s.session.paused = false; pauseMatchPresentation(s, false); }
    const stepping = command.startsWith("step ");
    const count = command === "resume" ? undefined : whole(command.substring(command.indexOf(" ") + 1));
    driver.target = count === undefined ? undefined : stepping ? s.runtime.simulationFrame + count : count;
    if (driver.target !== undefined && driver.target < s.runtime.simulationFrame) throw new Error("native driver: target frame is behind this match");
    driver.paused = driver.target === s.runtime.simulationFrame;
    publish(s);
    return;
  }
  const script = parseScript(text);
  applyDeveloperCommand(s, 0, "-dev reset");
  applyDeveloperCommand(s, 0, script.setup);
  if (s.game.phase !== Phase.match || s.runtime.simulationFrame !== 0) throw new Error("native driver: pad setup did not start a new match");
  globalThis.__smashcraftNativeDriver = { edges: script.edges, next: 0, captures: [], paused: true, target: undefined, pads: PARTICIPANT_SLOTS.map(() => neutralPad()) };
  startInputTrace(s);
  publish(s);
}

/** Polling continues while the entire map callback is held. */
export function beforeNativeDriverTick(s: ShellState): boolean {
  if (s.build.inputProfile !== "native-driver") return true;
  serviceNativeDriver();
  const driver = state();
  return !driver.paused;
}

/** Bindings are applied before scripted rows enter the existing capture. */
export function captureNativeDriverInputs(s: ShellState): void {
  if (s.build.inputProfile !== "native-driver") return;
  const driver = state();
  const frame = s.runtime.simulationFrame + 1;
  while (driver.next < driver.edges.length) {
    const edge = driver.edges[driver.next];
    if (edge === undefined || edge.frame > frame) break;
    const pad = driver.pads[edge.slot];
    if (edge.action === "capture") driver.captures.push(edge.slot);
    else if (pad !== undefined) applyEdge(s, pad, edge);
    driver.next++;
  }
  for (const slot of PARTICIPANT_SLOTS) {
    const pad = driver.pads[slot];
    if (pad === undefined) continue;
    padSample(pad);
    copyInput(s.participants[slot].capture.row, pad.capture.row);
    commitEdges(pad.capture);
  }
}

export function afterNativeDriverTick(s: ShellState): void {
  if (s.build.inputProfile !== "native-driver") return;
  const driver = state();
  for (const slot of PARTICIPANT_SLOTS) {
    const pad = driver.pads[slot];
    if (pad !== undefined && pad.viewSince !== undefined && !pad.viewSaved && s.runtime.simulationFrame - pad.viewSince >= 60) {
      pad.viewSaved = true;
      driver.captures.push(slot);
    }
  }
  if (driver.captures.includes(localSlot())) saveFrame(s);
  driver.captures = [];
  if (driver.target !== undefined && s.runtime.simulationFrame >= driver.target || s.game.phase !== Phase.match || s.session.paused) {
    driver.paused = true;
    driver.target = undefined;
    saveFrame(s);
    publish(s);
  }
}
export function installSmashcraftNativeDriver(): void { installNativeDriver(nativeDriverCommand); }
export function startSmashcraftNativeDriver(): void { state(); startNativeDriver([0, 1]); }
