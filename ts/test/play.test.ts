// Smashcraft's `bun wisp play` declaration against fake game files: the
// request left before Warcraft starts, fighter selection from the map's ready
// file, the go-ahead and the map's receipt, and the optional controller service
// (test/controller-service.test.ts). The map's side is test/playtest.test.ts.
import { expect, test } from "bun:test";
import { join } from "node:path";
import { Clock, Effect, Exit, Fiber, Layer } from "effect";
import { TestClock } from "effect/testing";
import { GameFiles, type StoredFile, dataDirectory } from "wisp/scripts/wisp/gameFiles";
import type { PlayGame } from "wisp/scripts/wisp/play";
import { PLAYTEST as OWNER_PLAYTEST, playtest } from "../scripts/wisp/commands/play";

const PLAYTEST = { ...OWNER_PLAYTEST, map: { folder: "00-Smashcraft", file: "Smashcraft 0.0.50.w3x", title: "Smashcraft 0.0.50", source: "/builds/Smashcraft 0.0.50.w3x" }, helper: "/builds/wc3-journal" };

const DOCUMENTS = "/pfx/drive_c/users/steamuser/Documents/Warcraft III";
const DATA = dataDirectory(DOCUMENTS);
const READY = join(DATA, "wc3-melee-ready.txt");
const REQUEST = join(DATA, "smashcraft-play.txt");
const GO = join(DATA, "smashcraft-play-go.txt");
const RECEIPT = join(DATA, "smashcraft-play-p0.txt");

const preload = (...lines: string[]) =>
  `function PreloadFiles takes nothing returns nothing\n\n\tcall PreloadStart()\n${lines.map((line) => `\tcall Preload( "${line}" )\n`).join("")}\tcall PreloadEnd( 0.0 )\n\nendfunction\n`;
const readyFile = (build = "playable-0047") => preload(`BUILD ${build}`, "INPUT callback PRESENTATION pool-confirmed", "SCENARIO normal", "BINDINGS 87", "HUMANS 1 FIGHTERS 1");

/** CustomMapData as a map: the map's side answers a go-ahead with its receipt, as src/platform/shell/playtest.ts does. */
function customMapData(answer: "started" | "refused" | "none" = "started") {
  const stored = new Map<string, StoredFile>();
  const removed: string[] = [];
  const files = GameFiles.of({
    read: (path) => Effect.succeed(stored.get(path)),
    write: (path, contents) => Effect.gen(function*() {
      const modified = yield* Clock.currentTimeMillis;
      stored.set(path, { text: typeof contents === "string" ? contents : new TextDecoder().decode(contents), modified });
      if (path === GO && answer !== "none") stored.set(RECEIPT, { text: preload(`PLAY v=3 computers=4 opponent=wren difficulty=intermediate ${answer}`), modified: modified + 1 });
    }),
    replace: () => Effect.void,
    list: () => Effect.succeed([]),
    remove: (path) => Effect.sync(() => {
      removed.push(path);
      stored.delete(path);
    }),
    installMap: () => Effect.void,
  });
  return { files, stored, removed };
}

const game: PlayGame = { documents: DOCUMENTS, pid: 2852, window: 762, display: ":0", xWindow: { id: "169869313", x: 0, y: 0, width: 2880, height: 1920 } };

const simulate = async <A, E>(program: Effect.Effect<A, E, GameFiles>, files: typeof GameFiles.Service) =>
  Effect.runPromise(Effect.gen(function*() {
    const fiber = yield* Effect.forkChild(Effect.exit(program.pipe(Effect.provide(Layer.succeed(GameFiles, files)))));
    for (let step = 0; step < 1000 && fiber.pollUnsafe() === undefined; step++) {
      yield* Effect.yieldNow;
      yield* TestClock.adjust("250 millis");
    }
    return yield* Fiber.join(fiber);
  }).pipe(Effect.provide(TestClock.layer())));

const failureText = <A, E>(exit: Exit.Exit<A, E>) => (Exit.isFailure(exit) ? String(exit.cause) : "");

test("before Warcraft starts, the request for a computer as Player 3 replaces an earlier run's go-ahead and receipt", async () => {
  const declared = playtest(PLAYTEST);
  const data = customMapData();
  data.stored.set(GO, { text: preload("GO"), modified: 1 });
  data.stored.set(RECEIPT, { text: preload("PLAY v=3 computers=4 opponent=wren difficulty=intermediate started"), modified: 1 });
  expect(Exit.isSuccess(await simulate(declared.prepare(DOCUMENTS), data.files))).toBe(true);
  expect(data.removed).toEqual([GO, RECEIPT]);
  expect(data.stored.get(REQUEST)?.text).toContain(`'$wsl', "PLAY v=3 computers=4 opponent=wren difficulty=intermediate", 0)`);
});

test("a run that stops removes the request, the go-ahead and the receipt", async () => {
  const declared = playtest(PLAYTEST);
  const data = customMapData();
  for (const path of [REQUEST, GO, RECEIPT]) data.stored.set(path, { text: preload("x"), modified: 1 });
  data.stored.set(READY, { text: readyFile(), modified: 1 });
  expect(Exit.isSuccess(await simulate(declared.cleanup(DOCUMENTS), data.files))).toBe(true);
  expect(data.removed.sort()).toEqual([GO, RECEIPT, REQUEST].sort());
  expect(data.stored.has(READY)).toBe(true);
});

test("fighter selection is the build's ready file written after the launch; an older file or another build's doesn't count", async () => {
  const declared = playtest(PLAYTEST);
  const fresh = customMapData();
  const started = await simulate(Effect.gen(function*() {
    yield* Effect.sleep("3 seconds");
    fresh.stored.set(READY, { text: readyFile(), modified: yield* Clock.currentTimeMillis });
  }).pipe(Effect.forkChild, Effect.flatMap(() => declared.started(game, 0))), fresh.files);
  expect(Exit.isSuccess(started)).toBe(true);
  const stale = customMapData();
  stale.stored.set(READY, { text: readyFile(), modified: -1 });
  expect(failureText(await simulate(declared.started(game, 0), stale.files)))
    .toContain("Smashcraft didn't reach fighter selection within 120 s (no new wc3-melee-ready.txt for playable-0047)");
  const other = customMapData();
  other.stored.set(READY, { text: readyFile("typescript-dev"), modified: 1 });
  expect(Exit.isFailure(await simulate(declared.started(game, 0), other.files))).toBe(true);
});

test("the go-ahead starts the match, and the request and go-ahead are removed for the next session", async () => {
  const declared = playtest(PLAYTEST);
  const data = customMapData();
  data.stored.set(REQUEST, { text: preload("PLAY v=3 computers=4 opponent=wren difficulty=intermediate"), modified: 0 });
  const matched = await simulate(declared.match(game), data.files);
  expect(Exit.isSuccess(matched) && matched.value).toBe("wren intermediate computer as Player 3, match started");
  expect(data.stored.has(REQUEST)).toBe(false);
  expect(data.stored.has(GO)).toBe(false);
  const refused = customMapData("refused");
  expect(failureText(await simulate(declared.match(game), refused.files))).toContain(`Smashcraft refused the playtest request "PLAY v=3 computers=4 opponent=wren difficulty=intermediate"`);
  const deaf = customMapData("none");
  expect(failureText(await simulate(declared.match(game), deaf.files))).toContain("Smashcraft didn't take the playtest request within 15 s");
});
