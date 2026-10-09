


import { afterAll, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { QUICK_MATCH_COMMAND, RESET_COMMAND, quickMatchHero } from "../src/game/shell/devSettings";
import { Phase } from "../src/game/match/rules";
import { install, startBuild } from "../src/platform/main";
import { activeRollback, shell, shellState } from "../src/platform/shell/state";
import { drawnFrameFile } from "../src/runtime/gameFiles";
import { parseDrawn, visualCaptureCommand, visualCaptureToken } from "../scripts/integrity/drawnCapture";
import { parsePadScript } from "../scripts/integrity/padScript";
import { scriptChat } from "../scripts/integrity/padParity";
import { clearVisualCapture, heldVisualFrame, visualCapture } from "../src/game/shell/visualCapture";
import { confirmedChecksum } from "../src/platform/shell/diagnostics";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { JournalHelpers } from "./rematch/journalHelper";
import { value } from "./rematch/playableMatch";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);


test("Warcraft's 127-character chat limit preserves every original cue schedule and starts both clients [spec #156]", () => {
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0, 1]);
  const helpers = new JournalHelpers(INTEGRITY_BUILD.id, true);
  const frames = (n: number) => { for (let i = 0; i < n; i++) { clients.frames(1); helpers.service(clients); } };
  clients.start();
  frames(30);
  const original = "-dev quick hero thrall |capture 1791371747161-3316068 62,76,91,102,116,131,142,150,156,171,222,232,312,326,402,405,642,646,702,706 -";
  expect(original.slice(0, 127)).toEndWith("702,");
  clients.chat(0, original.slice(0, 127));
  for (const client of clients.clients) expect(value(client, () => shell().game.phase)).toBe(Phase.characterMenu);

  const directory = new URL("native/pads/", import.meta.url);
  const scripts = readdirSync(directory).filter(name => name.endsWith("-cues.pad")).sort();
  expect(scripts.length).toBeGreaterThan(0);
  const token = visualCaptureToken(1791371747161, 3316068);
  for (const name of scripts) {
    clients.chat(0, RESET_COMMAND);
    const script = readFileSync(new URL(name, directory), "utf8");
    const steps = parsePadScript(script);
    const chat = scriptChat(script);
    if (chat === undefined) throw new Error(`${name} has no setup command`);
    const command = visualCaptureCommand(chat, token, steps);
    expect(command.length, name).toBeLessThanOrEqual(127);
    clients.chat(0, command.slice(0, 127));
    for (const client of clients.clients) {
      expect(value(client, () => shell().game.phase), name).toBe(Phase.match);
      expect(value(client, () => shell().game.characterChoices[client.slot]), name).toBe(quickMatchHero(chat));
      const wanted = [...new Set(steps.filter(step => step.kind === "capture" && step.slot === client.slot).map(step => step.frame))].sort((a, b) => a - b);
      expect(visualCapture(client.slot)?.frames ?? [], `${name} client ${client.slot}`).toEqual(wanted);
      if (wanted.length > 0) expect(visualCapture(client.slot)?.token).toBe(token);
      expect(client.errors, name).toEqual([]);
    }
  }
  clients.chat(0, RESET_COMMAND);
  expect(() => visualCaptureCommand("x".repeat(127), token, [])).toThrow("127-character");
});

test("a visual hold captures inside a catch-up callback while the unchanged match keeps advancing [invariant]", () => {
  const run = (hold: boolean) => {
    for (const slot of [0, 1]) clearVisualCapture(slot);
    const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0, 1]);
    const helpers = new JournalHelpers(INTEGRITY_BUILD.id, true);
    helpers.clock = clients => clients.frame * 3;
    let crossedTarget = false;
    const predicted = () => value(clients.client(0), () => {
      const current = shellState();
      return current === undefined ? 0 : activeRollback(current)?.speculative.runtime.simulationFrame ?? 0;
    });
    const frames = (n: number) => { for (let i = 0; i < n; i++) {
      const before = predicted();
      clients.frames(1);
      if (before < 19 && predicted() > 19) crossedTarget = true;
      helpers.service(clients);
    } };
    clients.start();
    frames(30);
    clients.chat(0, hold ? `${QUICK_MATCH_COMMAND} |capture held 19 -` : QUICK_MATCH_COMMAND);
    frames(120);
    const checksum = value(clients.client(0), () => confirmedChecksum(shell()));
    const actual = value(clients.client(0), () => activeRollback(shell())?.speculative.runtime.simulationFrame ?? 0);
    if (hold) {
      expect(crossedTarget).toBe(true);
      expect(heldVisualFrame(0)).toEqual({ epoch: 1, frame: 19 });
      expect(actual).toBeGreaterThan(60);
      const receipt = clients.client(0).files.get(drawnFrameFile(INTEGRITY_BUILD.id, 0)) ?? [];
      expect(receipt[0]).toContain("epoch=1 frame=19");
      clients.chat(0, RESET_COMMAND);
      expect(heldVisualFrame(0)).toBeUndefined();
    }
    for (const slot of [0, 1]) clearVisualCapture(slot);
    return checksum;
  };
  expect(run(true)).toEqual(run(false));
});

test("a local visual capture creates the same confirmed combat sounds on both clients [repro #69]", () => {
  for (const slot of [0, 1]) clearVisualCapture(slot);
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0, 1]);
  const helpers = new JournalHelpers(INTEGRITY_BUILD.id, true);
  helpers.workload = { denseCycles: 4, walkers: [] };
  const frames = (n: number) => { for (let i = 0; i < n; i++) { clients.frames(1); helpers.service(clients); } };
  clients.start();
  frames(30);
  clients.chat(0, `${QUICK_MATCH_COMMAND} |capture sounds 19 -`);
  frames(180);
  const sounds = (slot: number) => clients.client(slot).soundLog.filter(cue => cue.event === "start").map(cue => cue.source);
  try {
    expect(heldVisualFrame(0)).toEqual({ epoch: 1, frame: 19 });
    expect(sounds(1).length).toBeGreaterThan(0);
    expect(sounds(0)).toEqual(sounds(1));
  } finally {
    for (const slot of [0, 1]) clearVisualCapture(slot);
  }
});

test("the integrity build writes the predicted frame it drew, in its match's epoch [invariant]", () => {
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
