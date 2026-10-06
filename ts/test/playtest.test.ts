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
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

const playable = { install, start: () => startBuild(PLAYABLE_BUILD) };

test("a playtest request adds a computer as Player 3 and starts the match on every client once the go-ahead appears", () => {
  const clients = headless.clients(playable, [0, 1]);
  const [host, guest] = clients.clients;
  if (host === undefined || guest === undefined) throw new Error("missing clients");
  host.published.set(PLAYTEST_REQUEST_FILE, [playtestRequest(0b100)]);
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
      expect(game.humanFighterMask).toBe(0b011);
    });
  }
  expect(host.files.get(playtestReceiptFile(0))).toEqual(["PLAY v=1 computers=4 started"]);
  expect(guest.files.get(playtestReceiptFile(1))).toEqual(["PLAY v=1 computers=4 started"]);
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
