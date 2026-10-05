import { assertDefined, assertEquals, assertTrue, assertFalse, test } from "../../runtime/testing";
import { type InputRow, type RowFields, emptyInput, inputRow, predictInto, sameInput } from "../input/inputRow";
import { INPUT_LAST_FRAME, encodePacket, inputPacket } from "../input/wire";
import { InputLedger } from "./ledger";

const row = (fields: RowFields = {}) => assertDefined(inputRow(fields), "row");
const packet = (epoch: number, firstFrame: number, ...rows: InputRow[]) => assertDefined(inputPacket(epoch, firstFrame, rows), "packet");
const NEUTRAL = row();
const ATTACK = row({ held: 32, pressed: 32 });

test("K advances only across complete rows, and consumption follows it in order", () => {
  const ledger = new InputLedger();
  assertTrue(ledger.beginEpoch(0, 1, 0, 3));
  const later = packet(0, 2, NEUTRAL, NEUTRAL);
  assertEquals(ledger.acceptPacket(1, later), "accepted");
  assertEquals(ledger.acceptPacket(0, later), "accepted");
  assertEquals(ledger.knownThrough(), 0);
  const gap = packet(0, 1, NEUTRAL);
  assertEquals(ledger.acceptPacket(0, gap), "accepted");
  assertEquals(ledger.knownThrough(), 0);
  assertFalse(ledger.markConsumed(0, 1));
  assertEquals(ledger.acceptPacket(1, gap), "accepted");
  assertEquals(ledger.knownThrough(), 3);
  assertEquals(ledger.consumedThrough(), 0);
  assertFalse(ledger.markConsumed(0, 2));
  assertTrue(ledger.markConsumed(0, 1));
  assertFalse(ledger.markConsumed(0, 1));
  assertTrue(ledger.markConsumed(0, 2));
});

test("accepted rows never change: duplicates are accepted again, different rows conflict", () => {
  const ledger = new InputLedger();
  assertTrue(ledger.beginEpoch(1, 1, 0, 3));
  const wire = encodePacket(packet(1, 1, row({ held: 32, pressed: 32, released: 16, axisX: 1, axisZ: -1, triggerLeft: 23, triggerRight: 45 })));
  assertEquals(ledger.receive(0, wire), "accepted");
  assertEquals(ledger.receive(0, wire), "accepted");
  assertEquals(ledger.accepted(1, 0, 1)?.held, 32);
  assertEquals(ledger.acceptPacket(0, packet(1, 1, NEUTRAL)), "conflict");
  assertEquals(ledger.accepted(1, 0, 1)?.released, 16);
  const output = emptyInput();
  predictInto(output, assertDefined(ledger.accepted(1, 0, 1)));
  assertEquals(output.held, 32);
  assertEquals(output.pressed, 0);
  assertEquals(output.released, 0);
  assertEquals(output.triggerRight, 45);
  assertEquals(ledger.knownThrough(), 0);
  assertEquals(ledger.accepted(1, 1, 1), undefined);
  assertEquals(ledger.accepted(1, 0, 1)?.pressed, 32);
});

test("a packet whose second row conflicts commits neither row", () => {
  const ledger = new InputLedger();
  assertTrue(ledger.beginEpoch(1, 1, 0, 3));
  assertEquals(ledger.acceptPacket(0, packet(1, 2, ATTACK)), "accepted");
  assertEquals(ledger.acceptPacket(0, packet(1, 1, NEUTRAL, NEUTRAL)), "conflict");
  assertEquals(ledger.accepted(1, 0, 1), undefined);
  assertEquals(ledger.acceptPacket(0, packet(1, 1, NEUTRAL, ATTACK)), "accepted");
  assertEquals(ledger.acceptPacket(0, packet(1, 1, NEUTRAL, ATTACK)), "accepted");
  assertTrue(ledger.accepted(1, 0, 1) !== undefined);
  assertEquals(ledger.knownThrough(), 0);
});

test("the future bound moves with consumption, and a packet straddling it is refused whole", () => {
  const ledger = new InputLedger();
  assertTrue(ledger.beginEpoch(1, 1, 0, 3));
  assertEquals(ledger.acceptPacket(0, packet(1, 64, NEUTRAL, NEUTRAL)), "tooFarAhead");
  assertEquals(ledger.accepted(1, 0, 64), undefined);
  assertEquals(ledger.acceptPacket(0, packet(1, 64, NEUTRAL)), "accepted");
  assertEquals(ledger.knownThrough(), 0);
  for (let frame = 1; frame <= 64; frame++) {
    assertEquals(ledger.acceptPacket(0, packet(1, frame, NEUTRAL)), "accepted");
    assertEquals(ledger.acceptPacket(1, packet(1, frame, NEUTRAL)), "accepted");
  }
  assertEquals(ledger.knownThrough(), 64);
  assertEquals(ledger.acceptPacket(0, packet(1, 65, NEUTRAL)), "tooFarAhead");
  assertTrue(ledger.markConsumed(1, 1));
  assertEquals(ledger.acceptPacket(0, packet(1, 65, NEUTRAL)), "accepted");
});

