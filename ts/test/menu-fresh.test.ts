import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect, Exit, Layer } from "effect";
import { expect, test } from "bun:test";
import { Clients, type Client } from "wisp/scripts/wisp/clients";
import { GameFiles } from "wisp/scripts/wisp/gameFiles";
import { ClientWatch, type ClientView } from "wisp/scripts/wisp/watch";
import { freshMatch } from "../scripts/wisp/commands/fresh";

test.each([[true, false], [false, true], [true, true]])("fresh hosts only a private game through every client's page, and refuses before hosting when one has none (host=%s, guest=%s) [spec AGENTS.md]", async (hostPage, guestPage) => {
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
          if (message === "GetMapList") tell("MapList", { mapList: { maps: [{ filename: "test.w3x", filepath: "C:/Maps/00-Smashcraft/tests/", isFolder: false }] } });
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

    const input = (client: Client, what: string) => Effect.sync(() => {
      clicks.push(`${client.name}:${what}`);
    });
    const driver = Clients.of({
      all: clients,
      read: (client) => input(client, "read").pipe(Effect.as("")),
      capture: () => Effect.die("no capture needed"), words: () => Effect.succeed([]),
      click: (client) => input(client, "click"), keys: (client) => input(client, "keys"), typeText: (client) => input(client, "type"),
      batch: (client) => input(client, "batch"),
    });
    const ready = readFileSync(join(import.meta.dir, "fixtures/wisp/melee-ready.pld"), "utf8");
    const files = GameFiles.of({
      read: () => Effect.sync(() => readyAt === undefined ? undefined : { text: ready, modified: readyAt }),
      write: () => Effect.void, replace: () => Effect.void, remove: () => Effect.void,
      list: () => Effect.succeed([]), installMap: () => Effect.void,
    });

    const watch = ClientWatch.of({ view: () => Effect.succeed({ state: { kind: "menus" } } as unknown as ClientView) });
    const exit = await Effect.runPromiseExit(freshMatch("/maps/test.w3x").pipe(Effect.provide(Layer.mergeAll(Layer.succeed(Clients, driver), Layer.succeed(GameFiles, files), Layer.succeed(ClientWatch, watch)))));
    expect(clicks).toEqual([]);
    if (hostPage && guestPage) {
      expect(Exit.isSuccess(exit)).toBe(true);
      expect([...state.values()]).toEqual(["playing", "playing"]);
      expect(commands).toContain("a:LobbyStart");
      expect(commands).toContain("b:JoinGameByGameName");

      expect(passwords.privateGame).toBe(true);
      expect(passwords.host).toMatch(/^[0-9a-z]{6}$/);
      expect(passwords.guest).toBe(passwords.host);
    } else {

      expect(Exit.isFailure(exit) && String(exit.cause)).toContain(`none reported for ${hostPage ? "b" : "a"}`);
      expect(commands.filter((command) => command.endsWith("CreateLobby"))).toEqual([]);
    }
  } finally {
    for (const interval of intervals) clearInterval(interval);
    for (const server of servers) server.stop(true);
  }
}, 10_000);
