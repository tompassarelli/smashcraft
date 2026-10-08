import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { PLAYABLE_BUILD, INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { shell } from "../src/platform/shell/state";
import { Key } from "../src/platform/shell/keyEvents";
import { advancePauseCamera } from "../src/platform/shell/pauseCamera";
import { surfaceLeft, surfaceRight, surfaceZ } from "../src/game/sim/stage";
import { stageClock } from "../src/game/match/rules";
import { stageBounds } from "../src/game/sim/stageBounds";
import { WORLD_BOUNDS } from "../src/game/presentation/arenaCamera";
import { confirmedChecksum } from "../src/platform/shell/diagnostics";
import { shows, value, startPlayableMatch, expectSynchronized } from "./rematch/playableMatch";

import { textEnvelope } from "../src/game/netcode/journal/text";
import { JournalHelpers } from "./rematch/journalHelper";

const headless = installHeadless(PREDICTED_HEADLESS);
afterAll(headless.restore);

test("paused camera pans, zooms, tilts, hides the HUD and restores the exact match view without changing the match [spec #332] [invariant]", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "os");
  Object.defineProperty(globalThis, "os", { configurable: true, value: { clock: () => 10 } });
  try {
    const clients = headless.clients({ start: () => startBuild({ ...PLAYABLE_BUILD, devConsole: true }), install }, [0]);
    const client = clients.client(0);
    clients.start();
    clients.frames(30);
    clients.chat(0, "-dev quick cpu wren rookie");
    clients.frames(90);
    const before = client.cameraPose();
    clients.press(0, Key.y);
    clients.frames(1);
    const frozen = value(client, () => confirmedChecksum(shell()));
    const original = value(client, () => ({ ...shell().camera, boxes: shell().camera.boxes.map(box => ({ ...box })) }));
    expect(shows(client, "Resume")).toBe(true);
    for (const [key, field, direction] of [[0x49, "z", 1], [0x4b, "z", -1], [0x4a, "x", -1], [0x4c, "x", 1], [0xbb, "distance", -1], [0xbd, "distance", 1]] as const) {
      const from = value(client, () => shell().camera[field]);
      clients.press(0, key);
      clients.frames(1);
      expect((value(client, () => shell().camera[field]) - from) * direction).toBeGreaterThan(0);
    }
    const distance = value(client, () => shell().camera.distance);
    clients.press(0, 0xbb, 1);
    clients.frames(1);
    expect(value(client, () => shell().camera.distance)).toBeLessThan(distance);
    clients.press(0, 0x4f);
    clients.frames(1);
    expect(value(client, () => shell().pauseCamera?.tilt)).toBeGreaterThan(0);
    clients.press(0, 0x50);
    clients.frames(1);
    expect(value(client, () => shell().pauseCamera?.tilt)).toBe(0);
    expect(shows(client, "Resume")).toBe(false);
    clients.press(0, 0x48);
    clients.frames(1);
    expect(client.frames.snapshot({ visibleOnly: true }).some(frame => frame.name.includes("MeleeHud") || frame.name.includes("Mana"))).toBe(false);
    clients.press(0, 0x26);
    clients.frames(1);
    expect(shows(client, "Resume")).toBe(true);
    clients.press(0, 0x48);
    clients.frames(1);
    expect(value(client, () => shell().pauseCamera?.hideHud)).toBe(false);
    expect(value(client, () => confirmedChecksum(shell()))).toBe(frozen);
    clients.press(0, Key.y);
    clients.frames(5);
    expect(client.cameraPose()).toEqual(before);
    expect(value(client, () => shell().camera)).toEqual(original);
    expect(value(client, () => shell().session.paused)).toBe(false);
    expect(client.errors).toEqual([]);
  } finally {
    if (previous === undefined) Reflect.deleteProperty(globalThis, "os");
    else Object.defineProperty(globalThis, "os", previous);
  }
});

