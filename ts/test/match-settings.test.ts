
import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import { nextMatchSeed } from "../src/game/match/botRandom";
import { randomStage } from "../src/game/menu/stageCatalog";

import { beginRematchCountdown, copyMatchState, createMatchState, Phase, requestStageSelect, requestStart, setParticipants, stageClock, tickRematchCountdown } from "../src/game/match/rules";
import { DROPS_BUTTON, HAZARDS_BUTTON } from "../src/game/ui/stageUi";
import { stageAtRest } from "../src/game/sim/stage";

import { RULE_BUTTONS } from "../src/game/ui/ruleButtons";
import { DROP_TELEGRAPH_FRAMES, meterDropPoint } from "../src/game/match/meterDrops";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { ALL_ITEMS_MASK, ItemKind, itemBit } from "../src/game/sim/codes";
import { fighterAt } from "../src/game/sim/roster";
import { install, startBuild } from "../src/platform/main";
import { Key } from "../src/platform/shell/keyEvents";
import { shell } from "../src/platform/shell/state";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { JournalHelpers } from "./rematch/journalHelper";
import { expectSynchronized, shows, value } from "./rematch/playableMatch";
import { sweep } from "./sweep";
const headless = installHeadless(PREDICTED_HEADLESS);
afterAll(headless.restore);
function session(endless = false, hazardsOff = false, dropsOff = false) {
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0, 1], { delivery: syncDelivery(MEASURED_BATTLE_NET, 74), keepCalls: 64 });
  const helpers = new JournalHelpers(INTEGRITY_BUILD.id);
  helpers.workload = { denseCycles: 0, walkers: [0] };
  const read = <T>(body: () => T) => value(clients.client(0), body);
  const frames = (n: number) => { for (let i = 0; i < n; i++) { clients.frames(1); helpers.service(clients); } };
  const until = (what: string, done: () => boolean, n = 1200) => {
    for (let i = 0; i < n && !done(); i++) frames(1);
    expect(done(), what).toBe(true);
  };
  const click = (name: keyof typeof RULE_BUTTONS, actor = 1) => {
    const box = RULE_BUTTONS[name];
    expect(clients.click(actor, box.x + box.width / 2, box.y - box.height / 2)).toBe(true);
    frames(1);
  };
  clients.start(); frames(30);
  click("fewerStocks"); click("fewerStocks", 0);
  for (let i = 0; i < 7; i++) click("lessTime");
  for (const client of clients.clients) expect(value(client, () => shell().game.timeLimitMinutes)).toBe(0);
  click("moreTime"); click("automaticRematch");
  if (endless) click("endless");
  for (const client of clients.clients) {
    expect(value(client, () => [shell().game.stockCount, shell().game.timeLimitMinutes, shell().game.automaticRematch, shell().game.endless])).toEqual([1, 1, true, endless]);
    expect(shows(client, "Automatic rematch: On")).toBe(true);
  }
  for (const actor of [0, 1]) clients.press(actor, Key.n);
  frames(5); clients.press(0, Key.y);
  until("stage selection", () => read(() => shell().game.phase) === Phase.stageMenu, 30);
  frames(2);
  for (const client of clients.clients) expect(shows(client, "Hazards: On")).toBe(true);
  if (hazardsOff) {
    expect(clients.click(1, HAZARDS_BUTTON.x + HAZARDS_BUTTON.width / 2, HAZARDS_BUTTON.y - HAZARDS_BUTTON.height / 2)).toBe(true);
    frames(1);
    for (const client of clients.clients) {
      expect(value(client, () => shell().game.hazards)).toBe(false);
      expect(shows(client, "Hazards: Off")).toBe(true);
    }
  }
  for (const client of clients.clients) expect(shows(client, "Drops: On")).toBe(true);
  if (dropsOff) {
    expect(clients.click(0, DROPS_BUTTON.x + DROPS_BUTTON.width / 2, DROPS_BUTTON.y - DROPS_BUTTON.height / 2)).toBe(true);
    frames(1);
    for (const client of clients.clients) {
      expect(value(client, () => shell().game.drops.on)).toBe(false);
      expect(shows(client, "Drops: Off")).toBe(true);
    }
  }
  clients.press(0, Key.y);
  until("match", () => read(() => shell().game.phase) === Phase.match, 120);
  return { clients, frames, read, until };
}
test("the last rematch countdown frame starts the next seeded pool stage on both copies [spec #74] [invariant]", () => {
  const first = createMatchState();
  setParticipants(first, 1, 2);
  first.characterReadiness[0] = true;
  expect(requestStageSelect(first, 0)).toBe(true);
  expect(requestStart(first, 0)).toBe(true);
  first.automaticRematch = true;
  first.matchFrame = 1;
  first.phase = Phase.result;
  beginRematchCountdown(first, 1);
  const second = createMatchState();
  copyMatchState(second, first);
  const nextSeed = nextMatchSeed(first.matchSeed);
  const nextStage = randomStage(nextSeed, first.stagePool.remainingMask);
  const remainingMask = first.stagePool.remainingMask & ~(1 << nextStage);
  for (const game of [first, second]) {
    for (let frame = 0; frame < 59; frame++) expect(tickRematchCountdown(game)).toBe(false);
    expect(game.phase).toBe(Phase.result);
    expect(game.rematchCountdown).toBe(1);
    expect(tickRematchCountdown(game)).toBe(true);
    expect(game.phase).toBe(Phase.match);
    expect(game.matchSeed).toBe(nextSeed);
    expect(game.stageChoice).toBe(nextStage);
    expect(game.stagePool.remainingMask).toBe(remainingMask);
  }
  expect(second).toEqual(first);
});
sweep("rules agree on both clients and the last countdown frame starts the next seeded pool stage [spec #74] [invariant]", () => {
  const { clients, frames, read, until } = session();
  const rules = () => [shell().game.characterChoices.join(), shell().game.stockCount, shell().game.timeLimitMinutes, shell().game.automaticRematch, shell().game.endless];
  const before = read(rules);
  const previousStage = read(() => shell().game.stageChoice);
  const pool = read(() => ({ ...shell().game.stagePool }));
  const nextSeed = nextMatchSeed(read(() => shell().game.matchSeed));
  expect(pool.remainingMask).toBeGreaterThan(0);
  const nextStage = randomStage(nextSeed, pool.remainingMask);
  until("result", () => read(() => shell().game.phase) === Phase.result);
  until("helpers stopped", () => read(() => shell().rollback?.journal?.lifecycle?.quiescent() === true), 120);
  const remaining = read(() => shell().game.rematchCountdown);
  expect(remaining).toBeGreaterThan(0);
  for (const client of clients.clients) expect(shows(client, "Rematch in")).toBe(true);
  frames(remaining - 1);
  expect(read(() => shell().game.phase)).toBe(Phase.result);
  expect(read(() => shell().game.rematchCountdown)).toBe(1);
  frames(1);
  expect(read(() => shell().game.phase)).toBe(Phase.match);
  expect(read(() => shell().rollback?.epoch)).toBe(2);
  expect(read(rules)).toEqual(before);
  expect(read(() => shell().game.matchSeed)).toBe(nextSeed);
  expect(read(() => shell().game.stageChoice)).toBe(nextStage);
  expect(nextStage).not.toBe(previousStage);
  expect(read(() => shell().game.stagePool)).toEqual({ ...pool, remainingMask: pool.remainingMask & ~(1 << nextStage) });
  expectSynchronized(clients);
}, 30_000);

