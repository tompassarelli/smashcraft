import { assertDefined, assertEquals, assertTrue, test } from "../../../runtime/testing";
import { JournalInputSource } from "./source";
import { type ReadFile, type VocabularyRead, markerFile, readVocabularyControlAck, readVocabularyPacket, symbolFile } from "./vocabulary";
import { VOCABULARY_PROBE_EPOCH, VOCABULARY_PROBE_SAMPLES, vocabularyProbePacket } from "./vocabularyProbe";

/** Files as the helper publishes them: one symbol each, then the length marker. */
function published(base: string, text: string, marker: string): Map<string, string> {
  const files = new Map<string, string>();
  for (let offset = 0; offset < text.length; offset++) files.set(symbolFile(base, offset), text.charAt(offset));
  files.set(markerFile(base), marker);
  return files;
}

const reader = (files: Map<string, string>): ReadFile => (filename) => files.get(filename);
const textOf = (read: VocabularyRead) => (read.kind === "text" ? read.text : read.kind);

test("a published packet reads back whole; a missing file means not yet, a bad one is invalid", () => {
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

test("the probe corpus spells exactly the recorded fixture packets, and each is the journal's next packet", () => {
  const recorded: readonly (readonly [number, number, number, string])[] = [
    [0, 1, 0, "I42a11_042042000Exu1450907-D042E3m28A"],
    [0, 1, 15, "I42a1VV052010000BET0-R02F002000050C5v02W"],
    [0, 1, 18, "I42a1b1F00200G00GFGz02vF00Y00W000EPX02-"],
    [0, 4, 36, "I41a1b1F00200G00GFGz02v"],
    [0, 5, 30, "I41a1VV052010000BET0-R02"],
    [1, 2, 11, "I42a1NT0017vf01p2YV0410400008n59Xu09"],
    [1, 4, 22, "I41a1NT0017vf01p2Y"],
    [1, 5, 299, "I41a1i9D0014kn03S"],
  ];
  for (const [sender, arm, sequence, wire] of recorded) assertEquals(vocabularyProbePacket(sender, arm, sequence), wire);
  // Arms differ only in rows per packet: arm 0 reaches every frame any arm sends, arm 3 sends single rows.
  for (let sender = 0; sender < 2; sender++) {
    for (const arm of [0, 3]) {
      const journal = assertDefined(JournalInputSource.open("vocabulary-corpus", VOCABULARY_PROBE_EPOCH, sender, 0));
      for (let sequence = 0; sequence < VOCABULARY_PROBE_SAMPLES; sequence++) {
        assertEquals(journal.read(assertDefined(vocabularyProbePacket(sender, arm, sequence)), 600).kind, "ready");
        assertTrue(journal.sent());
      }
    }
  }
});
