// `wisp fresh MAP.w3x`: starts a new Battle.net game, issues `-dev quick`,
// waits for every client's receipt, then checks what each player sees
// (playerView.ts). `--rebuild` packages a warm script first; `--no-quick`
// stops at character selection, as captures and playable builds need.
// Every client's menu page drives it: the first client hosts a private game,
// the others join it by name and password. A client without a reporting page
// stops it first, since a game created by clicks is listed publicly. The map signals
// character selection by writing its ready file into each client's
// CustomMapData. A client that crashes or loses Battle.net stops fresh at once
// (wisp:docs/watch.md).
import { basename, join } from "node:path";
import { Clock, Console, Effect, Layer, Schedule } from "effect";
import { QUICK_MATCH_COMMAND } from "../../../src/game/shell/devSettings";
import { devCommandReceiptFile, MELEE_READY_FILE } from "../../../src/runtime/gameFiles";
import { DevCommandReceipt, MeleeReady } from "../boundary";
import type { MalformedGameFile } from "wisp/scripts/wisp/boundary";
import { type Client, Clients, type DesktopFailure, waitFor } from "wisp/scripts/wisp/clients";
import { type Command, UsageFailure } from "wisp/scripts/wisp/command";
import { GameFiles, dataDirectory, prepareHotFolders, readGameFile } from "wisp/scripts/wisp/gameFiles";
import { checkPlayerView } from "wisp/scripts/wisp/playerView";
import { step } from "wisp/scripts/wisp/timings";
import { hostLobby, joinLobby, leaveLobby, reportedMenus, startLobby } from "wisp/scripts/wisp/menus";
import { ClientWatch, inState, unlessLost, waitFor as waitForState } from "wisp/scripts/wisp/watch";
import { rebuildMap } from "../mapInputs";
import { clientState, profileOption, sceneProfiles } from "../project";
import { freshFrames, smashcraftPlayerView } from "../playerView";
import { profileOptions } from "./map";
import { onHealthyClients } from "../doctor";

/** Six random letters and digits, as `wisp menus host` chooses. */
const gamePassword = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) => (byte % 36).toString(36)).join("");

export const fresh: Command = (args) => Effect.gen(function*() {
  const options = yield* profileOptions(args);
  const { profile } = yield* profileOption(args);
  const [map, ...flags] = options.args;
  if (map === undefined || flags.some((flag) => flag !== "--rebuild" && flag !== "--no-quick")) {
    return yield* new UsageFailure({ problem: "fresh takes MAP.w3x [--rebuild] [--no-quick] [--profile PROFILE]" });
  }
  if (flags.includes("--rebuild")) yield* rebuildMap(map).pipe(step("map rebuilt"), Effect.provide(options.services));
  // Doctor heals the clients first and once after a failure (wisp:docs/doctor.md);
  // Clients' layer finds each client's Warcraft window only after it.
  yield* onHealthyClients(Effect.gen(function*() {
    yield* freshMatch(map);
    if (!flags.includes("--no-quick")) {
      const since = yield* Clock.currentTimeMillis;
      yield* sendQuickMatchCommand.pipe(step("quick match and client receipts"));
      yield* checkPlayerView(smashcraftPlayerView({ frame: true, scene: sceneProfiles.has(profile) }), since, freshFrames).pipe(step("player view"));
    }
  }).pipe(Effect.provide(Layer.merge(options.services.pipe(Layer.provideMerge(Clients.layer(clientState))), ClientWatch.layer({ filePrefix: "smashcraft" })))));
});

