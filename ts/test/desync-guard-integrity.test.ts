// The desync guard's journey (see test/desync-guard.test.ts) on the journal
// integrity build. Its own file lets the suite run both journeys in parallel.
import { afterAll, test } from "bun:test";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { installNatives } from "./desync/twoClients";
import { entryFor, expectNoDivergence, playThroughReload } from "./desync/journeys";

const restoreNatives = installNatives();
afterAll(restoreNatives);

test("desync guard: the journal integrity build makes the same native calls on every client", () => {
  expectNoDivergence(playThroughReload(entryFor(INTEGRITY_BUILD)));
});
