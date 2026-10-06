import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect, Layer } from "effect";
import { expect, test } from "bun:test";
import { Clients, type Client } from "wisp/scripts/wisp/clients";
import { GameFiles } from "wisp/scripts/wisp/gameFiles";
import { CREATE, CREATE_GAME, CREATE_TITLE, CUSTOM_GAMES, FIRST_MAP, JOIN, LOBBY, MAP_TITLE, START, freshMatch } from "../scripts/wisp/commands/fresh";

test.each([[true, false], [false, true], [true, true]])("fresh uses each client's page independently (host=%s, guest=%s)", async (hostPage, guestPage) => {
  const state = new Map([["a", "custom"], ["b", "custom"]]);
  const commands: string[] = [];
  const passwords: { host?: unknown; privateGame?: unknown; guest?: unknown } = {};
  const clicks: string[] = [];
  const servers: Bun.Server<undefined>[] = [];
  const intervals: ReturnType<typeof setInterval>[] = [];
  let readyAt: number | undefined;
  const start = () => {
    readyAt = Date.now() + 1;
    state.set("a", "playing");
    state.set("b", "playing");
  };
  const page = (name: string, enabled: boolean) => {
    if (!enabled) return {};
    const reservation = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() });
    const menuReportPort = reservation.port!;
    reservation.stop(true);
    const server = Bun.serve<undefined>({
      hostname: "127.0.0.1", port: 0,
      fetch(request, server) {
        if (server.upgrade(request)) return undefined;
        return new Response("not found", { status: 404 });
      },
      websocket: {
        message(socket, data) {
          const { message, payload } = JSON.parse(String(data)) as { message: string; payload?: Record<string, unknown> };
          commands.push(`${name}:${message}`);
          const tell = (messageType: string, payload: unknown) => socket.send(JSON.stringify({ messageType, payload }));
          if (message === "GetMapList") tell("MapList", { mapList: { maps: [{ filename: "test.w3x", filepath: "C:/Maps/00-Smashcraft/", isFolder: false }] } });
          if (message === "CreateLobby") {
            passwords.host = payload?.["password"];
            passwords.privateGame = payload?.["privateGame"];
            state.set(name, "lobby");
            tell("GameLobbySetup", { isHost: false });
            tell("SetGlueScreen", { screen: "GAME_LOBBY" });
          }
          if (message === "SendGameLobbySetup") tell("GameLobbySetup", { isHost: true });
          if (message === "JoinGameByGameName") {
            passwords.guest = payload?.["gamePass"];
            expect(state.get("a")).toBe("lobby");
            // Fresh 97387: a page-hosted public game asked a guest joining by name for a password, again and again.
            if (passwords.host !== undefined && (passwords.host === "" || payload?.["gamePass"] !== passwords.host)) {
              tell("RequestForPassword", {});
              return;
            }
            state.set(name, "lobby");
            tell("GameLobbySetup", { isHost: false });
          }
          if (message === "LobbyStart") {
            expect(state.get("b")).toBe("lobby");
            start();
            tell("SetGlueScreen", { screen: "LOADING_SCREEN" });
          }
        },
      },
    });
    servers.push(server);
    intervals.push(setInterval(() => {
      void fetch(`http://127.0.0.1:${menuReportPort}/menus`, {
        method: "POST", headers: { origin: `http://127.0.0.1:${server.port}` },
        body: JSON.stringify({ port: server.port, guid: "fresh-test-guid" }),
      }).catch(() => {});
    }, 10));
    return { menuReportPort };
  };
  try {
    const clients: readonly [Client, Client] = [
      { name: "a", documents: "/a", ...page("a", hostPage) },
      { name: "b", documents: "/b", ...page("b", guestPage) },
    ];
    const click = (client: Client, x: number, y: number) => Effect.sync(() => {
      clicks.push(`${client.name}:${x},${y}`);
      if (x === CREATE_GAME.x && y === CREATE_GAME.y) state.set(client.name, "create");
      if (x === FIRST_MAP.x && y === FIRST_MAP.y) state.set(client.name, "selected");
      if (x === CREATE.x && y === CREATE.y) state.set(client.name, "lobby");
      if (x === START.x && y === START.y) start();
      if (x === JOIN.x && y === JOIN.y) state.set(client.name, "lobby");
    });
    const driver = Clients.of({
      all: clients,
      read: (client, region) => Effect.sync(() => {
        const screen = state.get(client.name);
        if (region === CUSTOM_GAMES) return screen === "custom" ? "CREATE" : "";
        if (region === CREATE_TITLE) return screen === "create" ? "REATE GAME" : "";
        if (region === MAP_TITLE) return screen === "selected" ? "SMASHCRAFT" : "";
        if (region === LOBBY) return screen === "lobby" ? `PLAYERS: ${state.get("b") === "lobby" ? 2 : 1}/4` : "";
        return "";
      }),
      capture: () => Effect.die("no capture needed"), words: () => Effect.succeed([]),
      click, keys: () => Effect.void, typeText: () => Effect.void,
      batch: (client, actions) => Effect.forEach(actions, (action) => action.kind === "click" ? click(client, action.x, action.y) : Effect.void, { discard: true }),
    });
    const ready = readFileSync(join(import.meta.dir, "fixtures/wisp/melee-ready.pld"), "utf8");
    const files = GameFiles.of({
      read: () => Effect.sync(() => readyAt === undefined ? undefined : { text: ready, modified: readyAt }),
      write: () => Effect.void, replace: () => Effect.void, remove: () => Effect.void,
      list: () => Effect.succeed([]), installMap: () => Effect.void,
    });
    await Effect.runPromise(freshMatch("/maps/test.w3x").pipe(Effect.provide(Layer.merge(Layer.succeed(Clients, driver), Layer.succeed(GameFiles, files)))));
    expect([...state.values()]).toEqual(["playing", "playing"]);
    if (hostPage) {
      expect(commands).toContain("a:CreateLobby");
      expect(commands).toContain("a:LobbyStart");
      expect(clicks.some((entry) => entry.startsWith("a:"))).toBe(false);
    }
    if (hostPage && guestPage) {
      // Both pages: a private game, joined with its own non-empty password.
      expect(passwords.privateGame).toBe(true);
      expect(passwords.host).toMatch(/^[0-9a-z]{6}$/);
      expect(passwords.guest).toBe(passwords.host);
    } else if (hostPage) expect(passwords).toEqual({ host: "", privateGame: false });
    if (guestPage) {
      expect(commands).toContain("b:JoinGameByGameName");
      expect(clicks.some((entry) => entry.startsWith("b:"))).toBe(false);
    }
  } finally {
    for (const interval of intervals) clearInterval(interval);
    for (const server of servers) server.stop(true);
  }
});
