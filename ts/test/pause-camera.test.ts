import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { shell } from "../src/platform/shell/state";
import { Key } from "../src/platform/shell/keyEvents";
import { advancePauseCamera } from "../src/platform/shell/pauseCamera";
import { stageBounds } from "../src/game/sim/stageBounds";
import { WORLD_BOUNDS } from "../src/game/presentation/arenaCamera";
import { confirmedChecksum } from "../src/platform/shell/diagnostics";
import { shows, value } from "./rematch/playableMatch";

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

test("paused camera cannot pan outside the stage or world or zoom through the stage [spec #332]", () => {
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
    }
  });
  expect(client.errors).toEqual([]);
});
