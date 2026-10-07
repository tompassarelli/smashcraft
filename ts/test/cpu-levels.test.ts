// A computer's level at fighter selection (smashcraft:docs/design/cpu-levels.md):
// its card's buttons change it on every client, only for a player who may
// choose that computer's fighter, and the match plays it.
import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import { Phase } from "../src/game/match/rules";
import { cpuLevelBox } from "../src/game/ui/ruleButtons";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { Key } from "../src/platform/shell/keyEvents";
import { shell } from "../src/platform/shell/state";
import { panelActions } from "../src/platform/shell/menus";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { JournalHelpers } from "./rematch/journalHelper";
import { expectSynchronized, shows, value } from "./rematch/playableMatch";

const headless = installHeadless(PREDICTED_HEADLESS);
afterAll(headless.restore);

test("a computer card's level buttons set its level on every client, and the match plays it", () => {
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0, 1], { delivery: syncDelivery(MEASURED_BATTLE_NET, 9), keepCalls: 64 });
  const helpers = new JournalHelpers(INTEGRITY_BUILD.id);
  helpers.workload = { denseCycles: 0, walkers: [0] };
  const frames = (n: number) => { for (let i = 0; i < n; i++) { clients.frames(1); helpers.service(clients); } };
  const levels = () => clients.clients.map((client) => value(client, () => shell().game.cpuLevels[2]));
  const click = (actor: number, direction: -1 | 1, enabled = true) => {
    const box = cpuLevelBox(2, direction);
    expect(clients.click(actor, box.x + box.width / 2, box.y - box.height / 2)).toBe(enabled);
    frames(1);
  };
  clients.start(); frames(30);
  // Slot C goes from empty to a human fighter, then to a computer.
  for (let n = 0; n < 2; n++) clients.everywhere(() => panelActions().selection.cycleMode(0, 2));
  frames(1);
  expect(levels()).toEqual([9, 9]);
  for (const client of clients.clients) expect(shows(client, "Level 9")).toBe(true);
  click(0, -1); click(0, -1); click(0, -1); click(0, -1); click(0, 1);
  expect(levels()).toEqual([6, 6]);
  for (const client of clients.clients) expect(shows(client, "Level 6")).toBe(true);
  // Player 2 neither leads the selection nor is that computer: its buttons are disabled.
  click(1, 1, false);
  expect(levels()).toEqual([6, 6]);
  for (const actor of [0, 1]) clients.press(actor, Key.n);
  frames(5); clients.press(0, Key.y);
  for (let i = 0; i < 30 && value(clients.client(0), () => shell().game.phase) !== Phase.stageMenu; i++) frames(1);
  clients.press(0, Key.y);
  for (let i = 0; i < 120 && value(clients.client(0), () => shell().game.phase) !== Phase.match; i++) frames(1);
  expect(value(clients.client(0), () => shell().game.phase)).toBe(Phase.match);
  frames(600);
  expect(levels()).toEqual([6, 6]);
  expect(value(clients.client(0), () => shell().game.matchSeed)).toBe(0);
  expectSynchronized(clients);
});
