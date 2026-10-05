// `waygate fresh MAP.w3x`: starts a new Battle.net game, issues `-dev quick`
// and waits for every client's receipt. `--rebuild` packages a warm script first.
// The first client hosts; the others join by game name. The map signals
// character selection by writing its ready file into each client's
// CustomMapData.
import { join } from "node:path";
import { Clock, Console, Effect, Layer } from "effect";
import { QUICK_MATCH_COMMAND } from "../../../src/game/shell/devSettings";
import { devCommandReceiptFile, MELEE_READY_FILE } from "../../../src/runtime/gameFiles";
import { DevCommandReceipt, MeleeReady, type MalformedGameFile } from "../boundary";
import { type Client, Clients, type DesktopFailure, waitFor, waitForText } from "../clients";
import { type Command, UsageFailure } from "../command";
import { GameFiles, dataDirectory, readGameFile } from "../gameFiles";
import { MapBuild } from "../mapBuild";
import { SourceErrors } from "../sourceErrors";
import { step } from "../timings";

// Regions of the 2560x1440 frame where each screen's identifying label appears.
export const GAME_MENU = { x: 1100, y: 180, width: 420, height: 50 };
// The score screen slides in; its title settles about 40 px above where it first appears.
export const RESULTS = { x: 150, y: 50, width: 420, height: 110 };
export const CUSTOM_GAMES = { x: 1440, y: 1180, width: 340, height: 60 };
// Read as "REATE GAME": the stylised first letter is not recognized.
export const CREATE_TITLE = { x: 150, y: 160, width: 300, height: 50 };
export const MAP_TITLE = { x: 1950, y: 150, width: 600, height: 60 };
export const LOBBY = { x: 80, y: 290, width: 220, height: 50 };
// Shows "PLAYERS: N/4" once a second player is in the lobby.
export const LOBBY_COUNT = { x: 1480, y: 185, width: 220, height: 50 };

// Controls, as frame positions.
export const BACK = { x: 155, y: 1389 };
export const CREATE_GAME = { x: 1510, y: 1201 };
/** The first map of the Smashcraft folder; Warcraft keeps the open folder for the session. */
export const FIRST_MAP = { x: 1190, y: 366 };
export const GAME_NAME = { x: 400, y: 340 };
export const CREATE = { x: 2198, y: 1126 };
export const JOIN_NAME = { x: 300, y: 1205 };
export const JOIN = { x: 1295, y: 1213 };
export const START = { x: 2195, y: 1127 };

const commandServices = MapBuild.layer.pipe(
  Layer.provideMerge(SourceErrors.layer),
  Layer.provideMerge(GameFiles.layer),
  Layer.provideMerge(Clients.layer()),
);

export const fresh: Command = (args) => Effect.gen(function*() {
  const [map, ...flags] = args;
  if (map === undefined || flags.some((flag) => flag !== "--rebuild")) {
    return yield* new UsageFailure({ problem: "fresh takes MAP.w3x [--rebuild]" });
  }
  if (flags.includes("--rebuild")) yield* MapBuild.use((maps) => maps.rebuild(map)).pipe(step("map rebuilt"));
  yield* freshMatch(map);
  yield* startQuickMatch.pipe(step("quick match and client receipts"));
}).pipe(Effect.provide(commandServices));

/** The game in every client, at character selection. */
export const freshMatch = (map: string) => Effect.gen(function*() {
  const clients = yield* Clients;
  const files = yield* GameFiles;
  const [first, ...others] = clients.all;
  const game = `scdev ${(yield* Clock.currentTimeMillis).toString(36)}`;

  const read = (client: Client, region: typeof RESULTS, ink: "light" | "gold", pattern: RegExp) =>
    clients.read(client, region, ink).pipe(Effect.map((text) => pattern.test(text)));
  const click = (client: Client, at: { readonly x: number; readonly y: number }) => clients.click(client, at.x, at.y);

  /** From a running game, its score screen, a lobby, Create Game or Custom Games, to Custom Games. */
  const leave = (client: Client) => Effect.gen(function*() {
    if (yield* read(client, CUSTOM_GAMES, "light", /CREATE/i)) return;
    // Results, a lobby and Create Game all leave through the same Back button.
    if (!(yield* read(client, RESULTS, "gold", /RESULTS/i)) && !(yield* read(client, LOBBY, "light", /PLAYERS/i)) && !(yield* read(client, CREATE_TITLE, "light", /REATE\s*GAME/i))) {
      yield* clients.keys(client, "F10");
      yield* waitForText(client, "game menu", /Game Menu/i, GAME_MENU, "gold", 5);
      yield* clients.keys(client, "e");
      yield* waitForText(client, "end game options", /End Game/i, GAME_MENU, "gold", 5);
      yield* clients.keys(client, "q");
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
    yield* click(client, GAME_NAME);
    yield* clients.keys(client, "ctrl+a");
    yield* clients.typeText(client, game);
    yield* click(client, CREATE);
    yield* waitForText(client, "lobby", /PLAYERS/i, LOBBY, "light", 20);
  }).pipe(step(`${client.name} hosting "${game}"`));

  const joinByName = (client: Client) => Effect.gen(function*() {
    yield* click(client, JOIN_NAME);
    yield* clients.keys(client, "ctrl+a");
    yield* clients.typeText(client, game);
    yield* click(client, JOIN);
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
  yield* host(first);
  yield* Effect.forEach(others, joinByName, { discard: true });
  yield* waitForText(first, "all players", new RegExp(`${clients.all.length}/4`), LOBBY_COUNT, "light", 60).pipe(step("everyone in the lobby"));
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

  yield* clients.keys(host, "enter");
  yield* clients.typeText(host, QUICK_MATCH_COMMAND);
  yield* clients.keys(host, "enter").pipe(step("send -dev quick"));

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
