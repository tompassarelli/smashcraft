// Two-client journeys shared by the desync guard's test files.
import { expect } from "bun:test";
import type { MapBuild } from "../../src/game/shell/build";
import { replayHistoryPlayback } from "../../src/game/shell/rollbackPlayback";
import { installDispatch } from "wisp/src/platform/dispatch";
import { configureRuntime } from "wisp/src/runtime/config";
import { installHotReload, startHotReload } from "wisp/src/platform/hotReload";
import { installShell, startShell } from "../../src/platform/shell/shell";
import { installObjectData } from "../../src/platform/shell/objectData";
import { Lockstep } from "./twoClients";

const CTRL = 2;
const T_KEY = 0x54;

export interface Entry {
  start(): void;
  install(): void;
}

/** The map entry with another build, as packaging would choose it. */
export function entryFor(build: MapBuild): Entry {
  const reinstall = () => {
    configureRuntime({ filePrefix: "smashcraft", globalPrefix: "__smashcraft", announcePrefix: "SC_HR", readyPrefix: "SC_HRR" });
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
      startHotReload(0, GetPlayerId(GetLocalPlayer()));
    },
  };
}

/** Start, -dev quick, a traced match, a hot reload mid-match, more match. */
export function playThroughReload(entry: Entry): Lockstep {
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
  clients.ticks(120);
  return clients;
}

export function expectNoDivergence(clients: Lockstep): void {
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  expect(clients.firstDivergence()).toBeUndefined();
}
