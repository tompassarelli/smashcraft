import { expect, test } from "bun:test";
import { playableResult, type PlayableRecord } from "../scripts/playable";
import type { CaptureEvidence, ClientExport, JourneyEvent } from "../scripts/integrity/reconcile";

// These fixtures test the verdict contract; native acceptance uses actual capture files.
const receipt = (frame: number) => ({ contents: `call Preload( "SMASHCRAFT JOURNAL CONTROL v=1 build=test epoch=1 slot=0 sequence=0 state=END frame=${frame}" )`, estimateNs: 0 });
const boundary = (event: "start" | "end", epoch: number, frames: readonly [number, number] = [900, 900]): JourneyEvent =>
  ({ event, epoch, publications: [receipt(frames[0]), receipt(frames[1])] });
const exported = (checksum = "123:456"): ClientExport => ({ trace: `confirmed frame 900 state ${checksum}\nconfirmed frame 960 state ${checksum}`, pages: [] });
const capture = (events: readonly JourneyEvent[] = [boundary("start", 1), boundary("end", 1), boundary("start", 2), boundary("end", 2)]): CaptureEvidence => ({
  metadata: { scope: "two native clients", build: "playable-test", helperSha256: "test", inputIntegrity: false, fourFighters: false, sweep: [], epochs: [1, 2], events },
  producer: [], kernel: [[], []], exports: new Map([[1, [exported(), exported()]], [2, [exported(), exported()]]]),
});
const record = (overrides: Partial<PlayableRecord> = {}): PlayableRecord => ({
  results: new Map([[1, ["Player 2 wins!", "Player 2\nwins!"]], [2, ["Player 1 wins!", "Player 1 wins!"]]]),
  errorReports: [],
  ...overrides,
});

test("a playable match and rematch pass when both clients agree on winner, end frame and result checksum", () => {
  expect(playableResult(capture(), record())).toMatchObject({
    passed: true, failures: [], epochs: [1, 2],
    matches: [{ epoch: 1, winners: ["Player 2", "Player 2"], end_frames: [900, 900] }, { epoch: 2, winners: ["Player 1", "Player 1"] }],
  });
});

test("a playable capture fails on any disagreement, missing result or in-game error", () => {
  const exports = new Map(capture().exports);
  exports.set(2, [exported(), exported("123:457")]);
  expect(playableResult({ ...capture(), exports }, record()).failures).toEqual(["epoch 2: confirmed checksums differ at frames 900, 960"]);
  expect(playableResult(capture([boundary("start", 1), boundary("end", 1, [900, 901]), boundary("start", 2), boundary("end", 2)]), record()).failures)
    .toEqual(["epoch 1: end frames differ or are absent"]);
  expect(playableResult(capture(), record({ results: new Map([[1, ["Player 2 wins!", "Player 1 wins!"]], [2, ["Player 1 wins!", "Player 1 wins!"]]]) })).passed).toBe(false);
  expect(playableResult(capture([boundary("start", 1), boundary("end", 1), boundary("start", 2)]), record()).passed).toBe(false);
  expect(playableResult(capture(), record({ errorReports: ["epoch-1/0-smashcraft-error-p0.txt"] })).passed).toBe(false);
});
