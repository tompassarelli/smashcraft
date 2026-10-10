









import { basename, join } from "node:path";
import { Clock, Console, Effect, Layer, Schedule } from "effect";
import { MENU_SECONDS } from "wisp/scripts/wisp/lobby";
import { QUICK_MATCH_COMMAND } from "../../../src/game/shell/devSettings";
import { devCommandReceiptFile, MELEE_READY_FILE } from "../../../src/runtime/gameFiles";
import { DevCommandReceipt, MeleeReady } from "../boundary";
import type { MalformedGameFile } from "wisp/scripts/wisp/preloadRecord";
import { type Client, Clients, type DesktopFailure, waitFor } from "wisp/scripts/wisp/clients";
import { type Command, UsageFailure } from "wisp/scripts/wisp/command";
import { GameFiles, dataDirectory, prepareHotFolders, readGameFile } from "wisp/scripts/wisp/gameFiles";
import { checkPlayerView } from "wisp/scripts/wisp/playerView";
import { step } from "wisp/scripts/wisp/timings";
import { hostLobby, joinLobby, leaveLobby, reportedMenus, startLobby } from "wisp/scripts/wisp/menus";
import { ClientWatch, inState, unlessLost, waitFor as waitForState } from "wisp/scripts/wisp/watch";
import { rebuildMap } from "../mapInputs";
import { profileOption, sceneProfiles } from "../project";
import { clientArguments } from "./client";
import { freshFrames, smashcraftPlayerView } from "../playerView";
import { profileOptions } from "./map";
import { onHealthyClients } from "../doctor";


const gamePassword = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) => (byte % 36).toString(36)).join("");

export const fresh: Command = (rawArgs) => Effect.gen(function*() {
  const { clientsFile, args } = yield* Effect.try({ try: () => clientArguments(rawArgs), catch: (cause) => cause instanceof UsageFailure ? cause : new UsageFailure({ problem: String(cause) }) });
  const options = yield* profileOptions(args);
  const { profile } = yield* profileOption(args);
  const [map, ...flags] = options.args;
  if (map === undefined || flags.some((flag) => flag !== "--rebuild" && flag !== "--no-quick")) {
    return yield* new UsageFailure({ problem: "fresh takes MAP.w3x [--rebuild] [--no-quick] [--profile PROFILE] [--clients-file FILE]" });
  }
  if (flags.includes("--rebuild")) yield* rebuildMap(map).pipe(step("map rebuilt"), Effect.provide(options.services));


  yield* onHealthyClients(Effect.gen(function*() {
    yield* freshMatch(map);
    if (!flags.includes("--no-quick")) {
      const since = yield* Clock.currentTimeMillis;
      yield* sendQuickMatchCommand.pipe(step("quick match and client receipts"));
      yield* checkPlayerView(smashcraftPlayerView({ frame: true, scene: sceneProfiles.has(profile) }), since, freshFrames).pipe(step("player view"));
    }
  }).pipe(Effect.provide(Layer.merge(options.services.pipe(Layer.provideMerge(Clients.layer(clientsFile))), ClientWatch.layer({ filePrefix: "smashcraft" })))), { clientsFile });
});


export const freshMatch = (map: string) => Effect.scoped(Effect.gen(function*() {
  const clients = yield* Clients;
  const files = yield* GameFiles;
  const [first, ...others] = clients.all;
  const game = `scdev ${(yield* Clock.currentTimeMillis).toString(36)}`;
  const connections = yield* Effect.forEach(clients.all, (client) => reportedMenus(client.menuReportPort), { concurrency: clients.all.length });
  const reported = clients.all.flatMap((client, index) => {
    const socket = connections[index];
    return socket === undefined ? [] : [[client.name, socket] as const];
  });
  const menus = new Map(reported);
  const missing = clients.all.filter((client) => !menus.has(client.name)).map((client) => client.name);
  if (missing.length > 0) {
    return yield* new UsageFailure({ problem: `fresh hosts only private games, through every client's menu page; none reported for ${missing.join(", ")} (\`bun wisp online setup\`, smashcraft:docs/wisp.md "Menu control")` });
  }
  const page = (client: Client) => {
    const socket = menus.get(client.name);

    if (socket === undefined) throw new Error(`no menu page for ${client.name}`);
    return socket;
  };

  const password = gamePassword();






  const leave = (client: Client) => Effect.gen(function*() {
    const { state } = yield* ClientWatch.use((watch) => watch.view(client));
    if (state.kind === "menus" || state.kind === "signed in") return;
    if (state.kind === "lobby" || state.kind === "loading" || state.kind === "in match") yield* leaveLobby(page(client));
    if (state.kind === "lobby") return;
    yield* Effect.sleep("2 seconds");
    yield* clients.keys(client, "Escape");
    yield* Console.log(`${client.name}: waiting for the menus (up to ${MENU_SECONDS} s)`);
    yield* waitForState(client, inState("menus"), { what: "the menus", seconds: MENU_SECONDS });
  }).pipe(step(`${client.name} at the menus`));


  const install = Effect.gen(function*() {
    yield* prepareHotFolders(clients.all.map((client) => dataDirectory(client.documents)), "smashcraft");
    yield* Effect.forEach(clients.all, (client) => files.installMap(client.documents, map), { discard: true });
  }).pipe(step("map installed"));

  const host = (client: Client) => hostLobby(page(client), { folder: "00-Smashcraft/tests", file: basename(map), gameName: game, password })
    .pipe(step(`${client.name} hosting "${game}"`));


  const joinByName = (client: Client) => joinLobby(page(client), game, password, 10).pipe(
    Effect.retry({ times: 2, schedule: Schedule.spaced("2 seconds") }),
    step(`${client.name} joined`),
  );

  yield* Effect.all([install, ...clients.all.map(leave)], { concurrency: "unbounded", discard: true });
  yield* unlessLost(first, host(first));
  yield* Effect.forEach(others, (client) => unlessLost(client, joinByName(client)), { discard: true });
  // Wait 2 s after lobby creation: immediate LobbyStart crashes Warcraft III 3.0 (#119).
  yield* Effect.sleep("2 seconds");
  const start = yield* Clock.currentTimeMillis;
  yield* startLobby(page(first));
  return yield* Effect.forEach(clients.all, (client) => unlessLost(client, readyAfter(client, start)), { concurrency: "unbounded" }).pipe(step("every client at character selection"));
}));


export const readyAfter = (client: Client, time: number) => Effect.gen(function*() {
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


export const sendDevCommand = (command: string, clientName?: string) => Effect.gen(function*() {
  const clients = yield* Clients;
  const files = yield* GameFiles;
  const host = clientName === undefined ? clients.all[0] : clients.all.find((client) => client.name === clientName);
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
    { kind: "keys", keys: ["Escape", "Return"] },
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
