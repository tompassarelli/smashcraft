// Two-client journeys shared by the desync guard's test files.
import { expect } from "bun:test";
import type { HeadlessRuntime } from "wisp/scripts/wisp/headless";
import type { MapEntry } from "wisp/src/headless/client";
import type { Lockstep } from "wisp/src/headless/lockstep";
import type { MapBuild } from "../../src/game/shell/build";
import { install, startBuild } from "../../src/platform/main";

const CTRL = 2;
const T_KEY = 0x54;

/** The map entry with another build, as packaging would choose it. */
export function entryFor(build: MapBuild): MapEntry {
  return { install, start: () => startBuild(build) };
}

/** Start, -dev quick, a traced match, install() mid-match on every client on one frame, more match. */
export function playThroughReload(headless: HeadlessRuntime, entry: MapEntry, settleFrames = 120): Lockstep {
  const clients = headless.clients(entry);
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick");
  clients.frames(settleFrames);
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
  clients.frames(settleFrames);
  return clients;
}

export function expectNoDivergence(clients: Lockstep): void {
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  expect(clients.firstDivergence()).toBeUndefined();
}
