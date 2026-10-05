// Takes the signed-in clients from wherever they are in a Smashcraft game to
// character selection in a new Battle.net game of MAP, and prints how long each
// step took. The first client hosts; the others join by game name.
// Usage: bun scripts/fresh.ts MAP.w3x
import { copyFileSync, mkdirSync, readdirSync, renameSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { Effect } from "effect";
import { type Client, DesktopFailure, click, keys, loadClients, read, typeText, waitFor, waitForText } from "./warcraft/desktop";

const map = Bun.argv[2];
if (map === undefined) throw new Error("usage: bun scripts/fresh.ts MAP.w3x");
const MAP_FOLDER = "Maps/00-Smashcraft";
const READY_FILE = "CustomMapData/wc3-melee-ready.txt";

// Regions of the 2560x1440 frame where each screen's identifying label appears.
const GAME_MENU = { x: 1100, y: 180, width: 420, height: 50 };
// The score screen slides in; its title settles about 40 px above where it first appears.
const RESULTS = { x: 150, y: 50, width: 420, height: 110 };
const CUSTOM_GAMES = { x: 1440, y: 1180, width: 340, height: 60 };
const MAP_TITLE = { x: 1950, y: 150, width: 600, height: 60 };
const LOBBY = { x: 80, y: 290, width: 220, height: 50 };
// Shows "PLAYERS: N/4" once a second player is in the lobby.
const LOBBY_COUNT = { x: 1480, y: 185, width: 220, height: 50 };

const started = performance.now();
const since = (from: number) => ((performance.now() - from) / 1000).toFixed(2);

function step<A, E>(name: string, effect: Effect.Effect<A, E>) {
  return Effect.gen(function*() {
    const from = performance.now();
    const value = yield* effect;
    yield* Effect.sync(() => console.log(`${since(started).padStart(6)} s  ${name} (${since(from)} s)`));
    return value;
  });
}

const atCustomGames = (client: Client) => read(client, CUSTOM_GAMES).pipe(Effect.map((text) => /CREATE/i.test(text)));
const atResults = (client: Client) => read(client, RESULTS, "gold").pipe(Effect.map((text) => /RESULTS/i.test(text)));
const inLobby = (client: Client) => read(client, LOBBY).pipe(Effect.map((text) => /PLAYERS/i.test(text)));

/** From a running game, its score screen, a lobby or Custom Games, to Custom Games. */
const leave = (client: Client) =>
  step(`${client.name} at Custom Games`, Effect.gen(function*() {
    if (yield* atCustomGames(client)) return;
    if (!(yield* atResults(client)) && !(yield* inLobby(client))) {
      yield* keys(client, "F10");
      yield* waitForText(client, "game menu", /Game Menu/i, GAME_MENU, "gold", 5);
      yield* keys(client, "e");
      yield* waitForText(client, "end game options", /End Game/i, GAME_MENU, "gold", 5);
      yield* keys(client, "q");
      yield* waitForText(client, "match results", /RESULTS/i, RESULTS, "gold", 10);
    }
    yield* click(client, 155, 1389);
    yield* waitForText(client, "custom games", /CREATE/i, CUSTOM_GAMES, "light", 15);
  }));

/** Makes MAP the one map in each client's Smashcraft folder. */
const install = (clients: readonly Client[]) =>
  step("map installed", Effect.forEach(clients, (client) =>
    Effect.try({
      try: () => {
        const folder = join(client.documents, MAP_FOLDER);
        const replaced = join(client.documents, "smashcraft-replaced-maps");
        mkdirSync(replaced, { recursive: true });
        for (const old of readdirSync(folder).filter((name) => name.endsWith(".w3x") && name !== basename(map))) renameSync(join(folder, old), join(replaced, old));
        // A running game may still read the old file: replace it by rename, never in place.
        const next = join(folder, `${basename(map)}.next`);
        copyFileSync(map, next);
        renameSync(next, join(folder, basename(map)));
      },
      catch: (cause) => new DesktopFailure({ operation: "install map", client: client.name, cause }),
    }), { discard: true }));

const host = (client: Client, game: string) =>
  step(`${client.name} hosting "${game}"`, Effect.gen(function*() {
    yield* click(client, 1510, 1201);
    yield* waitForText(client, "map list", /SMASHCRAFT/i, MAP_TITLE, "light", 10);
    // The first map of the Smashcraft folder; Warcraft keeps the open folder for the session.
    yield* click(client, 1190, 366);
    yield* click(client, 400, 340);
    yield* keys(client, "ctrl+a");
    yield* typeText(client, game);
    yield* click(client, 2198, 1126);
    yield* waitForText(client, "lobby", /PLAYERS/i, LOBBY, "light", 20);
  }));

const joinByName = (client: Client, game: string) =>
  step(`${client.name} asked to join`, Effect.gen(function*() {
    yield* click(client, 300, 1205);
    yield* keys(client, "ctrl+a");
    yield* typeText(client, game);
    yield* click(client, 1295, 1213);
  }));

const readyAfter = (client: Client, time: number) =>
  waitFor(client, "character selection", 60, Effect.sync(() => {
    try {
      return statSync(join(client.documents, READY_FILE)).mtimeMs > time ? true : undefined;
    } catch {
      return undefined;
    }
  }));

const program = Effect.gen(function*() {
  const clients = yield* loadClients();
  const [first, ...others] = clients;
  const game = `scdev ${Date.now().toString(36)}`;
  yield* Effect.all([install(clients), ...clients.map(leave)], { concurrency: "unbounded", discard: true });
  yield* host(first, game);
  yield* Effect.forEach(others, (client) => joinByName(client, game), { discard: true });
  yield* step("everyone in the lobby", waitForText(first, "all players", new RegExp(`${clients.length}/4`), LOBBY_COUNT, "light", 60));
  const start = Date.now();
  yield* click(first, 2195, 1127);
  yield* step("every client at character selection", Effect.forEach(clients, (client) => readyAfter(client, start), { concurrency: "unbounded", discard: true }));
});

await Effect.runPromise(program);
console.log(`total ${since(started)} s`);
