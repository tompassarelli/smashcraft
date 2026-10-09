




import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import type { HeadlessClient } from "wisp/src/headless/client";
import { parseRepro } from "wisp/src/runtime/repro";
import { MOMENT_FRAMES, replayRepro } from "../src/game/replay/moment";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { Phase } from "../src/game/match/rules";
import { QUICK_MATCH_COMMAND } from "../src/game/shell/devSettings";
import { install, start } from "../src/platform/devMain";
import { confirmedChecksum } from "../src/platform/shell/diagnostics";
import { Key } from "../src/platform/shell/keyEvents";
import { shell } from "../src/platform/shell/state";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { JournalHelpers } from "./rematch/journalHelper";
import { confirmedFrame, expectSynchronized, startPlayableMatch, value } from "./rematch/playableMatch";
import { sweep } from "./sweep";

const headless = installHeadless(PREDICTED_HEADLESS);
afterAll(headless.restore);

const moments = (client: HeadlessClient) => [...client.files.keys()].filter(name => name.startsWith("smashcraft-repro-"));


function expectReplays(lines: readonly string[] | undefined, checksum: string): void {
  const repro = parseRepro(lines ?? []);
  if (typeof repro === "string") throw new Error(repro);
  expect(repro.checksum).toBe(checksum);
  const result = replayRepro(repro);
  expect(result.problems).toEqual([]);
  expect(result.checksum).toBe(repro.checksum);
  expect(result.frames).toBe(Math.min(repro.frame, MOMENT_FRAMES + Math.max(0, repro.frame - MOMENT_FRAMES) % 120));
}

function checkCallbackSave(beats: number): void {
  const clients = headless.clients({ start, install }, [0, 1]);
  const hold = (player: number, key: number, down: boolean) => {
    for (const client of clients.clients) client.key(player, key, 0, down);
  };
  clients.start();
  clients.frames(30);
  clients.chat(0, QUICK_MATCH_COMMAND);


  hold(1, 0x50, true);
  for (let beat = 0; beat < beats; beat++) {
    clients.press(0, beat % 2 === 0 ? 0x4e : 0x49);
    for (const walk of [Key.r, Key.w]) {
      hold(1, walk, true);
      clients.frames(10);
      hold(1, walk, false);
      clients.frames(5);
    }
  }
  hold(1, 0x50, false);
  const [a, b] = clients.clients;
  if (a === undefined || b === undefined) throw new Error("two clients");
  expect(value(a, () => shell().game.phase)).toBe(Phase.match);
  const checksum = value(a, () => confirmedChecksum(shell()));
  clients.press(0, Key.k);

  clients.frames(12);
  expect([moments(a).length, moments(b).length]).toEqual([1, 0]);
  expect(clients.firstDivergence()).toBeUndefined();
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  const [name = ""] = moments(a);
  expectReplays(a.files.get(name), checksum);
}

test("K in a fresh development match saves a moment on that player's client which replays to its checksum [spec wisp#15] [invariant]", () => {
  checkCallbackSave(2);
}, 30_000);

sweep("K in the development build's match saves its last ten seconds on that player's client, which replay to its checksum [spec wisp#15] [invariant]", () => {
  checkCallbackSave(24);
}, 30_000);

test("in the integrity build's rollback match, a controller helper's request and K each save the moment on their own client [spec wisp#15] [invariant]", () => {
  const helpers = new JournalHelpers(INTEGRITY_BUILD.id, true);
  helpers.workload = { denseCycles: 2, walkers: [1] };
  const { clients, frames, clientA: a, clientB: b } = startPlayableMatch(headless, helpers, true);

  frames(60);
  helpers.requestMoment(1);
  frames(15);
  expect([moments(a).length, moments(b).length]).toEqual([0, 1]);
  const [helperMoment = ""] = moments(b);
  const saved = b.files.get(helperMoment);
  const frame = Number(/-f(\d+)-/.exec(helperMoment)?.[1]);
  expect(frame).toBeGreaterThan(0);
  expect(confirmedFrame(b)).toBeGreaterThanOrEqual(frame);
  const repro = parseRepro(saved ?? []);
  if (typeof repro === "string") throw new Error(repro);
  expectReplays(saved, repro.checksum);
  const keyChecksum = value(a, () => confirmedChecksum(shell()));
  clients.press(0, Key.k);
  frames(12);
  expect(moments(a).length).toBe(1);
  expectReplays(a.files.get(moments(a)[0] ?? ""), keyChecksum);
  frames(30);
  expectSynchronized(clients);
});
