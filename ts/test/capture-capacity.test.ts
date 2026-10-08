import { expect, test } from "bun:test";
import { Cause, Effect } from "effect";
import { padBatch } from "../scripts/wisp/padBatch";

test("native pad batch stops before preparing scripts without an exclusive lease [repro #311]", async () => {
  const result = await Effect.runPromiseExit(padBatch({ scripts: ["missing-script.pad"], helper: "missing-helper", build: "test", out: "missing-output", headlessJobs: 1, retries: 0, pairs: [], map: "missing-map", freshEach: false }));
  expect(result._tag).toBe("Failure");
  if (result._tag === "Failure") expect(Cause.pretty(result.cause)).toContain("exclusive capacity lease before client input");
});
