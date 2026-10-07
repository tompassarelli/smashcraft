// The release keyboard path: local capture assigns two frames ahead, and
// predicted fighters respond on that frame while their own echo is in flight.
import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { syncDelivery } from "wisp/src/headless/syncChannel";
import { PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { shell } from "../src/platform/shell/state";
import { fighterAt } from "../src/game/sim/roster";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { value } from "./rematch/playableMatch";
import { startProbe } from "../src/platform/shell/responseProbe";

const headless = installHeadless(PREDICTED_HEADLESS);
afterAll(headless.restore);

test("a refused local keyboard send retries the original row and keeps neutral capture running", () => {
  const clients = headless.clients({ start: () => startBuild({ ...PLAYABLE_BUILD, devConsole: true }), install }, [0, 1]);
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick");
  clients.frames(30);
  const first = clients.client(0);
  const before = value(first, () => shell().runtime.simulationFrame);
  const send = first.natives.BlzSendSyncData;
  let refused = false;
  first.natives.BlzSendSyncData = (...args: unknown[]) => {
    if (!refused) {
      refused = true;
      return false;
    }
    if (typeof send !== "function") throw new Error("missing sync native");
    return send(...args);
  };
  clients.frames(120);
  expect(refused).toBe(true);
  expect(value(first, () => shell().rollback?.sendFailed)).toBe(false);
  expect(value(first, () => shell().runtime.simulationFrame)).toBeGreaterThan(before + 90);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  expect(clients.firstDivergence()).toBeUndefined();
});

test("release keyboard shields start exactly two frames after capture before the sender's echo", () => {
  const clients = headless.clients({ start: () => startBuild({ ...PLAYABLE_BUILD, devConsole: true }), install }, [0, 1], {
    delivery: syncDelivery({ latencyMs: 150, turnMs: 25, extraTurns: [1] }, 60),
  });
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick");
  clients.frames(30);
  let pressedFrames: readonly number[] = [];
  const states = () => clients.clients.map((client) => value(client, () => {
    const rollback = shell().rollback;
    if (rollback === undefined) throw new Error("release has no rollback");
    return {
      shield: fighterAt(rollback.speculative.world, client.slot).shield.raised,
      frame: rollback.schedule.speculativeFrame(),
      accepted: rollback.schedule.accepted(rollback.epoch, client.slot, pressedFrames[client.slot] ?? 0) !== undefined,
      target: rollback.schedule.captureTarget(),
      delay: rollback.delay,
    };
  }));
  const before = states();
  pressedFrames = before.map((state) => state.target ?? 0);
  for (const state of before) {
    expect(state.shield).toBe(false);
    expect(state.delay).toBe(2);
    expect(state.target).toBe(state.frame + 2);
  }
  for (const player of clients.clients) for (const client of clients.clients) client.key(player.slot, 0x51, 0, true);
  clients.frames(1);
  expect(states().map((state) => state.shield)).toEqual([false, false]);
  clients.frames(1);
  expect(states().map((state) => state.shield)).toEqual([false, false]);
  clients.frames(1);
  for (const state of states()) {
    expect(state.shield).toBe(true);
    expect(state.accepted).toBe(false);
  }
  for (const player of clients.clients) for (const client of clients.clients) client.key(player.slot, 0x51, 0, false);
  clients.frames(30);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  expect(clients.firstDivergence()).toBeUndefined();
});

test("native keyboard diagnostics retain the original captured row separately from first prediction", () => {
  const clients = headless.clients({ start: () => startBuild({ ...PLAYABLE_BUILD, devConsole: true, responseProbe: true }), install }, [0, 1], {
    delivery: syncDelivery({ latencyMs: 150, turnMs: 25, extraTurns: [1] }, 60),
  });
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick");
  clients.frames(30);
  const first = clients.clients[0];
  if (first === undefined) throw new Error("missing local client");
  const target = value(first, () => shell().rollback?.schedule.captureTarget());
  expect(target).toBeGreaterThan(0);
  for (const client of clients.clients) client.run(() => {
    const probe = shell().probe;
    if (probe === undefined) throw new Error("diagnostic has no response probe");
    startProbe(probe, false);
  });
  for (const client of clients.clients) client.key(0, 0x51, 0, true);
  clients.frames(3);
  const recorded = value(first, () => shell().probe?.integrity ?? []);
  const captures = recorded.filter(line => line.includes(" capture "));
  expect(captures).toHaveLength(1);
  expect(captures[0]).toMatch(new RegExp(`^1 capture \\d+ 0 ${target} 256 256 0 \\d+$`));
  expect(recorded.filter(line => line.includes(" held "))).toEqual([]);
  expect(recorded.some(line => new RegExp(`^3 action \\d+ 0 ${target} 256 256 256$`).test(line))).toBe(true);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  expect(clients.firstDivergence()).toBeUndefined();
});

test("keyboard stall attribution clears after latched presses are admitted despite the two-frame queue", () => {
  let delayed = false;
  let lastArrival = 0;
  const clients = headless.clients({ start: () => startBuild({ ...PLAYABLE_BUILD, devConsole: true, responseProbe: true }), install }, [0, 1], {
    delivery: { arrivalFrame: (_sender, frame) => {
      lastArrival = Math.max(lastArrival, frame + (delayed ? 60 : 1));
      return lastArrival;
    } },
  });
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick");
  clients.frames(30);
  const first = clients.client(0);
  const recording = () => value(first, () => shell().probe?.integrity ?? []);
  for (const client of clients.clients) client.run(() => {
    const probe = shell().probe;
    if (probe === undefined) throw new Error("diagnostic has no response probe");
    startProbe(probe, false);
  });
  delayed = true;
  clients.frames(35);
  expect(value(first, () => shell().rollback?.schedule.windowHalted(0))).toBe(true);
  for (const client of clients.clients) client.key(0, 0x51, 0, true);
  clients.frames(1);
  for (const client of clients.clients) client.key(0, 0x51, 0, false);
  clients.frames(1);
  delayed = false;
  clients.frames(100);
  expect(recording().filter(line => line.includes(" held "))).toHaveLength(1);
  expect(value(first, () => shell().rollback?.schedule.hasLocalRow(0))).toBe(true);
  expect(value(first, () => shell().rollback?.predictionHeld)).toBe(false);
  for (const client of clients.clients) client.key(0, 0x51, 0, true);
  clients.frames(3);
  expect(recording().filter(line => line.includes(" held "))).toHaveLength(1);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  expect(clients.firstDivergence()).toBeUndefined();
});
