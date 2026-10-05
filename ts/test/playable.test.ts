import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { type PlayableRecord, playableResult, playableVerdict } from "../scripts/playable";
import type { CaptureEvidence, ClientExport, JourneyEvent } from "../scripts/integrity/reconcile";

// These fixtures test the verdict contract; native acceptance uses actual capture files.
const receipt = (frame: number, winner = "") => ({ contents: `call Preload( "SMASHCRAFT JOURNAL CONTROL v=1 build=test epoch=1 slot=0 sequence=0 state=END frame=${frame}${winner}" )`, estimateNs: 0 });
const boundary = (event: "start" | "end", epoch: number, frames: readonly [number, number] = [900, 900], winners: readonly [string, string] = ["", ""]): JourneyEvent =>
  ({ event, epoch, publications: [receipt(frames[0], winners[0]), receipt(frames[1], winners[1])] });
const exported = (checksum = "123:456"): ClientExport => ({ trace: `confirmed frame 900 state ${checksum}\nconfirmed frame 960 state ${checksum}`, pages: [] });
const capture = (events: readonly JourneyEvent[] = [boundary("start", 1), boundary("end", 1), boundary("start", 2), boundary("end", 2)]): CaptureEvidence => ({
  metadata: { scope: "two native clients", build: "playable-test", helperSha256: "test", inputIntegrity: false, fourFighters: false, sweep: [], epochs: [1, 2], events },
  producer: [], kernel: [[], []], exports: new Map([[1, [exported(), exported()]], [2, [exported(), exported()]]]),
});
const record = (overrides: Partial<PlayableRecord> = {}): PlayableRecord => ({
  results: new Map([[1, { texts: ["Player 2 wins!", "Player 2\nwins!"] }], [2, { texts: ["Player 1 wins!", "Player 1 wins!"] }]]),
  errorReports: [],
  ...overrides,
});

test("a playable match and rematch pass when both clients agree on winner and confirmed result checksum", () => {
  expect(playableResult(capture(), record())).toMatchObject({
    passed: true, failures: [], epochs: [1, 2],
    matches: [{ epoch: 1, winner: "Player 2", winners: ["Player 2", "Player 2"], end_frames: [900, 900] }, { epoch: 2, winner: "Player 1", winners: ["Player 1", "Player 1"] }],
  });
});

test("a playable capture fails on any disagreement, missing result or in-game error", () => {
  const exports = new Map(capture().exports);
  exports.set(2, [exported(), exported("123:457")]);
  expect(playableResult({ ...capture(), exports }, record()).failures).toEqual(["epoch 2: confirmed checksums differ at frames 900, 960"]);
  // Each receipt's frame is its client's local input frame; a difference alone is not a disagreement.
  expect(playableResult(capture([boundary("start", 1), boundary("end", 1, [900, 901]), boundary("start", 2), boundary("end", 2)]), record()).failures).toEqual([]);
  expect(playableResult(capture([boundary("start", 1), boundary("end", 1, [900, 0]), boundary("start", 2), boundary("end", 2)]), record()).failures)
    .toEqual(["epoch 1: an end receipt is absent"]);
  expect(playableResult(capture(), record({ results: new Map([[1, { texts: ["Player 2 wins!", "Player 1 wins!"] }], [2, { texts: ["Player 1 wins!", "Player 1 wins!"] }]]) })).passed).toBe(false);
  expect(playableResult(capture([boundary("start", 1), boundary("end", 1), boundary("start", 2)]), record()).passed).toBe(false);
  expect(playableResult(capture(), record({ errorReports: ["epoch-1/0-smashcraft-error-p0.txt"] })).passed).toBe(false);
});

