import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "waygate/src/runtime/testing";
import { Action, bit } from "../../input/actions";
import { type InputRow, type RowFields, inputRow, sameInput } from "../../input/inputRow";
import { encodePacket, inputPacket } from "../../input/wire";
import { JournalInputSource } from "./source";
import { TransportBatch, decodeTransport } from "./transport";

const row = (fields: RowFields = {}) => assertDefined(inputRow(fields), "row");
const wire = (epoch: number, firstFrame: number, ...rows: InputRow[]) => encodePacket(assertDefined(inputPacket(epoch, firstFrame, rows), "packet"));
const NEUTRAL = row();
const PRESS = row({ held: bit(Action.attack), pressed: bit(Action.attack) });
const RELEASE = row({ released: bit(Action.attack) });

test("a paired message keeps every original edge and frame", () => {
  const source = assertDefined(JournalInputSource.open("batch", 7, 0, 0));
  const batch = new TransportBatch();
  const first = wire(7, 1, PRESS, RELEASE);
  const read = source.read(first, 64);
  assertTrue(read.kind === "ready" && sameInput(read.packet.rows[0]!, PRESS));
  assertTrue(batch.append(first));
  assertTrue(source.sent());
  assertEquals(source.expectedFrame(), 3);
  assertEquals(batch.ready(false), undefined);
  batch.tick();
  assertEquals(batch.ready(false), undefined);
  const second = wire(7, 3, PRESS, RELEASE);
  assertEquals(source.read(second, 64).kind, "ready");
  assertTrue(batch.append(second));
  assertTrue(source.sent());
  const message = assertDefined(batch.ready(false));
  assertEquals(message.rows, 4);
  assertEquals(message.firstFrame, 1);
  const packets = assertDefined(decodeTransport(message.wire));
  assertEquals(packets.length, 2);
  packets.forEach((packet, index) => {
    assertEquals(encodePacket(packet), index === 0 ? first : second);
    assertEquals(packet.epoch, 7);
    assertEquals(packet.firstFrame, 1 + 2 * index);
    assertTrue(sameInput(packet.rows[0]!, PRESS));
    assertTrue(sameInput(packet.rows[1]!, RELEASE));
  });
});

test("a lone packet goes after two callbacks, or at once when flushed for a pause or the end", () => {
  const batch = new TransportBatch();
  const lone = wire(8, 40, NEUTRAL);
  assertTrue(batch.append(lone));
  assertEquals(batch.ready(false), undefined);
  assertTrue(batch.ready(true) !== undefined);
  batch.tick();
  assertEquals(batch.ready(false), undefined);
  batch.tick();
  assertEquals(batch.ready(false)?.wire, lone);
  batch.clear();
  assertEquals(batch.ready(true), undefined);
});

test("a discontinuous or partial second packet is refused before delivery", () => {
  const first = wire(9, 1, NEUTRAL, NEUTRAL);
  const gap = wire(9, 4, NEUTRAL, NEUTRAL);
  const otherEpoch = wire(10, 3, NEUTRAL, NEUTRAL);
  assertEquals(decodeTransport(`B4${first}|${gap}`), undefined);
  assertEquals(decodeTransport(`B4${first}|`), undefined);
  assertEquals(decodeTransport(`B4${first}|${otherEpoch}`), undefined);
  const batch = new TransportBatch();
  assertTrue(batch.append(first));
  assertFalse(batch.append(gap));
  assertFalse(batch.append(otherEpoch));
});
