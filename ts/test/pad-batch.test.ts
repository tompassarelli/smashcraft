// `bun wisp pad --batch` plays many scripts in one game per pair: a new game
// (about a minute: menus, lobby, map load) only starts a session or replaces
// one an invalid or broken run left, never between valid scripts, unless
// --fresh-each asks for the old loop.
import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Cause, Effect } from "effect";
import { needsNewGame, padBatch, runBatchProcess } from "../scripts/wisp/padBatch";
import { pollUntil } from "../scripts/hostPoll";
import { pad } from "../scripts/wisp/commands/pad";

test("a native comparison batch rejects missing export before starting references or clients [spec AGENTS.md]", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pad-preflight-"));
  const script = join(dir, "no-export.pad");
  writeFileSync(script, "#! chat -dev quick hero rifleman\n150 a tap A 2\n154 a capture\n");
  const out = join(dir, "out");
  await expect(Effect.runPromise(padBatch({ scripts: [script], pairs: [], helper: "/missing-helper", build: "typescript-integrity", out, map: "/missing-map.w3x", retries: 0, freshEach: false, hot: false, headlessJobs: 1 }))).rejects.toThrow("comparison requires a replay export");
  await expect(Effect.runPromise(pad([script, "--headless", "--helper", "/missing-helper", "--out", out, "--compare", "/missing-native"]))).rejects.toThrow("comparison requires a replay export");
  expect(existsSync(join(out, "no-export", "headless.log"))).toBe(false);
});

test("a batch session starts one game and resets between valid or failed scripts [spec AGENTS.md]", () => {
  const outcomes = ["none", "valid", "failed", "valid"] as const;
  expect(outcomes.map((previous) => needsNewGame(previous, false))).toEqual([true, false, false, false]);
  expect(needsNewGame("invalid", false)).toBe(true);
  expect(needsNewGame("broken", false)).toBe(true);
  expect(outcomes.map((previous) => needsNewGame(previous, true))).toEqual([true, true, true, true]);
});

test("batch children preserve completion and failure and cancellation leaves no child [spec #240]", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pad-batch-process-"));
  const pidPath = join(dir, "pid");
  try {
    const success = await Effect.runPromiseExit(runBatchProcess(process.execPath, ["-e", "console.log('finished')"], join(dir, "success.log")));
    expect(success._tag).toBe("Success");
    expect(readFileSync(join(dir, "success.log"), "utf8")).toBe("finished\n");
    const failure = await Effect.runPromiseExit(runBatchProcess(process.execPath, ["-e", "console.error('broken'); process.exit(7)"], join(dir, "failure.log")));
    expect(failure._tag).toBe("Failure");
    if (failure._tag === "Failure") expect(Cause.pretty(failure.cause)).toContain("exited 7");
    expect(readFileSync(join(dir, "failure.log.err"), "utf8")).toBe("broken\n");
    const stopped = await Effect.runPromiseExit(runBatchProcess(process.execPath, ["-e", `process.on('SIGTERM', () => {}); require('node:fs').writeFileSync(${JSON.stringify(pidPath)}, String(process.pid)); setInterval(() => {}, 1000);`], join(dir, "cancel.log")).pipe(
      Effect.raceFirst(pollUntil(Effect.sync(() => existsSync(pidPath) ? true : undefined), { every: "5 millis", within: "3 seconds", orElse: () => Effect.die("child never started") }).pipe(Effect.andThen(Effect.fail("cancelled")))),
    ));
    expect(stopped._tag).toBe("Failure");
    if (stopped._tag === "Failure") expect(Cause.pretty(stopped.cause)).toContain("cancelled");
    const pid = Number(readFileSync(pidPath, "utf8"));
    expect(() => process.kill(pid, 0)).toThrow();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