test("epochs seed neutral delay rows, only increase, and refuse observers and stale packets", () => {
  const ledger = new InputLedger();
  assertFalse(ledger.beginEpoch(-1, 1, 3, 3));
  assertFalse(ledger.beginEpoch(1, 0, 3, 3));
  assertFalse(ledger.beginEpoch(1, 1, 65, 3));
  assertFalse(ledger.beginEpoch(1, 1, -1, 3));
  const neutral = packet(1, 1, NEUTRAL);
  assertEquals(ledger.acceptPacket(0, neutral), "wrongEpoch");
  assertTrue(ledger.beginEpoch(1, 1, 3, 3));
  assertEquals(ledger.knownThrough(), 3);
  assertEquals(ledger.consumedThrough(), 0);
  for (let frame = 1; frame <= 3; frame++) {
    for (let sender = 0; sender <= 1; sender++) assertTrue(sameInput(assertDefined(ledger.accepted(1, sender, frame)), NEUTRAL));
  }
  assertEquals(ledger.accepted(1, 0, 0), undefined);
  assertEquals(ledger.receive(-1, encodePacket(neutral)), "wrongSender");
  assertEquals(ledger.receive(2, encodePacket(neutral)), "wrongSender");
  assertEquals(ledger.accepted(1, 2, 1), undefined);
  assertEquals(ledger.acceptPacket(0, neutral), "accepted");
  assertEquals(ledger.acceptPacket(0, packet(1, 1, ATTACK)), "conflict");
  assertFalse(ledger.beginEpoch(1, 1, 0, 3));
  assertFalse(ledger.beginEpoch(0, 1, 0, 3));
  assertEquals(ledger.knownThrough(), 3);
  assertTrue(ledger.beginEpoch(2, 1, 0, 3));
  assertEquals(ledger.acceptPacket(0, packet(1, 1, ATTACK)), "wrongEpoch");
  assertEquals(ledger.accepted(1, 0, 1), undefined);
  assertEquals(ledger.accepted(2, 0, 1), undefined);
  assertFalse(ledger.markConsumed(1, 1));
  assertFalse(ledger.discardThrough(1, 0));
  assertEquals(ledger.knownThrough(), 0);
});

test("rows stay until explicitly discarded, and the ring is reused only after discard", () => {
  const ledger = new InputLedger();
  assertTrue(ledger.beginEpoch(1, 1, 0, 3));
  for (let frame = 1; frame <= 256; frame++) {
    assertEquals(ledger.acceptPacket(0, packet(1, frame, NEUTRAL)), "accepted");
    assertEquals(ledger.acceptPacket(1, packet(1, frame, NEUTRAL)), "accepted");
    assertTrue(ledger.markConsumed(1, frame));
  }
  assertEquals(ledger.firstRetained(), 1);
  assertTrue(ledger.accepted(1, 0, 1) !== undefined);
  const wrapped = packet(1, 257, NEUTRAL);
  assertEquals(ledger.acceptPacket(0, wrapped), "storageFull");
  assertFalse(ledger.discardThrough(1, 257));
  assertTrue(ledger.accepted(1, 0, 1) !== undefined);
  assertTrue(ledger.discardThrough(1, 1));
  assertEquals(ledger.acceptPacket(0, wrapped), "accepted");
  assertEquals(ledger.acceptPacket(1, wrapped), "accepted");
  assertEquals(ledger.knownThrough(), 257);
  assertTrue(ledger.markConsumed(1, 257));
  assertEquals(ledger.accepted(1, 0, 1), undefined);
  assertTrue(ledger.accepted(1, 0, 257) !== undefined);
  assertEquals(ledger.acceptPacket(0, packet(1, 1, NEUTRAL, NEUTRAL)), "outOfHistory");
  assertTrue(ledger.discardThrough(1, 257));
  assertEquals(ledger.firstRetained(), 258);
  assertEquals(ledger.accepted(1, 0, 257), undefined);
  assertFalse(ledger.discardThrough(1, 256));
});

test("a malformed second record commits nothing", () => {
  const ledger = new InputLedger();
  assertTrue(ledger.beginEpoch(1, 1, 0, 3));
  const wire = encodePacket(packet(1, 1, NEUTRAL, NEUTRAL));
  // The second record's held group reads 32768, one past every action.
  assertEquals(ledger.receive(0, `${wire.substring(0, wire.length - 1)}1800`), "malformed");
  assertEquals(ledger.accepted(1, 0, 1), undefined);
  assertEquals(ledger.accepted(1, 0, 2), undefined);
  assertEquals(ledger.receive(0, wire), "accepted");
  assertEquals(ledger.receive(1, wire), "accepted");
  assertEquals(ledger.knownThrough(), 2);
});

