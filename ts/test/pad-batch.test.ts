// `bun wisp pad --batch` plays many scripts in one game per pair: a new game
// (about a minute: menus, lobby, map load) only starts a session or replaces
// one an invalid or broken run left, never between valid scripts, unless
// --fresh-each asks for the old loop.
import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { batchScripts, lanPairs, needsNewGame, padBatch } from "../scripts/wisp/padBatch";
import { nativeChatReceipt, pad } from "../scripts/wisp/commands/pad";

test("a native comparison batch rejects missing export before starting references or clients", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pad-preflight-"));
  const script = join(dir, "no-export.pad");
  writeFileSync(script, "#! chat -dev quick hero archer\n150 a tap A 2\n154 a capture\n");
  const out = join(dir, "out");
  await expect(Effect.runPromise(padBatch({ scripts: [script], pairs: [], helper: "/missing-helper", build: "typescript-integrity", out, map: "/missing-map.w3x", retries: 0, freshEach: false, headlessJobs: 1 }))).rejects.toThrow("comparison requires a replay export");
  await expect(Effect.runPromise(pad([script, "--headless", "--helper", "/missing-helper", "--out", out, "--compare", "/missing-native"]))).rejects.toThrow("comparison requires a replay export");
  expect(existsSync(join(out, "no-export", "headless.log"))).toBe(false);
});

test("native reset reads complete chat hand-off receipts, never a partially written file", () => {
  const prefix = 'function PreloadFiles takes nothing returns nothing\ncall Preload( "SMASHCRAFT TEXT ACK v=1 build=test epoch=4 slot=0 received=100 consumed=100 revision=12 chat=2 chatState=3 chatFrame=1" )\n';
  expect(nativeChatReceipt(prefix)).toBeUndefined();
  expect(nativeChatReceipt(`${prefix}endfunction\n`)).toEqual({ epoch: 4, revision: 12, chat: 2, chatState: 3 });
  expect(nativeChatReceipt(`${prefix.replace("revision=12", "revision=NaN")}endfunction\n`)).toBeUndefined();
});

test("a batch session starts one game and resets between valid or failed scripts", () => {
  const outcomes = ["none", "valid", "failed", "valid"] as const;
  expect(outcomes.map((previous) => needsNewGame(previous, false))).toEqual([true, false, false, false]);
  expect(needsNewGame("invalid", false)).toBe(true);
  expect(needsNewGame("broken", false)).toBe(true);
  expect(outcomes.map((previous) => needsNewGame(previous, true))).toEqual([true, true, true, true]);
});

test("batch scripts: a directory's own .pad files in name order, files as given; LAN pairs from pool.json", () => {
  const dir = mkdtempSync(join(tmpdir(), "pad-batch-"));
  for (const name of ["b.pad", "a.pad", "notes.md"]) writeFileSync(join(dir, name), "");
  expect(batchScripts([dir, join(dir, "b.pad")])).toEqual([join(dir, "a.pad"), join(dir, "b.pad"), join(dir, "b.pad")]);
  const pool = join(dir, "pool.json");
  writeFileSync(pool, JSON.stringify({ pairs: [0, 1, 2].map((id) => ({ id, clients: `/pool/pair-${id}/clients.json`, appIds: { a: `a${id}`, b: `b${id}` } })) }));
  const pairs = lanPairs(pool, { count: 2 });
  expect(pairs.map((pair) => [pair.name, pair.clients, pair.lan, pair.appIds.get("b")])).toEqual([["lan-0", "/pool/pair-0/clients.json", 0, "b0"], ["lan-1", "/pool/pair-1/clients.json", 1, "b1"]]);
  expect(() => lanPairs(pool, { count: 4 })).toThrow(/lists 3 pairs/);
  expect(lanPairs(pool, { ids: [2] }).map((pair) => pair.name)).toEqual(["lan-2"]);
  expect(() => lanPairs(pool, { ids: [5] })).toThrow(/no pair 5/);
});
