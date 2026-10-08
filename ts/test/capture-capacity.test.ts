import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Cause, Effect } from "effect";
import { padBatch } from "../scripts/wisp/padBatch";
import { admitCaptures, requireCaptureLease, timingCheck } from "../scripts/wisp/captureCapacity";
import { parsePadScript } from "../scripts/integrity/padScript";

test("a native timing batch stops before client input without an exclusive lease [repro #311]", async () => {
  const directory = mkdtempSync(join(tmpdir(), "capture-capacity-"));
  try {
    const script = join(directory, "timing.pad");
    writeFileSync(script, "#! chat -dev quick\n60 a tap A\n61 b tap B\n100 a press VIEW\n170 a release VIEW\n");
    const result = await Effect.runPromiseExit(padBatch({ scripts: [script], helper: "missing-helper", build: "test", out: join(directory, "out"), headlessJobs: 1, retries: 0, pairs: [], map: "missing-map", freshEach: false }));
    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") expect(Cause.pretty(result.cause)).toContain("exclusive capacity lease before client input");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("visual capture scripts take no exclusive lease; a script without a capture is a timing check that does [spec AGENTS.md]", async () => {
  const visual = parsePadScript("#! chat -dev quick\n60 a tap A\n62 a capture\n");
  const timing = parsePadScript("60 a tap A\n61 b tap B\n");
  expect(timingCheck([visual])).toBe(false);
  expect(timingCheck([visual, timing])).toBe(true);
  expect((await Effect.runPromiseExit(requireCaptureLease(timingCheck([visual]))))._tag).toBe("Success");
  expect((await Effect.runPromiseExit(admitCaptures(["missing.pad"], false)))._tag).toBe("Success");
});