sweep("either player's press cancels the automatic rematch [spec #74] [invariant]", () => {
  for (const actor of [0, 1]) {
    for (const key of [Key.n, Key.u, Key.y]) {
    const { clients, frames, read, until } = session();
    until("result", () => read(() => shell().game.phase) === Phase.result);
    until("helpers stopped", () => read(() => shell().rollback?.journal?.lifecycle?.quiescent() === true), 120);
    clients.press(actor, key);
    expect(read(() => shell().game.rematchCountdown)).toBe(0);
    expect(read(() => shell().game.rematchReadiness.slice())).toEqual([false, false, false, false]);
    frames(310);
    expect(read(() => shell().game.phase)).toBe(Phase.result);
    expectSynchronized(clients);
    }
  }
}, 30_000);

sweep("endless survives repeated knockouts past the selected time limit [spec #74] [invariant]", () => {
  const { clients, frames, read } = session(true);
  let respawns = 0; let out = false;
  for (let i = 0; i < 3800; i++) {
    frames(1);
    const now = read(() => fighterAt(shell().world, 0).status.out);
    if (out && !now) respawns++;
    out = now;
  }
  expect(respawns).toBeGreaterThan(1);
  expect(read(() => shell().game.phase)).toBe(Phase.match);
  expect(read(() => shell().runtime.simulationFrame)).toBeGreaterThan(3600);
  expect(read(() => shell().game.timedOut)).toBe(false);
  expectSynchronized(clients);
}, 30_000);
test("the stage menu's hazards toggle turns hazards off for both players and the match keeps the stage at rest [spec #194] [repro #242] [invariant]", () => {
  const { clients, frames, read } = session(false, true);
  frames(120);
  expect(read(() => shell().game.hazards)).toBe(false);
  expect(read(() => stageAtRest(stageClock(shell().game)))).toBe(true);
  expectSynchronized(clients);
}, 30_000);

