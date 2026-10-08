// The desync guard's journey (see test/desync-guard.test.ts) on the journal
// integrity build. Its own file lets the suite run both journeys in parallel.
import { afterAll, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { entryFor, expectNoDivergence, playThroughReload } from "./desync/journeys";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

// About 1 s alone; a loaded host takes a test several times that, past Bun's 5 s default.
test("desync guard: the journal integrity build makes the same native calls on every client [invariant]", () => {
  expectNoDivergence(playThroughReload(headless, entryFor(INTEGRITY_BUILD)));
}, 30_000);
