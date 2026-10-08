// `bun wisp pad --batch` plays many scripts in one game per pair: a new game
// (about a minute: menus, lobby, map load) only starts a session or replaces
// one an invalid or broken run left, never between valid scripts, unless
// --fresh-each asks for the old loop.
import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { needsNewGame, padBatch } from "../scripts/wisp/padBatch";
import { pad } from "../scripts/wisp/commands/pad";

test("a native comparison batch rejects missing export before starting references or clients [spec AGENTS.md]", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pad-preflight-"));
  const script = join(dir, "no-export.pad");
  writeFileSync(script, "#! chat -dev quick hero archer\n150 a tap A 2\n154 a capture\n");
  const out = join(dir, "out");
  await expect(Effect.runPromise(padBatch({ scripts: [script], pairs: [], helper: "/missing-helper", build: "typescript-integrity", out, map: "/missing-map.w3x", retries: 0, freshEach: false, headlessJobs: 1 }))).rejects.toThrow("comparison requires a replay export");
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

