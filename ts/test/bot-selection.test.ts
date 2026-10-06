// The native bot session's selection (scripts/wisp/botMatch.ts BOT_FOUR):
// players A and B on journal helpers, a computer Illidan in C and a computer
// Archer in D, through fighter and stage selection on the integrity build.
// Stepping back from Frozen Throne wraps to Sky Deck, a stage with fewer
// decks than the arena still draws until the match starts.
import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { Phase } from "../src/game/match/rules";
import { STAGE_CATALOG } from "../src/game/menu/stageCatalog";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { FROZEN_THRONE_STAGE, surfaceCount } from "../src/game/sim/stage";
import { install, startBuild } from "../src/platform/main";
import { Key } from "../src/platform/shell/keyEvents";
import { shell } from "../src/platform/shell/state";
import { BOT_FOUR } from "../scripts/wisp/botMatch";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { JournalHelpers } from "./rematch/journalHelper";
import { value } from "./rematch/playableMatch";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

test("bot session: selection with computers in C and D steps to every stage and starts without errors", () => {
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0, 1]);
  const helpers = new JournalHelpers(INTEGRITY_BUILD.id, true);
  const frames = (n: number) => { for (let i = 0; i < n; i++) { clients.frames(1); helpers.service(clients); } };
  const read = <T>(body: () => T) => value(clients.client(0), body);
  const until = (what: string, done: () => boolean) => {
    for (let i = 0; i < 120 && !done(); i++) frames(1);
    expect(done(), what).toBe(true);
  };
  const errors = () => clients.clients.flatMap(client => client.errors.map(error => `p${client.slot}: ${error}`));
  clients.start();
  frames(30);
  for (const client of clients.clients) clients.press(client.slot, Key.n);
  frames(5);
  clients.everywhere(() => {
    const { game } = shell();
    for (const [slot, character] of BOT_FOUR.computers) {
      game.computerMask |= 1 << slot;
      game.characterChoices[slot] = character;
      game.characterReadiness[slot] = true;
    }
  });
  frames(30);
  expect(errors()).toEqual([]);
  clients.press(0, Key.y);
  until("stage selection", () => read(() => shell().game.phase) === Phase.stageMenu);
  expect(read(() => shell().game.stageChoice)).toBe(FROZEN_THRONE_STAGE);
  // W steps back: from Frozen Throne to Sky Deck, then around the whole lineup.
  for (let step = 1; step <= STAGE_CATALOG.length; step++) {
    clients.press(0, Key.w);
    frames(10);
    expect(errors(), `after ${step} steps back`).toEqual([]);
  }
  clients.press(0, Key.w);
  frames(10);
  const stage = read(() => shell().game.stageChoice);
  expect(stage).toBe(0);
  for (const client of clients.clients) expect(value(client, () => shell().game.stageChoice)).toBe(stage);
  clients.press(0, Key.y);
  until("the match", () => read(() => shell().game.phase) === Phase.match);
  frames(60);
  expect(errors()).toEqual([]);
  for (const client of clients.clients) expect(value(client, () => shell().stageDecks.length)).toBe(surfaceCount(stage));
});
