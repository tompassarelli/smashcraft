// Smashcraft's `bun wisp play` declaration against fakes: fighter selection
// from the host's menu file, the computer added through its card tag with the
// slot cycling HMN, CPU, EMPTY as src/game/match/rules.ts does, and the
// helper's arguments for the found controller.
import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Clock, Effect, Exit, Fiber, Layer } from "effect";
import { TestClock } from "effect/testing";
import { GameFiles, type StoredFile, dataDirectory } from "wisp/scripts/wisp/gameFiles";
import type { PlayGame } from "wisp/scripts/wisp/play";
import { PLAYTEST, playtest } from "../scripts/wisp/commands/play";

const DOCUMENTS = "/pfx/drive_c/users/steamuser/Documents/Warcraft III";
const MENU = join(dataDirectory(DOCUMENTS), "smashcraft-journal-menu-playable-0047-s0.txt");
const scratch = mkdtempSync(join(tmpdir(), "smashcraft-play-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const menuFile = (phase: string, humans: number, computers: number) => `function PreloadFiles takes nothing returns nothing

\tcall PreloadStart()
\tcall Preload( "SMASHCRAFT JOURNAL MENU v=1 build=playable-0047 epoch=1 slot=0 phase=${phase}" )
\tcall Preload( "connected=1 human-fighters=${humans} computers=${computers} fighters=${humans + computers}" )
\tcall PreloadEnd( 0.0 )

endfunction
`;

function selection(options: { readonly tagWorks?: boolean } = {}) {
  let file: StoredFile | undefined = { text: menuFile("CHARACTER", 1, 4), modified: -1 };
  let humans = 1;
  let computers = 0;
  const clicks: string[] = [];
  const write = (modified: number) => { file = { text: menuFile("CHARACTER", humans, computers), modified }; };
  const files = GameFiles.of({
    read: (path) => Effect.succeed(path === MENU ? file : undefined),
    write: () => Effect.void, replace: () => Effect.void, list: () => Effect.succeed([]), remove: () => Effect.void, installMap: () => Effect.void,
  });
  const game: PlayGame = {
    documents: DOCUMENTS, pid: 2852, window: 762, display: ":0",
    xWindow: { id: "169869313", x: 0, y: 0, width: 2880, height: 1920 },
    clickUi: (x, y) => Effect.gen(function*() {
      clicks.push(`${x.toFixed(4)},${y.toFixed(4)}`);
      // Slot C's tag: cycle HMN, CPU, EMPTY.
      if (options.tagWorks === false || Math.abs(x - 0.485) > 0.001) return;
      const bit = 4;
      if ((humans & bit) !== 0) {
        humans -= bit;
        computers += bit;
      } else if ((computers & bit) !== 0) computers -= bit;
      else humans += bit;
      // The map rewrites the file; each write is newer than the last.
      write(Math.max(yield* Clock.currentTimeMillis, (file?.modified ?? 0) + 1));
    }),
  };
  return { files, game, clicks, start: (at: number) => write(at) };
}

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

test("fighter selection is a CHARACTER menu file written after Start; an older file doesn't count", async () => {
  const declared = playtest(PLAYTEST);
  const fresh = selection();
  const started = await simulate(Effect.gen(function*() {
    yield* Effect.sleep("3 seconds");
    fresh.start(yield* Clock.currentTimeMillis);
  }).pipe(Effect.forkChild, Effect.flatMap(() => declared.started(fresh.game, 0))), fresh.files);
  expect(Exit.isSuccess(started)).toBe(true);
  const stale = selection();
  const timedOut = await simulate(declared.started(stale.game, 0), stale.files);
  expect(failureText(timedOut)).toContain("Smashcraft didn't reach fighter selection within 120 s (no new smashcraft-journal-menu-playable-0047-s0.txt)");
});

test("the computer opponent takes two tag clicks from EMPTY, each after a click on the widescreen margin", async () => {
  const declared = playtest(PLAYTEST);
  const world = selection();
  world.start(0);
  const added = await simulate(declared.opponent(world.game), world.files);
  expect(failureText(added)).toBe("");
  expect(Exit.isSuccess(added) && added.value).toBe("computer as Player 3");
  // The 2880x1920 window's 4:3 area spans 160 to 2720; the margin's centre is at UI x 0.825.
  expect(world.clicks).toEqual(["0.8250,0.5167", "0.4850,0.2565", "0.8250,0.5167", "0.4850,0.2565"]);
  const stuck = selection({ tagWorks: false });
  stuck.start(0);
  expect(failureText(await simulate(declared.opponent(stuck.game), stuck.files))).toContain("clicking Player 3's card tag didn't change fighter selection");
});

test("the helper gets the found Xbox controller, the game's data folder, pid and windows", async () => {
  const devices = join(scratch, "by-id");
  mkdirSync(devices);
  writeFileSync(join(scratch, "event7"), "");
  symlinkSync(join(scratch, "event7"), join(devices, "usb-Microsoft_Controller_3039363431313739383233353335-event-joystick"));
  symlinkSync(join(scratch, "event7"), join(devices, "usb-Logitech_USB_Receiver-event-mouse"));
  const declared = playtest({ ...PLAYTEST, inputDevices: devices });
  const world = selection();
  const args = await simulate(declared.helper.args(world.game), world.files);
  expect(Exit.isSuccess(args) && args.value).toEqual([
    "--follow-matches", "--build", "playable-0047", "--slot", "0", "--device", join(scratch, "event7"), "--out", dataDirectory(DOCUMENTS),
    "--editbox-display", ":0", "--x11-window", "169869313", "--pid", "2852", "--niri-window", "762",
  ]);
  const none = playtest({ ...PLAYTEST, inputDevices: join(scratch, "missing") });
  expect(failureText(await simulate(none.helper.args(world.game), world.files))).toContain(`no Xbox controller in ${join(scratch, "missing")}; plug it in and run play again`);
});
