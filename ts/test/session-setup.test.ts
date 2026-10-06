// A native bot session's setup without the menus' pointer targets: the chat
// commands journey.ts types (sessionSetup.ts) in two headless clients of the
// integrity build, each confirmed by both clients' developer receipts, then
// the stage receipt a capture waits on before it checks the player's view.
import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { Phase } from "../src/game/match/rules";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { Character } from "../src/game/sim/codes";
import { fighterName } from "../src/game/sim/heroes/registry";
import { surfaceCount } from "../src/game/sim/stage";
import { install, startBuild } from "../src/platform/main";
import { Key } from "../src/platform/shell/keyEvents";
import { shell } from "../src/platform/shell/state";
import { devCommandReceiptFile, stageReceiptFile } from "../src/runtime/gameFiles";
import { receiptFields } from "../scripts/integrity/journey";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { JournalHelpers } from "./rematch/journalHelper";
import { value } from "./rematch/playableMatch";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

test("bot session setup: slot, fighter, rule and stage commands, each confirmed by both clients' receipts", () => {
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0, 1]);
  const helpers = new JournalHelpers(INTEGRITY_BUILD.id, true);
  const frames = (n: number) => { for (let i = 0; i < n; i++) { clients.frames(1); helpers.service(clients); } };
  const errors = () => clients.clients.flatMap(client => client.errors.map(error => `p${client.slot}: ${error}`));
  const receipt = (slot: number, name: string) => receiptFields((clients.clients[slot]?.files.get(name) ?? []).join("\n"));
  clients.start();
  frames(30);
  // A Battle.net lobby's computer players: C and D come up CPU.
  clients.everywhere(() => { shell().game.computerMask = 12; });
  let count = 0;
  const confirmed = (command: string, fields: Readonly<Record<string, string>>) => {
    clients.chat(0, command);
    frames(2);
    count++;
    for (const slot of [0, 1]) {
      const fieldsNow = receipt(slot, devCommandReceiptFile(INTEGRITY_BUILD.id, slot));
      expect(fieldsNow.get("receipt"), `${command} on client ${slot}`).toBe(String(count));
      for (const [field, wanted] of Object.entries(fields)) expect(fieldsNow.get(field), `${command}: ${field}`).toBe(wanted);
    }
  };
  confirmed("-dev slots 3 0", { "human-fighters": "3", computers: "0" });
  for (const [humans, computers] of [[7, 0], [3, 4], [11, 4], [3, 12]] as const) confirmed(`-dev slots ${humans} ${computers}`, { "human-fighters": `${humans}`, computers: `${computers}` });
  confirmed(`-dev fighter 3 ${fighterName(Character.demonHunter)}`, {});
  confirmed(`-dev fighter 4 ${fighterName(Character.archer)}`, { characters: `0,1,${Character.demonHunter},${Character.archer}` });
  confirmed("-dev stocks 1", { stocks: "1" });
  confirmed("-dev time 1", { minutes: "1" });
  confirmed("-dev auto-rematch on", { "automatic-rematch": "1" });
  confirmed("-dev stage 0", { stage: "0" });
  // A refused command still gets a receipt, whose state shows nothing changed.
  confirmed("-dev stage 99", { stage: "0" });
  expect(errors()).toEqual([]);
  for (const client of clients.clients) {
    expect(value(client, () => {
      const { game } = shell();
      return [game.humanFighterMask, game.computerMask, game.stockCount, game.timeLimitMinutes, game.automaticRematch, game.stageChoice];
    })).toEqual([3, 12, 1, 1, true, 0]);
  }
  // The players pick their fighters and start; no stage was clicked.
  for (const client of clients.clients) clients.press(client.slot, Key.n);
  frames(5);
  clients.press(0, Key.y);
  frames(10);
  expect(value(clients.client(0), () => shell().game.phase)).toBe(Phase.stageMenu);
  clients.press(0, Key.y);
  for (let i = 0; i < 60 && value(clients.client(0), () => shell().game.phase) !== Phase.match; i++) frames(1);
  frames(30);
  expect(errors()).toEqual([]);
  for (const slot of [0, 1]) {
    const drawn = receipt(slot, stageReceiptFile(INTEGRITY_BUILD.id, slot));
    expect([drawn.get("epoch"), drawn.get("stage"), drawn.get("decks")]).toEqual(["1", "0", String(surfaceCount(0))]);
  }
});
