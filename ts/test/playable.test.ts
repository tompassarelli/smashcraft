import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { playableVerdict } from "../scripts/playable";


const EVIDENCE_0045 = join(import.meta.dir, "../../evidence/playable-0045-native-20261006/capture.json");
const FIXTURES_0045 = "fixtures/playable-0045/";
const TRACES_0045 = [
  "fixtures/playable-0045/epoch-1/0-wc3-melee-input-trace.txt",
  "fixtures/playable-0045/epoch-1/1-wc3-melee-input-trace.txt",
  "fixtures/playable-0045/epoch-2/0-wc3-melee-input-trace.txt",
  "fixtures/playable-0045/epoch-2/1-wc3-melee-input-trace.txt",
];
const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true });
});

interface RecordedCapture {
  events: { event: string; epoch?: number; texts?: string[]; publications?: { contents: string }[] }[];
}


function recorded0045(change: (capture: RecordedCapture, traces: Map<string, string>) => void = () => {}) {
  const capture = JSON.parse(readFileSync(EVIDENCE_0045, "utf8")) as RecordedCapture;
  const traces = new Map(TRACES_0045.map((fixture) => [fixture.slice(FIXTURES_0045.length), readFileSync(join(import.meta.dir, fixture), "utf8")] as const));
  change(capture, traces);
  const root = mkdtempSync(join(tmpdir(), "playable-0045-"));
  roots.push(root);
  writeFileSync(join(root, "capture.json"), JSON.stringify(capture));
  for (const name of ["producer.jsonl", "kernel-0.jsonl", "kernel-1.jsonl"]) writeFileSync(join(root, name), "");
  for (const [name, text] of traces) {
    mkdirSync(join(root, name, ".."), { recursive: true });
    writeFileSync(join(root, name), text);
  }
  return Effect.runPromise(playableVerdict(root));
}

test("0.0.45's recorded match and rematch pass: B's rematch screen read \"Player | wins!\" names Player 1 [native]", async () => {
  expect(await recorded0045()).toMatchObject({
    build: "playable-0045",
    passed: true,
    failures: [],
    matches: [
      { epoch: 1, winner: "Player 2", winner_source: "result screens", receipt_winners: [null, null], winners: ["Player 2", "Player 2"], end_frames: [273, 273], result_checksums: [{ frame: 263, checksum: "771580:781223" }] },
      { epoch: 2, winner: "Player 1", winner_source: "result screens", receipt_winners: [null, null], winners: ["Player 1", "Player 1"], end_frames: [285, 285], result_checksums: [{ frame: 276, checksum: "783381:730897" }] },
    ],
  });
});
