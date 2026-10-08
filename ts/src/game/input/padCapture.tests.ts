import { assertDefined, assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { floorDiv } from "wisp/src/sim/intMath";
import { type InputRow, inputRow, sameInput } from "./inputRow";
import { decodePacket, encodePacket, inputPacket } from "./wire";
import { keyboardCapture, commitEdges } from "./keyboardCapture";
import { PAD_ACTIVE_KEY, PAD_AXIS_LEVELS, PAD_KEYS, PAD_TRIGGER_LEVELS, cursorWorldPacket, decodePad, padKeyPacket, samplePad } from "./padCapture";

test("both pad carriers decode all 4624 quantized axis and trigger combinations into valid rows [invariant]", () => {
  const calibration = { first: { x: -400.0, y: 900.0 }, last: { x: 870.0, y: -370.0 } };
  for (let x = 0; x < PAD_AXIS_LEVELS.length; x++) {
    for (let z = 0; z < PAD_AXIS_LEVELS.length; z++) {
      for (let left = 0; left < PAD_TRIGGER_LEVELS.length; left++) {
        for (let right = 0; right < PAD_TRIGGER_LEVELS.length; right++) {
          const packet = x | z << 5 | left << 10 | right << 12;
          const keys = padKeyPacket(key => key === PAD_ACTIVE_KEY || PAD_KEYS.some((carrier, index) => key === carrier && (packet & 1 << index) !== 0));
          const cursor = cursorWorldPacket(calibration, -400.0 + (packet & 127) * 10.0, 900.0 - floorDiv(packet, 128) * 10.0);
          assertEquals(keys, packet);
          assertEquals(cursor, packet);
          const values = assertDefined(decodePad(packet));
          assertEquals(values.axisX, PAD_AXIS_LEVELS[x]);
          assertEquals(values.axisZ, PAD_AXIS_LEVELS[z]);
          assertEquals(values.triggerLeft, PAD_TRIGGER_LEVELS[left]);
          assertEquals(values.triggerRight, PAD_TRIGGER_LEVELS[right]);
          assertDefined(inputRow(values));
        }
      }
    }
  }
});

/** Replays the packets of a helper's recorded session, retaining keyboard edges. */
function replayPadSession(session: readonly { readonly packed: number; readonly held: number; readonly row: InputRow }[]): void {
  const capture = keyboardCapture();
  for (let frame = 0; frame < session.length; frame++) {
    const sample = assertDefined(session[frame]);
    assertTrue(samplePad(capture, sample.held, sample.packed));
    assertTrue(sameInput(capture.row, sample.row));
    const packet = assertDefined(inputPacket(1, frame + 1, [capture.row]));
    const replay = assertDefined(decodePacket(encodePacket(packet)));
    assertTrue(sameInput(assertDefined(replay.rows[0]), sample.row));
    commitEdges(capture);
  }
}

test("the recorded SDL pad session replays all 16 exact input rows through capture and wire [native]", () => {
  // Actual helper acquisition: test/fixtures/analog204/recorded-pad-session.tsv.
  // The helper's action transitions and quantized axes supply independent rows.
  const recorded = [
    { packed: 267, row: inputRow({ held: 2, pressed: 2, axisX: 62, sdi: true, sdiX: 1 }) },
    { packed: 272, row: inputRow({ held: 2, axisX: 127 }) },
    { packed: 261, row: inputRow({ held: 1, pressed: 1, released: 2, axisX: -62, sdi: true, sdiX: -1 }) },
    { packed: 264, row: inputRow({ released: 1 }) },
    { packed: 360, row: inputRow({ held: 8, pressed: 8, axisZ: 62, sdi: true, sdiZ: 1, ledgeVertical: 1 }) },
    { packed: 520, row: inputRow({ held: 8, axisZ: 127 }) },
    { packed: 264, row: inputRow({ released: 8 }) },
    { packed: 1288, row: inputRow({ held: 32768, pressed: 32768, triggerLeft: 77 }) },
    { packed: 2312, row: inputRow({ held: 32768, triggerLeft: 166 }) },
    { packed: 3336, row: inputRow({ held: 32768, triggerLeft: 255 }) },
    { packed: 264, row: inputRow({ released: 32768 }) },
    { packed: 8456, row: inputRow({ held: 512, pressed: 512, triggerRight: 166 }) },
    { packed: 12552, row: inputRow({ held: 512, triggerRight: 255 }) },
    { packed: 264, row: inputRow({ released: 512 }) },
    { packed: 264, row: inputRow({ held: 32, pressed: 32 }) },
    { packed: 264, row: inputRow({ released: 32 }) },
  ];
  replayPadSession(recorded.map(sample => {
    const row = assertDefined(sample.row);
    return { packed: sample.packed, held: row.held, row };
  }));
});
