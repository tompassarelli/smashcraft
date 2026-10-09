

import { afterAll, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { entryFor, expectNoDivergence, playThroughReload } from "./desync/journeys";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);


test("desync guard: the journal integrity build makes the same native calls on every client [invariant]", () => {
  expectNoDivergence(playThroughReload(headless, entryFor(INTEGRITY_BUILD), 30));
}, 30_000);
