// Two-client journeys shared by the desync guard's test files.
import { expect } from "bun:test";
import type { HeadlessRuntime } from "wisp/scripts/wisp/headless";
import type { MapEntry } from "wisp/src/headless/client";
import type { Lockstep } from "wisp/src/headless/lockstep";
import type { MapBuild } from "../../src/game/shell/build";
import { replayHistoryPlayback } from "../../src/game/shell/rollbackPlayback";
import { installDispatch } from "wisp/src/platform/dispatch";
import { configureRuntime } from "wisp/src/runtime/config";
import { installHotReload, startHotReload } from "wisp/src/platform/hotReload";
import { installShell, startShell } from "../../src/platform/shell/shell";
import { installObjectData } from "../../src/platform/shell/objectData";

const CTRL = 2;
const T_KEY = 0x54;

/** The map entry with another build, as packaging would choose it. */
export function entryFor(build: MapBuild): MapEntry {
  const reinstall = () => {
    configureRuntime({ filePrefix: "smashcraft", globalPrefix: "__smashcraft", readyPrefix: "SC_HRR" });
    installDispatch();
    installShell();
    installObjectData();
    installHotReload();
  };
  return {
    install: reinstall,
    start: () => {
      reinstall();
      startShell(build, replayHistoryPlayback());
      startHotReload();
    },
  };
}

/** Start, -dev quick, a traced match, install() mid-match on every client on one frame, more match. */
export function playThroughReload(headless: HeadlessRuntime, entry: MapEntry): Lockstep {
  const clients = headless.clients(entry);
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick");
  clients.frames(120);
  clients.press(0, T_KEY, CTRL);
  clients.frames(330);
  const nativeCallCount = clients.clients.map(client => client.log.length);
  clients.everywhere(() => entry.install());
  for (const [index, client] of clients.clients.entries()) {
    const installCalls = client.log.slice(nativeCallCount[index] ?? 0);
    expect(installCalls.filter(({ name }) => /^(?:Create|BlzCreate|AddSpecialEffect|Destroy|BlzDestroy|Remove)\w+$/.test(name))).toEqual([]);
    // The same existing handles receive both the movement and combat fields.
    const created = client.log.slice(0, nativeCallCount[index]).filter(({ name }) => name === "SetUnitMoveSpeed").map(({ args }) => args[0]);
    const movement = installCalls.filter(({ name }) => name === "SetUnitMoveSpeed");
    const combat = installCalls.filter(({ name }) => name === "BlzSetUnitAttackCooldown");
    expect(movement.length).toBeGreaterThan(0);
    expect(combat.map(({ args }) => args[0])).toEqual(movement.map(({ args }) => args[0]));
    for (const { args } of movement) expect(created).toContain(args[0]);
    const receipt = client.files.get(`smashcraft-object-data-p${client.slot}.txt`);
    expect(receipt?.[0]).toMatch(/^object-data frame \d+ objects \d+:\d+ state /);
    expect(receipt?.filter(line => line.includes(" speed 270 cooldown 1.5")).length).toBe(movement.length);
  }
  clients.frames(120);
  return clients;
}

export function expectNoDivergence(clients: Lockstep): void {
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  expect(clients.firstDivergence()).toBeUndefined();
}
