import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { EDITBOX_CAPACITY, EditboxSession } from "./editbox";
import { textEnvelope } from "./text";

const envelope = (sequence: number, payload: string) => assertDefined(textEnvelope(1, sequence, payload), "envelope");

test("draining keeps an incomplete record and acknowledges receipt and use in the helper's spelling", () => {
  const session = new EditboxSession("candidate", 1, 2, EDITBOX_CAPACITY);
  const partial = envelope(3, "I421500").substring(0, 12);
  assertEquals(session.drain(`noise${envelope(1, "I421100")}${envelope(2, "I421300")}${partial}`), partial);
  assertEquals(session.stream.next(), "I421100");
  const receipt = session.receipt(true);
  assertEquals(receipt.name, "smashcraft-journal-text-ack-candidate-e1-p2.txt");
  assertEquals(receipt.line, "SMASHCRAFT TEXT ACK v=1 build=candidate epoch=1 slot=2 received=2 consumed=0 revision=1 chat=0 chatState=0 chatFrame=1");
  assertTrue(session.consume());
  assertFalse(session.tick());
  assertTrue(session.tick());
  assertTrue(session.requestChat(4));
  assertEquals(session.receipt(false).line, "SMASHCRAFT TEXT ACK v=1 build=candidate epoch=1 slot=2 received=2 consumed=1 revision=2 chat=4 chatState=1 chatFrame=0");
  assertEquals(session.chatFile(), "smashcraft-journal-chat-candidate-e1-s2-n4.pld");
});

test("a short text limit, a full box or a vanished payload stops the session", () => {
  const limited = new EditboxSession("candidate", 1, 0, 255);
  assertEquals(limited.failure, "controller text capacity was not accepted");
  assertFalse(limited.receiving());
  const full = new EditboxSession("candidate", 1, 0, EDITBOX_CAPACITY);
  full.drain(`@${"J".repeat(EDITBOX_CAPACITY - 1)}`);
  assertEquals(full.failure, "controller text capacity reached");
  const empty = new EditboxSession("candidate", 1, 0, EDITBOX_CAPACITY);
  assertFalse(empty.consume());
  assertEquals(empty.failure, "controller text changed during admission");
});
