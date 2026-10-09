



import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { ALL_ACTIONS, Action, bit, has } from "../../input/actions";
import { type InputRow, inputRow } from "../../input/inputRow";
import { encodePacket, inputPacket } from "../../input/wire";

export const VOCABULARY_PROBE_EPOCH = 36;
export const VOCABULARY_PROBE_SAMPLES = 300;

function vocabularyProbeRows(arm: number): 1 | 2 {
  return arm < 3 ? 2 : 1;
}

function vocabularyProbeFrame(arm: number, sequence: number): number {
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

function vocabularyProbeRow(sender: number, frame: number): InputRow | undefined {
  const held = heldAt(sender, frame);
  const previous = heldAt(sender, frame - 1);

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
