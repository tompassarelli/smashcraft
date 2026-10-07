// #129: the stage-loading screen between the start press and the match, gated
// on every client's "stage drawn" report, with a timeout for a client that
// never sends one.
import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import { Phase } from "../src/game/match/rules";
import { stageInfo } from "../src/game/menu/stageCatalog";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { STAGE_LOAD_TIMEOUT_FRAMES, STAGE_READY_PREFIX, STAGE_SETTLE_FRAMES } from "../src/game/shell/stageLoad";
import { install, startBuild } from "../src/platform/main";
import { Key } from "../src/platform/shell/keyEvents";
import { shell } from "../src/platform/shell/state";
import { startMatch } from "../src/platform/shell/matchStart";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { JournalHelpers } from "./rematch/journalHelper";
import { expectSynchronized, shows, value } from "./rematch/playableMatch";
const headless = installHeadless(PREDICTED_HEADLESS);
afterAll(headless.restore);

/** Two players at stage selection on Gryphon Aerie; `silent` clients never report their stage. */
function atStageSelection(silent: readonly number[] = [], stage = 11) {
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0, 1], { delivery: syncDelivery(MEASURED_BATTLE_NET, 74), keepCalls: 64 });
  for (const slot of silent) {
    const client = clients.client(slot);
    const send = client.natives.BlzSendSyncData as (prefix: string, data: string) => boolean;
    client.natives.BlzSendSyncData = (prefix: string, data: string) => prefix === STAGE_READY_PREFIX ? true : send(prefix, data);
  }
  const helpers = new JournalHelpers(INTEGRITY_BUILD.id);
  helpers.workload = { denseCycles: 0, walkers: [] };
  const frames = (n: number) => { for (let i = 0; i < n; i++) { clients.frames(1); helpers.service(clients); } };
  const phases = () => clients.clients.map(client => value(client, () => shell().game.phase));
  clients.start(); frames(30);
  for (const actor of [0, 1]) clients.press(actor, Key.n);
  frames(5); clients.press(0, Key.y);
  for (let i = 0; i < 30 && phases()[0] !== Phase.stageMenu; i++) frames(1);
  clients.everywhere(() => { shell().game.stageChoice = stage; });
  return { clients, frames, phases };
}

for (const stage of [10, 11, 13]) test(`${stageInfo(stage).name}: entry and rematch retain the scene prepared beneath the loading cover`, () => {
  const { clients, frames, phases } = atStageSelection([], stage);
  clients.press(0, Key.y); frames(1);
  const prepared = clients.clients.map(client => value(client, () => [...shell().stageDecks, ...(shell().stageScenery ?? [])]));
  for (const client of clients.clients) expect(shows(client, "Getting the arena ready")).toBe(true);
  for (let frame = 0; frame < 120 && phases().some(phase => phase !== Phase.match); frame++) frames(1);
  expect(phases()).toEqual([Phase.match, Phase.match]);
  expect(clients.clients.map(client => value(client, () => [...shell().stageDecks, ...(shell().stageScenery ?? [])]))).toEqual(prepared);
  clients.everywhere(() => startMatch(shell()));
  expect(clients.clients.map(client => value(client, () => [...shell().stageDecks, ...(shell().stageScenery ?? [])]))).toEqual(prepared);
  expectSynchronized(clients);
});

test("the start press shows the stage's loading screen until every client reports the stage drawn", () => {
  const { clients, frames, phases } = atStageSelection();
  clients.press(0, Key.y);
  frames(1);
  const { name } = stageInfo(11);
  expect(phases()).toEqual([Phase.stageMenu, Phase.stageMenu]);
  for (const client of clients.clients) expect(shows(client, name) && shows(client, "Getting the arena ready")).toBe(true);
  frames(STAGE_SETTLE_FRAMES - 5);
  expect(phases()).toEqual([Phase.stageMenu, Phase.stageMenu]);
  let waited = STAGE_SETTLE_FRAMES - 4;
  for (; waited < 120 && phases().some(phase => phase !== Phase.match); waited++) frames(1);
  expect(phases()).toEqual([Phase.match, Phase.match]);
  expect(waited).toBeLessThan(STAGE_SETTLE_FRAMES + 30);
  for (const client of clients.clients) expect(shows(client, "Getting the arena ready")).toBe(false);
  expectSynchronized(clients);
});

test("a client that never reports holds the match only until the timeout, and both start together", () => {
  const { clients, frames, phases } = atStageSelection([1]);
  clients.press(0, Key.y);
  frames(STAGE_LOAD_TIMEOUT_FRAMES - 10);
  expect(phases()).toEqual([Phase.stageMenu, Phase.stageMenu]);
  for (let i = 0; i < 60 && phases().some(phase => phase !== Phase.match); i++) frames(1);
  expect(phases()).toEqual([Phase.match, Phase.match]);
  expectSynchronized(clients);
});
