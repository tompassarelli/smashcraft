// The desync guard: two simulated clients, local slot 0 and local slot 1,
// run the map's TypeScript entry in lockstep through a match and a hot reload
// mid-match, and must make the same native calls in the same order. Only
// local-only natives may differ: Wisp's own and those
// scripts/wisp/headless.ts declares. Wisp's headless runtime stands in for
// Warcraft, so this finds code that branches on the local client; it does not
// prove native behavior.
import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import type { MapEntry } from "wisp/src/headless/client";
import type { Lockstep } from "wisp/src/headless/lockstep";
import { CURRENT_BUILD, PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { DESYNC_COMMAND } from "../src/game/shell/devSettings";
import { install, start } from "../src/platform/main";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { entryFor, expectNoDivergence, playThroughReload } from "./desync/journeys";
import { type InputTrace, beginInputTrace, finishInputTrace, inputTrace, traceInput } from "../src/platform/shell/trace";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

test("desync guard: both clients make the same native calls through a match and a hot reload", () => {
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

/** Start, then slot 1 types the deliberate desync command. */
function typeDesync(entry: MapEntry): Lockstep {
  const clients = headless.clients(entry);
  clients.start();
  clients.frames(1);
  clients.chat(1, DESYNC_COMMAND);
  clients.frames(2);
  return clients;
}

const devReceipts = (clients: Lockstep) => clients.clients.map(client => [...client.files.keys()].filter(name => name.startsWith("smashcraft-dev-")));

test("-dev desync creates one more handle on the typing player's client and nothing else differs", () => {
  const clients = typeDesync({ start, install });
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  const [host, typist] = clients.clients.map(client => client.log.map(({ name }) => name));
  const at = typist?.findIndex((name, index) => name !== host?.[index]) ?? -1;
  expect(typist?.[at]).toBe("CreateTimer");
  expect(typist?.slice(at + 1)).toEqual(host?.slice(at));
  expect(clients.firstDivergence()).toBeDefined();
  expect(devReceipts(clients).map(names => names.length)).toEqual([1, 1]);
});

test("the playable build ignores -dev desync", () => {
  expect(PLAYABLE_BUILD.devConsole).toBe(false);
  const clients = typeDesync(entryFor(PLAYABLE_BUILD));
  expectNoDivergence(clients);
  expect(devReceipts(clients)).toEqual([[], []]);
});

test("an input trace starts and finishes on one client only, as the helper's first row arrives there, without a synchronized native call", () => {
  // A trace starts at this client's own first journal row (journal.ts), a turn the other client reaches at another time;
  // a handle made then is born on different turns on each client, a native tempest-checksum desync (#158).
  const clients = headless.clients({ start: () => {}, install: () => {} });
  clients.start();
  const traces: InputTrace[] = [];
  clients.everywhere(() => void traces.push(inputTrace(2048)));
  clients.frames(3);
  const trace = traces[0];
  if (trace === undefined) throw new Error("no trace");
  clients.client(0).run(() => {
    beginInputTrace(trace);
    traceInput(trace, "first row");
    finishInputTrace(trace);
  });
  clients.frames(3);
  expectNoDivergence(clients);
  expect(trace.lines).toEqual(["0 0.000 first row"]);
});
