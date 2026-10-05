// `waygate fresh MAP.w3x`: starts a new Battle.net game, issues `-dev quick`
// and waits for every client's receipt. `--rebuild` packages a warm script first.
// The first client hosts; the others join by game name. The map signals
// character selection by writing its ready file into each client's
// CustomMapData.
import { join } from "node:path";
import { Clock, Console, Effect, Layer } from "effect";
import { QUICK_MATCH_COMMAND } from "../../../src/game/shell/devSettings";
import { devCommandReceiptFile, MELEE_READY_FILE } from "../../../src/runtime/gameFiles";
import { DevCommandReceipt, MeleeReady } from "../boundary";
import type { MalformedGameFile } from "waygate/scripts/waygate/boundary";
import { type Client, Clients, type DesktopFailure, waitFor, waitForText } from "waygate/scripts/waygate/clients";
import { type Command, UsageFailure } from "waygate/scripts/waygate/command";
import { GameFiles, dataDirectory, readGameFile } from "waygate/scripts/waygate/gameFiles";
import { step } from "waygate/scripts/waygate/timings";
import { rebuildMap } from "../mapInputs";

// Regions of the 2560x1440 frame where each screen's identifying label appears.
export const GAME_MENU = { x: 1100, y: 180, width: 420, height: 50 };
// The score screen slides in; its title settles about 40 px above where it first appears.
export const RESULTS = { x: 150, y: 50, width: 420, height: 110 };
export const CUSTOM_GAMES = { x: 1440, y: 1180, width: 340, height: 60 };
// Read as "REATE GAME": the stylised first letter is not recognized.
export const CREATE_TITLE = { x: 150, y: 160, width: 300, height: 50 };
export const MAP_TITLE = { x: 1950, y: 150, width: 600, height: 60 };
// The browser also has a PLAYERS column; only the lobby has this player count.
export const LOBBY = { x: 1400, y: 185, width: 300, height: 50 };
const LOBBY_READY = /PLAYERS\s*:?\s*\d+\s*\/\s*4/i;

// Controls, as frame positions.
export const BACK = { x: 155, y: 1389 };
export const CREATE_GAME = { x: 1510, y: 1201 };
/** The first map of the Smashcraft folder; Warcraft keeps the open folder for the session. */
export const FIRST_MAP = { x: 1190, y: 366 };
const GAME_NAME = { x: 400, y: 340 };
export const CREATE = { x: 2198, y: 1126 };
export const JOIN_NAME = { x: 300, y: 1205 };
export const JOIN = { x: 1295, y: 1213 };
export const START = { x: 2195, y: 1127 };

import { clientState } from "../project";
import { profileOptions } from "./map";

export const fresh: Command = (args) => Effect.gen(function*() {
  const options = yield* profileOptions(args);
  const [map, ...flags] = options.args;
  if (map === undefined || flags.some((flag) => flag !== "--rebuild" && flag !== "--from-game")) {
    return yield* new UsageFailure({ problem: "fresh takes MAP.w3x [--rebuild] [--from-game] [--profile PROFILE]" });
  }
  yield* Effect.gen(function*() {
    if (flags.includes("--rebuild")) yield* rebuildMap(map).pipe(step("map rebuilt"));
    yield* freshMatch(map, flags.includes("--from-game"));
    yield* startQuickMatch.pipe(step("quick match and client receipts"));
  }).pipe(Effect.provide(options.services.pipe(Layer.provideMerge(Clients.layer(clientState)))));
});

