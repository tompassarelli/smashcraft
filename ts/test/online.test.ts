// Direct play (#142): join codes, the user.reg switch the setup writes, and
// the host and guest flows against two fake games that share one fake
// Battle.net, each answering on Wisp's menu socket the way fresh's fakes do.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { Deferred, Effect, Exit, Fiber } from "effect";
import { GameFiles } from "wisp/scripts/wisp/gameFiles";
import { MenuFailure, connectMenus } from "wisp/scripts/wisp/menus";
import { playerProblem } from "../scripts/wisp/commands/online";
import { newJoinCode, readJoinCode } from "../scripts/wisp/joinCode";
import { allowLocalFiles } from "../scripts/wisp/menuPageSetup";
import { hostMatch, joinMatch } from "../scripts/wisp/online";

const bytes = (...values: number[]) => () => Uint8Array.from(values);

test("a join code names the game and carries its password", () => {
  const code = newJoinCode(bytes(10, 11, 12, 13, 0, 1, 31, 32));
  expect(code).toEqual({ text: "ABCD-01Z0", gameName: "Smashcraft ABCD", password: "01Z0" });
  expect(readJoinCode(code.text)).toEqual(code);
  // Fresh codes are eight characters of the alphabet.
  for (let i = 0; i < 50; i++) expect(newJoinCode().text).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
});

test("a typed code ignores case, spaces and dashes and reads O, I and L as digits", () => {
  expect(readJoinCode(" abcd efgh ")?.text).toBe("ABCD-EFGH");
  expect(readJoinCode("abcd-oil0")).toEqual({ text: "ABCD-0110", gameName: "Smashcraft ABCD", password: "0110" });
  expect(readJoinCode("ABCDEFG")).toBeUndefined();
  expect(readJoinCode("ABCD-EFGHJ")).toBeUndefined();
  expect(readJoinCode("ABCD-EFGU")).toBeUndefined();
  expect(readJoinCode("")).toBeUndefined();
});

test("setup sets Allow Local Files in Warcraft III's key, once", () => {
  const key = "[Software\\\\Blizzard Entertainment\\\\Warcraft III] 1759700000\n#time=1dc36c4b6a0e1f2\n\"Preferred Game Port\"=dword:000017e0\n";
  const userReg = `WINE REGISTRY Version 2\n\n[Software\\\\Wine] 1759700000\n"Version"="win10"\n\n${key}\n[Volatile] 1\n`;
  const set = allowLocalFiles(userReg, 1759800000)!;
  expect(set).toBe(userReg.replace("#time=1dc36c4b6a0e1f2\n", "#time=1dc36c4b6a0e1f2\n\"Allow Local Files\"=dword:00000001\n"));
  expect(allowLocalFiles(set, 1759800000)).toBeUndefined();
  expect(allowLocalFiles(set.replace("dword:00000001", "dword:00000000"), 1759800000)).toBe(set);
  const bare = "WINE REGISTRY Version 2\n\n[Software\\\\Wine] 1759700000\n";
  expect(allowLocalFiles(bare, 1759800000)).toBe(`${bare}\n[Software\\\\Blizzard Entertainment\\\\Warcraft III] 1759800000\n"Allow Local Files"=dword:00000001\n`);
});

test("each failure reads as a player step", () => {
  expect(playerProblem(new MenuFailure({ operation: "join \"Smashcraft ABCD\"", problem: "no answer within 10 s" }))).toContain("Check the code");
  expect(playerProblem(new MenuFailure({ operation: "wait for the host to start", problem: "the lobby closed" }))).toBe("The host closed the game.");
  expect(playerProblem(new MenuFailure({ operation: "find the menus", problem: "no menu page reported" }))).toContain("Open Warcraft III");
});

interface Sent {
  readonly message: string;
  readonly payload: Record<string, unknown>;
}

const MAPS = "C:/users/steamuser/Documents/Warcraft III/Maps/";
const MAP = "Smashcraft 0.0.52.w3x";
const READY = readFileSync(join(import.meta.dir, "fixtures/wisp/melee-ready.pld"), "utf8");

/**
 * Battle.net and two players' games. The host's game lists 00-Smashcraft;
 * a lobby is joined by its exact name and password; lobby chat reaches the
 * other player; LobbyStart with both in shows both loading screens, and each
 * game's Smashcraft then writes its ready file. `refuse` names refused at
 * creation stand for games another host already has.
 */
