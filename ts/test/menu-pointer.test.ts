import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { Phase, holdingStart } from "../src/game/match/rules";
import { journalMenuFile } from "../src/runtime/gameFiles";
import { PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { CPU_SETTINGS_DONE, CPU_SETTINGS_ROWS } from "../src/game/ui/cpuSettingsLayout";
import { cpuSettingsBox } from "../src/game/ui/ruleButtons";
import * as playable from "../src/platform/playableMain";
import { Key } from "../src/platform/shell/keyEvents";
import { panelActions } from "../src/platform/shell/menus";
import { shell } from "../src/platform/shell/state";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { value } from "./rematch/playableMatch";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

test("the CPU settings screen publishes pointer permission and its clicked difficulty reaches the match [spec #214]", () => {
  const clients = headless.clients(playable);
  const host = clients.client(0);
  const menu = () => host.files.get(journalMenuFile(PLAYABLE_BUILD.id, 0))?.[0];
  clients.start();
  clients.frames(30);
  for (const slot of [0, 1]) clients.press(slot, Key.r);
  for (let mode = 0; mode < 2; mode++) clients.everywhere(() => panelActions().selection.cycleMode(0, 2));
  clients.frames(2);
  const button = cpuSettingsBox(2);
  expect(clients.click(0, button.x + button.width / 2, button.y - button.height / 2)).toBe(true);
  clients.frames(2);
  expect(menu()).toContain("phase=CPU");
  expect(clients.click(0, 0.625, CPU_SETTINGS_ROWS[1] - 0.0135)).toBe(true);
  clients.frames(2);
  expect(value(host, () => shell().game.cpuTiers[2])).toBe("advanced");
  expect(clients.click(0, CPU_SETTINGS_DONE.left + CPU_SETTINGS_DONE.width / 2, CPU_SETTINGS_DONE.top - CPU_SETTINGS_DONE.height / 2)).toBe(true);
  clients.frames(2);
  expect(menu()).toContain("phase=CHARACTER");
  clients.press(0, Key.y);
  clients.frames(10);
  expect(menu()).toContain("phase=STAGE");
  clients.press(0, Key.y);
  for (let frame = 0; frame < 120 && value(host, () => shell().game.phase) !== Phase.match; frame++) clients.frames(1);
  expect(value(host, () => shell().game.phase)).toBe(Phase.match);
  expect(menu()).toContain("phase=BLOCKED");
  for (const client of clients.clients) {
    expect(value(client, () => shell().game.cpuTiers[2])).toBe("advanced");
    expect(client.errors).toEqual([]);
  }
  expect(clients.firstDivergence()).toBeUndefined();
});

test("the playable keyboard build publishes pointer menus and blocks the pointer during a match [spec #214]", () => {
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
