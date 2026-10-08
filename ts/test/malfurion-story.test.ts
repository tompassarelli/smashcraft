import { sweep } from "./sweep";
import { afterAll, expect } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { classicRoute } from "../src/game/classic/routes";
import { BossKind } from "../src/game/classic/runState";
import { Phase } from "../src/game/match/rules";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { Character } from "../src/game/sim/codes";
import { RULE_BUTTONS } from "../src/game/ui/ruleButtons";
import { install, startBuild } from "../src/platform/main";
import { Key } from "../src/platform/shell/keyEvents";
import { shell } from "../src/platform/shell/state";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { JournalHelpers, rowFor } from "./rematch/journalHelper";
import { expectSynchronized, shows, value } from "./rematch/playableMatch";

const headless = installHeadless(PREDICTED_HEADLESS);
afterAll(headless.restore);

function storyClients(idle = false) {
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0, 1]);
  const helpers = new JournalHelpers(INTEGRITY_BUILD.id, idle);
  helpers.rows = (slot, frame) => rowFor(slot, frame, { denseCycles: 0, walkers: [] });
  const frames = (n: number) => { for (let i = 0; i < n; i++) { clients.frames(1); helpers.service(clients); } };
  const until = (what: string, done: () => boolean, n = 600) => {
    for (let i = 0; i < n && !done(); i++) frames(1);
    expect(done(), what).toBe(true);
  };
  return { clients, frames, until, read: <T>(body: () => T) => value(clients.client(0), body) };
}

import { LORE_BATTLES } from "../src/game/classic/loreBattles";
import { RunOutcome } from "../src/game/classic/runState";
import { panelActions } from "../src/platform/shell/menus";
import { PARTICIPANT_SLOTS } from "../src/game/input/participants";
import { fighterAt, isActive } from "../src/game/sim/roster";

sweep("Malfurion selects Classic, six scripted wins reach his ending and results, and his authored Lore battle starts [spec #351] [invariant]", () => {
  const { clients, frames, until, read } = storyClients(true);
  clients.start(); frames(30);
  const mode = RULE_BUTTONS.training;
  for (let press = 0; press < 2; press++) {
    expect(clients.click(0, mode.x + mode.width / 2, mode.y - mode.height / 2)).toBe(true);
    frames(1);
  }
  clients.everywhere(() => panelActions().selection.selectChoice(0, Character.malfurion));
  expect(read(() => shell().game.characterChoices[0])).toBe(Character.malfurion);
  for (const actor of [0, 1]) clients.press(actor, Key.n);
  frames(5); clients.press(0, Key.y);
  const route = classicRoute(Character.malfurion);
  expect(route).toBeDefined();
  for (let fight = 0; fight < 6; fight++) {
    until(`Malfurion fight ${fight + 1}`, () => read(() => shell().game.phase) === Phase.match);
    frames(2);
    expect(read(() => [shell().game.run.fighter, shell().game.run.fight])).toEqual([Character.malfurion, fight]);
    if (fight < 5) expect(read(() => shell().game.stageChoice)).toBe(route?.fights[fight]?.stage);
    else expect(read(() => shell().game.run.boss.kind)).toBe(BossKind.archimonde);
    // Script rival knockouts; the real map judges the match and advances on the player's confirm.
    clients.everywhere(() => {
      const { game, world } = shell();
      for (const slot of PARTICIPANT_SLOTS) {
        if (slot === game.run.player || !isActive(world, slot)) continue;
        fighterAt(world, slot).status.stocks = 0;
        fighterAt(world, slot).status.out = true;
      }
      game.run.boss.health = 0;
    });
    until(`fight ${fight + 1} result`, () => read(() => shell().game.phase) === Phase.result);
    frames(3);
    expect(read(() => shell().game.run.outcome)).toBe(RunOutcome.won);
    if (fight < 5) clients.press(0, Key.y);
  }
  expect(read(() => shell().game.run.cleared)).toBe(true);
  for (const client of clients.clients) {
    for (const line of route?.ending ?? []) expect(shows(client, line)).toBe(true);
    expect(shows(client, "continues · finished on")).toBe(true);
  }
  expectSynchronized(clients);
  clients.press(0, Key.y);
  until("Classic returns to selection", () => read(() => shell().game.phase) === Phase.characterMenu);
  const lore = LORE_BATTLES.findIndex(battle => battle.id === "lore.hyjal-malfurion");
  expect(lore).toBeGreaterThanOrEqual(20);
  clients.chat(0, `-dev lore ${lore + 1}`);
  until("Malfurion's Lore battle", () => read(() => shell().game.phase) === Phase.match);
  frames(2);
  for (const client of clients.clients) {
    expect(value(client, () => [shell().game.run.current?.id, shell().game.characterChoices[0], shell().game.run.boss.kind])).toEqual(["lore.hyjal-malfurion", Character.malfurion, BossKind.archimonde]);
  }
  expectSynchronized(clients);
}, 120000);