test("item switches sync between players and keep their choices at match start [spec #196] [invariant]", () => {
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0, 1], { delivery: syncDelivery(MEASURED_BATTLE_NET, 196), keepCalls: 64 });
  clients.start(); clients.frames(30);
  const settings = () => [shell().game.items.on, shell().game.items.enabledMask];
  const expectSettings = (on: boolean, mask: number) => {
    for (const client of clients.clients) expect(value(client, settings)).toEqual([on, mask]);
  };
  const click = (name: keyof typeof RULE_BUTTONS, actor: number) => {
    const box = RULE_BUTTONS[name];
    expect(clients.click(actor, box.x + box.width / 2, box.y - box.height / 2)).toBe(true);
    clients.frames(30);
  };
  expectSettings(false, ALL_ITEMS_MASK);
  for (const client of clients.clients) {
    expect(shows(client, "Items: Off")).toBe(true);
    for (const label of ["Speed item: On", "Heavy item: On"]) expect(shows(client, label)).toBe(false);
  }
  click("items", 1); expectSettings(true, ALL_ITEMS_MASK);
  for (const client of clients.clients) for (const label of ["Items: On", "Speed item: On", "Heavy item: On"]) expect(shows(client, label)).toBe(true);
  click("itemSpeed", 0); expectSettings(true, itemBit(ItemKind.heavy));
  click("itemHeavy", 1); expectSettings(true, 0);
  for (const client of clients.clients) for (const label of ["Speed item: Off", "Heavy item: Off"]) expect(shows(client, label)).toBe(true);
  click("itemHeavy", 0);
  expectSettings(true, itemBit(ItemKind.heavy));
  for (const actor of [0, 1]) clients.press(actor, Key.n);
  clients.frames(30); clients.press(0, Key.y); clients.frames(30);
  expect(value(clients.client(0), () => shell().game.phase)).toBe(Phase.stageMenu);
  clients.press(0, Key.y); clients.frames(120);
  expect(value(clients.client(0), () => shell().game.phase)).toBe(Phase.match);
  expectSettings(true, itemBit(ItemKind.heavy));
  expectSynchronized(clients);
});

sweep("both clients see the same meter drop telegraph and appear at centre stage [spec #385] [invariant]", () => {
  const { clients, read, until } = session(true);
  const drops = () => ({ ...shell().game.drops });
  until("drop telegraph", () => read(() => shell().game.drops.nextSpawnFrame !== 0 && shell().game.matchFrame >= shell().game.drops.nextSpawnFrame - DROP_TELEGRAPH_FRAMES), 2400);
  until("drop appears", () => read(() => shell().game.drops.spawnSerial) >= 1, DROP_TELEGRAPH_FRAMES + 120);
  until("both clients reach the spawn", () => clients.clients.every(client => value(client, () => shell().game.drops.spawnSerial) >= 1), 120);
  const first = value(clients.client(0), drops);
  for (const client of clients.clients) expect(value(client, drops).spawnSerial).toBe(first.spawnSerial);
  expect(meterDropPoint(read(() => shell().game.stageChoice), 0).x).toBe(0.0);
  expectSynchronized(clients);
}, 60_000);

test("the stage menu's Drops toggle turns meter drops off for both players [spec #385] [invariant]", () => {
  const { clients, frames } = session(false, false, true);
  frames(120);
  for (const client of clients.clients) expect(value(client, () => ({ ...shell().game.drops }))).toMatchObject({ on: false, nextSpawnFrame: 0, spawnSerial: 0 });
  expectSynchronized(clients);
}, 30_000);
