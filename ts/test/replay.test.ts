// #141, #166: every client records the playable build's match as a replay
// while it runs (parts during the match, the manifest at its result, under
// its match record's serial), and the replay plays the whole match back to
// every checksum it recorded: in Bun always, and in 32-bit Lua when LUA names
// one (CI's Lua step runs this file with it). The playable build's match is
// played on the keyboard alone, through Warcraft's synchronized key events.
import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import type { HeadlessClient } from "wisp/src/headless/client";
import { Phase, holdingStart } from "../src/game/match/rules";
import { joinReplay, parseReplayHeader, parseReplayPart, replayMatch } from "../src/game/replay/matchReplay";
import { PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { fighterAt } from "../src/game/sim/roster";
import { RULE_BUTTONS } from "../src/game/ui/ruleButtons";
import { matchRecordFile, replayFile, replayPartFile } from "../src/runtime/gameFiles";
import { install, startBuild } from "../src/platform/main";
import { install as installDev, start as startDev } from "../src/platform/devMain";
import { Key } from "../src/platform/shell/keyEvents";
import { shell } from "../src/platform/shell/state";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { replayInLua } from "../scripts/wisp/commands/replay";
import { readReplay } from "../scripts/wisp/replayFiles";
import { expectSynchronized, value } from "./rematch/playableMatch";

const headless = installHeadless(PREDICTED_HEADLESS);
afterAll(headless.restore);

/** The client's replay `serial`, joined from its manifest and parts. */
function joinedReplay(client: HeadlessClient, serial: number): string[] {
  const manifest = client.files.get(replayFile(serial));
  if (manifest === undefined) throw new Error(`p${client.slot} wrote no manifest ${replayFile(serial)}`);
  const header = parseReplayHeader(manifest);
  if (typeof header === "string") throw new Error(header);
  const parts = Array.from({ length: header.parts ?? 0 }, (_, index) => {
    const body = parseReplayPart(client.files.get(replayPartFile(serial, index + 1)) ?? [], serial, index + 1);
    if (typeof body === "string") throw new Error(body);
    return body;
  });
  return joinReplay(header, parts);
}

/** The standard key layout's keys (game/input/keyBindings.ts). */
const KEYS = { left: 0x57, right: 0x52, jump: 0x49, attack: 0x4e, special: 0x55, grab: 0x4f, shield: 0x51 } as const;
/** Taps both players make, one every 20 frames, before they walk off. */
const TAPS = [KEYS.jump, KEYS.attack, KEYS.special, KEYS.grab, KEYS.shield, KEYS.attack];

// Three stocks, one minute: after their taps the players walk off their own
// sides, which ends the match in about ten seconds.
test("a one-minute keyboard match in the playable build reaches its result and replays to every recorded checksum", async () => {
  const clients = headless.clients({ start: () => startBuild(PLAYABLE_BUILD), install }, [0, 1], { delivery: syncDelivery(MEASURED_BATTLE_NET, 141), keepCalls: 64 });
  const read = <T>(body: () => T) => value(clients.client(0), body);
  const frames = (n: number) => clients.frames(n);
  const until = (what: string, done: () => boolean, n: number) => {
    for (let i = 0; i < n && !done(); i++) frames(1);
    expect(done(), what).toBe(true);
  };
  // A key held down or let go: Warcraft gives the event to every client on the same turn.
  const hold = (slot: number, key: number, down: boolean) => {
    for (const client of clients.clients) client.key(slot, key, 0, down);
  };
  const click = (name: keyof typeof RULE_BUTTONS) => {
    const box = RULE_BUTTONS[name];
    expect(clients.click(1, box.x + box.width / 2, box.y - box.height / 2)).toBe(true);
    frames(1);
  };
  clients.start();
  frames(30);
  for (let i = 0; i < 7; i++) click("lessTime");
  click("moreTime");
  // Each player picks the next fighter with Move right; Start (Y) goes on to stages, then to the match.
  for (const actor of [0, 1]) clients.press(actor, KEYS.right);
  frames(5);
  clients.press(0, Key.y);
  until("stage selection", () => read(() => shell().game.phase) === Phase.stageMenu, 30);
  clients.press(0, Key.y);
  until("match", () => read(() => shell().game.phase) === Phase.match, 120);
  until("GO!", () => read(() => !holdingStart(shell().game)), 240);
  for (const key of TAPS) {
    for (const actor of [0, 1]) clients.press(actor, key);
    frames(20);
  }
  frames(30);
  const [attacks, jumps] = [read(() => [0, 1].map((slot) => fighterAt(shell().world, slot).attack.serial)), read(() => [0, 1].map((slot) => fighterAt(shell().world, slot).jump.serial))];
  for (const slot of [0, 1]) {
    expect(attacks[slot] ?? 0, `player ${slot + 1} attacked`).toBeGreaterThan(0);
    expect(jumps[slot] ?? 0, `player ${slot + 1} jumped`).toBeGreaterThan(0);
  }
  hold(0, KEYS.left, true);
  hold(1, KEYS.right, true);
  until("result", () => read(() => shell().game.phase) === Phase.result, 3900);
  hold(0, KEYS.left, false);
  hold(1, KEYS.right, false);
  frames(30);
  expectSynchronized(clients);
  const replays = clients.clients.map((client) => {
    const names = [...client.files.keys()];
    const manifests = names.filter((name) => /^smashcraft-replay-\d+\.txt$/.test(name));
    expect(manifests.length).toBe(1);
    const serial = Number(/(\d+)/.exec(manifests[0] ?? "")?.[1]);
    // The replay shares its serial with the match's record.
    expect(client.files.has(matchRecordFile(serial))).toBe(true);
    // Written during the match: more than one part.
    expect(names.filter((name) => name.startsWith(`smashcraft-replay-${serial}-`)).length).toBeGreaterThan(1);
    expect(client.errors).toEqual([]);
    return { serial, files: client.files, joined: joinedReplay(client, serial) };
  });
  const [first, second] = replays.map(({ joined }) => joined);
  if (first === undefined || second === undefined) throw new Error("two replays");
  // On disk, as Warcraft writes Preload files, the manifest finds its parts beside it.
  const folder = mkdtempSync(join(tmpdir(), "smashcraft-replay-"));
  const written = replays[0];
  if (written === undefined) throw new Error("a replay");
  for (const [name, lines] of written.files) {
    if (name.startsWith("smashcraft-replay-")) writeFileSync(join(folder, name), `function PreloadFiles takes nothing returns nothing\n${lines.map((line) => `\tcall Preload( "${line}" )\n`).join("")}endfunction\n`);
  }
  expect(readReplay(join(folder, replayFile(written.serial)))).toEqual(first);
  const header = parseReplayHeader(first);
  if (typeof header === "string") throw new Error(header);
  // Both clients ran the same confirmed match.
  expect(parseReplayHeader(second)).toMatchObject({ repro: { frame: header.repro.frame, checksum: header.repro.checksum } });
  expect(header.repro.frame).toBeGreaterThan(480);
  const bun = replayMatch(first);
  expect(bun.problems).toEqual([]);
  expect(bun.frames).toBe(header.repro.frame);
  expect(bun.reached).toBe(bun.recorded);
  expect(bun.recorded).toBeGreaterThan(header.repro.frame / 120);
  const lua = process.env.LUA;
  if (lua === undefined) return;
  const file = join(folder, "joined.txt");
  writeFileSync(file, `${first.join("\n")}\n`);
  const inLua = await Effect.runPromise(replayInLua(file, lua));
  expect(inLua.problems).toEqual([]);
  expect(inLua).toMatchObject({ frames: bun.frames, reached: bun.recorded, recorded: bun.recorded, checksum: bun.checksum });
}, 120_000);

// Native match 76 (#141): a versus match against a computer in the development
// build, whose computers choose their controls on the game callback, replayed
// to 1 of 5 checksums: the record began after the computer had changed its
// attack delay for the first frame, so the replay changed it twice.
test("a callback match against a computer replays to every recorded checksum", () => {
  const clients = headless.clients({ start: startDev, install: installDev }, [0]);
  const client = clients.client(0);
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick cpu 9");
  expect(value(client, () => shell().game.computerMask)).not.toBe(0);
  // The player walks into the computer every two-thirds of a second until the match ends.
  for (let frame = 0; frame < 6000 && value(client, () => shell().game.phase) === Phase.match; frame++) {
    if (frame % 40 < 20) client.key(0, Key.w, 0, frame % 40 === 0);
    clients.frames(1);
  }
  expect(value(client, () => shell().game.phase)).toBe(Phase.result);
  clients.frames(30);
  expect(client.errors).toEqual([]);
  const manifest = [...client.files.keys()].find((name) => /^smashcraft-replay-\d+\.txt$/.test(name)) ?? "";
  const replay = replayMatch(joinedReplay(client, Number(/(\d+)/.exec(manifest)?.[1])));
  expect(replay.problems).toEqual([]);
  expect(replay.reached).toBe(replay.recorded);
  expect(replay.recorded).toBeGreaterThan(5);
}, 120_000);
