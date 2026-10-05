// Runs the converted game tests registered through src/runtime/testing.ts.
// Optional filter: GAME_TESTS=Simulation bun test test/game.test.ts
// GAME_SOAK=1 runs the long *.soak.ts scenarios instead, without a time limit.
import { describe, test } from "bun:test";
import { registeredTests } from "../src/runtime/testing";

const filter = process.env.GAME_TESTS ?? "";
const soak = process.env.GAME_SOAK === "1";
const modules = [...new Bun.Glob(soak ? "**/*.soak.ts" : "**/*.tests.ts").scanSync(`${import.meta.dir}/../src`)].sort();
for (const module of modules) {
  if (!module.includes(filter)) continue;
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
