// Issue #168: a callback confirms only the rows every client had received
// when the previous callback began, so a correction's repair spreads over the
// callback after its rows arrive and the frame budget holds. Two simulated
// clients of the journal (integrity) build, with Battle.net's measured sync latency.
import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { activeRollback, shell } from "../src/platform/shell/state";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { JournalHelpers } from "./rematch/journalHelper";
import { confirmedFrame, expectSynchronized, startPlayableMatch, value } from "./rematch/playableMatch";

const headless = installHeadless(PREDICTED_HEADLESS);
afterAll(headless.restore);

test("every client confirms the same frame in the same callback, never past the rows known a callback earlier [invariant]", () => {
  const helpers = new JournalHelpers(INTEGRITY_BUILD.id, true);
  helpers.workload = { denseCycles: 2, walkers: [] };
  const { frames, clients, clientA: a, clientB: b } = startPlayableMatch(headless, helpers, false);
  const known = (client: typeof a) => value(client, () => activeRollback(shell())?.knownBefore ?? 0);
  frames(30);
  const start = confirmedFrame(a);
  let trailed = 0;
  for (let callback = 0; callback < 60; callback++) {
    const before = known(a);
    frames(1);
    expect(confirmedFrame(b)).toBe(confirmedFrame(a));
    expect(confirmedFrame(a)).toBeLessThanOrEqual(before);
    if (known(a) > confirmedFrame(a)) trailed++;
  }
  expect(confirmedFrame(a)).toBeGreaterThan(start + 45);
  expect(trailed).toBeGreaterThan(10);
  expectSynchronized(clients);
});
