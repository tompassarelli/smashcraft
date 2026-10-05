import { readFileSync, mkdtempSync, utimesSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Cause, Clock, Effect, Exit, Fiber, Layer } from "effect";
import { TestClock } from "effect/testing";
import { expect, test } from "bun:test";
import {
  Acknowledgement,
  ErrorReport,
  InputTrace,
  InputTraceStart,
  MeleeReady,
} from "../scripts/waygate/boundary";
import { validateDataDirectories } from "../scripts/waygate/commands/hot";
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
  LOBBY_COUNT,
  MAP_TITLE,
  RESULTS,
  START,
  freshMatch,
} from "../scripts/waygate/commands/fresh";
import { Clients, type Client } from "../scripts/waygate/clients";
import { dataDirectory, GameFiles, type StoredFile } from "../scripts/waygate/gameFiles";
import { HotReload } from "../scripts/waygate/hotReload";
import { MapBuild, type CompiledBundle } from "../scripts/waygate/mapBuild";
import { freshBundleAge } from "../scripts/waygate/mapBuild";

const fixture = (name: string) => readFileSync(join(import.meta.dir, "fixtures/waygate", name), "utf8");

test("each game-written file kind decodes its native Preload fixture", async () => {
  expect(await Effect.runPromise(Acknowledgement.decode("ack.txt", fixture("acknowledgement.pld"))))
    .toEqual({ version: 42, elapsed: 621.2031 });
  expect(await Effect.runPromise(ErrorReport.decode("error.txt", fixture("error-report.pld"))))
    .toEqual({ count: 3, handler: "OnTrigger", lines: ["attempt to call nil value", "smashcraft-hot-101-24:42: in function 'OnTrigger'"] });
  expect(await Effect.runPromise(MeleeReady.decode("ready.txt", fixture("melee-ready.pld"))))
    .toEqual({ build: "ts-shell-r1", input: "input-v4", presentation: "pose-v6", scenario: "default", bindings: "standard", humans: 2, fighters: 2, slotBindings: ["BINDINGS0 HUMAN", "BINDINGS1 HUMAN"] });
  expect(await Effect.runPromise(InputTraceStart.decode("trace-start.txt", fixture("input-trace-start.pld"))))
    .toEqual({ build: "ts-shell-r1" });
  expect(await Effect.runPromise(InputTrace.decode("trace.txt", fixture("input-trace.pld"))))
    .toEqual({ lines: ["confirmed frame 301 state 8821", "confirmed frame 302 state 8837"], dropped: 0, ticks: 300, seconds: 4.996 });
});

test("malformed fixtures report their file and typed field", async () => {
  const cases = [
    ["ack-malformed.txt", Acknowledgement, "acknowledgement-malformed.pld", "version"],
    ["error-malformed.txt", ErrorReport, "error-report-malformed.pld", "count"],
    ["ready-malformed.txt", MeleeReady, "melee-ready-malformed.pld", "humans"],
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
  const hotLayer = HotReload.layer(directories).pipe(Layer.provide(dependencies));
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
    const manifest = events.findIndex((event) => event === `manifest:${directory}/smashcraft-hot-manifest-1.pld`);
    const acknowledgementRead = events.findIndex((event) => event === `ack:${directory}/smashcraft-hot-ack-p0.txt`);
    expect(payload).toBeGreaterThanOrEqual(0);
    expect(manifest).toBeGreaterThan(payload);
    expect(acknowledgementRead).toBeGreaterThan(manifest);
  }
});