/** The game in every client, at character selection, through every client's menu page. */
export const freshMatch = (map: string) => Effect.scoped(Effect.gen(function*() {
  const clients = yield* Clients;
  const files = yield* GameFiles;
  const [first, ...others] = clients.all;
  const game = `scdev ${(yield* Clock.currentTimeMillis).toString(36)}`;
  const connections = yield* Effect.forEach(clients.all, (client) => reportedMenus(client.menuReportPort), { concurrency: clients.all.length });
  const missing = clients.all.filter((_, index) => connections[index] === undefined).map((client) => client.name);
  if (missing.length > 0) {
    return yield* new UsageFailure({ problem: `fresh hosts only private games, through every client's menu page; none reported for ${missing.join(", ")} (\`bun wisp online setup\`, smashcraft:docs/wisp.md "Menu control")` });
  }
  const menus = new Map(clients.all.map((client, index) => [client.name, connections[index]!]));
  const page = (client: Client) => menus.get(client.name)!;
  // A page join of a game without a password lands the guest in Battle.net's password prompt; a private game joined with its password does not.
  const password = gamePassword();

  /**
   * From wherever the watch places the client to its menus: a lobby or match
   * is left through the page, and the score screen with Escape (Warcraft III
   * 3.0 ignores the page's ScoreScreenClose). The page hosts from any menu screen.
   */
  const leave = (client: Client) => Effect.gen(function*() {
    const { state } = yield* ClientWatch.use((watch) => watch.view(client));
    if (state.kind === "menus" || state.kind === "signed in") return;
    if (state.kind === "lobby" || state.kind === "loading" || state.kind === "in match") yield* leaveLobby(page(client));
    if (state.kind === "lobby") return;
    yield* Effect.sleep("2 seconds");
    yield* clients.keys(client, "Escape");
    yield* waitForState(client, inState("menus"), { what: "the menus", seconds: 20 });
  }).pipe(step(`${client.name} at the menus`));

  // The hot folder exists before the match does: a map without it reads all of CustomMapData to look for a reload.
  const install = Effect.gen(function*() {
    yield* prepareHotFolders(clients.all.map((client) => dataDirectory(client.documents)), "smashcraft");
    yield* Effect.forEach(clients.all, (client) => files.installMap(client.documents, map), { discard: true });
  }).pipe(step("map installed"));

  const host = (client: Client) => hostLobby(page(client), { folder: "00-Smashcraft/tests", file: basename(map), gameName: game, password })
    .pipe(step(`${client.name} hosting "${game}"`));

  // A join sent as the host's lobby appears went unanswered on 7 Oct (client B); the same join a second later entered it.
  const joinByName = (client: Client) => joinLobby(page(client), game, password, 10).pipe(
    Effect.retry({ times: 2, schedule: Schedule.spaced("2 seconds") }),
    step(`${client.name} joined`),
  );

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
  yield* unlessLost(first, host(first));
  yield* Effect.forEach(others, (client) => unlessLost(client, joinByName(client)), { discard: true });
  // A LobbyStart sent as soon as the lobby exists crashed Warcraft III 3.0 in 6 of 6 starts on client B; 2 s later, 0 of 11 (smashcraft#119).
  yield* Effect.sleep("2 seconds");
  const start = yield* Clock.currentTimeMillis;
  yield* startLobby(page(first));
  return yield* Effect.forEach(clients.all, (client) => unlessLost(client, readyAfter(client, start)), { concurrency: "unbounded" }).pipe(step("every client at character selection"));
}));

/** Sends a developer chat command, such as `-dev quick`, from the host client and waits until every player's new receipt arrives. */
export const sendDevCommand = (command: string) => Effect.gen(function*() {
  const clients = yield* Clients;
  const files = yield* GameFiles;
  const [host] = clients.all;
  const mapReady = yield* Effect.forEach(clients.all, (client) => {
    const path = join(dataDirectory(client.documents), MELEE_READY_FILE);
    return readGameFile(path, MeleeReady);
  });
  const build = mapReady[0]?.value.build;
  if (host === undefined || build === undefined) return yield* new UsageFailure({ problem: `${command} needs a ready game on every client` });

  const receipts = clients.all.map((client, slot) => ({ client, path: join(dataDirectory(client.documents), devCommandReceiptFile(build, slot)), slot }));
  yield* Effect.forEach(receipts, ({ path }) => files.read(path).pipe(
    Effect.flatMap((old) => old === undefined ? Effect.void : files.remove(path)),
  ), { concurrency: "unbounded", discard: true }).pipe(step("clear old quick-match receipts"));

  yield* clients.batch(host, [
    { kind: "keys", keys: ["Return"] },
    { kind: "text", text: command },
    { kind: "keys", keys: ["Return"] },
  ]).pipe(step(`send ${command}`));

  const waitReceipt = ({ client, path, slot }: typeof receipts[number]) => Effect.gen(function*() {
    let problem: MalformedGameFile | undefined;
    const observe = readGameFile(path, DevCommandReceipt).pipe(
      Effect.map((file) => file?.value.build === build && file.value.receipt > 0 ? file.value : undefined),
      Effect.catchTag("MalformedGameFile", (malformed) => Effect.sync(() => {
        problem = malformed;
        return undefined;
      })),
    );
    const receipt = yield* waitFor(client, `${command} receipt for slot ${slot}`, 4, observe).pipe(
      Effect.catchTag("DesktopFailure", (timeout): Effect.Effect<never, DesktopFailure | MalformedGameFile> =>
        problem === undefined ? Effect.fail(timeout) : Effect.fail(problem)),
    );
    return receipt;
  });
  const received = yield* Effect.forEach(receipts, (receipt) => waitReceipt(receipt).pipe(step(`${receipt.client.name} quick-match receipt`)), { concurrency: "unbounded" });
  yield* Console.log(`${command} acknowledged by ${received.length} client(s)`);
});

export const sendQuickMatchCommand = sendDevCommand(QUICK_MATCH_COMMAND);