test("paused camera keeps the stage visible inside world bounds when panning, zooming or tilting [spec #332]", () => {
  const clients = headless.clients({ start: () => startBuild({ ...PLAYABLE_BUILD, devConsole: true }), install }, [0]);
  const client = clients.client(0);
  clients.start(); clients.frames(30); clients.chat(0, "-dev quick"); clients.frames(60);
  clients.press(0, Key.y); clients.frames(1);
  client.run(() => {
    const s = shell();
    const camera = s.pauseCamera;
    if (camera === undefined) throw Error("pause camera missing");
    const bounds = stageBounds(s.game.stageChoice).camera;
    for (const key of [0x49, 0x4b, 0x4a, 0x4c, 0xbb, 0xbd, 0x4f, 0x50]) {
      camera.held[key] = true;
      for (let i = 0; i < 1000; i++) advancePauseCamera(s, camera.aspect);
      camera.held[key] = false;
      expect(s.camera.x).toBeGreaterThanOrEqual(bounds.left);
      expect(s.camera.x).toBeLessThanOrEqual(bounds.right);
      expect(s.origin.x + s.camera.x).toBeGreaterThanOrEqual(WORLD_BOUNDS.left);
      expect(s.origin.x + s.camera.x).toBeLessThanOrEqual(WORLD_BOUNDS.right);
      expect(s.camera.z).toBeGreaterThanOrEqual(bounds.bottom);
      expect(s.camera.z).toBeLessThanOrEqual(bounds.top);
      expect(s.camera.distance).toBeGreaterThanOrEqual(498);
      expect(camera.tilt).toBeGreaterThanOrEqual(-25);
      expect(camera.tilt).toBeLessThanOrEqual(15);
      const stageFrame = stageClock(s.game);
      const deckX = Math.max(surfaceLeft(s.game.stageChoice, 0, stageFrame), Math.min(surfaceRight(s.game.stageChoice, 0, stageFrame), s.camera.x));
      const dz = surfaceZ(s.game.stageChoice, 0, stageFrame) - s.camera.z;
      const angle = (10 - camera.tilt) * Math.PI / 180;
      const depth = s.camera.distance - dz * Math.sin(angle);
      const column = 0.5 + (deckX - s.camera.x) / (2 * depth * s.camera.tangent * camera.aspect);
      const row = 0.5 - dz * Math.cos(angle) / (2 * depth * s.camera.tangent);
      expect(column).toBeGreaterThanOrEqual(0);
      expect(column).toBeLessThanOrEqual(1);
      expect(row).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThanOrEqual(1);
    }
  });
  expect(client.errors).toEqual([]);
});


test("controller camera text stays local while both paused journal clients keep their match checksums [spec #332] [invariant]", () => {
  const helpers = new JournalHelpers(INTEGRITY_BUILD.id, true);
  const { clients, frames, clientA: a, clientB: b } = startPlayableMatch(headless, helpers, false);
  frames(30);
  helpers.pressStart(0);
  for (let i = 0; i < 90 && clients.clients.some(client => !value(client, () => shell().session.paused)); i++) frames(1);
  expect(clients.clients.map(client => value(client, () => shell().session.paused))).toEqual([true, true]);
  const frozen = clients.clients.map(client => value(client, () => confirmedChecksum(shell())));
  const remote = b.cameraPose();
  const overlay = () => a.frames.snapshot({ visibleOnly: true }).some(frame => frame.name === "SmashcraftPause");
  const before = value(a, () => shell().camera.x);
  clients.type(0, "l");
  frames(1);
  expect(value(a, () => shell().camera.x)).toBeGreaterThan(before);
  expect(overlay()).toBe(false);
  clients.type(0, "h");
  frames(1);
  expect(value(a, () => shell().pauseCamera?.hideHud)).toBe(true);
  expect(a.frames.snapshot({ visibleOnly: true }).some(frame => frame.name === "JournalControllerInput" || frame.name === "JournalPauseHelp")).toBe(false);
  clients.type(0, "e");
  frames(1);
  expect(overlay()).toBe(true);
  for (const controls of ["j", "i", "k", "-", "=", "o", "p"]) {
    clients.type(0, controls);
    frames(1);
  }
  expect(b.cameraPose()).toEqual(remote);
  expect(clients.clients.map(client => value(client, () => confirmedChecksum(shell())))).toEqual(frozen);
  expect(clients.clients.map(client => value(client, () => shell().rollback?.journal?.failed))).toEqual([false, false]);
  expectSynchronized(clients);
  a.run(() => {
    const ingress = shell().rollback?.journal?.editbox;
    if (ingress === undefined) throw Error("focused controller box missing");
    const box = BlzGetFrameByName("JournalControllerInput", 969);
    const envelope = textEnvelope(shell().rollback?.epoch ?? 0, 1, "I4|ijklop-h");
    if (envelope === undefined) throw Error("journal envelope missing");
    for (const text of [envelope, envelope.substring(0, envelope.length - 1)]) {
      BlzFrameSetText(box, "h" + text);
      expect(ingress.takePauseControls()).toBe("h");
      expect(BlzFrameGetText(box)).toBe(text);
    }
    BlzFrameSetText(box, "");
  });
});
