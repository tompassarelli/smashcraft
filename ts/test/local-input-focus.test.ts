import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { shell } from "../src/platform/shell/state";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { value } from "./rematch/playableMatch";
import { Key } from "../src/platform/shell/keyEvents";

const headless = installHeadless(PREDICTED_HEADLESS);
afterAll(headless.restore);

test("an unfocused keyboard keeps sixty neutral rows and resumes without waiting for itself [spec docs/controller-platforms.md] [invariant]", () => {
  const clients = headless.clients({ start: () => startBuild({ ...PLAYABLE_BUILD, devConsole: true }), install }, [0, 1]);
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick");
  clients.frames(30);
  const first = clients.client(0);
  first.key(0, 0x51, 0, true);
  clients.frames(3);
  const target = value(first, () => shell().rollback?.schedule.captureTarget());
  expect(target).toBeDefined();
  const before = value(first, () => shell().runtime.simulationFrame);
  first.natives.BlzIsLocalClientActive = () => false;
  clients.frames(60);
  expect(value(first, () => shell().runtime.simulationFrame)).toBeGreaterThan(before + 55);
  expect(value(first, () => shell().rollback?.waitingFor)).toBe(0);
  for (let offset = 0; offset < 60; offset++) {
    const row = value(first, () => {
      const rollback = shell().rollback;
      return rollback?.schedule.pending(rollback.epoch, (target ?? 0) + offset);
    });
    expect(row?.held).toBe(0);
    expect(row?.pressed).toBe(0);
    expect(row?.released).toBe(offset === 0 ? 256 : 0);
  }
  first.natives.BlzIsLocalClientActive = () => true;
  first.key(0, 0x51, 0, false);
  clients.frames(30);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  expect(clients.firstDivergence()).toBeUndefined();
});

test("pause samples neutral keys, holds the agreed frame and resumes local rows [invariant]", () => {
  const clients = headless.clients({ start: () => startBuild({ ...PLAYABLE_BUILD, devConsole: true }), install }, [0, 1]);
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick");
  clients.frames(30);
  const first = clients.client(0);
  first.key(0, 0x51, 0, true);
  clients.frames(3);
  clients.press(0, Key.y);
  clients.frames(1);
  expect(value(first, () => shell().session.paused)).toBe(true);
  const target = value(first, () => shell().rollback?.schedule.captureTarget());
  for (const key of [0x28, 0x26, 32, 69]) clients.press(0, key);
  clients.frames(60);
  expect(value(first, () => shell().rollback?.keyboard?.capture.row.held)).toBe(0);
  expect(value(first, () => shell().rollback?.schedule.captureTarget())).toBe(target);
  first.key(0, 0x51, 0, false);
  clients.press(0, Key.y);
  const before = value(first, () => shell().runtime.simulationFrame);
  clients.frames(120);
  expect(value(first, () => shell().session.paused)).toBe(false);
  expect(value(first, () => shell().runtime.simulationFrame)).toBeGreaterThan(before + 110);
  expect(value(first, () => shell().rollback?.waitingFor)).toBe(0);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  expect(clients.firstDivergence()).toBeUndefined();
});
