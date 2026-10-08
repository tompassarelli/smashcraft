import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { CARRIER_KEYS, KeyboardMailbox, decodeChunk } from "./keyboard";

/** The carrier keys a helper holds for one chunk, written from the protocol independently of the decoder. */
function carrier(text: string, final: boolean): boolean[] {
  const keys = CARRIER_KEYS.map(() => false);
  for (let offset = 0; offset < text.length; offset++) {
    const code = text.charCodeAt(offset);
    for (let bit = 0; bit < 7; bit++) keys[offset * 7 + bit] = (code & (1 << bit)) !== 0;
  }
  for (let bit = 0; bit < 3; bit++) keys[49 + bit] = (text.length & (1 << bit)) !== 0;
  keys[52] = final;
  return keys;
}

function held(keys: readonly boolean[]): string {
  const down: number[] = [];
  keys.forEach((isDown, index) => {
    if (isDown) down.push(index);
  });
  return down.join(",");
}

const decoded = (keys: readonly boolean[]) => decodeChunk(keys)?.text;

test("ASCII chunks carry I4 and control text exactly, least significant bit first [reference]", () => {
  assertEquals(CARRIER_KEYS.length, 54);
  // "I" is 73: bits 0, 3 and 6, with a byte count of one.
  assertEquals(held(carrier("I", false)), "0,3,6,49");
  assertEquals(decoded(carrier("I40001a", false)), "I40001a");
  assertEquals(decoded(carrier("ACK1|4|", false)), "ACK1|4|");
  assertEquals(decoded(carrier("PREPARE", false)), "PREPARE");
  const last = decodeChunk(carrier("|19", true));
  assertEquals(last?.text, "|19");
  assertEquals(last?.final, true);
});

test("a message's chunks are acknowledged as taken, and its final chunk once the message is used [reference]", () => {
  const mailbox = new KeyboardMailbox("candidate", 7, 2);
  assertFalse(mailbox.pending(false));
  assertTrue(mailbox.pending(true));
  assertTrue(mailbox.take(true, { text: "I41", final: false }));
  assertEquals(mailbox.receipt().name, "smashcraft-journal-mailbox-ack-candidate-e7-s2-c1.txt");
  assertEquals(mailbox.receipt().line, "SMASHCRAFT KEYBOARD ACK v=1 build=candidate epoch=7 slot=2 chunk=1");
  assertEquals(mailbox.message(), undefined);
  assertFalse(mailbox.pending(true));
  assertFalse(mailbox.take(false, { text: "710", final: true }));
  assertEquals(mailbox.message(), "I41710");
  assertTrue(mailbox.release());
  assertEquals(mailbox.receipt().line, "SMASHCRAFT KEYBOARD ACK v=1 build=candidate epoch=7 slot=2 chunk=2");
  assertEquals(mailbox.message(), undefined);
  assertFalse(mailbox.release());
});
