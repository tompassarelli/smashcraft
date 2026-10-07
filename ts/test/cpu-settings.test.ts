// Opponent settings through the same key events and frame hit targets as Warcraft.
import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { CPU_OPPONENT_IDS, CPU_TIERS } from "../src/game/match/cpuProfiles";
import { Phase } from "../src/game/match/rules";
import { CPU_OPPONENT_COPY } from "../src/game/ui/cpuOpponentCopy";
import { cpuSettingsBox } from "../src/game/ui/ruleButtons";
import { INTEGRITY_BUILD, PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import type { MapBuild } from "../src/game/shell/build";
import { install, startBuild } from "../src/platform/main";
import { Key } from "../src/platform/shell/keyEvents";
import { shell } from "../src/platform/shell/state";
import { panelActions } from "../src/platform/shell/menus";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { JournalHelpers } from "./rematch/journalHelper";
import { value } from "./rematch/playableMatch";

const headless = installHeadless(PREDICTED_HEADLESS);
afterAll(headless.restore);

function journey(build: MapBuild) {
  const clients = headless.clients({ start: () => startBuild(build), install }, [0, 1]);
  const helpers = new JournalHelpers(build.id);
  const frames = (n = 2) => { for (let i = 0; i < n; i++) { clients.frames(1); helpers.service(clients); } };
  const key = (code: number, actor = 0) => { clients.press(actor, code); frames(); };
  const read = <T>(body: () => T, actor = 0) => value(clients.client(actor), body);
  const text = (actor = 0) => clients.client(actor).frames.shownText().join("\n");
  clients.start(); frames(30);
  for (let n = 0; n < 2; n++) clients.everywhere(() => panelActions().selection.cycleMode(0, 2));
  frames();
  return { clients, frames, key, read, text };
}

for (const build of [PLAYABLE_BUILD, INTEGRITY_BUILD]) test(`${build.id}: all 30 CPU choices reachable with keys, exact previews, Random and retained focus`, () => {
  const { clients, frames, key, read, text } = journey(build);
  expect(read(() => shell().game.cpuOpponents[2])).toBe("wren");
  expect(read(() => shell().game.cpuTiers[2])).toBe("intermediate");
  // Own fighter, CPU fighter, CPU settings. N opens without a pointer.
  key(69); key(69); key(Key.n);
  expect(text()).toContain("CPU 3 — Opponent settings");
  expect(text()).toContain("Flexible tools and burst pressure.");
  for (let i = 0; i < 5; i++) key(Key.w);
  for (const opponent of CPU_OPPONENT_IDS) {
    expect(read(() => shell().game.cpuOpponents[2])).toBe(opponent);
    key(69);
    for (let i = 0; i < 4; i++) key(Key.w);
    expect(read(() => shell().game.cpuTiers[2])).toBe("rookie");
    key(Key.w); // Difficulty stops at Rookie.
    for (const tier of CPU_TIERS) {
      expect(read(() => shell().game.cpuTiers[2])).toBe(tier);
      expect(text()).toContain(CPU_OPPONENT_COPY[opponent].description);
      expect(text()).toContain(CPU_OPPONENT_COPY[opponent].tags);
      for (const line of CPU_OPPONENT_COPY[opponent].previews[tier].split("\n")) expect(text()).toContain(line);
      key(Key.r);
    }
    expect(read(() => shell().game.cpuTiers[2])).toBe("expert");
    key(69); key(69); key(Key.r);
  }
  expect(read(() => shell().game.cpuOpponents[2])).toBe("random");
  expect(text()).toContain("A different opponent each match.");
  expect(text()).not.toContain("Strong at:");
  key(Key.n); key(Key.n); key(Key.n); // Choose advances two rows, then Done.
  expect(text()).not.toContain("CPU 3 — Opponent settings");
  expect(text()).toContain("> Opponent settings <");
  key(Key.n); key(Key.u); key(Key.n); // Back retains and returns focus.
  for (const client of clients.clients) client.key(0, Key.y, 0, true);
  frames(); // Start only closes.
  for (const client of clients.clients) client.key(0, Key.y, 0, true);
  frames(); // A held repeat cannot start behind the closed panel.
  expect(read(() => shell().game.phase)).toBe(Phase.characterMenu);
  for (const client of clients.clients) client.key(0, Key.y, 0, false);
  expect(text()).not.toContain("CPU 3 — Opponent settings");
  expect(read(() => shell().game.cpuOpponents[2])).toBe("random");
  expect(read(() => shell().game.cpuTiers[2])).toBe("expert");
  frames();
  expect(clients.clients.flatMap(client => client.errors)).toEqual([]);
  expect(clients.firstDivergence()).toBeUndefined();
}, 15000);

test("CPU preview follows shared choices, denies unauthorized changes and permission loss", () => {
  const { clients, frames, key, read, text } = journey(INTEGRITY_BUILD);
  key(69, 1); key(69, 1); key(Key.n, 1);
  expect(text(1)).toContain("Only the slot owner or first player can change this opponent.");
  key(Key.r, 1);
  expect(read(() => shell().game.cpuOpponents[2])).toBe("wren");
  clients.everywhere(() => panelActions().selection.changeCpuOpponent(0, 2, -1));
  frames();
  expect(text(1)).toContain(CPU_OPPONENT_COPY.kite.description);
  clients.everywhere(() => { shell().game.humanMask = 2; shell().game.humanCount = 1; });
  frames();
  key(Key.r, 1);
  expect(read(() => shell().game.cpuOpponents[2])).toBe("wren");
  clients.everywhere(() => { shell().game.humanMask = 3; shell().game.humanCount = 2; });
  frames();
  key(Key.r, 1);
  expect(read(() => shell().game.cpuOpponents[2])).toBe("wren");
  expect(text(1)).toContain("Only the slot owner or first player can change this opponent.");
  key(Key.u, 1);
  const box = cpuSettingsBox(2);
  const ready = read(() => shell().game.characterReadiness[2]);
  expect(clients.click(0, box.x + box.width / 2, box.y - box.height / 2)).toBe(true);
  frames();
  expect(text()).toContain("CPU 3 — Opponent settings");
  expect(read(() => shell().game.characterReadiness[2])).toBe(ready);
  expect(clients.clients.flatMap(client => client.errors)).toEqual([]);
});