test("epoch and frame limits never wrap signed counters", () => {
  const ledger = new InputLedger();
  assertFalse(ledger.beginEpoch(0, INPUT_LAST_FRAME, 2, 3));
  assertFalse(ledger.beginEpoch(0, 2147483647, 0, 3));
  assertTrue(ledger.beginEpoch(2147483647, INPUT_LAST_FRAME - 1, 0, 3));
  const last = packet(2147483647, INPUT_LAST_FRAME - 1, NEUTRAL, NEUTRAL);
  assertEquals(ledger.acceptPacket(0, last), "accepted");
  assertEquals(ledger.acceptPacket(1, last), "accepted");
  assertEquals(ledger.knownThrough(), INPUT_LAST_FRAME);
  assertTrue(ledger.markConsumed(2147483647, INPUT_LAST_FRAME - 1));
  assertTrue(ledger.markConsumed(2147483647, INPUT_LAST_FRAME));
  assertFalse(ledger.markConsumed(2147483647, 2147483647));
  assertTrue(ledger.discardThrough(2147483647, INPUT_LAST_FRAME));
  assertEquals(ledger.firstRetained(), 2147483647);
  assertFalse(ledger.beginEpoch(-2147483647, 1, 0, 3));
  assertFalse(ledger.beginEpoch(2147483647, 1, 0, 3));
  assertEquals(ledger.acceptPacket(0, last), "outOfHistory");
});

test("four participants wait for slot three, and each sender's two-frame packets stay atomic", () => {
  const ledger = new InputLedger();
  assertTrue(ledger.beginEpoch(10, 1, 0, 15));
  const first = row({ held: 23, pressed: 17, released: 12, axisX: 127, axisZ: -81, triggerLeft: 42, triggerRight: 255, throwX: -3, throwZ: 7 });
  const second = row({ held: 31, pressed: 9, released: 4, axisX: -7, axisZ: 43, triggerLeft: 111, triggerRight: 0 });
  const wire = encodePacket(packet(10, 1, first, second));
  for (let sender = 0; sender <= 2; sender++) assertEquals(ledger.receive(sender, wire), "accepted");
  assertEquals(ledger.knownThrough(), 0);
  assertEquals(ledger.accepted(10, 3, 1), undefined);
  assertFalse(ledger.markConsumed(10, 1));
  assertEquals(ledger.acceptPacket(3, packet(10, 2, second)), "accepted");
  assertEquals(ledger.knownThrough(), 0);
  assertEquals(ledger.acceptPacket(3, packet(10, 1, first, first)), "conflict");
  assertEquals(ledger.accepted(10, 3, 1), undefined);
  assertEquals(ledger.acceptPacket(3, packet(10, 1, first, second)), "accepted");
  assertEquals(ledger.acceptPacket(3, packet(10, 1, first, second)), "accepted");
  assertEquals(ledger.knownThrough(), 2);
  assertTrue(sameInput(assertDefined(ledger.accepted(10, 3, 1)), first));
});

test("sparse membership is fixed per epoch and refuses inactive senders", () => {
  const ledger = new InputLedger();
  assertFalse(ledger.beginEpoch(1, 1, 2, 0));
  assertFalse(ledger.beginEpoch(1, 1, 2, 16));
  assertTrue(ledger.beginEpoch(1, 1, 2, 13));
  assertEquals(ledger.participantMask(), 13);
  assertEquals(ledger.knownThrough(), 2);
  assertEquals(ledger.accepted(1, 1, 1), undefined);
  assertTrue(ledger.accepted(1, 3, 1) !== undefined);
  const third = packet(1, 3, NEUTRAL);
  assertEquals(ledger.acceptPacket(1, third), "wrongSender");
  assertEquals(ledger.acceptPacket(4, third), "wrongSender");
  assertEquals(ledger.acceptPacket(3, third), "accepted");
  assertEquals(ledger.acceptPacket(0, third), "accepted");
  assertEquals(ledger.knownThrough(), 2);
  assertEquals(ledger.acceptPacket(2, third), "accepted");
  assertEquals(ledger.knownThrough(), 3);
  assertFalse(ledger.beginEpoch(2, 1, 0, -1));
  assertEquals(ledger.participantMask(), 13);
  assertTrue(ledger.beginEpoch(2, 1, 0, 8));
  assertEquals(ledger.accepted(2, 3, 1), undefined);
  const next = packet(2, 1, NEUTRAL);
  assertEquals(ledger.acceptPacket(0, next), "wrongSender");
  assertEquals(ledger.acceptPacket(3, next), "accepted");
  assertEquals(ledger.knownThrough(), 1);
});
