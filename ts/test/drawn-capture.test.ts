// A pad script's capture shows the frame it names, however far the client's
// drawn match runs behind the helper's clock (#156: 6 to 88 frames under
// load). The integrity build writes the frame it drew; the capture waits for it.
import { afterAll, expect, test } from "bun:test";
import { Effect, Exit } from "effect";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { QUICK_MATCH_COMMAND } from "../src/game/shell/devSettings";
import { install, startBuild } from "../src/platform/main";
import { activeRollback, shell } from "../src/platform/shell/state";
import { drawnFrameFile } from "../src/runtime/gameFiles";
import { type Drawn, captureWhenDrawn, parseDrawn } from "../scripts/integrity/drawnCapture";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { JournalHelpers } from "./rematch/journalHelper";
import { value } from "./rematch/playableMatch";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

/** A client whose drawn match runs `lag` frames behind a 60 fps clock that started `ahead` frames ago, in match `epoch`. */
function laggingClient(epoch: number, lag: number, ahead: number) {
  const started = performance.now() - ahead * 1000 / 60;
  const clockFrame = () => Math.floor((performance.now() - started) * 60 / 1000);
  return { clockFrame, read: (): Drawn => ({ epoch, frame: Math.max(0, clockFrame() - lag) }) };
}

test("a capture waits until the lagging client has drawn its frame, and records the frame it showed", async () => {
  // The helper's clock is already at frame 40; the client draws 30 frames behind it.
  const client = laggingClient(2, 30, 40);
  let shotAtDrawn = -1;
  let shotAtClock = -1;
  const shoot = Effect.sync(() => {
    shotAtDrawn = client.read().frame;
    shotAtClock = client.clockFrame();
    return "frame";
  });
  const result = await Effect.runPromise(captureWhenDrawn(client.read, 2, 40, 2000, shoot, "test"));
  // On the clock alone the capture would show frame 10; it waited for 40.
  expect(result.before).toBeGreaterThanOrEqual(40);
  expect(result.before).toBeLessThanOrEqual(42);
  expect(shotAtDrawn).toBeGreaterThanOrEqual(40);
  expect(shotAtClock - shotAtDrawn).toBeGreaterThanOrEqual(29);
  expect(result.after).toBeGreaterThanOrEqual(result.before);
  expect(result.waitedMs).toBeGreaterThan(400);
});

test("a capture ignores another match's drawn frames and fails after its wait", async () => {
  const oldMatch = laggingClient(1, 0, 500);
  const exit = await Effect.runPromiseExit(captureWhenDrawn(oldMatch.read, 2, 40, 150, Effect.succeed("frame"), "test"));
  expect(Exit.isFailure(exit)).toBe(true);
  expect(String(exit)).toContain("hadn't drawn match 2 frame 40");
});

test("the integrity build writes the predicted frame it drew, in its match's epoch", () => {
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0, 1]);
  const helpers = new JournalHelpers(INTEGRITY_BUILD.id, true);
  const frames = (n: number) => { for (let i = 0; i < n; i++) { clients.frames(1); helpers.service(clients); } };
  clients.start();
  frames(30);
  expect(clients.client(0).files.get(drawnFrameFile(INTEGRITY_BUILD.id, 0))).toBeUndefined();
  clients.chat(0, QUICK_MATCH_COMMAND);
  frames(120);
  for (const client of clients.clients) {
    const lines = client.files.get(drawnFrameFile(INTEGRITY_BUILD.id, client.slot)) ?? [];
    const drawn = parseDrawn(`function PreloadFiles takes nothing returns nothing\n${lines.map((line) => `\tcall Preload( "${line}" )`).join("\n")}\nendfunction\n`);
    const predicted = value(client, () => {
      const rollback = activeRollback(shell());
      return rollback === undefined ? undefined : { epoch: rollback.epoch, frame: rollback.speculative.runtime.simulationFrame };
    });
    expect(predicted?.frame).toBeGreaterThan(60);
    expect(drawn).toEqual(predicted);
  }
});
