import { assertEquals, test } from "wisp/src/runtime/testing";
import { type ReadFile, type VocabularyRead, markerFile, readVocabularyControlAck, readVocabularyPacket, symbolFile } from "./vocabulary";


function published(base: string, text: string, marker: string): Map<string, string> {
  const files = new Map<string, string>();
  for (let offset = 0; offset < text.length; offset++) files.set(symbolFile(base, offset), text.charAt(offset));
  files.set(markerFile(base), marker);
  return files;
}

const reader = (files: Map<string, string>): ReadFile => (filename) => files.get(filename);
const textOf = (read: VocabularyRead) => (read.kind === "text" ? read.text : read.kind);

test("a published packet reads back whole; a missing file means not yet, a bad one is invalid [invariant]", () => {
  const base = "smashcraft-journal-vocabulary-e91-s2-n4";
  const wire = "I42a11_042042000Exu1450907-D042E3m28A";
  const files = published(base, wire, "b");
  assertEquals(textOf(readVocabularyPacket(reader(files), base)), wire);
  files.delete(symbolFile(base, 36));
  assertEquals(readVocabularyPacket(reader(files), base).kind, "missing");
  files.delete(markerFile(base));
  assertEquals(readVocabularyPacket(reader(files), base).kind, "missing");
  assertEquals(textOf(readVocabularyPacket(reader(published(base, wire, "_")), base)), "invalid");
  assertEquals(textOf(readVocabularyPacket(reader(published(base, "I410", "4")), base)), "invalid");
  const control = published(base, "ACK1|3|PAUSE|12", "F");
  assertEquals(textOf(readVocabularyControlAck(reader(control), base)), "ACK1|3|PAUSE|12");
  const invalid = readVocabularyPacket(reader(control), base);
  assertEquals(invalid.kind === "invalid" ? invalid.reason : undefined, "invalid-vocabulary-symbol");
});
