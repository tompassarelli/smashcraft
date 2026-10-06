// How test processes run, shared by the full suite (scripts/test.ts) and
// `bun wisp dev`.

/**
 * The game registry and native fixtures own independent global stubs, so each
 * group runs in a process of its own; every other test file may share one.
 */
export const ISOLATED_TEST_GROUPS: readonly (readonly string[])[] = [
  ["test/game.test.ts"],
  ["test/desync-guard.test.ts", "test/desync-guard-integrity.test.ts", "test/input-stall.test.ts"],
  ["test/visual-lifecycle.test.ts", "test/player-view.test.ts", "test/selection-load.test.ts", "test/player-text.test.ts"],
  // source-shapes only reads files, so it fills the short group and the groups finish together.
  ["test/stack-trace.test.ts", "test/missing-input.test.ts", "test/source-shapes.test.ts"],
  ["test/tune.test.ts"],
];

/**
 * Engine settings for short-lived test processes: they cannot amortize the
 * optimizing tiers' compile work for all but their hottest loops, and a GC
 * marker thread per core costs more CPU than it saves.
 */
export const TEST_WORKER_ENV: Readonly<Record<string, string>> = {
  BUN_JSC_useFTLJIT: "false",
  BUN_JSC_numberOfDFGCompilerThreads: "1",
  BUN_JSC_thresholdForOptimizeAfterWarmUp: "16000",
  BUN_JSC_thresholdForOptimizeSoon: "16000",
  BUN_JSC_numberOfGCMarkers: "1",
};
