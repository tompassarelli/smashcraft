// The playtest request `bun wisp play` leaves in CustomMapData, in the
// playable build's simulated clients: read once at map start, the match
// started on every client only after the go-ahead, and no file read at
// fighter selection in a session without a request.
import { afterAll, expect, test } from "bun:test";
import { Phase } from "../src/game/match/rules";
import { PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { playtestRequest } from "../src/game/shell/playtest";
import { PLAYTEST_GO_FILE, PLAYTEST_REQUEST_FILE, playtestReceiptFile } from "../src/runtime/gameFiles";
import { install, startBuild } from "../src/platform/main";
import { shell } from "../src/platform/shell/state";
import { panelActions } from "../src/platform/shell/menus";
import { Character } from "../src/game/sim/codes";
import { cardX } from "../src/game/menu/selectionDrag";
import { Key } from "../src/platform/shell/keyEvents";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

const playable = { install, start: () => startBuild(PLAYABLE_BUILD) };

test("a playtest request adds a Wren Intermediate as Player 3 and starts the match on every client once the go-ahead appears", () => {
  const clients = headless.clients(playable, [0, 1]);
  const [host, guest] = clients.clients;
  if (host === undefined || guest === undefined) throw new Error("missing clients");
  host.published.set(PLAYTEST_REQUEST_FILE, [playtestRequest(0b100, "wren", "intermediate")]);
  clients.start();
  clients.frames(120);
  // The helper isn't running yet: fighter selection waits.
  for (const client of clients.clients) client.run(() => expect(shell().game.phase).toBe(Phase.characterMenu));
  host.published.set(PLAYTEST_GO_FILE, ["GO"]);
  clients.frames(40);
  for (const client of clients.clients) {
    client.run(() => {
      const { game } = shell();
      expect(game.phase).toBe(Phase.match);
      expect(game.computerMask).toBe(0b100);
      expect(game.cpuTiers[2]).toBe("intermediate");
      expect(game.humanFighterMask).toBe(0b011);
    });
  }
  expect(host.files.get(playtestReceiptFile(0))).toEqual(["PLAY v=3 computers=4 opponent=wren difficulty=intermediate started"]);
  expect(guest.files.get(playtestReceiptFile(1))).toEqual(["PLAY v=3 computers=4 opponent=wren difficulty=intermediate started"]);
  expect([...host.errors, ...guest.errors]).toEqual([]);
  expect(clients.firstDivergence()).toBeUndefined();
});

test("a session without a request reads no file at fighter selection and starts nothing", () => {
  const clients = headless.clients(playable, [0]);
  const [host] = clients.clients;
  if (host === undefined) throw new Error("missing client");
  clients.start();
  clients.frames(1);
  // A look for the go-ahead would be a missed lookup: none happens.
  const missed = host.missedLookups;
  clients.frames(120);
  expect(host.missedLookups).toBe(missed);
  host.published.set(PLAYTEST_GO_FILE, ["GO"]);
  clients.frames(120);
  host.run(() => expect(shell().game.phase).toBe(Phase.characterMenu));
  expect(host.files.has(playtestReceiptFile(0))).toBe(false);
});

test("manual CPU tag clicks cancel a delayed automatic request before Rifleman chooses his fighter", () => {
  const clients = headless.clients(playable, [1]);
  const host = clients.client(1);
  const request = playtestRequest(4, "wren", "intermediate");
  host.published.set(PLAYTEST_REQUEST_FILE, [request]);
  clients.start();
  clients.frames(30);
  // The helper's Choose binding emits this left click; Start alone emits Y.
  for (let click = 0; click < 2; click++) {
    expect(clients.click(1, cardX(2) + 0.08, 0.256)).toBe(true);
    clients.frames(2);
  }
  clients.everywhere(() => panelActions().selection.selectCpuChoice(1, 2, Character.demonHunter));
  host.published.set(PLAYTEST_GO_FILE, ["GO"]);
  clients.frames(120);
  host.run(() => {
    expect(shell().game.phase).toBe(Phase.characterMenu);
    expect(shell().game.characterReadiness[1]).toBe(false);
    expect(shell().game.characterChoices[1]).toBe(Character.rifleman);
    expect(shell().game.characterChoices[2]).toBe(Character.demonHunter);
  });
  expect(host.files.get(playtestReceiptFile(1))).toEqual([`${request} refused`]);
  clients.press(1, Key.y);
  clients.frames(2);
  host.run(() => expect(shell().game.phase).toBe(Phase.characterMenu));
  clients.press(1, Key.r);
  clients.frames(2);
  clients.everywhere(() => {
    panelActions().selection.changeCpuOpponent(1, 2, 1);
    panelActions().selection.changeCpuTier(1, 2, 1);
  });
  clients.frames(2);
  host.run(() => expect(shell().game.phase).toBe(Phase.characterMenu));
  clients.press(1, Key.y);
  clients.frames(2);
  host.run(() => expect(shell().game.phase).toBe(Phase.stageMenu));
  clients.press(1, Key.y);
  clients.frames(120);
  host.run(() => expect(shell().game.phase).toBe(Phase.match));
  expect(host.errors).toEqual([]);
});

test("keyboard fighter selection cancels a delayed automatic request and preserves the chosen fighter", () => {
  const clients = headless.clients(playable, [0]);
  const host = clients.client(0);
  host.published.set(PLAYTEST_REQUEST_FILE, [playtestRequest(4, "wren", "intermediate")]);
  clients.start();
  clients.frames(30);
  clients.press(0, Key.r);
  clients.frames(2);
  host.published.set(PLAYTEST_GO_FILE, ["GO"]);
  clients.frames(120);
  host.run(() => {
    expect(shell().game.phase).toBe(Phase.characterMenu);
    expect(shell().game.characterChoices[0]).toBe(Character.rifleman);
    expect(shell().game.characterReadiness[0]).toBe(true);
  });
  expect(host.errors).toEqual([]);
});
