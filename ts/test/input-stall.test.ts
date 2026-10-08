// Issue #46: a player's controller input stops mid-match. Every client names
// the player the match waits for during the stall (#348), and the
// match goes on when the input returns. Two simulated clients of the journal (integrity) build, with Battle.net's
// measured sync latency.
import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import type { HeadlessClient } from "wisp/src/headless/client";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { JournalHelpers } from "./rematch/journalHelper";
import { WAITING, confirmedFrame, expectSynchronized, shows, startPlayableMatch } from "./rematch/playableMatch";
import { activeRollback, shell } from "../src/platform/shell/state";
import { waitingMessage } from "../src/game/shell/messages";
import { startProbe } from "../src/platform/shell/responseProbe";
import { value } from "./rematch/playableMatch";

const headless = installHeadless(PREDICTED_HEADLESS);
afterAll(headless.restore);

test("a helper that stops mid-match shows who every client waits for within a second and clears on resume [spec #46] [spec #348]", () => {
  const helpers = new JournalHelpers(INTEGRITY_BUILD.id, true);
  helpers.workload = { denseCycles: 2, walkers: [] };
  const { clients, frames, clientA: a, clientB: b } = startPlayableMatch(headless, helpers, false);
  frames(60);
  expect(confirmedFrame(a)).toBeGreaterThan(0);
  expect([shows(a, WAITING), shows(b, WAITING)]).toEqual([false, false]);
  for (const client of [a, b]) client.run(() => {
    const probe = shell().probe;
    if (probe === undefined) throw new Error("integrity has no response probe");
    startProbe(probe, false);
  });
  // Player 2's helper types nothing for two seconds.
  const cut = clients.frame;
  helpers.silent.add(1);
  const waitingFor = (client: HeadlessClient) => value(client, () => activeRollback(shell())?.waitingFor ?? 0);
  const named = (client: HeadlessClient) => waitingFor(client) !== 0 && waitingMessage(waitingFor(client)) === WAITING;
  const shown = new Map<HeadlessClient, number>();
  for (let frame = 0; frame < 120; frame++) {
    frames(1);
    for (const client of [a, b]) {
      if (!shown.has(client) && shows(client, WAITING)) shown.set(client, clients.frame - cut);
      expect(shows(client, WAITING)).toBe(named(client));
    }
  }
  // Within one second (60 frames) of player 2's input stopping, on both clients.
  expect([shown.get(a) ?? Infinity, shown.get(b) ?? Infinity].every(frames => frames <= 60)).toBe(true);
  expect(value(a, () => shell().probe?.waitingCallbacks)).toBeGreaterThan(0);
  expect(value(a, () => shell().probe?.waitingOwnCallbacks)).toBe(0);
  expect(value(b, () => shell().probe?.waitingOwnCallbacks)).toBeGreaterThan(0);
  const stalled = confirmedFrame(a);
  helpers.silent.delete(1);
  const restored = clients.frame;
  const cleared = new Map<HeadlessClient, number>();
  for (let frame = 0; frame < 60; frame++) {
    frames(1);
    for (const client of [a, b]) if (!cleared.has(client) && waitingFor(client) === 0) cleared.set(client, clients.frame - restored);
  }
  expect([cleared.get(a) ?? Infinity, cleared.get(b) ?? Infinity].every(frames => frames <= 30)).toBe(true);
  expect([waitingFor(a), waitingFor(b), shows(a, WAITING), shows(b, WAITING)]).toEqual([0, 0, false, false]);
  for (const client of [a, b]) expect(confirmedFrame(client)).toBeGreaterThan(stalled + 30);
  expectSynchronized(clients);
  console.log(`helper cut: waiting named ${shown.get(a)}/${shown.get(b)} frames after the cut, cleared ${cleared.get(a)}/${cleared.get(b)} frames after input returned; confirmed ${stalled} -> ${confirmedFrame(a)}`);
});