test("fresh-match flow drives two fake clients and waits on the Effect clock for both ready files", async () => {
  const clients: readonly [Client, Client] = [
    { name: "a", documents: "/a/Documents/Warcraft III" },
    { name: "b", documents: "/b/Documents/Warcraft III" },
  ];
  const states = new Map(clients.map(({ name }) => [name, "game"]));
  const selected = new Set<string>();
  const clicks: string[] = [];
  let readyAt: number | undefined;
  const gameFiles = GameFiles.of({
    read: (path): Effect.Effect<StoredFile | undefined> => Effect.gen(function*() {
      const now = yield* Clock.currentTimeMillis;
      if (readyAt !== undefined && now >= readyAt && clients.some(({ documents }) => path === `${dataDirectory(documents)}/wc3-melee-ready.txt`)) {
        return { text: fixture("melee-ready.pld"), modified: readyAt };
      }
      return undefined;
    }),
    write: () => Effect.void,
    replace: () => Effect.void,
    list: () => Effect.succeed([]),
    remove: () => Effect.void,
    installMap: () => Effect.void,
  });
  const fakeClients = Clients.of({
    all: clients,
    read: (client, region) => Effect.succeed((() => {
      const state = states.get(client.name);
      if (region === CUSTOM_GAMES) return state === "custom" ? "CREATE GAME" : "";
      if (region === RESULTS) return state === "results" ? "RESULTS" : "";
      if (region === LOBBY) return state === "lobby" ? "PLAYERS" : "";
      if (region === CREATE_TITLE) return state === "create" ? "REATE GAME" : "";
      if (region === GAME_MENU) return state === "menu" ? "Game Menu" : state === "end-menu" ? "End Game" : "";
      if (region === MAP_TITLE) return selected.has(client.name) ? "SMASHCRAFT" : "";
      if (region === LOBBY_COUNT) return clients.every(({ name }) => states.get(name) === "lobby") ? "2/4" : "";
      return "";
    })()),
    words: () => Effect.succeed([]),
    click: (client, x, y) => Effect.gen(function*() {
      clicks.push(`${client.name}:${x},${y}`);
      if (x === BACK.x && y === BACK.y) states.set(client.name, "custom");
      if (x === CREATE_GAME.x && y === CREATE_GAME.y) states.set(client.name, "create");
      if (x === FIRST_MAP.x && y === FIRST_MAP.y) selected.add(client.name);
      if (x === CREATE.x && y === CREATE.y) states.set(client.name, "lobby");
      if (x === JOIN.x && y === JOIN.y) states.set(client.name, "lobby");
      if (x === START.x && y === START.y) {
        readyAt = (yield* Clock.currentTimeMillis) + 100;
        for (const { name } of clients) states.set(name, "playing");
      }
    }),
    keys: (client, ...names) => Effect.sync(() => {
      const state = states.get(client.name);
      if (names.includes("F10")) states.set(client.name, "menu");
      else if (names.includes("e") && state === "menu") states.set(client.name, "end-menu");
      else if (names.includes("q") && state === "end-menu") states.set(client.name, "results");
    }),
    typeText: () => Effect.void,
  });
  const services = Layer.merge(Layer.succeed(Clients, fakeClients), Layer.succeed(GameFiles, gameFiles));
  const program = freshMatch("/maps/test.w3x").pipe(Effect.provide(services));
  const run = Effect.gen(function*() {
    const fiber = yield* Effect.forkChild(program);
    yield* Effect.yieldNow;
    yield* TestClock.adjust("2 seconds");
    yield* Fiber.join(fiber);
  }).pipe(Effect.provide(TestClock.layer()));

  await Effect.runPromise(run);
  expect([...states.values()]).toEqual(["playing", "playing"]);
  expect(selected).toEqual(new Set(["a"]));
  expect(clicks).toContain(`a:${START.x},${START.y}`);
});

test("hot reload requires distinct non-empty client data directories", async () => {
  expect(await Effect.runPromise(validateDataDirectories(["/client/data"]))).toEqual(["/client/data"]);
  expect(Exit.isFailure(await Effect.runPromiseExit(validateDataDirectories([])))).toBe(true);
  expect(Exit.isFailure(await Effect.runPromiseExit(validateDataDirectories([""])))).toBe(true);
  expect(Exit.isFailure(await Effect.runPromiseExit(validateDataDirectories(["/client/data", "/client/data"])))).toBe(true);
});

test("map rebuild reuses the bundle only while it is newer than every compile input", () => {
  const root = mkdtempSync(join(tmpdir(), "smashcraft-fresh-"));
  const src = join(root, "src");
  mkdirSync(join(src, "game"), { recursive: true });
  const source = join(src, "game", "a.ts");
  const config = join(root, "tsconfig.map.json");
  const bundle = join(root, "map.lua");
  for (const file of [source, config, bundle, `${bundle}.map`]) writeFileSync(file, "");
  const at = (file: string, seconds: number) => utimesSync(file, seconds, seconds);
  at(source, 100);
  at(config, 100);
  at(bundle, 200);
  expect(freshBundleAge(bundle, [src, config], 203_000)).toBe(3);
  at(source, 250);
  expect(freshBundleAge(bundle, [src, config], 260_000)).toBeUndefined();
});
