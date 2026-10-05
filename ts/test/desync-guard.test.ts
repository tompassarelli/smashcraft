// The desync guard: two simulated clients, local slot 0 and local slot 1,
// run the map's TypeScript entry in lockstep through a match and a hot reload
// mid-match, and must make the same native calls in the same order. Only the
// local-only calls in test/desync/twoClients.ts ALLOWED_LOCAL may differ.
// Host stubs stand in for Warcraft, so this finds code that branches on the
// local client; it does not prove native behavior.
import { afterAll, expect, test } from "bun:test";
import { CURRENT_BUILD, INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import type { MapBuild } from "../src/game/shell/build";
import { uncorrectedPlayback } from "../src/game/shell/uncorrectedPlayback";
import { installDispatch } from "../src/platform/dispatch";
import { installHotReload, startHotReload } from "../src/platform/hotReload";
import { install, start } from "../src/platform/main";
import { installShell, startShell } from "../src/platform/shell/shell";
import { Lockstep, installNatives } from "./desync/twoClients";

const restoreNatives = installNatives();
afterAll(restoreNatives);

const CTRL = 2;
const T_KEY = 0x54;

interface Entry {
  start(): void;
  install(): void;
}

/** The map entry with another build, as packaging would choose it. */
function entryFor(build: MapBuild): Entry {
  const reinstall = () => {
    installDispatch();
    installShell();
    installHotReload();
  };
  return {
    install: reinstall,
    start: () => {
      reinstall();
      startShell(build, uncorrectedPlayback());
      startHotReload(0, GetPlayerId(GetLocalPlayer()));
    },
  };
}

/** Start, -dev quick, a traced match, a hot reload mid-match, more match. */
function playThroughReload(entry: Entry): Lockstep {
  const clients = new Lockstep([0, 1]);
  clients.everywhere(() => entry.start());
  clients.ticks(30);
  clients.chat(0, "-dev quick");
  clients.ticks(120);
  clients.press(0, T_KEY, CTRL);
  clients.ticks(330);
  const nativeCallCount = clients.clients.map(client => client.log.length);
  clients.everywhere(() => entry.install());
  for (const [index, client] of clients.clients.entries()) {
    const installCalls = client.log.slice(nativeCallCount[index] ?? 0);
    expect(installCalls.filter(call => /^(?:Create|BlzCreate|AddSpecialEffect|Destroy|BlzDestroy|Remove)\w+\(/.test(call))).toEqual([]);
  }
  clients.ticks(120);
  return clients;
}

function expectNoDivergence(clients: Lockstep): void {
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  expect(clients.firstDivergence()).toBeUndefined();
}

test("desync guard: both clients make the same native calls through a match and a hot reload", () => {
  expect(CURRENT_BUILD.devConsole).toBe(true);
  const clients = playThroughReload({ start, install });
  expectNoDivergence(clients);
  for (const client of clients.clients) {
    expect(client.files.has("wc3-melee-ready.txt")).toBe(true);
    expect(client.files.has("wc3-melee-input-trace.txt")).toBe(true);
  }
  const state = clients.clients[0];
  expect(state?.log.length ?? 0).toBeGreaterThan(1000);
});

test("desync guard: the journal integrity build makes the same native calls on every client", () => {
  expectNoDivergence(playThroughReload(entryFor(INTEGRITY_BUILD)));
});
