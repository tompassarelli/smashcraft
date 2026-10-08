import { expect, test } from "bun:test";
import { suiteProblems } from "wisp/scripts/wisp/accept";
import { SMASHCRAFT_ACCEPT } from "../scripts/wisp/acceptChecks";

test("Smashcraft's declared native checks name known maps, clients and readings [spec wisp:docs/accept.md]", () => {
  expect(suiteProblems(SMASHCRAFT_ACCEPT, ["a", "b"])).toEqual([]);
});

test("an accept shard that exits nonzero fails with its exit code instead of passing silently [repro #240]", async () => {
  const { Effect } = await import("effect");
  const { runShard } = await import("../scripts/wisp/commands/accept");
  const { mkdtempSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const directory = join(mkdtempSync(join(tmpdir(), "accept-shard-")), "shard-0");
  const { rmSync } = await import("node:fs");
  const { dirname } = await import("node:path");
  try {
    // No pool lists pair 999999, so the shard's own run stops before touching any client.
    const failure = await Effect.runPromise(Effect.flip(runShard("999999", ["no-such-check"], directory)));
    expect(failure.message).toMatch(/exited [1-9]/);
    expect((await Bun.file(`${directory}.err`).text()).trim()).not.toBe("");
  } finally {
    rmSync(dirname(directory), { recursive: true, force: true });
  }
}, 30000);
