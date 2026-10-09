// Test fixtures only: controllers played through the real input path. Each
// pad state becomes a row as the companion helper builds it
// (controller/src/main.rs), read as a journal packet, carried in the
// synchronized input message and adapted by the match frame executor.
import { assertDefined, assertTrue } from "wisp/src/runtime/testing";
import { Action, bit, has } from "../input/actions";
import { type InputRow, copyInput, inputRow } from "../input/inputRow";
import { participantInputs } from "../input/participants";
import { decodeInputMessage, encodeInputMessage, encodePacket, inputPacket } from "../input/wire";
import { JournalInputSource } from "../netcode/journal/source";
import { captureNetworkFrame, executeMatchFrame } from "./frameInput";
import type { TestMatch } from "./testMatch";

const EPOCH = 3;
const RAW = 32767;

const STICK_DIGITAL = 7000;
const C_STICK_DIGITAL = 11000;
const TRIGGER_DIGITAL = 4000;
const SHIELDS = bit(Action.leftTrigger) | bit(Action.rightTrigger);


export interface Pad {
  readonly x?: number;
  readonly y?: number;
  readonly cx?: number;
  readonly cy?: number;
  readonly attack?: boolean;
  readonly special?: boolean;
  readonly jump?: boolean;
  readonly trigger?: boolean;
  readonly rightTrigger?: boolean;
  readonly tilt?: boolean;
  readonly shortHop?: boolean;
  readonly meter?: boolean;
  readonly rightStickTilts?: boolean;
}

const raw = (value: number | undefined) => Math.trunc((value ?? 0) * RAW);
const axisByte = (rawValue: number) => Math.max(-127, Math.min(127, Math.trunc((rawValue * 127) / RAW)));
const signOf = (value: number) => (value < 0 ? -1 : value > 0 ? 1 : 0);
const beyond = (rawValue: number) => (Math.abs(rawValue) > STICK_DIGITAL ? signOf(rawValue) : 0);


function heldActions(pad: Pad): number {
  const x = raw(pad.x);
  const up = raw(pad.y);
  let held = 0;
  if (pad.attack === true) held |= bit(Action.attack);
  if (pad.special === true) held |= bit(Action.special);
  if (pad.jump === true) held |= bit(Action.jump);
  if (pad.tilt === true) held |= bit(Action.walk);
  if (pad.shortHop === true) held |= bit(Action.shortHop);
  if (pad.meter === true) held |= bit(Action.meter);
  if (x < -STICK_DIGITAL) held |= bit(Action.moveLeft);
  if (x > STICK_DIGITAL) held |= bit(Action.moveRight);
  if (up < -STICK_DIGITAL) held |= bit(Action.moveDown);
  if (up > STICK_DIGITAL) held |= bit(Action.moveUp) | bit(Action.jump);
  if (raw(pad.cx) > C_STICK_DIGITAL) held |= bit(Action.smashRight);
  if (raw(pad.cx) < -C_STICK_DIGITAL) held |= bit(Action.smashLeft);
  if (raw(pad.cy) > C_STICK_DIGITAL) held |= bit(Action.smashUp);
  if (raw(pad.cy) < -C_STICK_DIGITAL) held |= bit(Action.smashDown);
  if (pad.rightStickTilts === true && Math.max(Math.abs(raw(pad.cx)), Math.abs(raw(pad.cy))) > C_STICK_DIGITAL) held |= bit(Action.walk);
  if (pad.trigger === true && RAW > TRIGGER_DIGITAL) held |= bit(Action.leftTrigger);
  if (pad.rightTrigger === true && RAW > TRIGGER_DIGITAL) held |= bit(Action.rightTrigger);
  return held;
}


function helperRow(previous: Pad, pad: Pad): InputRow {
  const before = heldActions(previous);
  const held = heldActions(pad);
  const pressed = held & ~before;
  const x = raw(pad.x);
  const up = raw(pad.y);
  const axis = (mask: number, negative: Action, positive: Action) => (has(mask, positive) ? 1 : 0) - (has(mask, negative) ? 1 : 0);
  const afterX = axis(held, Action.moveLeft, Action.moveRight);
  const afterZ = axis(held, Action.moveDown, Action.moveUp);
  const sdi = (afterX !== 0 && afterX !== axis(before, Action.moveLeft, Action.moveRight)) || (afterZ !== 0 && afterZ !== axis(before, Action.moveDown, Action.moveUp));
  return assertDefined(inputRow({
    held, pressed, released: before & ~held,
    axisX: axisByte(x), axisZ: axisByte(up),
    triggerLeft: pad.trigger === true ? 255 : 0,
    triggerRight: pad.rightTrigger === true ? 255 : 0,
    specialX: has(pressed, Action.special) ? beyond(x) : 0,
    specialZ: has(pressed, Action.special) ? beyond(up) : 0,
    dodgeX: (pressed & SHIELDS) !== 0 ? beyond(x) : 0,
    dodgeZ: (pressed & SHIELDS) !== 0 ? beyond(up) : 0,
    ledgeVertical: has(pressed, Action.moveUp) ? 1 : has(pressed, Action.moveDown) ? -1 : 0,
    sdi, sdiX: sdi ? afterX : 0, sdiZ: sdi ? afterZ : 0,
  }), "helper row");
}


export interface PadMatch {
  readonly match: TestMatch;
  readonly journals: readonly [JournalInputSource, JournalInputSource];
  readonly previous: [Pad, Pad];
}

export function padMatch(match: TestMatch, build: string): PadMatch {
  const journal = (slot: number) => assertDefined(JournalInputSource.open(build, EPOCH, slot, 0), "journal");
  return { match, journals: [journal(0), journal(1)], previous: [{}, {}] };
}


export function playPads(run: PadMatch, first: Pad, second: Pad): void {
  const { match } = run;
  const frame = match.runtime.simulationFrame + 1;
  const rows = participantInputs();
  const pads = [first, second] as const;
  for (const slot of [0, 1] as const) {
    const row = helperRow(run.previous[slot], pads[slot]);
    run.previous[slot] = pads[slot];
    const journal = run.journals[slot];
    const read = journal.read(encodePacket(assertDefined(inputPacket(EPOCH, frame, [row]), "packet")), frame);
    assertTrue(read.kind === "ready");
    const journaled = read.kind === "ready" ? read.packet.rows[0] : undefined;
    assertTrue(journal.sent());
    const message = encodeInputMessage(EPOCH, frame, frame, () => assertDefined(journaled, "journaled row"));
    const delivered = assertDefined(decodeInputMessage(message.wire), "message")[0]?.rows[0];
    copyInput(rows[slot], assertDefined(delivered, "delivered row"));
  }
  assertTrue(captureNetworkFrame(match.row, frame, rows, match.world, 3));
  assertTrue(executeMatchFrame(match.row, match.game, match.world, match.inputs, match.runtime, frame));
}
