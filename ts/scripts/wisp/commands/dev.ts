// `wisp dev [--data DIR ...]`: every save's type errors, affected tests,
// quick-match journey in two simulated clients and whole type check, each
// with its time since the save (wisp:docs/dev.md). With --data it also
// hot-reloads the development build into those clients.
import { join } from "node:path";
import { type DevProject, makeDev } from "wisp/scripts/wisp/commands/dev";
import { ISOLATED_TEST_GROUPS, TEST_WORKER_ENV } from "../../testWorkers";
import { buildProject, sourceMapDirectory, tsDirectory } from "../project";

const SMASHCRAFT_DEV: DevProject = {
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
      "test/command-list.test.ts": ["scripts/wisp.ts", "../AGENTS.md"],
      "test/menu-fresh.test.ts": ["test/fixtures/wisp/**"],
      // Dated evidence records, never edited.
      "test/integrity.test.ts": ["../evidence/**"],
      "test/playable.test.ts": ["test/fixtures/playable-0045/**", "../evidence/**"],
      // Only the temporary directories it creates.
      "test/tape-process.test.ts": [],
      // It copies src/, the tunables' files included, to load the map with tuned values.
      "test/tune.test.ts": ["src/**"],
      "test/repro.test.ts": [],
      "scripts/meleeOracle.tests.ts": ["../docs/gameplay-design.md"],
      // The case study's pages and the reference data its numbers come from.
      "scripts/meleeCaseStudy.tests.ts": ["../docs/design/melee/**", "../references/melee-frame-data/**", "../docs/smash-melee-reference/retail-roster.json"],
    },
    // Played in simulated clients: reported with the quick-match journey.
    journeys: [
      "test/desync-guard.test.ts", "test/desync-guard-integrity.test.ts",
      "test/visual-lifecycle.test.ts", "test/player-view.test.ts", "test/selection-load.test.ts", "test/player-text.test.ts",
      "test/stack-trace.test.ts", "test/rematch-load.test.ts", "test/match-settings.test.ts", "test/missing-input.test.ts", "test/input-stall.test.ts", "test/tune.test.ts", "test/repro.test.ts",
      "test/lag-recovery.test.ts", "test/local-start.test.ts", "test/bot-selection.test.ts", "test/session-setup.test.ts",
    ],
    perFile: ["test/source-shapes.test.ts"],
    // The audit parses with the TypeScript compiler, a third of a second to load.
    warm: { "test/source-shapes.test.ts": ["typescript"] },
    isolated: ISOLATED_TEST_GROUPS,
    env: TEST_WORKER_ENV,
  },
  journey: { module: "scripts/wisp/journeys.ts", export: "SMASHCRAFT_JOURNEYS", name: "quick-match" },
  hot: { project: buildProject("main"), sourceDirectory: join(tsDirectory, "src"), sourceMapDirectory, filePrefix: "smashcraft" },
};

export const dev = makeDev(SMASHCRAFT_DEV);
