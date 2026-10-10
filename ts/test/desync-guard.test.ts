






import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { CURRENT_BUILD } from "../src/game/shell/currentBuild";
import { install, start } from "../src/platform/main";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { expectNoDivergence, playThroughReload } from "./desync/journeys";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

test("desync guard: both clients make the same native calls through a match and a hot reload [invariant]", () => {
  expect(CURRENT_BUILD.devConsole).toBe(true);
  const clients = playThroughReload(headless, { start, install });
  expectNoDivergence(clients);
  for (const client of clients.clients) {
    expect(client.files.has("wc3-melee-ready.txt")).toBe(true);
    expect(client.files.has("wc3-melee-input-trace.txt")).toBe(true);
  }
  const state = clients.clients[0];
  expect(state?.log.length ?? 0).toBeGreaterThan(1000);
});
