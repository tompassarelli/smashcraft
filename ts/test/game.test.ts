// Runs game tests registered through wisp:src/runtime/testing.ts.
// Optional filter: GAME_TESTS=Simulation bun test test/game.test.ts
// GAME_SOAK=1 runs the long *.soak.ts scenarios instead, without a time limit.
// SWEEPS=1 runs only the sweeps (src/runtime/sweep.ts), which the suite skips.
// GAME_MODULES=A,B loads only those modules (paths under src/), so the suite
// can spread the registry over several processes.
import { describe, test } from "bun:test";
import { registeredTests } from "wisp/src/runtime/testing";
import { isSweep } from "../src/runtime/sweep";

const filter = process.env.GAME_TESTS ?? "";
const soak = process.env.GAME_SOAK === "1";
const sweeps = process.env.SWEEPS === "1";
const only = process.env.GAME_MODULES?.split(",");
const modules = [...new Bun.Glob(soak ? "**/*.soak.ts" : "**/*.tests.ts").scanSync(`${import.meta.dir}/../src`)].sort()
  .filter((module) => module.includes(filter) && (only === undefined || only.includes(module)));
for (const module of modules) {
  const before = registeredTests.length;
  let loadError: unknown;
  try {
    await import(`../src/${module}`);
  } catch (error) {
    loadError = error;
  }
  const added = registeredTests.slice(before).filter((t) => soak || isSweep(t.name) === sweeps);
  if (added.length === 0 && loadError === undefined) continue;
  describe(module.replace(/\.(tests|soak)\.ts$/, ""), () => {
    if (loadError !== undefined) test("loads", () => { throw loadError; });
    for (const t of added) test(t.name, t.run, soak ? Number.MAX_SAFE_INTEGER : undefined);
  });
}
