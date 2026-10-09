import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { CLASSIC_CHARACTERS, classicRoute } from "../src/game/classic/routes";
import { LORE_BATTLES } from "../src/game/classic/loreBattles";
import { Phase } from "../src/game/match/rules";
import { Character } from "../src/game/sim/codes";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { Key } from "../src/platform/shell/keyEvents";
import { shell } from "../src/platform/shell/state";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { JournalHelpers, rowFor } from "./rematch/journalHelper";
import { expectSynchronized, shows, value } from "./rematch/playableMatch";

const headless = installHeadless(PREDICTED_HEADLESS);
afterAll(headless.restore);

const STORIES = [
  { character: Character.anubarak, name: "Anub'arak", lore: "lore.anubarak-ascent" },
  { character: Character.kobold, name: "Kobold", lore: "lore.kobold-candle" },
  { character: Character.medivh, name: "Medivh", lore: "lore.medivh-warning" },
] as const;

for (const { character, name, lore: loreId } of STORIES) test(`${name} selects Classic, clears six fights to its boss, ending and results, returns to selection, and clears its authored Lore Battle [spec #350] [spec #352] [spec #353] [invariant]`, () => {
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0, 1]);
  const helpers = new JournalHelpers(INTEGRITY_BUILD.id, true);
  helpers.rows = (slot, frame) => rowFor(slot, frame, { denseCycles: 0, walkers: [] });
  const frames = (n: number) => { for (let i = 0; i < n; i++) { clients.frames(1); helpers.service(clients); } };
  const read = <T>(body: () => T) => value(clients.client(0), body);
  const until = (label: string, done: () => boolean, limit = 600) => {
    for (let i = 0; i < limit && !done(); i++) frames(1);
    expect(done(), label).toBe(true);
  };
  expect(CLASSIC_CHARACTERS.includes(character)).toBe(true);
  const route = classicRoute(character);
  const battle = LORE_BATTLES.find(entry => entry.id === loreId);
  if (route === undefined || battle === undefined) throw new Error(`${name} route or Lore Battle missing`);
  clients.start(); frames(30);
  clients.chat(0, `-dev classic ${name}`);
  for (let fight = 0; fight < 6; fight++) {
    until(`${name} fight ${fight + 1}`, () => read(() => shell().game.phase) === Phase.match);
    frames(2);
    for (const client of clients.clients) {
      expect(value(client, () => [shell().game.run.fighter, shell().game.run.fight])).toEqual([character, fight]);
      if (fight < 5) expect(value(client, () => shell().game.stageChoice)).toBe(route.fights[fight]?.stage);
      else expect(value(client, () => shell().game.run.boss.kind)).toBe(route.boss);
      client.run(() => {
        const { game, world } = shell();
        for (const fighter of world.fighters) if (fighter !== undefined && fighter !== world.fighters[game.run.player]) {
          fighter.status.stocks = 0;
          fighter.status.out = true;
        }
        game.run.boss.health = 0;
      });
    }
    until(`${name} result ${fight + 1}`, () => read(() => shell().game.phase) === Phase.result);
    frames(100);
    expectSynchronized(clients);
    if (fight === 5) {
      for (const client of clients.clients) {
        expect(value(client, () => shell().game.run.cleared)).toBe(true);
        for (const line of route.ending) expect(shows(client, line), line).toBe(true);
        expect(shows(client, "0 continues")).toBe(true);
      }
    }
    clients.press(0, Key.y); frames(3);
  }
  until("fighter selection after ending", () => read(() => shell().game.phase) === Phase.characterMenu);
  const lore = LORE_BATTLES.indexOf(battle);
  clients.chat(0, `-dev lore ${lore + 1}`);
  until(`${name} Lore match`, () => read(() => shell().game.phase) === Phase.match);
  frames(2);
  for (const client of clients.clients) {
    expect(value(client, () => [shell().game.run.fighter, shell().game.run.current?.id])).toEqual([character, loreId]);
  }
  for (const client of clients.clients) client.run(() => {
    const { game, world } = shell();
    for (const fighter of world.fighters) if (fighter !== undefined && fighter !== world.fighters[game.run.player]) {
      fighter.status.stocks = 0;
      fighter.status.out = true;
    }
  });
  until(`${name} Lore clear`, () => read(() => shell().game.phase) === Phase.result);
  frames(2);
  for (const client of clients.clients) {
    expect(value(client, () => shell().game.run.cleared)).toBe(true);
    expect(shows(client, `Lore Battle cleared: ${battle.title}`)).toBe(true);
    expect(client.errors).toEqual([]);
  }
  expectSynchronized(clients);
}, 30000);
