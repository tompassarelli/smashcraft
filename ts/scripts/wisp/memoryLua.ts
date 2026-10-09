// `bun wisp soak memory`'s program (commands/soak.ts): the playable build in
// two headless clients in 32-bit Lua, with Warcraft's measured sync latency,
// playing match after match for MINUTES game minutes: every fighter and every
// stage in turn, four fighters a match (the two players press the native bot
// session's beat, two computers), one stock and a one-minute clock, back to
// fighter selection after each result and every third match an automatic
// rematch. Each game minute and each result it prints what the clients'
// maps hold (memoryCensus.ts) for the slope check (memorySoak.ts).
// Usage: lua build/memory.lua MAP_LUA WARCRAFT_D_TS [MINUTES]
import { parseNativeDeclarations } from "wisp/src/headless/declarations";
import { type HeadlessClient } from "wisp/src/headless/client";
import { luaLockstep, readFile } from "wisp/src/headless/lua";
import { SMASHCRAFT_NOOPS, smashcraftNativeBehavior } from "./headlessNatives";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import { Phase } from "../../src/game/match/rules";
import { STAGE_CATALOG } from "../../src/game/menu/stageCatalog";
import { PLAYABLE_BUILD } from "../../src/game/shell/currentBuild";
import { SELECTABLE_CHARACTERS } from "../../src/game/sim/heroes/registry";
import { Key } from "../../src/platform/shell/keyEvents";
import { botBeatKeys, gameOf } from "./botMatch";
import { PREDICTED_LOCAL_NATIVES } from "./localNatives";
import { HandleCensus, compactEmulator, reach } from "./memoryCensus";

declare const arg: Readonly<Record<number, string | undefined>>;

const [bundlePath, declarationsPath, minutesText = "30", matchesText, firstText = "0"] = [arg[1], arg[2], arg[3], arg[4], arg[5]];
if (bundlePath === undefined || declarationsPath === undefined) throw new Error("usage: lua memory.lua MAP_LUA WARCRAFT_D_TS [MINUTES]");
const FRAMES_PER_MINUTE = 3600;
const totalFrames = Number(minutesText) * FRAMES_PER_MINUTE;
const releaseMatches = matchesText === undefined ? undefined : Number(matchesText);
const declarationsText = readFile(declarationsPath);
const { functions } = parseNativeDeclarations(declarationsText);
const clients = luaLockstep({ filePrefix: "smashcraft", localNatives: PREDICTED_LOCAL_NATIVES, intentionalNoops: SMASHCRAFT_NOOPS, natives: smashcraftNativeBehavior }, readFile(bundlePath), declarationsText, undefined, syncDelivery(MEASURED_BATTLE_NET, 7));
const host = clients.client(0);
const censuses = clients.clients.map((client) => new HandleCensus(client, functions));
// What the emulator and the census put in each environment before the map ran: natives, constants and globals.
const emulator = clients.clients.map((client) => {
  const owned: unknown[] = [client];
  for (const [, value] of pairs(client.natives)) owned.push(value);
  return owned;
});
const errors: string[] = [];

let matches = 0;
let held = 0;
let beat = 0;

const census = (heading: string) => {
  collectgarbage("collect");
  collectgarbage("collect");
  const heapKb = collectgarbage("count");
  clients.clients.forEach((client, index) => {
    const handles = censuses[index];
    if (handles === undefined) return;
    for (const error of compactEmulator(client, handles.takeReleased())) errors.push(`p${client.slot}: ${error}`);
  });
  collectgarbage("collect");
  const compactKb = collectgarbage("count");
  const everything = reach({ clients, censuses }, []);
  const parts = [`sample ${heading} frame=${clients.frame} matches=${matches} heap-kb=${Math.floor(compactKb)} heap-before-compact-kb=${Math.floor(heapKb)} all-entries=${everything.entries} all-string-bytes=${everything.stringBytes}`];
  clients.clients.forEach((client, index) => {
    const handles = censuses[index];
    const found = reach(client.natives, [...(emulator[index] ?? []), ...(handles?.liveHandles() ?? [])], heading.startsWith("kind=menu"));
    for (const [shape, count, paths] of found.tableShapes) {
      print(`graph ${heading} frame=${clients.frame} p${client.slot} count=${count} shape=${shape} paths=${paths.join(";")}`);
    }
    const live = handles === undefined ? "" : handles.counts().map(([kind, count]) => `${kind}=${count}`).join(",");
    const models = new Map<string, number>();
    for (const pose of client.effectPoses()) models.set(pose.model, (models.get(pose.model) ?? 0) + 1);
    // Every model at fighter selection, to tell which effects a match left behind; the most used elsewhere.
    const byModel = [...models].sort((a, b) => b[1] - a[1]).slice(0, heading.startsWith("kind=menu") ? models.size : 8).map(([model, count]) => `${model.replaceAll(" ", "_")}:${count}`).join(",");
    parts.push(`p${client.slot} tables=${found.tables} functions=${found.functions} entries=${found.entries} string-bytes=${found.stringBytes} live=${live} top=${found.byGlobal.slice(0, 6).map(([name, count]) => `${name}:${count}`).join(",")} models=${byModel}`);
  });
  print(parts.join(" | "));
};

