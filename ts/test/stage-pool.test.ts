import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { captureScene } from "wisp/scripts/wisp/headlessRender";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { Phase, holdingStart } from "../src/game/match/rules";
import { STAGE_CATALOG, RANDOM_STAGE } from "../src/game/menu/stageCatalog";
import { activeStageMask, stageInPool } from "../src/game/menu/stagePool";
import { shell } from "../src/platform/shell/state";
import { panelActions } from "../src/platform/shell/menus";
import { Key } from "../src/platform/shell/keyEvents";
import * as playable from "../src/platform/playableMain";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { value } from "./rematch/playableMatch";

const fonts = new Map<number, number>();
const headless = installHeadless({ ...SMASHCRAFT_HEADLESS, natives: client => ({ ...SMASHCRAFT_HEADLESS.natives?.(client),
  BlzGetLocalClientWidth: () => 1620,
  BlzFrameSetFont: (frame: { id: number }, _file: string, size: number) => { fonts.set(frame.id, size); },
}) });
afterAll(headless.restore);

test("two clients edit the pool, Start without a stage pick, and play two rotating rematches", async () => {
  const clients = headless.clients(playable, [0, 1]);
  const host = clients.client(0);
  const read = <T>(body: () => T) => value(host, body);
  const wait = (name: string, done: () => boolean, limit = 2000) => {
    for (let frame = 0; frame < limit && !done(); frame++) clients.frames(1);
    expect(done(), name).toBe(true);
  };
  const click = (x: number, y: number) => { expect(clients.click(0, x, y)).toBe(true); clients.frames(3); };
  clients.start(); clients.frames(30);
  for (const slot of [0, 1]) clients.press(slot, Key.r);
  clients.everywhere(() => {
    const actions = panelActions().selection;
    actions.changeStocks(0, -1); actions.changeStocks(0, -1);
    actions.toggleAutomaticRematch(0);
  });
  clients.press(0, Key.y); clients.frames(3);
  expect(read(() => shell().game.stageChoice)).toBe(RANDOM_STAGE);
  click(0.604, 0.5);
  expect(host.frames.shownText()).toContain("All except these");
  for (let index = 0; index < STAGE_CATALOG.length; index++) {
    const stage = STAGE_CATALOG[index]!;
    if ([2, 10, 11].includes(stage.id)) continue;
    click(0.22 + floorMod(index, 3) * 0.18, 0.324 - floorDiv(index, 3) * 0.045);
  }
  const mask = read(() => activeStageMask(shell().game.stagePool));
  click(0.4, 0.412);
  expect(host.frames.shownText()).toContain("Only these");
  expect(read(() => activeStageMask(shell().game.stagePool))).toBe(mask);
  for (const client of clients.clients) expect(value(client, () => activeStageMask(shell().game.stagePool))).toBe(mask);
  const output = process.env.STAGE_POOL_CAPTURE;
  if (output) await Bun.write(output, JSON.stringify({ scene: captureScene(host), fonts: Object.fromEntries(fonts), width: 1620, height: 1080 }));
  click(0.618, 0.456);
  clients.press(0, Key.y);
  const drawn: number[] = [];
  for (let match = 0; match < 3; match++) {
    wait(`match ${match + 1} starts`, () => read(() => shell().game.phase) === Phase.match);
    const choice = read(() => shell().game.stageChoice);
    expect(drawn).not.toContain(choice);
    expect(read(() => stageInPool(shell().game.stagePool, choice))).toBe(true);
    for (const client of clients.clients) expect(value(client, () => shell().game.stageChoice)).toBe(choice);
    drawn.push(choice);
    if (match === 2) break;
    wait("GO!", () => !read(() => holdingStart(shell().game)), 240);
    for (const client of clients.clients) client.key(0, Key.w, 0, true);
    wait(`match ${match + 1} ends`, () => read(() => shell().game.phase) === Phase.result);
    for (const client of clients.clients) client.key(0, Key.w, 0, false);
  }
  expect(drawn.length).toBe(3);
  expect(clients.firstDivergence()).toBeUndefined();
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  console.log(`stage pool two-client journey: ${drawn.join(" -> ")}; 2 played rematches, 0 repeats/desyncs`);
}, 20000);
