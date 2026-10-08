// #305: Lore Battles chosen with the mode button at fighter selection, the
// first battle started from its list on both journal clients with its own
// fighter, opponent and stage, -dev lore starting a later battle, and
// -dev lore win clearing a battle that stays cleared after a reload.
import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { customMapData } from "wisp/scripts/wisp/headlessInput";
import type { ClientFiles } from "wisp/src/headless/client";
import { LORE_BATTLES } from "../src/game/classic/loreBattles";
import { Phase } from "../src/game/match/rules";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { RULE_BUTTONS } from "../src/game/ui/ruleButtons";
import { install, startBuild } from "../src/platform/main";
import { Key } from "../src/platform/shell/keyEvents";
import { shell } from "../src/platform/shell/state";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { JournalHelpers, rowFor } from "./rematch/journalHelper";
import { expectSynchronized, shows, value } from "./rematch/playableMatch";

const headless = installHeadless(PREDICTED_HEADLESS);
afterAll(headless.restore);

function loreClients(idle = false, files?: (slot: number) => ClientFiles, players: readonly number[] = [0, 1]) {
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, players, files === undefined ? undefined : { files });
  const helpers = new JournalHelpers(INTEGRITY_BUILD.id, idle);
  helpers.rows = (slot, frame) => rowFor(slot, frame, { denseCycles: 0, walkers: [] });
  const frames = (n: number) => { for (let i = 0; i < n; i++) { clients.frames(1); helpers.service(clients); } };
  const until = (what: string, done: () => boolean, n = 600) => {
    for (let i = 0; i < n && !done(); i++) frames(1);
    expect(done(), what).toBe(true);
  };
  return { clients, frames, until, read: <T>(body: () => T) => value(clients.client(0), body) };
}

test("the mode button reaches Lore Battles on both clients, the list steps to the second battle, and Start plays it with its fighter, opponent and stage [spec #305] [invariant]", () => {
  const { clients, frames, until, read } = loreClients();
  clients.start(); frames(30);
  const mode = RULE_BUTTONS.training;
  for (let press = 0; press < 3; press++) {
    expect(clients.click(1, mode.x + mode.width / 2, mode.y - mode.height / 2)).toBe(true);
    frames(1);
  }
  const next = RULE_BUTTONS.harderClassic;
  expect(clients.click(1, next.x + next.width / 2, next.y - next.height / 2)).toBe(true);
  frames(1);
  const battle = LORE_BATTLES[1];
  for (const client of clients.clients) {
    expect(value(client, () => [shell().game.lore, shell().game.classic, shell().game.loreBattle])).toEqual([true, false, 1]);
    expect(shows(client, "Mode: Lore Battles")).toBe(true);
    expect(shows(client, `2/${LORE_BATTLES.length} ${battle?.title}`)).toBe(true);
  }
  for (const actor of [0, 1]) clients.press(actor, Key.n);
  frames(5);
  clients.press(0, Key.y);
  until("the second Lore Battle", () => read(() => shell().game.phase) === Phase.match, 240);
  for (const client of clients.clients) {
    expect(client.errors).toEqual([]);
    expect(value(client, () => {
      const { game } = shell();
      return [game.run.active, game.run.current?.id, game.stageChoice, game.characterChoices[0], game.characterChoices[2]];
    })).toEqual([true, battle?.id, battle?.stage, battle?.player, battle?.opponents[0]?.character]);
  }
  frames(240);
  expectSynchronized(clients);
});

test("-dev lore 20 starts The Ascension's boss battle on the Frozen Throne on both clients [spec #305] [invariant]", () => {
  const { clients, frames, until, read } = loreClients(true);
  clients.start(); frames(30);
  clients.chat(0, "-dev lore 20");
  until("the boss battle", () => read(() => shell().game.phase) === Phase.match, 240);
  frames(120);
  const battle = LORE_BATTLES[19];
  for (const client of clients.clients) {
    expect(client.errors).toEqual([]);
    expect(value(client, () => [shell().game.run.current?.id, shell().game.run.boss.kind, shell().game.stageChoice])).toEqual([battle?.id, battle?.boss, 2]);
  }
  expectSynchronized(clients);
});

test("-dev lore win ends Lore Battle 1 as a clear on both clients, and the clear is saved and shown as (cleared) when the player's game loads again [spec #305] [invariant]", () => {
  const root = mkdtempSync(join(tmpdir(), "lore-win-"));
  try {
    const files = (slot: number) => customMapData(join(root, `player${slot}`));
    const first = loreClients(true, files);
    first.clients.start(); first.frames(5);
    first.clients.chat(0, "-dev lore 1");
    first.until("the first battle", () => first.read(() => shell().game.phase) === Phase.match, 240);
    first.frames(2);
    first.clients.chat(0, "-dev lore win");
    first.until("the battle's result", () => first.read(() => shell().game.phase) === Phase.result, 120);
    first.frames(2);
    for (const client of first.clients.clients) {
      expect(client.errors).toEqual([]);
      expect(value(client, () => [shell().game.run.current?.id, shell().game.run.cleared])).toEqual([LORE_BATTLES[0]?.id, true]);
    }
    expectSynchronized(first.clients);
    const reloaded = loreClients(true, files, [0]);
    reloaded.clients.start(); reloaded.frames(5);
    const mode = RULE_BUTTONS.training;
    for (let press = 0; press < 3; press++) {
      expect(reloaded.clients.click(0, mode.x + mode.width / 2, mode.y - mode.height / 2)).toBe(true);
      reloaded.frames(1);
    }
    expect(reloaded.read(() => shell().game.loreBattle)).toBe(0);
    expect(shows(reloaded.clients.client(0), `1/${LORE_BATTLES.length} ${LORE_BATTLES[0]?.title} |cff40ff40(cleared)|r`)).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
