



import { join } from "node:path";
import { type DevProject, makeDev } from "wisp/scripts/wisp/commands/dev";
import { ISOLATED_TEST_GROUPS, TEST_WORKER_ENV, testWorkerEnvironment } from "../../testWorkers";
import { buildProject, sourceMapDirectory, tsDirectory } from "../project";

export const SMASHCRAFT_DEV: DevProject = {
  root: tsDirectory,
  sources: ["src", "scripts", "test"],
  typeCheck: { projects: ["tsconfig.json", "tsconfig.game.json"], command: [process.execPath, "run", "check"] },
  tests: {

    files: ["{src,scripts,test}/**/*{.test,_test,.spec,_spec}.{js,jsx,ts,tsx}", "scripts/**/*.tests.ts"],
    registry: "src/**/*.tests.ts",
    registryRunners: ["test/game.test.ts"],
    preload: ["test/host-natives.ts"],
    reads: {
      "test/source-shapes.test.ts": ["src/**/*.ts", "scripts/**/*.ts"],
      "test/lua-holes.test.ts": ["src/**/*.ts", "scripts/**/*.ts", "tsconfig.game.json"],
      "test/wisp.test.ts": ["test/fixtures/wisp/**"],
      "test/command-list.test.ts": ["scripts/wisp.ts", "scripts/wisp/commands/help.ts", "../docs/README.md", "../docs/commands/*.md"],
      "test/cli-vocabulary.test.ts": ["scripts/wisp.ts", "scripts/wisp/commands/help.ts", "node_modules/wisp/docs/cli.md", "../docs/README.md"],
      "test/doctor-declaration.test.ts": ["../docs/commands/client.md"],
      "test/stage-render.test.ts": [],
      "test/stage-thumbnails.test.ts": ["stage-thumbnails.json", "src/game/menu/stageSilhouettes.ts"],
      "test/ui-frames.test.ts": ["../tools/selection/art/*.fdf", "../tools/selection/art/*.toc"],
      "test/menu-fresh.test.ts": ["test/fixtures/wisp/**"],

      "test/integrity.test.ts": ["../evidence/**"],
      "test/playable.test.ts": ["test/fixtures/playable-0045/**", "../evidence/**"],

      "test/tune.test.ts": ["src/**"],
      "test/repro.test.ts": [],
      "test/standalone.test.ts": ["test/native/pads/cpu-expert.pad"],
      "test/native-driver.test.ts": ["test/native/pads/rifleman-neutral.pad", "test/native/pads/171/*.pad"],
      "scripts/meleeOracle.tests.ts": ["../docs/gameplay-design.md"],
    },

    journeys: [
      "test/desync-guard.test.ts", "test/desync-guard-integrity.test.ts",
      "test/visual-lifecycle.test.ts", "test/player-view.test.ts", "test/selection-load.test.ts", "test/player-text.test.ts",
      "test/stage-render.test.ts", "test/standalone.test.ts",
      "test/stack-trace.test.ts", "test/rematch-load.test.ts", "test/match-settings.test.ts", "test/missing-input.test.ts", "test/input-stall.test.ts", "test/tune.test.ts", "test/repro.test.ts",
      "test/lag-recovery.test.ts", "test/local-start.test.ts", "test/bot-selection.test.ts", "test/cpu-settings.test.ts", "test/session-setup.test.ts",
    ],
    perFile: ["test/source-shapes.test.ts"],

    warm: { "test/source-shapes.test.ts": ["typescript"] },
    isolated: ISOLATED_TEST_GROUPS,
    env: TEST_WORKER_ENV,
    envForFiles: testWorkerEnvironment,
  },
  journey: { module: "scripts/wisp/journeys.ts", export: "SMASHCRAFT_JOURNEYS", name: "quick-match" },
  hot: { project: buildProject("main"), sourceDirectory: join(tsDirectory, "src"), sourceMapDirectory, filePrefix: "smashcraft" },
};

export const dev = makeDev(SMASHCRAFT_DEV);
