// `bun wisp pad --batch` plays many scripts in one game per pair: a new game
// (about a minute: menus, lobby, map load) only starts a session or replaces
// one an invalid or broken run left, never between valid scripts, unless
// --fresh-each asks for the old loop.
import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { batchScripts, lanPairs, needsNewGame } from "../scripts/wisp/padBatch";

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
  const pairs = lanPairs(pool, 2);
  expect(pairs.map((pair) => [pair.name, pair.clients, pair.lan, pair.appIds.get("b")])).toEqual([["lan-0", "/pool/pair-0/clients.json", 0, "b0"], ["lan-1", "/pool/pair-1/clients.json", 1, "b1"]]);
  expect(() => lanPairs(pool, 4)).toThrow(/lists 3 pairs/);
});
