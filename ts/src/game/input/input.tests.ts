import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { ALL_ACTIONS, Action, bit } from "./actions";
import { type InputRow, type RowFields, emptyInput, inputRow, predictInto, sameInput } from "./inputRow";
import { INPUT_LAST_FRAME, decodePacket, encodePacket, inputPacket } from "./wire";

const describe = (fields: RowFields) => Object.entries(fields).map(([key, value]) => `${key}=${String(value)}`).join(" ");
const row = (fields: RowFields = {}) => assertDefined(inputRow(fields), `row ${describe(fields)}`);


const fullRow = (overrides: RowFields = {}) =>
  row({
    held: ALL_ACTIONS, pressed: ALL_ACTIONS, released: ALL_ACTIONS, axisX: -127, axisZ: 127, triggerLeft: 255, triggerRight: 255,
    specialX: -1, specialZ: -1, dodgeX: 1, dodgeZ: 0, sdi: true, sdiX: 1, sdiZ: -1, ledgeVertical: 1, throwX: -127, throwZ: 127,
    ...overrides,
  });

function roundtrip(epoch: number, firstFrame: number, rows: InputRow[]): string {
  const wire = encodePacket(assertDefined(inputPacket(epoch, firstFrame, rows), "packet"));
  const decoded = assertDefined(decodePacket(wire), `decoded ${wire}`);
  assertEquals(decoded.epoch, epoch);
  assertEquals(decoded.firstFrame, firstFrame);
  assertEquals(decoded.rows.length, rows.length);
  rows.forEach((sent, i) => assertTrue(sameInput(decoded.rows[i]!, sent)));
  assertEquals(encodePacket(decoded), wire);
  return wire;
}

const reject = (wire: string) => assertEquals(decodePacket(wire), undefined, wire);

test("rows reject what a controller cannot send [spec docs/netcode-proposal.md]", () => {
  assertDefined(inputRow({ held: ALL_ACTIONS, pressed: ALL_ACTIONS, released: ALL_ACTIONS, axisX: -127, axisZ: 127, triggerLeft: 255, triggerRight: 0 }));
  const invalid: RowFields[] = [
    { held: ALL_ACTIONS + 1 }, { pressed: -1 }, { released: ALL_ACTIONS + 1 }, { axisX: -128 }, { axisZ: 128 }, { triggerLeft: -1 }, { triggerRight: 256 },
    { specialX: 1 },
    { pressed: bit(Action.special), specialZ: 2 },
    { dodgeX: 1 },
    { sdi: true },
    { sdiX: 1 },
    { ledgeVertical: 1 },
    { throwX: 128 },
    { throwZ: -128 },
  ];
  for (const fields of invalid) assertEquals(inputRow(fields), undefined, describe(fields));
});

test("prediction continues holds, stick and triggers but never repeats edges or press data [spec docs/netcode-proposal.md]", () => {
  const source = fullRow({ held: 32, pressed: bit(Action.attack) | bit(Action.special) | bit(Action.leftTrigger) | bit(Action.moveUp), released: 16, axisX: 93, axisZ: -71, triggerLeft: 124 });
  const predicted = emptyInput();
  predictInto(predicted, source);
  const expected = row({ held: 32, axisX: 93, axisZ: -71, triggerLeft: 124, triggerRight: 255 });
  assertTrue(sameInput(predicted, expected));
  assertEquals(source.pressed, bit(Action.attack) | bit(Action.special) | bit(Action.leftTrigger) | bit(Action.moveUp));
  predictInto(predicted, predicted);
  assertTrue(sameInput(predicted, expected));
});

test("packets roundtrip every field at its extremes and every analog value and direction combination [invariant]", () => {
  roundtrip(7, 1, [fullRow()]);
  roundtrip(2147483647, INPUT_LAST_FRAME - 1, [fullRow(), fullRow()]);

  assertEquals(decodePacket(roundtrip(7, 1, [row({ pressed: bit(Action.moveRight), throwX: 0 })]))?.rows[0]?.throwX, 0);
  for (let value = -127; value <= 127; value++) {
    roundtrip(7, 1, [fullRow({ axisX: value, axisZ: -value, triggerLeft: value + 127, triggerRight: 127 - value, throwX: -value, throwZ: value })]);
  }
  for (const x of [-1, 0, 1]) {
    for (const z of [-1, 0, 1]) {
      roundtrip(7, 1, [fullRow({ held: 0, axisX: 0, axisZ: 0, triggerLeft: 0, specialX: x, specialZ: z, dodgeX: z, dodgeZ: x, sdi: x !== 0 || z !== 0, sdiX: x, sdiZ: z, ledgeVertical: z })]);
    }
  }
});

test("decoding rejects truncation, trailing text, unknown characters and bad headers [invariant]", () => {
  const wire = encodePacket(assertDefined(inputPacket(0, 1, [fullRow(), fullRow()])));
  for (let length = 0; length < wire.length; length++) reject(wire.slice(0, length));
  reject(`${wire}0`);
  for (let offset = 0; offset < wire.length; offset++) reject(`${wire.slice(0, offset)}!${wire.slice(offset + 1)}`);
  reject(`I3${wire.slice(2)}`);
  reject(`I40${wire.slice(3)}`);
  reject(`I43${wire.slice(3)}`);
  for (const malformed of ["I41W010", "I41______210", "I41_______10", "I41000", "I410______10", "I41!10"]) reject(malformed);
  assertDefined(decodePacket(wire));
});

test("packets bound epochs, frames and row counts [spec docs/netcode-proposal.md]", () => {
  const input = emptyInput();
  for (const [epoch, firstFrame, rows] of [[-1, 1, 1], [0, 0, 1], [0, 1, 0], [0, 1, 3], [0, INPUT_LAST_FRAME, 2]] as const) {
    assertEquals(inputPacket(epoch, firstFrame, Array.from({ length: rows }, () => input)), undefined);
  }
  const wire = roundtrip(2147483647, INPUT_LAST_FRAME - 1, [input, input]);
  reject(`${wire.slice(0, 10)}-_____1${wire.slice(17)}`);
  roundtrip(2147483647, INPUT_LAST_FRAME, [input]);
  assertFalse(decodePacket(wire) === undefined);
});
