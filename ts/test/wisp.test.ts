import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Cause, Clock, Effect, Exit, Fiber, Layer } from "effect";
import { TestClock } from "effect/testing";
import { expect, test } from "bun:test";
import {
  DevCommandReceipt,
  InputTrace,
  InputTraceStart,
  MeleeReady,
} from "../scripts/wisp/boundary";
import {
  BACK,
  CREATE,
  CREATE_GAME,
  CREATE_TITLE,
  CUSTOM_GAMES,
  FIRST_MAP,
  GAME_MENU,
  JOIN,
  JOIN_NAME,
  LOBBY,
  MAP_TITLE,
  RESULTS,
  START,
  freshMatch,
  sendQuickMatchCommand,
} from "../scripts/wisp/commands/fresh";
import { Clients, type Client } from "wisp/scripts/wisp/clients";
import { dataDirectory, GameFiles, type StoredFile } from "wisp/scripts/wisp/gameFiles";
import { HotReload } from "wisp/scripts/wisp/hotReload";
import { MapBuild, type CompiledBundle } from "wisp/scripts/wisp/mapBuild";

const fixture = (name: string) => readFileSync(join(import.meta.dir, "fixtures/wisp", name), "utf8");

test("each game-written file kind decodes its native Preload fixture", async () => {
  expect(await Effect.runPromise(MeleeReady.decode("ready.txt", fixture("melee-ready.pld"))))
    .toEqual({ build: "ts-shell-r1", input: "input-v4", presentation: "pose-v6", scenario: "default", bindings: "standard", humans: 2, fighters: 2, slotBindings: ["BINDINGS0 HUMAN", "BINDINGS1 HUMAN"] });
  expect(await Effect.runPromise(DevCommandReceipt.decode("dev.txt", fixture("dev-command-receipt.pld"))))
    .toEqual({ build: "ts-shell-r1", receipt: 1, epoch: 0, rollback: 6, delay: 0, batch: 2 });
  expect(await Effect.runPromise(InputTraceStart.decode("trace-start.txt", fixture("input-trace-start.pld"))))
    .toEqual({ build: "ts-shell-r1" });
  expect(await Effect.runPromise(InputTrace.decode("trace.txt", fixture("input-trace.pld"))))
    .toEqual({ lines: ["confirmed frame 301 state 8821", "confirmed frame 302 state 8837"], dropped: 0, ticks: 300, seconds: 4.996 });
});

test("malformed fixtures report their file and typed field", async () => {
  const cases = [
    ["ready-malformed.txt", MeleeReady, "melee-ready-malformed.pld", "humans"],
    ["dev-malformed.txt", DevCommandReceipt, "dev-command-receipt-malformed.pld", "receipt"],
    ["trace-start-malformed.txt", InputTraceStart, "input-trace-start-malformed.pld", "build"],
    ["trace-malformed.txt", InputTrace, "input-trace-malformed.pld", "dropped"],
  ] as const;
  for (const [file, kind, source, field] of cases) {
    const result = await Effect.runPromiseExit(kind.decode(file, fixture(source)));
    expect(Exit.isFailure(result)).toBe(true);
    if (Exit.isFailure(result)) {
      expect(Cause.pretty(result.cause)).toContain(file);
      expect(Cause.pretty(result.cause)).toContain(field);
    }
  }
});

