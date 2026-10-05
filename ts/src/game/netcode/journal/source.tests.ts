import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "../../../runtime/testing";
import { Action, bit } from "../../input/actions";
import { type InputRow, type RowFields, inputRow, sameInput } from "../../input/inputRow";
import { type InputPacket, encodePacket, inputPacket } from "../../input/wire";
import { type JournalRead, JournalInputSource } from "./source";

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
