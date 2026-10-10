
import { join } from "node:path";
import { Effect } from "effect";
import { expect, test } from "bun:test";
import { readEvidence, readMetadata } from "../scripts/integrity/evidence";
import { capturePair, integrityResult, integrityTable, summaryJson } from "../scripts/integrity/reconcile";
import { clientDelay, delayTable, savedClients, withCursorOffsets } from "../scripts/integrity/delayReadout";


const evidence = (run: string) => join(import.meta.dir, "../../evidence", `input-integrity-0042-${run}-20261005`);


const NOTHING_HELD = { local_start_while_prediction_held_frames: { n: 0, p50: null, p95: null, max: null, distribution: {} }, held_missing_first_prediction: 0 };

const reconcileRun = async (run: string) => {
  const root = evidence(run);
  const metadata = await Effect.runPromise(readMetadata(root));
  return integrityResult(await Effect.runPromise(readEvidence(root, metadata)), capturePair(metadata));
};


test("the r8 capture reconciles to #26's measured table [k4 reference native]", async () => {
  const result = await reconcileRun("r8");
  expect(integrityTable(result)).toEqual([
    "| Metric | Result |",
    "|---|---|",
    "| Edges injected per player | 648 / 648 |",
    "| Lost / duplicated / reordered / stuck edges | 0 / 0 / 0 / 0 |",
    "| Edges applied at expected frame, both clients | 1296/1296 (100.0%) |",
    "| Local start − capture, frames | 8 / 88 / 97 (n=203); missing first prediction 0 |",
    "| Local start while a remote row held prediction back (not gated) | None / None / None (n=0); missing first prediction 0 |",
    "| Opponent input lateness, frames: p50 / p95 / max | 9 / 21 / 23 (n=1391) |",
    "| Rollback depth, frames: p50 / p95 / max | 13 / 24 / 24 (n=198) |",
    "| Prediction stalls at 24-frame limit | 169; longest 52 callbacks |",
    "| Injected input → screen, ms | Not captured in this session |",
    "| Final checksums match | Yes |",
  ]);
  expect(result.gates).toEqual({ edges: true, expectedFrame: true, localStart: false, checksums: true });
  expect(result.failures).toEqual([]);

  const retained = await Bun.file(join(evidence("r8"), "summary.json")).json();
  expect(summaryJson(result)).toEqual({ ...retained, rollback_limit_frames: 24, four_fighters: false, player_view_failures: [], ...NOTHING_HELD });
});


test("the delay readout reports each client's echo, lateness, depth, agreed delay, cursor offset, halts and drops from a hand-counted pair [k4 reference native]", () => {
  const clients = withCursorOffsets(savedClients(join(import.meta.dir, "fixtures/delay-readout")).map(clientDelay));
  expect(delayTable(clients).slice(2)).toEqual([
    "| . p0 run1 | 1:2 (2,3) | 1 / 1 / 1 (n=1) | 0 | 4 / 4 / 4 (n=1) | 0 / 3 / 3 (n=2) | 4 / 4 / 4 (n=1) | 1 / 1 / 1 (n=3) | 1 | 0 / 1 / 0 |",
    "| . p1 run1 | 1:2 (2,3) | None / None / None (n=0) | 1 | 7 / 7 / 7 (n=1) | 3 / 3 / 3 (n=1) | 2 / 6 / 6 (n=2) | -1 / 0 / 0 (n=3) | 0 | 2 / 0 / 3 |",
  ]);
});
