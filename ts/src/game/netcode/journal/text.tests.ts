import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { emptyInput } from "../../input/inputRow";
import { encodePacket, inputPacket } from "../../input/wire";
import { JournalInputSource } from "./source";
import { type Inspection, JournalTextStream, TEXT_WINDOW, textEnvelope } from "./text";

const envelope = (epoch: number, sequence: number, payload: string) => assertDefined(textEnvelope(epoch, sequence, payload), "envelope");
const numbered = (sequence: number) => `I42${sequence}100`;
const widthOf = (inspection: Inspection) => (inspection.kind === "wait" ? undefined : inspection.width);

test("the golden envelope is received once and acknowledged only when consumed [reference]", () => {
  const stream = new JournalTextStream(1);
  const golden = "@J10000000001000000000102742|I421100;";
  assertEquals(envelope(1, 1, "I421100"), golden);
  assertEquals(stream.inspect(golden).kind, "ready");
  assertEquals(stream.next(), "I421100");
  assertEquals(stream.received(), 1);
  assertEquals(stream.acknowledged(), 0);
  assertEquals(stream.inspect(golden).kind, "skip");
  assertEquals(stream.received(), 1);
  assertTrue(stream.consume());
  assertEquals(stream.acknowledged(), 1);
  assertEquals(stream.inspect(golden).kind, "skip");
  assertFalse(stream.consume());
  assertEquals(stream.acknowledged(), 1);
});

test("an interrupted envelope is skipped, and a damaged or contradicting one is never accepted [spec docs/netcode-proposal.md]", () => {
  const stream = new JournalTextStream(1);
  const whole = envelope(1, 1, "I421100");
  const partial = whole.substring(0, 33);
  assertEquals(stream.inspect(partial).kind, "wait");
  const resumed = stream.inspect(partial + whole);
  assertEquals(resumed.kind, "skip");
  assertEquals(widthOf(resumed), partial.length);
  assertEquals(stream.acknowledged(), 0);
  assertEquals(stream.inspect(`${whole.substring(0, 29)}i421100;`).kind, "skip");
  assertEquals(stream.acknowledged(), 0);
  assertEquals(stream.inspect(whole).kind, "ready");
  assertTrue(stream.consume());
  assertEquals(stream.inspect(envelope(1, 1, "I421300")).kind, "invalid");
  assertEquals(stream.acknowledged(), 1);
});

test("a focus gap replays without retagging frames or applying a record twice [invariant]", () => {
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

test("repeated records drain while consumption is blocked, within the receive window [spec docs/netcode-proposal.md]", () => {
  const stream = new JournalTextStream(1);
  for (let sequence = 1; sequence <= TEXT_WINDOW; sequence++) {
    assertEquals(stream.inspect(envelope(1, sequence, numbered(sequence))).kind, "ready");
    assertEquals(stream.received(), sequence);
    assertEquals(stream.acknowledged(), 0);
  }
  assertEquals(stream.inspect(envelope(1, TEXT_WINDOW + 1, "I421700")).kind, "invalid");
  assertEquals(stream.next(), "I421100");
  for (let sequence = 1; sequence <= TEXT_WINDOW; sequence++) {
    const record = envelope(1, sequence, numbered(sequence));
    const repeated = stream.inspect(record + record);
    assertEquals(repeated.kind, "skip");
    assertEquals(widthOf(repeated), record.length);
    assertEquals(stream.received(), TEXT_WINDOW);
    assertEquals(stream.acknowledged(), 0);
  }
  for (let sequence = 1; sequence <= TEXT_WINDOW; sequence++) {
    assertEquals(stream.next(), numbered(sequence));
    assertTrue(stream.consume());
    assertEquals(stream.acknowledged(), sequence);
  }
  assertEquals(stream.next(), undefined);
  assertFalse(stream.consume());
});

test("records after a missing first or middle record wait in the window until it arrives [invariant]", () => {
  const [first, second, third, fourth] = [1, 2, 3, 4].map((sequence) => envelope(1, sequence, numbered(sequence)));
  const stream = new JournalTextStream(1);
  assertEquals(stream.inspect(second!).kind, "ready");
  assertEquals(stream.inspect(third!).kind, "ready");
  assertEquals(stream.received(), 0);
  assertEquals(stream.next(), undefined);
  assertEquals(stream.inspect(envelope(1, 2, "I422300")).kind, "invalid");
  assertEquals(stream.inspect(second!).kind, "skip");
  assertEquals(stream.inspect(first!).kind, "ready");
  assertEquals(stream.received(), 3);
  for (let sequence = 1; sequence <= 3; sequence++) {
    assertEquals(stream.next(), numbered(sequence));
    assertTrue(stream.consume());
  }
  assertEquals(stream.acknowledged(), 3);
  assertEquals(stream.next(), undefined);

  // Leave records 3 and 4 in the window while 2 is missing.
  const gapped = new JournalTextStream(1);
  assertEquals(gapped.inspect(first!).kind, "ready");
  assertTrue(gapped.consume());
  assertEquals(gapped.inspect(third!).kind, "ready");
  assertEquals(gapped.inspect(fourth!).kind, "ready");
  assertEquals(gapped.received(), 1);
  assertEquals(gapped.next(), undefined);
  assertEquals(gapped.inspect(fourth!).kind, "skip");
  assertEquals(gapped.inspect(second!).kind, "ready");
  assertEquals(gapped.received(), 4);
  for (let sequence = 2; sequence <= 4; sequence++) {
    assertEquals(gapped.next(), numbered(sequence));
    assertTrue(gapped.consume());
  }
  assertEquals(gapped.acknowledged(), 4);
  assertEquals(gapped.next(), undefined);
});

test("a stream skips records from other epochs [spec docs/netcode-proposal.md]", () => {
  const stream = new JournalTextStream(2);
  assertEquals(stream.inspect(envelope(1, 2, "I421300")).kind, "skip");
  assertEquals(stream.acknowledged(), 0);
  assertEquals(stream.inspect(envelope(2, 1, "I422100")).kind, "ready");
  assertTrue(stream.consume());
  assertEquals(stream.acknowledged(), 1);
});
