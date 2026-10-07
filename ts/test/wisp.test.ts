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
import { sendQuickMatchCommand } from "../scripts/wisp/commands/fresh";
import { Clients, type Client } from "wisp/scripts/wisp/clients";
import { GameFiles, type StoredFile } from "wisp/scripts/wisp/gameFiles";
import { HotReload } from "wisp/scripts/wisp/hotReload";
import { MapBuild } from "wisp/scripts/wisp/mapBuild";
import { SourceErrors } from "wisp/scripts/wisp/sourceErrors";

const fixture = (name: string) => readFileSync(join(import.meta.dir, "fixtures/wisp", name), "utf8");

test("each game-written file kind decodes its native Preload fixture", async () => {
  expect(await Effect.runPromise(MeleeReady.decode("ready.txt", fixture("melee-ready.pld"))))
    .toEqual({ build: "ts-shell-r1", input: "input-v4", presentation: "pose-v6", scenario: "default", bindings: "standard", humans: 2, fighters: 2, slotBindings: ["BINDINGS0 HUMAN", "BINDINGS1 HUMAN"] });
  expect(await Effect.runPromise(DevCommandReceipt.decode("dev.txt", fixture("dev-command-receipt.pld"))))
    .toEqual({
      build: "ts-shell-r1", receipt: 1, epoch: 0, rollback: 6, delay: 0, batch: 2, rematchSeconds: 5,
      phase: 0, humanFighters: 3, computers: 0, characters: "0,1,2,0", stocks: 1, minutes: 7, automaticRematch: 0, stage: 2,
    });
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
  const modules = { entry: "main", modules: [{ name: "main", code: "return {}", sourceMap: () => "{}" }] };
  const mapBuild = MapBuild.of({ compile: Effect.succeed(modules), build: () => Effect.void, rebuild: () => Effect.void });
  const sourceErrors = SourceErrors.of({ retain: () => Effect.void, retainModule: () => Effect.void, changed: () => Effect.succeed([]) });
  const dependencies = Layer.mergeAll(Layer.succeed(GameFiles, files), Layer.succeed(MapBuild, mapBuild), Layer.succeed(SourceErrors, sourceErrors));
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

test("the quick-match command is one chat line from the host, acknowledged by every client's new receipt", async () => {
  const clients: readonly [Client, Client] = [
    { name: "a", documents: "/a/Documents/Warcraft III" },
    { name: "b", documents: "/b/Documents/Warcraft III" },
  ];
  let quickAt: number | undefined;
  const removed: string[] = [];
  const sent: string[] = [];
  const gameFiles = GameFiles.of({
    read: (path): Effect.Effect<StoredFile | undefined> => Effect.gen(function*() {
      if (path.endsWith("/wc3-melee-ready.txt")) return { text: fixture("melee-ready.pld"), modified: 0 };
      if (quickAt !== undefined && (yield* Clock.currentTimeMillis) >= quickAt && path.includes("smashcraft-dev-")) return { text: fixture("dev-command-receipt.pld"), modified: quickAt };
      // An earlier command's receipt, removed before this one is sent.
      return path.includes("smashcraft-dev-") && quickAt === undefined ? { text: fixture("dev-command-receipt.pld"), modified: 0 } : undefined;
    }),
    write: () => Effect.void, replace: () => Effect.void, list: () => Effect.succeed([]), installMap: () => Effect.void,
    remove: (path) => Effect.sync(() => {
      removed.push(path);
    }),
  });
  const fakeClients: typeof Clients.Service = Clients.of({
    all: clients,
    read: () => Effect.succeed(""), words: () => Effect.succeed([]), capture: () => Effect.die("no capture"),
    click: () => Effect.die("no clicks"), keys: () => Effect.die("one batch"), typeText: () => Effect.die("one batch"),
    batch: (client, actions) => Effect.gen(function*() {
      sent.push(`${client.name}: ${actions.map((action) => action.kind === "keys" ? action.keys.join("+") : action.kind === "text" ? action.text : action.kind).join(" | ")}`);
      quickAt = (yield* Clock.currentTimeMillis) + 100;
    }),
  });
  const run = Effect.gen(function*() {
    const fiber = yield* Effect.forkChild(sendQuickMatchCommand.pipe(Effect.provide(Layer.merge(Layer.succeed(Clients, fakeClients), Layer.succeed(GameFiles, gameFiles)))));
    for (let advance = 0; advance < 10; advance++) {
      yield* Effect.yieldNow;
      yield* TestClock.adjust("100 millis");
    }
    yield* Fiber.join(fiber);
  }).pipe(Effect.provide(TestClock.layer()));
  await Effect.runPromise(run);
  // One batch, so Wisp checks once that the host is in its match before Return (wisp:docs/watch.md).
  expect(sent).toEqual(["a: Return | -dev quick | Return"]);
  expect(removed).toHaveLength(2);
});