test("hot reload publishes payloads before manifests and waits for each fake client acknowledgement", async () => {
  const directories = ["/a/CustomMapData", "/b/CustomMapData"] as const;
  const events: string[] = [];
  const acknowledgement = "function PreloadFiles takes nothing returns nothing\ncall Preload( \"applied 1 at 0\" )\nendfunction\n";
  let acknowledgeAt: number | undefined;
  const files = GameFiles.of({
    read: (path) => Effect.gen(function*() {
      const now = yield* Clock.currentTimeMillis;
      if (acknowledgeAt !== undefined && now >= acknowledgeAt && path.endsWith("ack-p0.txt")) {
        events.push(`ack:${path}`);
        return { text: acknowledgement, modified: acknowledgeAt };
      }
      return undefined;
    }),
    write: (path) => Effect.sync(() => events.push(`payload:${path}`)),
    replace: (path) => Effect.gen(function*() {
      events.push(`manifest:${path}`);
      acknowledgeAt = (yield* Clock.currentTimeMillis) + 10;
    }),
    list: () => Effect.succeed([]),
    remove: () => Effect.void,
    installMap: () => Effect.void,
  });
  const bundle = { text: "bundle", bytes: new TextEncoder().encode("bundle"), checksum: "6:abc" } satisfies CompiledBundle;
  const mapBuild = MapBuild.of({ compile: Effect.succeed(bundle), build: () => Effect.void, rebuild: () => Effect.void });
  const dependencies = Layer.merge(Layer.succeed(GameFiles, files), Layer.succeed(MapBuild, mapBuild));
  const hotLayer = HotReload.layer(directories, "smashcraft").pipe(Layer.provide(dependencies));
  const program = Effect.gen(function*() {
    const hot = yield* HotReload;
    return yield* hot.publish;
  });

  const clocked = Effect.gen(function*() {
    const fiber = yield* Effect.forkChild(program);
    for (let advance = 0; advance < 4; advance++) {
      yield* Effect.yieldNow;
      yield* TestClock.adjust("5 millis");
    }
    return yield* Fiber.join(fiber);
  }).pipe(Effect.provide(Layer.merge(hotLayer, TestClock.layer())));
  expect(await Effect.runPromise(clocked)).toBe(1);
  for (const directory of directories) {
    const payload = events.findIndex((event) => event.startsWith(`payload:${directory}/`));
    const manifest = events.findIndex((event) => event === `manifest:${directory}/smashcraft-hot/manifest-1.pld`);
    const acknowledgementRead = events.findIndex((event) => event === `ack:${directory}/smashcraft-hot-ack-p0.txt`);
    expect(payload).toBeGreaterThanOrEqual(0);
    expect(manifest).toBeGreaterThan(payload);
    expect(acknowledgementRead).toBeGreaterThan(manifest);
  }
});

