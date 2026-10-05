// `wisp dev [--data DIR ...]`: every save's type errors, affected tests,
// quick-match journey in two simulated clients and whole type check, each
// with its time since the save (wisp:docs/dev.md). With --data it also
// hot-reloads the development build into those clients.
import { join } from "node:path";
import { type DevProject, makeDev } from "wisp/scripts/wisp/commands/dev";
import { ISOLATED_TEST_GROUPS, TEST_WORKER_ENV } from "../../testWorkers";
import { buildProject, sourceMapDirectory, tsDirectory } from "../project";

export const SMASHCRAFT_DEV: DevProject = {
  root: tsDirectory,
  sources: ["src", "scripts", "test"],
  typeCheck: { projects: ["tsconfig.json", "tsconfig.game.json"], command: [process.execPath, "run", "check"] },
  tests: {
    // scripts/test.ts's full suite: every Bun test file and the game registry.
    files: ["{src,scripts,test}/**/*{.test,_test,.spec,_spec}.{js,jsx,ts,tsx}", "scripts/**/*.tests.ts"],
    registry: "src/**/*.tests.ts",
    registryRunners: ["test/game.test.ts"],
    preload: ["test/host-natives.ts"],
    reads: {
      "test/source-shapes.test.ts": ["src/**/*.ts", "scripts/**/*.ts"],
      "test/wisp.test.ts": ["test/fixtures/wisp/**"],
      // Dated evidence records, never edited.
      "test/integrity.test.ts": ["../evidence/**"],
      "test/playable.test.ts": ["test/fixtures/playable-0045/**", "../evidence/**"],
      // Only the temporary directories it creates.
      "test/tape-process.test.ts": [],
    },
    isolated: ISOLATED_TEST_GROUPS,
    env: TEST_WORKER_ENV,
  },
  journey: { module: "scripts/wisp/journeys.ts", export: "SMASHCRAFT_JOURNEYS", name: "quick-match" },
  hot: { project: buildProject("main"), sourceDirectory: join(tsDirectory, "src"), sourceMapDirectory, filePrefix: "smashcraft" },
};

export const dev = makeDev(SMASHCRAFT_DEV);