test("end receipts name the winner; a result screen may be unreadable but never name another player", () => {
  const named = (one: readonly [string, string], two: readonly [string, string]) =>
    capture([boundary("start", 1), boundary("end", 1, [900, 900], one), boundary("start", 2), boundary("end", 2, [900, 900], two)]);
  const agreed = named([" winner=P2", " winner=P2"], [" winner=P1", " winner=P1"]);
  const unreadable = record({ results: new Map([[1, { texts: ["Player 2 wins!", "Pl@yer ? w1ns"] }], [2, { texts: ["", ""], notices: ["Player 1 wins!", "Player I wins!"] }]]) });
  expect(playableResult(agreed, unreadable)).toMatchObject({
    passed: true,
    matches: [
      { epoch: 1, winner: "Player 2", winner_source: "end receipts", receipt_winners: ["Player 2", "Player 2"], winners: ["Player 2", null] },
      { epoch: 2, winner: "Player 1", receipt_winners: ["Player 1", "Player 1"], winners: ["Player 1", "Player 1"] },
    ],
  });
  expect(playableResult(named([" winner=P2", " winner=P2"], [" winner=P1", " winner=P2"]), record()).failures)
    .toEqual(["epoch 2: end receipts name different winners: Player 1 / Player 2"]);
  expect(playableResult(named([" winner=P2", ""], [" winner=P1", " winner=P1"]), record()).failures)
    .toEqual(["epoch 1: end receipts name different winners: Player 2 / no winner field"]);
  expect(playableResult(named([" winner=P2", " winner=P2"], [" winner=none", " winner=none"]), record()).failures).toEqual([
    "epoch 2: client A's result screen names Player 1, the game nobody",
    "epoch 2: client B's result screen names Player 1, the game nobody",
    "epoch 2: nobody won, expected Player 1",
  ]);
  const contradicted = record({ results: new Map([[1, { texts: ["Player 2 wins!", "Player 2 wins!"] }], [2, { texts: ["Player 1 wins!", "Player 2 wins!"] }]]) });
  expect(playableResult(agreed, contradicted).failures).toEqual(["epoch 2: client B's result screen names Player 2, the game Player 1"]);
});

// 0.0.45's native match and rematch: smashcraft:evidence/playable-0045-native-20261006/capture.json
// and, from the private raw capture, both clients' result traces in fixtures/playable-0045/.
const EVIDENCE_0045 = join(import.meta.dir, "../../evidence/playable-0045-native-20261006/capture.json");
const FIXTURES_0045 = "fixtures/playable-0045/";
const TRACES_0045 = [
  "fixtures/playable-0045/epoch-1/0-wc3-melee-input-trace.txt",
  "fixtures/playable-0045/epoch-1/1-wc3-melee-input-trace.txt",
  "fixtures/playable-0045/epoch-2/0-wc3-melee-input-trace.txt",
  "fixtures/playable-0045/epoch-2/1-wc3-melee-input-trace.txt",
];
/** A trace's path in the capture directory. */
const TRACE = (epoch: number, client: number) => `epoch-${epoch}/${client}-wc3-melee-input-trace.txt`;
const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true });
});

interface RecordedCapture {
  events: { event: string; epoch?: number; texts?: string[]; publications?: { contents: string }[] }[];
}

/** The 0.0.45 capture as a capture directory, after `change` edits its capture.json and result traces. */
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

const results = (capture: RecordedCapture, epoch: number) => {
  const event = capture.events.find((each) => each.event === "results" && each.epoch === epoch);
  if (event?.texts === undefined) throw new Error(`no epoch ${epoch} results`);
  return event.texts;
};

test("0.0.45's recorded match and rematch pass: B's rematch screen read \"Player | wins!\" names Player 1", async () => {
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

test("the recorded 0.0.45 capture fails when its clients disagree on the winner or the result checksum", async () => {
  const otherWinner = await recorded0045((capture) => {
    results(capture, 2)[1] = "Player 2 wins!";
  });
  expect(otherWinner.failures).toEqual(["epoch 2: result screens do not both name one winner: Player 1 / Player 2"]);
  const otherChecksum = await recorded0045((_capture, traces) => {
    traces.set(TRACE(2, 1), (traces.get(TRACE(2, 1)) ?? "").replaceAll("783381:730897", "783381:730898"));
  });
  expect(otherChecksum.failures).toEqual(["epoch 2: confirmed checksums differ at frames 276"]);
  // The same run, had its end receipts named different winners.
  const otherReceipt = await recorded0045((capture) => {
    const end = capture.events.find((each) => each.event === "end" && each.epoch === 2);
    for (const [client, publication] of (end?.publications ?? []).entries()) publication.contents = publication.contents.replace("frame=285\"", `frame=285 winner=P${client + 1}"`);
  });
  expect(otherReceipt.failures).toEqual(["epoch 2: end receipts name different winners: Player 1 / Player 2"]);
});
