import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Action, bit } from "../../input/actions";
import { type InputRow, type RowFields, inputRow, sameInput } from "../../input/inputRow";
import { type InputPacket, encodeInputMessage, encodePacket, inputPacket } from "../../input/wire";
import { type JournalRead, JournalInputSource, RECORD_PACKETS } from "./source";

const row = (fields: RowFields = {}) => assertDefined(inputRow(fields), "row");
const wire = (epoch: number, firstFrame: number, ...rows: InputRow[]) => encodePacket(assertDefined(inputPacket(epoch, firstFrame, rows), "packet"));
const NEUTRAL = row();
const PRESS = row({ held: bit(Action.attack), pressed: bit(Action.attack) });
const RELEASE = row({ released: bit(Action.attack) });

const open = (build: string, epoch: number, slot: number, delay: number) => assertDefined(JournalInputSource.open(build, epoch, slot, delay), "journal");

const ready = (read: JournalRead): InputPacket => assertDefined(read.kind === "ready" ? read.packet : undefined, `ready packet, not ${read.kind},`);

test("a packet is admitted at its original frame, and the cursor moves only when it is sent", () => {
  const source = open("candidate", 91, 2, 3);
  assertEquals(source.expectedFrame(), 4);
  assertEquals(source.packetBase(), "smashcraft-journal-candidate-e91-s2-n4");
  const shield = row({ held: bit(Action.leftTrigger), pressed: bit(Action.leftTrigger), triggerLeft: 255 });
  const single = wire(91, 4, shield);
  assertEquals(source.read(single, 3).kind, "wait");
  assertEquals(source.sequenceNumber(), 1);
  assertTrue(sameInput(ready(source.read(single, 4)).rows[0]!, shield));
  assertTrue(source.sent());
  assertEquals(source.sequenceNumber(), 2);
  assertEquals(source.expectedFrame(), 5);
  assertEquals(source.packetBase(), "smashcraft-journal-candidate-e91-s2-n5");
  assertEquals(source.read(single, 5).kind, "invalid");
  assertEquals(source.sequenceNumber(), 2);
});

test("packets from another epoch, out of sequence or malformed are invalid", () => {
  const source = open("candidate", 92, 0, 0);
  assertEquals(source.read(wire(93, 1, NEUTRAL), 64).kind, "invalid");
  assertEquals(source.read(wire(92, 2, NEUTRAL), 64).kind, "invalid");
  assertEquals(source.read("I4 malformed", 64).kind, "invalid");
  assertEquals(source.read("", 64).kind, "wait");
  assertEquals(source.sequenceNumber(), 1);
});

test("pause control waits for the exact sequenced acknowledgment", () => {
  const source = open("candidate", 95, 0, 0);
  assertEquals(source.controlSequenceNumber(), 1);
  assertEquals(source.controlAckBase(), "smashcraft-journal-ack-candidate-e95-s0-n1");
  assertEquals(source.acceptControlAck("ACK1|2|PREPARE|12", "PREPARE"), undefined);
  assertEquals(source.controlSequenceNumber(), 1);
  assertEquals(source.acceptControlAck("ACK1|1|RESUME|12", "PREPARE"), undefined);
  assertEquals(source.controlSequenceNumber(), 1);
  assertEquals(source.acceptControlAck("ACK1|1|PREPARE|12", "PREPARE"), 12);
  assertEquals(source.controlSequenceNumber(), 2);
  assertEquals(source.acceptControlAck("ACK1|2|PAUSE|12", "PAUSE"), 12);
  assertEquals(source.controlSequenceNumber(), 3);
  assertEquals(source.acceptControlAck("ACK1|3|RESUME|12", "RESUME"), 12);
});

test("a two-row packet waits until both rows are admissible and advances by two", () => {
  const source = open("candidate", 94, 1, 3);
  const pair = wire(94, 4, PRESS, RELEASE);
  assertEquals(source.read(pair, 4).kind, "wait");
  assertEquals(source.bufferedPacket(), pair);
  assertFalse(source.sent());
  assertEquals(source.sequenceNumber(), 1);
  const packet = ready(source.read(pair, 5));
  assertEquals(packet.rows.length, 2);
  assertTrue(sameInput(packet.rows[0]!, PRESS));
  assertTrue(sameInput(packet.rows[1]!, RELEASE));
  // Reading again before a successful send keeps the cursor and the rows.
  assertEquals(source.read(pair, 5).kind, "ready");
  assertEquals(source.sequenceNumber(), 1);
  assertTrue(source.sent());
  assertEquals(source.bufferedPacket(), undefined);
  assertEquals(source.sequenceNumber(), 3);
  assertEquals(source.expectedFrame(), 6);
  assertEquals(source.packetBase(), "smashcraft-journal-candidate-e94-s1-n6");
  assertEquals(source.read(pair, 64).kind, "invalid");
  assertEquals(source.read(wire(94, 7, PRESS, RELEASE), 6).kind, "invalid");
  assertEquals(source.bufferedPacket(), undefined);
});

