// Runs game tests registered through wisp:src/runtime/testing.ts.
// Optional filter: GAME_TESTS=Simulation bun test test/game.test.ts
// GAME_TEST_SHARD=K/N runs every Nth module starting at K; scripts/test.ts runs all shards.
// GAME_SOAK=1 runs the long *.soak.ts scenarios instead, without a time limit.
import { describe, test } from "bun:test";
import { registeredTests } from "wisp/src/runtime/testing";

const filter = process.env.GAME_TESTS ?? "";
const soak = process.env.GAME_SOAK === "1";
const [shard, shards] = (process.env.GAME_TEST_SHARD ?? "0/1").split("/").map(Number);
if (shard === undefined || shards === undefined || !Number.isInteger(shard) || !Number.isInteger(shards) || shard < 0 || shard >= shards) {
  throw new Error(`GAME_TEST_SHARD must be K/N with 0 <= K < N, got ${process.env.GAME_TEST_SHARD}`);
}
const modules = [...new Bun.Glob(soak ? "**/*.soak.ts" : "**/*.tests.ts").scanSync(`${import.meta.dir}/../src`)].sort();
for (const [index, module] of modules.entries()) {
  if (index % shards !== shard || !module.includes(filter)) continue;
  const before = registeredTests.length;
  let loadError: unknown;
  try {
    await import(`../src/${module}`);
  } catch (error) {
    loadError = error;
  }
  const added = registeredTests.slice(before);
  describe(module.replace(/\.(tests|soak)\.ts$/, ""), () => {
    if (loadError !== undefined) test("loads", () => { throw loadError; });
    for (const t of added) test(t.name, t.run, soak ? Number.MAX_SAFE_INTEGER : undefined);
  });
}
