import { expect, test } from "bun:test";
import { fourFighterResult } from "../scripts/fourFighters";
import type { CaptureEvidence, ClientExport, JourneyEvent } from "../scripts/integrity/reconcile";

// These fixtures test the verdict contract; native acceptance uses actual capture files.
const boundary = (event: "start" | "end", epoch: number): JourneyEvent => ({ event, epoch, publications: [{ contents: "", estimateNs: 0 }, { contents: "", estimateNs: 0 }] });
const exported = (epoch: number, checksum = "123:456", phase = 3): ClientExport => ({
  trace: "connected 3 human-fighters 3 computers 12 fighters 15",
  pages: [`call Preload( "I 10 checksum ${epoch} 3600 ${checksum} ${phase}" )`],
});
const capture = (): CaptureEvidence => ({
  metadata: {
    scope: "two native clients, four fighters", build: "test", helperSha256: "test", inputIntegrity: false, padLayout: "xpad", fourFighters: true, sweep: [], epochs: [3, 4],
    events: [
      { event: "four-fighter-setup", epoch: 3, changes: [[7, 0], [3, 4], [11, 4], [3, 12]].map(([humanFighters = 0, computers = 0]) => ({ humanFighters, computers })) },
      boundary("start", 3), boundary("end", 3),
      { event: "integrity-slot-change", epoch: 4, changes: [[3, 8], [7, 8], [3, 12]].map(([humanFighters = 0, computers = 0]) => ({ humanFighters, computers })) },
      boundary("start", 4), boundary("end", 4),
    ],
  },
  producer: [], kernel: [[], []], exports: new Map([[3, [exported(3), exported(3)]], [4, [exported(4), exported(4)]]]),
});

test("#17 closes from four-fighter results without #26 timing or edge samples [spec docs/native-four-fighters.md]", () => {
  expect(fourFighterResult(capture())).toMatchObject({ passed: true, failures: [], epochs: [3, 4] });
});

test("#17 rejects mismatched results and a combat checksum used as a result [spec docs/native-four-fighters.md]", () => {
  const original = capture();
  const mismatch = new Map(original.exports);
  mismatch.set(4, [exported(4), exported(4, "123:457")]);
  expect(fourFighterResult({ ...original, exports: mismatch })).toMatchObject({ passed: false, failures: ["epoch 4: final checksums differ"] });
  const combat = new Map(original.exports);
  combat.set(3, [exported(3, "123:456", 2), exported(3, "123:456", 2)]);
  expect(fourFighterResult({ ...original, exports: combat }).passed).toBe(false);
});

test("#17 rejects missing native roster, completion or rematch slot change [spec docs/native-four-fighters.md]", () => {
  const original = capture();
  const twoFighters = new Map(original.exports);
  twoFighters.set(3, [{ ...exported(3), trace: "connected 3 human-fighters 3 computers 0 fighters 3" }, exported(3)]);
  expect(fourFighterResult({ ...original, exports: twoFighters }).passed).toBe(false);
  for (const absent of ["end", "integrity-slot-change"] as const) {
    expect(fourFighterResult({ ...original, metadata: { ...original.metadata, events: original.metadata.events.filter((event) => event.event !== absent) } }).passed).toBe(false);
  }
});
