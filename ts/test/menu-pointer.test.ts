import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { Phase, holdingStart } from "../src/game/match/rules";
import { journalMenuFile } from "../src/runtime/gameFiles";
import { PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import * as playable from "../src/platform/playableMain";
import { Key } from "../src/platform/shell/keyEvents";
import { panelActions } from "../src/platform/shell/menus";
import { shell } from "../src/platform/shell/state";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { value } from "./rematch/playableMatch";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

test("the playable keyboard build publishes pointer menus and blocks the pointer during a match", () => {
  const clients = headless.clients(playable);
  const menu = (phase: string) => {
    for (const client of clients.clients) {
      const lines = client.files.get(journalMenuFile(PLAYABLE_BUILD.id, client.slot));
      expect(lines?.[0]).toContain(`phase=${phase}`);
      expect(client.errors).toEqual([]);
    }
  };
  const phases = () => clients.clients.map(client => value(client, () => shell().game.phase));
  clients.start();
  clients.frames(30);
  menu("CHARACTER");
  for (const slot of [0, 1]) clients.press(slot, Key.r);
  clients.frames(10);
  clients.everywhere(() => {
    panelActions().selection.changeStocks(0, -1);
    panelActions().selection.changeStocks(0, -1);
  });
  clients.press(0, Key.y);
  clients.frames(10);
  menu("STAGE");
  clients.press(0, Key.y);
  for (let frame = 0; frame < 120 && !phases().every(phase => phase === Phase.match); frame++) clients.frames(1);
  expect(phases()).toEqual([Phase.match, Phase.match]);
  menu("BLOCKED");
  for (let frame = 0; frame < 240 && clients.clients.some(client => value(client, () => holdingStart(shell().game))); frame++) clients.frames(1);
  for (const client of clients.clients) client.key(0, Key.w, 0, true);
  for (let frame = 0; frame < 1200 && !phases().every(phase => phase === Phase.result); frame++) clients.frames(1);
  expect(phases()).toEqual([Phase.result, Phase.result]);
  clients.frames(15);
  menu("RESULT");
  expect(clients.firstDivergence()).toBeUndefined();
});
