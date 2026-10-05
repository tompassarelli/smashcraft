// Runs the converted game tests registered through src/runtime/testing.ts.
// Optional filter: GAME_TESTS=Simulation bun test test/game.test.ts
import { describe, test } from "bun:test";
import { registeredTests } from "../src/runtime/testing";

const filter = process.env.GAME_TESTS ?? "";
const modules = [...new Bun.Glob("**/*.tests.ts").scanSync(`${import.meta.dir}/../src`)].sort();
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
  describe(module.replace(/\.tests\.ts$/, ""), () => {
    if (loadError !== undefined) test("loads", () => { throw loadError; });
    for (const t of added) test(t.name, t.run);
  });
}
