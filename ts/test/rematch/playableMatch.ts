// Two simulated clients of the journal (integrity) build with Battle.net's measured sync
// latency, from start to the match player 1 starts, for the tests of a player
// whose controller input is missing or stops (#46).
import { expect } from "bun:test";
import type { HeadlessRuntime } from "wisp/scripts/wisp/headless";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import type { HeadlessClient } from "wisp/src/headless/client";
import type { Lockstep } from "wisp/src/headless/lockstep";
import { Phase } from "../../src/game/match/rules";
import { INTEGRITY_BUILD } from "../../src/game/shell/currentBuild";
import { Character } from "../../src/game/sim/codes";
import { install, startBuild } from "../../src/platform/main";
import { confirmedChecksum } from "../../src/platform/shell/diagnostics";
import { Key } from "../../src/platform/shell/keyEvents";
import { panelActions } from "../../src/platform/shell/menus";
import { shell } from "../../src/platform/shell/state";
import type { JournalHelpers } from "./journalHelper";

export const WAITING = "Waiting for Player 2";

export function value<T>(client: HeadlessClient, body: () => T): T {
  let result: T | undefined;
  client.run(() => {
    result = body();
  });
  return result as T;
}

export const shows = (client: HeadlessClient, text: string) => client.frames.shownText().some(shown => shown.includes(text));
export const confirmedFrame = (client: HeadlessClient) => value(client, () => shell().runtime.simulationFrame);

/** Fighter selection, optionally a computer Illidan in slot C, then the match player 1 starts; helpers type after each frame. */
export function startPlayableMatch(headless: HeadlessRuntime, helpers: JournalHelpers, withComputer: boolean) {
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0, 1], {
    delivery: syncDelivery(MEASURED_BATTLE_NET, 46), keepCalls: 64,
  });
  const frames = (count: number) => {
    for (let frame = 0; frame < count; frame++) {
      clients.frames(1);
      helpers.service(clients);
    }
  };
  const host = clients.client(0);
  const until = (what: string, done: () => boolean) => {
    for (let frame = 0; frame < 60 && !done(); frame++) frames(1);
    if (!done()) throw new Error(`${what} not reached`);
  };
  clients.start();
  frames(30);
  for (const slot of [0, 1]) clients.press(slot, Key.n);
  frames(5);
  if (withComputer) {
    // Slot C goes from empty to a human fighter, then to a computer.
    for (let click = 0; click < 2; click++) clients.everywhere(() => panelActions().selection.cycleMode(0, 2));
    expect(value(host, () => [shell().game.humanFighterMask, shell().game.computerMask, shell().game.characterChoices[2]])).toEqual([3, 4, Character.demonHunter]);
  }
  clients.press(0, Key.y);
  until("stage selection", () => value(host, () => shell().game.phase) === Phase.stageMenu);
  clients.press(0, Key.y);
  until("the match", () => value(host, () => shell().game.phase) === Phase.match);
  return { clients, frames, clientA: clients.client(0), clientB: clients.client(1) };
}

/** The clients' synchronized native calls and confirmed match states are equal. */
export function expectSynchronized(clients: Lockstep): void {
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  expect(clients.firstDivergence()).toBeUndefined();
  const [first, second] = clients.clients.map(client => [client.checksum(), value(client, () => confirmedChecksum(shell()))]);
  expect(second).toEqual(first);
}