function battleNet(options: { readonly refuse?: readonly string[] } = {}) {
  const sent: string[] = [];
  const payloads: Sent[] = [];
  let lobby: { name: string; password: string; guest: boolean } | undefined;
  let readyAt: number | undefined;
  const sockets = new Map<string, Set<Bun.ServerWebSocket<undefined>>>([["host", new Set()], ["guest", new Set()]]);
  const tell = (player: string, messageType: string, payload: unknown) => {
    for (const socket of sockets.get(player)!) socket.send(JSON.stringify({ messageType, payload }));
  };
  const game = (player: "host" | "guest") => Bun.serve<undefined>({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request, server) => (server.upgrade(request) ? undefined : new Response("not found", { status: 404 })),
    websocket: {
      open: (socket) => void sockets.get(player)!.add(socket),
      close: (socket) => void sockets.get(player)!.delete(socket),
      message(_socket, data) {
        const { message, payload } = JSON.parse(String(data)) as { message: string; payload: Record<string, unknown> };
        sent.push(`${player}:${message}`);
        payloads.push({ message: `${player}:${message}`, payload });
        switch (message) {
          case "GetMapList": {
            const folder = payload["useLastMap"] === true ? MAPS : String(payload["subdirectory"]);
            const maps = folder === MAPS ? [{ filename: "00-Smashcraft", isFolder: true }] : folder === `${MAPS}00-Smashcraft/` ? [{ filename: MAP, isFolder: false }] : [];
            tell(player, "MapList", { mapList: { maps: maps.map((entry) => ({ ...entry, filepath: folder })) } });
            return;
          }
          case "CreateLobby":
            if (options.refuse?.includes(String(payload["gameName"]))) {
              tell(player, "MultiplayerGameCreateResult", { details: { success: false } });
              return;
            }
            lobby = { name: String(payload["gameName"]), password: String(payload["password"]), guest: false };
            tell(player, "SetGlueScreen", { screen: "GAME_LOBBY" });
            tell(player, "GameLobbySetup", { isHost: true });
            return;
          case "JoinGameByGameName":
            if (lobby === undefined || payload["gameName"] !== lobby.name) return;
            if (payload["checkForGamePass"] === true || payload["gamePass"] !== lobby.password) {
              tell(player, "RequestForPassword", {});
              return;
            }
            lobby.guest = true;
            tell(player, "GameLobbySetup", { isHost: false });
            tell("host", "GameLobbySetup", { isHost: true });
            return;
          case "LeaveGame":
            lobby = undefined;
            tell("host", "MultiplayerGameLeave", {});
            tell("guest", "MultiplayerGameLeave", {});
            return;
          case "LobbyStart":
            if (player !== "host" || lobby?.guest !== true) return;
            tell("host", "SetGlueScreen", { screen: "LOADING_SCREEN" });
            tell("guest", "SetGlueScreen", { screen: "LOADING_SCREEN" });
            setTimeout(() => (readyAt = Date.now()), 50);
            return;
        }
      },
    },
  });
  const servers = { host: game("host"), guest: game("guest") };
  const files = GameFiles.of({
    read: () => Effect.sync(() => (readyAt === undefined ? undefined : { text: READY, modified: readyAt })),
    write: () => Effect.void, replace: () => Effect.void, remove: () => Effect.void,
    list: () => Effect.succeed([]), installMap: () => Effect.void,
  });
  return {
    sent, payloads, files,
    address: (player: "host" | "guest") => ({ port: servers[player].port!, guid: "online-test" }),
    stop: () => Object.values(servers).forEach((server) => server.stop(true)),
  };
}

/** Host and guest at once; the guest reads the code from the host's lines, as a friend would. */
const playBoth = (net: ReturnType<typeof battleNet>, options: { readonly startNow?: (lines: string[]) => Effect.Effect<void>; readonly password?: string; readonly makeCodes?: (() => ReturnType<typeof newJoinCode>) } = {}) =>
  Effect.scoped(Effect.gen(function*() {
    const hostLines: string[] = [];
    const guestLines: string[] = [];
    const shown = yield* Deferred.make<string>();
    const hostMenus = yield* connectMenus(net.address("host"));
    const guestMenus = yield* connectMenus(net.address("guest"));
    const host = hostMatch({
      menus: hostMenus, map: { folder: "00-Smashcraft", file: MAP }, documents: "/host",
      say: (line) => Effect.gen(function*() {
        hostLines.push(line);
        const code = /^Join code: (\S+)$/.exec(line)?.[1];
        if (code !== undefined) yield* Deferred.succeed(shown, code);
      }),
      startNow: options.startNow?.(guestLines) ?? Effect.gen(function*() {
        while (!guestLines.includes("In the lobby; waiting for the host to start")) yield* Effect.sleep("20 millis");
      }),
      ...(options.password === undefined ? {} : { password: options.password }),
      ...(options.makeCodes === undefined ? {} : { makeCode: options.makeCodes }),
    });
    const guest = Effect.gen(function*() {
      const parsed = readJoinCode((yield* Deferred.await(shown)).toLowerCase())!;
      const code = options.password === undefined ? parsed : { ...parsed, password: options.password };
      yield* joinMatch({ menus: guestMenus, code, documents: "/guest", say: (line) => Effect.sync(() => void guestLines.push(line)) });
    });
    const [code] = yield* Effect.all([host, guest], { concurrency: 2 });
    return { code, hostLines, guestLines };
  })).pipe(Effect.provideService(GameFiles, net.files));