/** One frame: the players' beat while a match runs, every key let go outside it, a census at each game minute. */
const frame = () => {
  // The shell starts at the first timer, after the first frame.
  const inMatch = clients.frame > 0 && gameOf(host).phase === Phase.match;
  const [tap, hold] = inMatch && releaseMatches === undefined ? botBeatKeys(++beat) : [0, 0];
  for (const player of clients.clients) {
    if (hold !== held && held !== 0) for (const client of clients.clients) client.key(player.slot, held, 0, false);
    if (hold !== held && hold !== 0) for (const client of clients.clients) client.key(player.slot, hold, 0, true);
    if (tap !== 0) for (const client of clients.clients) client.key(player.slot, tap, 0, true);
  }
  held = hold;
  clients.frames(1);
  if (tap !== 0) for (const player of clients.clients) for (const client of clients.clients) client.key(player.slot, tap, 0, false);
  // Each frame's logged calls fold into the checksum at once: a log kept for a minute would grow the heap by its own array.
  for (const client of clients.clients) client.forget(client.log.length);
  if (releaseMatches === undefined && floorMod(clients.frame, FRAMES_PER_MINUTE) === 0) census(`kind=minute minute=${floorDiv(clients.frame, FRAMES_PER_MINUTE)}`);
};

const until = (what: string, limit: number, done: () => boolean, each?: (index: number) => void) => {
  for (let index = 0; index < limit && !done(); index++) {
    each?.(index);
    frame();
  }
  if (!done()) throw new Error(`${what} not reached at frame ${clients.frame}`);
};

/** The same choices in every client keep them synchronized, as the native bot session's setup does (botMatch.ts). */
const choose = (lineup: number, automaticRematch: boolean) => {
  const stage = STAGE_CATALOG[floorMod(lineup, STAGE_CATALOG.length)]?.id ?? 0;
  for (const client of clients.clients) {
    const game = gameOf(client);
    if (releaseMatches !== undefined) game.humanFighterMask = 0;
    for (let slot = 0; slot < 4; slot++) {
      if (slot >= 2 || releaseMatches !== undefined) game.computerMask |= 1 << slot;
      game.characterChoices[slot] = SELECTABLE_CHARACTERS[floorMod(lineup * 4 + slot, SELECTABLE_CHARACTERS.length)] ?? 0;
      game.characterReadiness[slot] = true;
    }
    game.stockCount = 1;
    game.timeLimitMinutes = 1;
    game.stageChoice = stage;
    game.automaticRematch = automaticRematch;
  }
};

clients.start();
for (const client of clients.clients) for (const error of client.errors) print(`start p${client.slot}: ${error}`);
for (let index = 0; index < 30; index++) frame();
if (releaseMatches === undefined) census("kind=start");
let lineup = Number(firstText);
let rematchNext = false;
while (releaseMatches === undefined ? clients.frame < totalFrames : matches < releaseMatches) {
  const rematch: boolean = rematchNext;
  // Every third match is the automatic rematch of the one before.
  rematchNext = !rematch && floorMod(matches, 3) === 1;
  if (!rematch) {
    choose(lineup, rematchNext);
    clients.press(0, Key.y);
    until("stage selection", 120, () => gameOf(host).phase === Phase.stageMenu);
    choose(lineup, rematchNext);
    clients.press(0, Key.y);
    until("the match", 600, () => gameOf(host).phase === Phase.match);
  }
  // One stock and a one-minute clock end every match within its minute, its start hold and the sudden death.
  until("the result", 3 * FRAMES_PER_MINUTE, () => gameOf(host).phase === Phase.result);
  matches++;
  for (let index = 0; index < 60; index++) frame();
  if (releaseMatches === undefined) census(`kind=match match=${matches} lineup=${lineup} path=${rematch ? "rematch" : "menus"}`);
  else {
    clients.clients.forEach((client, index) => {
      const handles = censuses[index];
      if (handles !== undefined) for (const error of compactEmulator(client, handles.takeReleased())) errors.push(`p${client.slot}: ${error}`);
    });
    print(`release match=${matches} lineup=${lineup} path=${rematch ? "rematch" : "menus"} cpu-mask=${gameOf(host).computerMask}`);
  }
  if (releaseMatches !== undefined && matches >= releaseMatches) break;
  if (rematchNext) until("the rematch", 20 * 60, () => gameOf(host).phase === Phase.match);
  else {
    // A press stops a rematch countdown; then each player's readies them for fighter selection.
    until("fighter selection", 20 * 60, () => gameOf(host).phase === Phase.characterMenu, (index) => {
      // One press at a time: a second player's press on the frame the last one readies would confirm fighter selection too.
      if (floorMod(index, 30) === 0) clients.press(floorMod(floorDiv(index, 30), 2), Key.y);
    });
    for (let index = 0; index < 60; index++) frame();
    if (releaseMatches === undefined) census(`kind=menu lineup=${lineup}`);
    lineup++;
  }
}
const divergence = clients.firstDivergence();
const checksums = clients.clients.map((client) => client.checksum());
if (divergence !== undefined || checksums.some((checksum) => checksum !== checksums[0])) errors.push(`desync: ${divergence ?? checksums.join(" ")}`);
for (const client of clients.clients) for (const error of client.errors) errors.push(`p${client.slot}: ${error}`);
for (const error of errors) print(`problem ${error}`);
if (releaseMatches !== undefined) print(`release matches=${matches} crashes=${errors.length} desyncs=${divergence === undefined && checksums.every((checksum) => checksum === checksums[0]) ? 0 : 1}`);
print(`done frames=${clients.frame} matches=${matches} problems=${errors.length}`);
if (errors.length > 0) os.exit(1);
