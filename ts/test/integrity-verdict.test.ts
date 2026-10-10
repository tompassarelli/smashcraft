import { expect, test } from "bun:test";
import { type Observations, emptyObservations, verdict } from "../scripts/integrity/reconcile";

const METADATA = { scope: "verdict", build: "test", fourFighters: false, helperSha256: "" };
const PAIR = [1, 2] as const;

/** A capture every gate passes: two epochs with matching endpoints, one confirmed edge each, prompt local starts and one rollback limit. */
function clean(): Observations {
  const seen = emptyObservations();
  for (const epoch of PAIR) for (const client of [0, 1]) seen.endpoints.set(`epoch-${epoch}-client-${client}`, [100, "c0ffee", 3]);
  seen.total = 2;
  seen.correct = 2;
  seen.legalPresses = 2;
  seen.localDelays.push(0, 1);
  seen.rollbackLimits.add(24);
  return seen;
}

const cases: readonly (readonly [name: string, change: (seen: Observations) => void, gates: Partial<Record<"edges" | "expectedFrame" | "localStart" | "checksums", false>>, failures?: readonly string[]])[] = [
  ["a clean capture", () => {}, {}],
  ["a lost edge", (seen) => { seen.lost = 1; }, { edges: false }],
  ["a duplicated edge", (seen) => { seen.duplicated = 1; }, { edges: false }],
  ["a reordered edge", (seen) => { seen.reordered = 1; }, { edges: false }],
  ["a stuck held mask", (seen) => { seen.stuck = 1; }, { edges: false }],
  ["an edge at the wrong frame", (seen) => { seen.correct = 1; }, { expectedFrame: false }],
  ["no source edges", (seen) => { seen.correct = 0; seen.total = 0; }, { expectedFrame: false }],
  ["a legal action missing its first prediction", (seen) => { seen.missingLocal = 1; }, { localStart: false }],
  ["a local start two frames late", (seen) => { seen.localDelays.push(2); }, { localStart: false }],
  ["a local start before its capture", (seen) => { seen.localDelays.push(-1); }, { localStart: false }],
  ["no legal presses", (seen) => { seen.legalPresses = 0; }, { localStart: false }],
  ["no measured local start", (seen) => { seen.localDelays.length = 0; }, { localStart: false }],
  ["clients that end on different checksums", (seen) => { seen.endpoints.set("epoch-2-client-1", [100, "bad", 3]); }, { checksums: false }],
  ["a missing endpoint", (seen) => { seen.endpoints.delete("epoch-1-client-0"); }, { checksums: false }],
  ["two rollback limits", (seen) => { seen.rollbackLimits.add(12); }, {}, ["native rollback limit absent or inconsistent"]],
  ["no rollback limit", (seen) => { seen.rollbackLimits.clear(); }, {}, ["native rollback limit absent or inconsistent"]],
  ["an earlier failure", (seen) => { seen.failures.push("slot 0: fewer than 500 injected edges"); }, {}, ["slot 0: fewer than 500 injected edges"]],
];

test("verdict passes a capture only when every gate holds and nothing failed [invariant]", () => {
  for (const [name, change, gates, failures = []] of cases) {
    const seen = clean();
    change(seen);
    const result = verdict(seen, METADATA, PAIR, []);
    expect(result.gates, name).toEqual({ edges: true, expectedFrame: true, localStart: true, checksums: true, ...gates });
    expect(result.failures, name).toEqual([...failures]);
    expect(result.passed, name).toBe(Object.keys(gates).length === 0 && failures.length === 0);
  }
});

test("verdict fails a capture whose rollback limit is not the commanded window, and leaves the observations untouched [invariant]", () => {
  const seen = clean();
  expect(verdict(seen, METADATA, PAIR, [], 24).passed).toBe(true);
  const result = verdict(seen, METADATA, PAIR, [], 12);
  expect(result.failures).toEqual(["native rollback limit 24 is not the commanded 12"]);
  expect(result.passed).toBe(false);
  expect(seen.failures).toEqual([]);
});