test("the host shows a code, the guest joins by it, and both reach fighter selection", async () => {
  const net = battleNet();
  try {
    const { code, hostLines, guestLines } = await Effect.runPromise(playBoth(net, { makeCodes: () => newJoinCode(bytes(10, 11, 12, 13, 14, 15, 16, 17)) }));
    expect(code.text).toBe("ABCD-EFGH");
    expect(hostLines).toEqual([
      "Join code: ABCD-EFGH",
      "Waiting for your opponent; press Start now once they have joined (in Warcraft III they can also join \"Smashcraft ABCD\" with password EFGH)",
      "Starting the match",
      "Loading the match",
      "In the match",
    ]);
    expect(guestLines).toEqual(["In the lobby; waiting for the host to start", "Loading the match", "In the match"]);
    const create = net.payloads.find(({ message }) => message === "host:CreateLobby")!.payload;
    expect(create).toMatchObject({ filename: `${MAPS}00-Smashcraft/${MAP}`, gameName: "Smashcraft ABCD", privateGame: true, password: "EFGH" });
    expect(net.payloads.filter(({ message }) => message === "guest:JoinGameByGameName").map(({ payload }) => payload["gamePass"])).toEqual(["EFGH", "EFGH"]);
    expect(net.sent.some((message) => message.endsWith(":SendGameChatMessage"))).toBe(false);
    // One start, after the guest has joined and the host requests it.
    expect(net.sent.filter((message) => message === "host:LobbyStart")).toHaveLength(1);
    expect(net.sent.indexOf("host:LobbyStart")).toBeGreaterThan(net.sent.lastIndexOf("guest:JoinGameByGameName"));
  } finally {
    net.stop();
  }
}, 20_000);

test("a name another game has gets a new code", async () => {
  const net = battleNet({ refuse: ["Smashcraft 0000"] });
  const codes = [bytes(0, 0, 0, 0, 1, 1, 1, 1), bytes(10, 11, 12, 13, 14, 15, 16, 17)];
  try {
    const { code, hostLines } = await Effect.runPromise(playBoth(net, { makeCodes: () => newJoinCode(codes.shift()!) }));
    expect(code.text).toBe("ABCD-EFGH");
    expect(hostLines[0]).toBe("Join code: ABCD-EFGH");
    expect(net.sent.filter((message) => message === "host:CreateLobby")).toHaveLength(2);
  } finally {
    net.stop();
  }
}, 20_000);

test("the lobby waits for Start now and sends no chat while waiting", async () => {
  const net = battleNet();
  try {
    const startNow = (guestLines: string[]) => Effect.gen(function*() {
      while (!guestLines.includes("In the lobby; waiting for the host to start")) yield* Effect.sleep("20 millis");
      yield* Effect.sleep("7 seconds");
      expect(net.sent).not.toContain("host:LobbyStart");
      expect(net.sent.some((message) => message.endsWith(":SendGameChatMessage"))).toBe(false);
    });
    const { hostLines, guestLines } = await Effect.runPromise(playBoth(net, { startNow }));
    expect(hostLines.slice(2)).toEqual(["Starting the match", "Loading the match", "In the match"]);
    expect(guestLines.at(-1)).toBe("In the match");
  } finally {
    net.stop();
  }
}, 20_000);

test("a guest whose host closes the lobby stops with that reason", async () => {
  const net = battleNet();
  try {
    const exit = await Effect.runPromiseExit(Effect.scoped(Effect.gen(function*() {
      const hostMenus = yield* connectMenus(net.address("host"));
      const guestMenus = yield* connectMenus(net.address("guest"));
      const code = newJoinCode(bytes(10, 11, 12, 13, 14, 15, 16, 17));
      yield* hostMenus.send("CreateLobby", { gameName: code.gameName, password: code.password, privateGame: true });
      const lines: string[] = [];
      const guest = yield* Effect.forkChild(joinMatch({ menus: guestMenus, code, documents: "/guest", say: (line) => Effect.sync(() => void lines.push(line)) }));
      while (!lines.includes("In the lobby; waiting for the host to start")) yield* Effect.sleep("20 millis");
      yield* hostMenus.send("LeaveGame");
      return yield* Fiber.join(guest);
    })).pipe(Effect.provideService(GameFiles, net.files)));
    expect(Exit.isFailure(exit) ? String(exit.cause) : "joined").toContain("wait for the host to start: the lobby closed");
  } finally {
    net.stop();
  }
});

test("an explicit online password keeps the game private and lets the guest join", async () => {
  const net = battleNet();
  try {
    const { guestLines } = await Effect.runPromise(playBoth(net, { password: "EFGH" }));
    expect(net.payloads.find(({ message }) => message === "host:CreateLobby")!.payload).toMatchObject({ privateGame: true, password: "EFGH" });
    expect(net.payloads.filter(({ message }) => message === "guest:JoinGameByGameName").every(({ payload }) => payload["gamePass"] === "EFGH")).toBe(true);
    expect(guestLines.at(-1)).toBe("In the match");
  } finally {
    net.stop();
  }
}, 20_000);