test.each([false, true])("fresh-match flow drives two fake clients and waits on the Effect clock for both ready files (fromGame=%s)", async (fromGame) => {
  const clients: readonly [Client, Client] = [
    { name: "a", documents: "/a/Documents/Warcraft III" },
    { name: "b", documents: "/b/Documents/Warcraft III" },
  ];
  const states = new Map(clients.map(({ name }) => [name, "game"]));
  const selected = new Set<string>();
  const clicks: string[] = [];
  const keyEvents: string[] = [];
  let readyAt: number | undefined;
  let quickAt: number | undefined;
  let joinedAt: number | undefined;
  let hostedAt: number | undefined;
  let chatSubmissions = 0;
  const messages: string[] = [];
  const gameFiles = GameFiles.of({
    read: (path): Effect.Effect<StoredFile | undefined> => Effect.gen(function*() {
      const now = yield* Clock.currentTimeMillis;
      if (readyAt !== undefined && now >= readyAt && clients.some(({ documents }) => path === `${dataDirectory(documents)}/wc3-melee-ready.txt`)) {
        return { text: fixture("melee-ready.pld"), modified: readyAt };
      }
      if (quickAt !== undefined && now >= quickAt && path.includes("smashcraft-dev-")) {
        return { text: fixture("dev-command-receipt.pld"), modified: quickAt };
      }
      return undefined;
    }),
    write: () => Effect.void,
    replace: () => Effect.void,
    list: () => Effect.succeed([]),
    remove: () => Effect.void,
    installMap: () => Effect.void,
  });
  const fakeClients: typeof Clients.Service = Clients.of({
    all: clients,
    read: (client, region) => Effect.gen(function*() {
      if (client.name === "a" && hostedAt !== undefined && (yield* Clock.currentTimeMillis) >= hostedAt) states.set("a", "lobby");
      if (client.name === "b" && joinedAt !== undefined && (yield* Clock.currentTimeMillis) >= joinedAt) states.set("b", "lobby");
      const state = states.get(client.name);
      if (region === CUSTOM_GAMES) return state === "custom" ? "CREATE GAME" : "";
      if (region === RESULTS) return state === "results" ? "RESULTS" : "";
      // A browser column can say PLAYERS while hosting/joining has not completed.
      // The lobby count can already include a computer before B arrives.
      if (region === LOBBY) return state === "lobby" ? "PLAYERS: 2/4" : "PLAYERS";
      if (region === CREATE_TITLE) return state === "create" ? "REATE GAME" : "";
      if (region === GAME_MENU) return state === "menu" ? "Game Menu" : state === "end-menu" ? "End Game" : "";
      if (region === MAP_TITLE) return selected.has(client.name) ? "SMASHCRAFT" : "";
      return "";
    }),
    words: () => Effect.succeed([]),
    click: (client, x, y) => Effect.gen(function*() {
      clicks.push(`${client.name}:${x},${y}`);
      const before = states.get(client.name);
      if (x === BACK.x && y === BACK.y) states.set(client.name, "custom");
      if (x === CREATE_GAME.x && y === CREATE_GAME.y) states.set(client.name, "create");
      if (x === FIRST_MAP.x && y === FIRST_MAP.y) selected.add(client.name);
      if (x === CREATE.x && y === CREATE.y && before === "create") {
        states.set(client.name, "hosting");
        hostedAt = (yield* Clock.currentTimeMillis) + 100;
      }
      if (x === JOIN.x && y === JOIN.y) {
        expect(states.get("a")).toBe("lobby");
        joinedAt = (yield* Clock.currentTimeMillis) + 100;
      }
      if (x === START.x && y === START.y && before === "lobby") {
        expect(states.get("b")).toBe("lobby");
        hostedAt = undefined;
        joinedAt = undefined;
        readyAt = (yield* Clock.currentTimeMillis) + 100;
        for (const { name } of clients) states.set(name, "playing");
      }
    }),
    keys: (client, ...names) => Effect.gen(function*() {
      keyEvents.push(...names.map((name) => `${client.name}:${name}`));
      const state = states.get(client.name);
      if (names.includes("F10")) states.set(client.name, "menu");
      else if (names.includes("e") && state === "menu") states.set(client.name, "end-menu");
      else if (names.includes("q") && state === "end-menu") states.set(client.name, "results");
      else if (names.includes("Return")) {
        chatSubmissions++;
        if (chatSubmissions === 2) quickAt = (yield* Clock.currentTimeMillis) + 100;
      }
    }),
    typeText: (_client, value) => Effect.sync(() => messages.push(value)),
    batch: (client, actions) => Effect.forEach(actions, (action) => {
      switch (action.kind) {
        case "click": return fakeClients.click(client, action.x, action.y);
        case "keys": return fakeClients.keys(client, ...action.keys);
        case "text": return fakeClients.typeText(client, action.text);
        case "wait": return Effect.sleep(action.millis);
      }
    }, { discard: true }),
  });
  const services = Layer.merge(Layer.succeed(Clients, fakeClients), Layer.succeed(GameFiles, gameFiles));
  const program = Effect.gen(function*() {
    yield* freshMatch("/maps/test.w3x", fromGame);
    yield* sendQuickMatchCommand;
  }).pipe(Effect.provide(services));
  const run = Effect.gen(function*() {
    const fiber = yield* Effect.forkChild(program);
    for (let advance = 0; advance < 20; advance++) {
      yield* Effect.yieldNow;
      yield* TestClock.adjust("250 millis");
    }
    yield* Fiber.join(fiber);
  }).pipe(Effect.provide(TestClock.layer()));

  await Effect.runPromise(run);
  expect([...states.values()]).toEqual(["playing", "playing"]);
  expect(selected).toEqual(new Set(["a"]));
  expect(keyEvents.indexOf("a:Escape")).toBeLessThan(keyEvents.indexOf("a:F10"));
  expect(clicks).toContain(`a:${START.x},${START.y}`);
  expect(messages.at(-1)).toBe("-dev quick");
  expect(chatSubmissions).toBe(2);
});
