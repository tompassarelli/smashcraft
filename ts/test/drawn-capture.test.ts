// A pad script's capture shows the frame it names, however far the client's
// drawn match runs behind the helper's clock (#156: 6 to 88 frames under
// load). The integrity build writes the frame it drew; the capture waits for it.
import { afterAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Effect, Exit } from "effect";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { QUICK_MATCH_COMMAND } from "../src/game/shell/devSettings";
import { install, startBuild } from "../src/platform/main";
import { activeRollback, shell } from "../src/platform/shell/state";
import { drawnFrameFile } from "../src/runtime/gameFiles";
import { type Drawn, captureWhenDrawn, parseDrawn, visualCaptureCommand } from "../scripts/integrity/drawnCapture";
import { parsePadScript } from "../scripts/integrity/padScript";
import { clearVisualCapture, configureVisualCapture, heldVisualFrame, holdVisualFrame, releaseVisualFrame } from "../src/game/shell/visualCapture";
import { confirmedChecksum } from "../src/platform/shell/diagnostics";
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

test("a capture waits for the requested held frame and identifies both receipts exactly", async () => {
  let frame = 10;
  const advance = setTimeout(() => { frame = 40; }, 20);
  const result = await Effect.runPromise(captureWhenDrawn(() => ({ epoch: 2, frame }), 2, 40, 2000, Effect.succeed("frame"), "test"));
  clearTimeout(advance);
  expect(result.before).toBe(40);
  expect(result.after).toBe(40);
  expect(result.shot).toBe("frame");
});

test("a missed requested frame fails before reading an unrelated framebuffer", async () => {
  let shots = 0;
  const exit = await Effect.runPromiseExit(captureWhenDrawn(() => ({ epoch: 2, frame: 164 }), 2, 154, 100, Effect.sync(() => ++shots), "test"));
  expect(Exit.isFailure(exit)).toBe(true);
  expect(String(exit)).toContain("request boundary missed match 2 frame 154; observed frame 164");
  expect(shots).toBe(0);
});

test("the retained 154 to 164 completion and absent or replaced receipts are INVALID", async () => {
  for (const completion of [{ epoch: 2, frame: 164 }, undefined, { epoch: 3, frame: 154 }]) {
    let receipt: Drawn | undefined = { epoch: 2, frame: 154 };
    const exit = await Effect.runPromiseExit(captureWhenDrawn(() => receipt, 2, 154, 100, Effect.sync(() => { receipt = completion; return "later framebuffer"; }), "test"));
    expect(Exit.isFailure(exit)).toBe(true);
    expect(String(exit)).toContain("INVALID: completion boundary expected match 2 frame 154");
  }
});

test("a clock stalled at 220 cannot satisfy frame 242", async () => {
  const exit = await Effect.runPromiseExit(captureWhenDrawn(() => ({ epoch: 2, frame: 220 }), 2, 242, 10, Effect.succeed("frame"), "test"));
  expect(Exit.isFailure(exit)).toBe(true);
  expect(String(exit)).toContain("INVALID: drawn-clock boundary");
  expect(String(exit)).toContain("epoch 2 frame 220");
});

test("the original Illidan capture schedule preserves all eight authored frames", () => {
  const steps = parsePadScript(readFileSync(new URL("native/pads/156/illidan.pad", import.meta.url), "utf8"));
  const frames = steps.filter(step => step.kind === "capture").map(step => step.frame);
  expect(frames).toEqual([154, 197, 247, 297, 347, 402, 462, 512]);
  const command = visualCaptureCommand("-dev quick hero illidan", "test", steps);
  expect(configureVisualCapture(command, 0)).toBe("-dev quick hero illidan");
  for (const frame of frames) {
    expect(holdVisualFrame(0, 1, frame)).toBe(true);
    expect(heldVisualFrame(0)).toEqual({ epoch: 1, frame });
    releaseVisualFrame(0);
  }
  clearVisualCapture(0);
});

test("a visual hold keeps its drawn receipt while the unchanged match keeps advancing", () => {
  const run = (hold: boolean) => {
    for (const slot of [0, 1]) clearVisualCapture(slot);
    const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0, 1]);
    const helpers = new JournalHelpers(INTEGRITY_BUILD.id, true);
    const frames = (n: number) => { for (let i = 0; i < n; i++) { clients.frames(1); helpers.service(clients); } };
    clients.start();
    frames(30);
    clients.chat(0, hold ? `${QUICK_MATCH_COMMAND} |capture held 20 -` : QUICK_MATCH_COMMAND);
    frames(120);
    const checksum = value(clients.client(0), () => confirmedChecksum(shell()));
    const actual = value(clients.client(0), () => activeRollback(shell())?.speculative.runtime.simulationFrame ?? 0);
    if (hold) {
      expect(heldVisualFrame(0)).toEqual({ epoch: 1, frame: 20 });
      expect(actual).toBeGreaterThan(60);
      const receipt = clients.client(0).files.get(drawnFrameFile(INTEGRITY_BUILD.id, 0)) ?? [];
      expect(receipt[0]).toContain("epoch=1 frame=20");
    }
    for (const slot of [0, 1]) clearVisualCapture(slot);
    return checksum;
  };
  expect(run(true)).toEqual(run(false));
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