/** The game in every client, at character selection. */
export const freshMatch = (map: string, fromGame = false) => Effect.gen(function*() {
  const clients = yield* Clients;
  const files = yield* GameFiles;
  const [first, ...others] = clients.all;
  const game = `scdev ${(yield* Clock.currentTimeMillis).toString(36)}`;

  const read = (client: Client, region: typeof RESULTS, ink: "light" | "gold", pattern: RegExp) =>
    clients.read(client, region, ink).pipe(Effect.map((text) => pattern.test(text)));
  const click = (client: Client, at: { readonly x: number; readonly y: number }) => clients.click(client, at.x, at.y);

  /** From a running game, its score screen, a lobby, Create Game or Custom Games, to Custom Games. */
  const leave = (client: Client) => Effect.gen(function*() {
    if (!fromGame && (yield* read(client, CUSTOM_GAMES, "light", /CREATE/i))) return;
    // Results, a lobby and Create Game all leave through the same Back button.
    if (fromGame || (!(yield* read(client, RESULTS, "gold", /RESULTS/i)) && !(yield* read(client, LOBBY, "light", LOBBY_READY)) && !(yield* read(client, CREATE_TITLE, "light", /REATE\s*GAME/i)))) {
      yield* clients.batch(client, [
        { kind: "keys", keys: ["Escape"] },
        { kind: "wait", millis: 40 },
        { kind: "keys", keys: ["F10"] },
      ]);
      yield* waitForText(client, "game menu", /Game Menu/i, GAME_MENU, "gold", 5);
      yield* clients.batch(client, [
        { kind: "keys", keys: ["e"] },
        // The submenu has no event signal; allow its measured animation before Q.
        { kind: "wait", millis: 200 },
        { kind: "keys", keys: ["q"] },
      ]);
      yield* waitForText(client, "match results", /RESULTS/i, RESULTS, "gold", 10);
    }
    yield* click(client, BACK);
    yield* waitForText(client, "custom games", /CREATE/i, CUSTOM_GAMES, "light", 15);
  }).pipe(step(`${client.name} at Custom Games`));

  const install = Effect.forEach(clients.all, (client) => files.installMap(client.documents, map), { discard: true }).pipe(step("map installed"));

  const host = (client: Client) => Effect.gen(function*() {
    yield* click(client, CREATE_GAME);
    yield* waitForText(client, "create game", /REATE\s*GAME/i, CREATE_TITLE, "light", 10);
    yield* click(client, FIRST_MAP);
    yield* waitForText(client, "map selected", /SMASHCRAFT/i, MAP_TITLE, "light", 5);
    yield* clients.batch(client, [
      { kind: "click", ...GAME_NAME },
      { kind: "keys", keys: ["ctrl+a"] },
      { kind: "text", text: game },
      { kind: "click", ...CREATE },
    ]);
    yield* waitForText(client, "lobby", LOBBY_READY, LOBBY, "light", 20);
  }).pipe(step(`${client.name} hosting "${game}"`));

  const prepareJoin = (client: Client) => clients.batch(client, [
    { kind: "click", ...JOIN_NAME },
    { kind: "keys", keys: ["ctrl+a"] },
    { kind: "text", text: game },
  ]).pipe(step(`${client.name} join name prepared`));

  const joinByName = (client: Client) => Effect.gen(function*() {
    yield* click(client, JOIN);
    yield* waitForText(client, "joined lobby", LOBBY_READY, LOBBY, "light", 20);
  }).pipe(step(`${client.name} asked to join`));

  /** Waits for a ready file written after `time`; a malformed one is read again until the wait ends. */
  const readyAfter = (client: Client, time: number) => Effect.gen(function*() {
    let problem: MalformedGameFile | undefined;
    const path = join(dataDirectory(client.documents), MELEE_READY_FILE);
    const ready = readGameFile(path, MeleeReady).pipe(
      Effect.map((file) => (file !== undefined && file.modified > time ? file.value : undefined)),
      Effect.catchTag("MalformedGameFile", (malformed) => Effect.sync(() => {
        problem = malformed;
        return undefined;
      })),
    );
    return yield* waitFor(client, "character selection", 60, ready).pipe(
      Effect.catchTag("DesktopFailure", (timeout): Effect.Effect<never, DesktopFailure | MalformedGameFile> => (problem === undefined ? Effect.fail(timeout) : Effect.fail(problem))),
    );
  });

  yield* Effect.all([install, ...clients.all.map(leave)], { concurrency: "unbounded", discard: true });
  yield* Effect.all([host(first), ...others.map(prepareJoin)], { concurrency: clients.all.length, discard: true });
  yield* Effect.forEach(others, joinByName, { discard: true });
  yield* waitForText(first, "all players", new RegExp(`PLAYERS\\s*:?\\s*${clients.all.length}\\s*/\\s*4`, "i"), LOBBY, "light", 60).pipe(step("everyone in the lobby"));
  const start = yield* Clock.currentTimeMillis;
  yield* click(first, START);
  return yield* Effect.forEach(clients.all, (client) => readyAfter(client, start), { concurrency: "unbounded" }).pipe(step("every client at character selection"));
});

/** Starts the ordinary developer quick match and waits until every player's new receipt arrives. */
export const startQuickMatch = Effect.gen(function*() {
  const clients = yield* Clients;
  const files = yield* GameFiles;
  const [host] = clients.all;
  const mapReady = yield* Effect.forEach(clients.all, (client) => {
    const path = join(dataDirectory(client.documents), MELEE_READY_FILE);
    return readGameFile(path, MeleeReady);
  });
  const build = mapReady[0]?.value.build;
  if (host === undefined || build === undefined) return yield* new UsageFailure({ problem: "fresh quick match needs a ready game on every client" });

  const receipts = clients.all.map((client, slot) => ({ client, path: join(dataDirectory(client.documents), devCommandReceiptFile(build, slot)), slot }));
  yield* Effect.forEach(receipts, ({ path }) => files.read(path).pipe(
    Effect.flatMap((old) => old === undefined ? Effect.void : files.remove(path)),
  ), { concurrency: "unbounded", discard: true }).pipe(step("clear old quick-match receipts"));

  yield* clients.batch(host, [
    { kind: "keys", keys: ["Return"] },
    { kind: "text", text: QUICK_MATCH_COMMAND },
    { kind: "keys", keys: ["Return"] },
  ]).pipe(step("send -dev quick"));

  const waitReceipt = ({ client, path, slot }: typeof receipts[number]) => Effect.gen(function*() {
    let problem: MalformedGameFile | undefined;
    const observe = readGameFile(path, DevCommandReceipt).pipe(
      Effect.map((file) => file?.value.build === build && file.value.receipt > 0 ? file.value : undefined),
      Effect.catchTag("MalformedGameFile", (malformed) => Effect.sync(() => {
        problem = malformed;
        return undefined;
      })),
    );
    const receipt = yield* waitFor(client, `-dev quick receipt for slot ${slot}`, 4, observe).pipe(
      Effect.catchTag("DesktopFailure", (timeout): Effect.Effect<never, DesktopFailure | MalformedGameFile> =>
        problem === undefined ? Effect.fail(timeout) : Effect.fail(problem)),
    );
    return receipt;
  });
  const received = yield* Effect.forEach(receipts, (receipt) => waitReceipt(receipt).pipe(step(`${receipt.client.name} quick-match receipt`)), { concurrency: "unbounded" });
  yield* Console.log(`-dev quick acknowledged by ${received.length} client(s)`);
});
