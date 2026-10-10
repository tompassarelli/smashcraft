import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { emptyInput } from "../../input/inputRow";
import { encodePacket, inputPacket } from "../../input/wire";
import { JournalInputSource } from "./source";
import { type Inspection, JournalTextStream, TEXT_WINDOW, textEnvelope } from "./text";

const envelope = (epoch: number, sequence: number, payload: string) => assertDefined(textEnvelope(epoch, sequence, payload), "envelope");
const numbered = (sequence: number) => `I42${sequence}100`;
const widthOf = (inspection: Inspection) => (inspection.kind === "wait" ? undefined : inspection.width);

test("a focus gap replays without retagging frames or applying a record twice [k1 scenario]", () => {
  const stream = new JournalTextStream(1);
  const journal = assertDefined(JournalInputSource.open("focus", 1, 0, 0));
  const neutral = emptyInput();
  const pairAt = (frame: number) => encodePacket(assertDefined(inputPacket(1, frame, [neutral, neutral])));
  const admit = (expectedFrame: number) => {
    const read = journal.read(assertDefined(stream.next()), 100);
    assertEquals(read.kind === "ready" ? read.packet.firstFrame : undefined, expectedFrame);
    assertTrue(journal.sent());
    assertTrue(stream.consume());
  };
  for (let sequence = 1; sequence <= 23; sequence++) {
    assertEquals(stream.inspect(envelope(1, sequence, pairAt(sequence * 2 - 1))).kind, "ready");
    admit(sequence * 2 - 1);
  }
  assertEquals(journal.expectedFrame(), 47);
  const recoveredSuffix = pairAt(57);
  assertEquals(stream.inspect(envelope(1, 29, recoveredSuffix)).kind, "ready");
  assertEquals(stream.acknowledged(), 23);
  assertEquals(stream.received(), 23);
  assertEquals(stream.next(), undefined);
  assertEquals(journal.expectedFrame(), 47);
  for (let sequence = 24; sequence <= 28; sequence++) {
    const record = envelope(1, sequence, pairAt(sequence * 2 - 1));
    assertEquals(stream.inspect(record).kind, "ready");
    admit(sequence * 2 - 1);
    assertEquals(stream.inspect(record).kind, "skip");
  }
  assertEquals(stream.received(), 29);
  assertEquals(stream.next(), recoveredSuffix);
  admit(57);
  assertEquals(stream.inspect(envelope(1, 30, pairAt(59))).kind, "ready");
  admit(59);
  assertEquals(journal.expectedFrame(), 61);
  assertEquals(stream.acknowledged(), 30);
});
