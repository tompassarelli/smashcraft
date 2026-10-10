// How test processes run, shared by the full suite (scripts/test.ts) and
// `bun wisp dev`.

/**
 * The game registry and native fixtures own independent global stubs, so each
 * group runs in a process of its own; every other test file may share one.
 */
export const ISOLATED_TEST_GROUPS: readonly (readonly string[])[] = [
  ["test/standalone.test.ts"],
  ["scripts/platformAdvantage.tests.ts"],
  ["test/game.test.ts"],
  ["test/desync-guard.test.ts"],
  ["test/visual-lifecycle.test.ts", "test/player-view.test.ts", "test/player-text.test.ts"],
  ["test/lag-recovery.test.ts"],
  ["test/local-start.test.ts", "test/match-settings.test.ts"],
];

/**
 * Engine settings for short-lived test processes: they cannot amortize the
 * optimizing tiers' compile work for all but their hottest loops, and neither
 * a GC marker thread per core nor a concurrent collector thread repays its CPU
 * (measured on 6 CPUs: concurrent GC off cut the full suite about 7%).
 */
export const TEST_WORKER_ENV: Readonly<Record<string, string>> = {
  BUN_JSC_useFTLJIT: "false",
  BUN_JSC_numberOfDFGCompilerThreads: "1",
  BUN_JSC_thresholdForOptimizeAfterWarmUp: "16000",
  BUN_JSC_thresholdForOptimizeSoon: "16000",
  BUN_JSC_numberOfGCMarkers: "1",
  BUN_JSC_useConcurrentGC: "false",
};

/** Full matches and the all-pairs platform measurement amortize the production runtime's optimizing tiers. */
export const testWorkerEnvironment = (files: readonly string[]): Readonly<Record<string, string>> =>
  files.some((file) => file.endsWith("test/standalone.test.ts") || file.endsWith("scripts/platformAdvantage.tests.ts")) ? {} : TEST_WORKER_ENV;