test("a deferred packet stays buffered, without another read, until it is admitted", () => {
  const source = open("deferred", 96, 0, 0);
  const pair = wire(96, 1, PRESS, RELEASE);
  assertEquals(source.read(pair, 1).kind, "wait");
  for (let attempt = 1; attempt <= 3; attempt++) {
    const buffered = assertDefined(source.bufferedPacket());
    assertEquals(buffered, pair);
    assertEquals(source.read(buffered, 1).kind, "wait");
    assertFalse(source.sent());
  }
  const packet = ready(source.read(assertDefined(source.bufferedPacket()), 2));
  assertTrue(sameInput(packet.rows[0]!, PRESS));
  assertTrue(sameInput(packet.rows[1]!, RELEASE));
  assertTrue(source.sent());
  assertEquals(source.bufferedPacket(), undefined);
  assertEquals(source.expectedFrame(), 3);
  assertEquals(source.read(wire(96, 3, PRESS, RELEASE), 3).kind, "wait");
});

test("a record joining consecutive packets is admitted whole at their frames; a gap, another epoch or too many packets is invalid", () => {
  const source = open("candidate", 96, 0, 0);
  const joined = [wire(96, 1, PRESS, RELEASE), wire(96, 3, NEUTRAL, NEUTRAL), wire(96, 5, PRESS)].join("|");
  assertEquals(source.read(joined, 4).kind, "wait");
  const packet = ready(source.read(joined, 5));
  assertEquals(packet.firstFrame, 1);
  assertEquals(packet.rows.length, 5);
  assertTrue(sameInput(packet.rows[0]!, PRESS) && sameInput(packet.rows[1]!, RELEASE) && sameInput(packet.rows[4]!, PRESS));
  assertTrue(source.sent());
  assertEquals(source.expectedFrame(), 6);
  assertEquals(source.read([wire(96, 6, NEUTRAL), wire(96, 8, NEUTRAL)].join("|"), 64).kind, "invalid");
  assertEquals(source.read([wire(96, 6, NEUTRAL), wire(97, 7, NEUTRAL)].join("|"), 64).kind, "invalid");
  const many = Array.from({ length: RECORD_PACKETS + 1 }, (_, index) => wire(96, 6 + index, NEUTRAL)).join("|");
  assertEquals(source.read(many, 64).kind, "invalid");
  assertEquals(source.read(Array.from({ length: RECORD_PACKETS }, (_, index) => wire(96, 6 + index, NEUTRAL)).join("|"), 64).kind, "ready");
});

test("a joined record admitted in parts is read again from its first row not yet sent", () => {
  const source = open("candidate", 97, 0, 0);
  const joined = [wire(97, 1, PRESS, RELEASE), wire(97, 3, NEUTRAL, PRESS), wire(97, 5, RELEASE)].join("|");
  assertEquals(ready(source.read(joined, 64)).rows.length, 5);
  assertFalse(source.sent(6));
  assertTrue(source.sent(3));
  assertEquals(source.expectedFrame(), 4);
  assertEquals(source.bufferedPacket(), joined);
  const rest = ready(source.read(joined, 64));
  assertEquals(rest.firstFrame, 4);
  assertEquals(rest.rows.length, 2);
  assertTrue(sameInput(rest.rows[0]!, PRESS) && sameInput(rest.rows[1]!, RELEASE));
  assertTrue(source.sent());
  assertEquals(source.bufferedPacket(), undefined);
  assertEquals(ready(source.read(wire(97, 6, NEUTRAL), 64)).firstFrame, 6);
});

test("an I5 backlog preserves 64 original frames and tap edges across admission budget splits", () => {
  const source = open("candidate", 98, 0, 3);
  const tap = row({ pressed: bit(Action.attack) | bit(Action.special), released: bit(Action.attack) | bit(Action.special), specialX: -1, throwX: 2 });
  const held = row({ held: bit(Action.moveRight), axisX: 127, triggerLeft: 128 });
  const release = row({ released: bit(Action.moveRight) });
  const rows = Array.from({ length: 64 }, () => NEUTRAL);
  rows[0] = tap;
  rows[20] = held;
  for (let index = 21; index < 40; index++) rows[index] = held;
  rows[40] = release;
  rows[63] = tap;
  const message = encodeInputMessage(98, 4, 67, frame => assertDefined(rows[frame - 4]));
  assertEquals(message.lastFrame, 67);
  assertEquals(source.read(message.wire, 66).kind, "wait");
  assertEquals(source.bufferedPacket(), message.wire);
  let sent = 0;
  while (sent < rows.length) {
    const packet = ready(source.read(assertDefined(source.bufferedPacket()), 67));
    assertEquals(packet.firstFrame, 4 + sent);
    assertEquals(packet.rows.length, rows.length - sent);
    for (let index = 0; index < packet.rows.length; index++) assertTrue(sameInput(assertDefined(packet.rows[index]), assertDefined(rows[sent + index])));
    const count = Math.min(6, packet.rows.length);
    assertTrue(source.sent(count));
    sent += count;
    assertEquals(source.expectedFrame(), 4 + sent);
  }
  assertEquals(source.bufferedPacket(), undefined);
  assertEquals(source.sequenceNumber(), 65);
  assertEquals(source.read(message.wire, 67).kind, "invalid");
});

test("an I5 backlog rejects another epoch, a skipped frame and malformed text", () => {
  const source = open("candidate", 99, 0, 0);
  assertEquals(source.read(encodeInputMessage(100, 1, 3, () => NEUTRAL).wire, 64).kind, "invalid");
  assertEquals(source.read(encodeInputMessage(99, 2, 4, () => NEUTRAL).wire, 64).kind, "invalid");
  assertEquals(source.read("I5 malformed", 64).kind, "invalid");
  assertEquals(source.expectedFrame(), 1);
});
