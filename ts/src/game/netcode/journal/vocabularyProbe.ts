// The deterministic input corpus of the native vocabulary-ingress probe. The
// helper publishes these packets as fixture files and the probe compares every
// received packet with vocabularyProbePacket's text, so each row is part of
// that contract.
import { floorDiv, floorMod } from "waygate/src/sim/intMath";
import { ALL_ACTIONS, Action, bit, has } from "../../input/actions";
import { type InputRow, inputRow } from "../../input/inputRow";
import { encodePacket, inputPacket } from "../../input/wire";

export const VOCABULARY_PROBE_EPOCH = 36;
export const VOCABULARY_PROBE_SAMPLES = 300;

/** Arms 0 to 2 offer two-row packets at 30 Hz, arms 3 to 5 one-row packets at 60 Hz. */
export function vocabularyProbeRate(arm: number): number {
  return arm < 3 ? 30 : 60;
}

export function vocabularyProbeRows(arm: number): 1 | 2 {
  return arm < 3 ? 2 : 1;
}

export function vocabularyProbeFrame(arm: number, sequence: number): number {
  return sequence * vocabularyProbeRows(arm) + 1;
}

function heldAt(sender: number, frame: number): number {
  if (frame < 1) return 0;
  let held = bit(floorMod(floorDiv(frame, 45) + sender, 2) === 0 ? Action.moveRight : Action.moveLeft);
  if (floorMod(frame, 24) < 8) held |= bit(Action.leftTrigger);
  if (floorMod(frame, 19) === 0) held |= bit(Action.attack);
  if (floorMod(frame, 31) === 0) held |= bit(Action.special);
  return held;
}

export function vocabularyProbeRow(sender: number, frame: number): InputRow | undefined {
  const held = heldAt(sender, frame);
  const previous = heldAt(sender, frame - 1);
  // A completed short jump tap keeps both edges with no held bit.
  const jumpTap = floorMod(frame, 37) === 0 ? bit(Action.jump) : 0;
  const pressed = (held & (ALL_ACTIONS ^ previous)) | jumpTap;
  const sdi = floorMod(frame, 23) === 0;
  return inputRow({
    held,
    pressed,
    released: (previous & (ALL_ACTIONS ^ held)) | jumpTap,
    axisX: floorMod(frame * 7 + sender * 29, 255) - 127,
    axisZ: floorMod(frame * 11 + sender * 13, 255) - 127,
    triggerLeft: floorMod(frame, 24) < 8 ? floorMod(frame * 17, 256) : 0,
    triggerRight: floorMod(frame * 5, 256),
    specialX: has(pressed, Action.special) ? 1 : 0,
    dodgeX: has(pressed, Action.leftTrigger) ? -1 : 0,
    sdi,
    sdiX: sdi ? 1 : 0,
  });
}

/** The packet text for one sender's sample of an arm. */
export function vocabularyProbePacket(sender: number, arm: number, sequence: number): string | undefined {
  const frame = vocabularyProbeFrame(arm, sequence);
  const rows: InputRow[] = [];
  for (let offset = 0; offset < vocabularyProbeRows(arm); offset++) {
    const row = vocabularyProbeRow(sender, frame + offset);
    if (row === undefined) return undefined;
    rows.push(row);
  }
  const packet = inputPacket(VOCABULARY_PROBE_EPOCH, frame, rows);
  return packet === undefined ? undefined : encodePacket(packet);
}
