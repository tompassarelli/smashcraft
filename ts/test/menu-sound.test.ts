import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { start, install } from "../src/platform/main";
import { shell } from "../src/platform/shell/state";
import { views } from "../src/platform/shell/ui";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

test("local roster hover reuses a shared sound handle without creating or retiring agents [invariant]", () => {
  const clients = headless.clients({ start, install });
  clients.start(); clients.frames(30);
  const client = clients.client(0);
  const before = client.log.length;
  client.run(() => {
    const state = shell();
    const presentation = views(state).match;
    for (const tile of [0, 1, 2]) presentation.presentMenus(state.game, tile);
  });
  const calls = client.log.slice(before);
  expect(calls.filter(call => call.name === "CreateSound" || call.name === "KillSoundWhenDone")).toHaveLength(0);
  const starts = calls.filter(call => call.name === "StartSound");
  expect(starts).toHaveLength(3);
  expect(new Set(starts.map(call => call.args[0])).size).toBe(1);
});
