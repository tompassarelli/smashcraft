import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import type { SyncDelivery } from "wisp/src/headless/lockstep";
import type { Lockstep } from "wisp/src/headless/lockstep";
import { Phase } from "../src/game/match/rules";
import { AUTO_DELAY, ROLLBACK_BUDGET, autoDelay, smoothedRttMs } from "../src/game/netcode/delayPolicy";
import type { MapBuild } from "../src/game/shell/build";
import { PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { chooseDelay } from "../src/game/ui/bindingSettings";
import { type ShellState, shellState } from "../src/platform/shell/state";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { entryFor } from "./desync/journeys";
import { confirmedChecksum } from "../src/platform/shell/diagnostics";
import { sweep } from "./sweep";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

const BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "typescript-input-delay", devConsole: true };
const JUMP_KEY = "I".charCodeAt(0);
const FRAME_MS = 1000 / 60;

function shellOf(clients: Lockstep, index: number): ShellState {
  let found: ShellState | undefined;
  clients.clients[index]?.run(() => {
    found = shellState();
  });
  if (found === undefined) throw new Error(`client ${index} has no shell`);
  return found;
}

function quickMatch(clients: Lockstep, choice: number): void {
  clients.start();
  clients.frames(30);
  clients.everywhere(() => {
    const s = shellState();
    if (s !== undefined) for (const participant of s.participants) chooseDelay(participant.bindings, choice);
  });
  clients.chat(0, "-dev quick cpu wren expert");
  for (let frame = 0; frame < 600 && shellOf(clients, 0).game.phase !== Phase.match; frame++) clients.frames(1);
  clients.frames(30);
}

function pressToFrame(choice: number): number {
  const clients = headless.clients(entryFor(BUILD), [0]);
  quickMatch(clients, choice);
  const s = shellOf(clients, 0);
  const rollback = s.rollback;
  if (rollback === undefined) throw new Error("no rollback");
  const next = rollback.schedule.speculativeFrame();
  clients.key(0, JUMP_KEY, 0, true);
  clients.frames(1);
  clients.key(0, JUMP_KEY, 0, false);
  clients.frames(12);
  for (let frame = next; frame < next + 12; frame++) {
    const row = rollback.schedule.pending(rollback.epoch, frame) ?? rollback.schedule.accepted(rollback.epoch, 0, frame);
    if (row !== undefined && row.pressed !== 0) return frame - next;
  }
  throw new Error("the press reached no frame");
}

test("against the computer a press reaches the simulation 2 frames later by default, and the fixed setting's frames when set [spec #396]", () => {
  expect(pressToFrame(AUTO_DELAY)).toBe(2);
  expect(pressToFrame(0)).toBe(0);
});

sweep("every fixed delay from 0 to 8 reaches the simulation exactly that many frames after the press [spec #396]", () => {
  for (let choice = 0; choice <= 8; choice++) expect(pressToFrame(choice)).toBe(choice);
});

function lastText(clients: Lockstep, index: number, prefix: string): string {
  return clients.clients[index]?.frames.shownText().find(text => text.startsWith(prefix)) ?? "";
}

test("the delay setting cycles in Options, the lobby shows both requests, uses the higher and warns from 8 frames [spec #396]", () => {
  const clients = headless.clients(entryFor(BUILD), [0, 1]);
  clients.start();
  clients.frames(60);
  expect(clients.click(0, 0.6275, 0.0245)).toBe(true);
  clients.frames(2);
  for (let press = 0; press < 4; press++) {
    expect(clients.click(0, 0.7, 0.489)).toBe(true);
    clients.frames(1);
  }
  expect(shellOf(clients, 1).participants[0].bindings.delay).toBe(3);
  expect(lastText(clients, 0, "Delay: ")).toBe("Delay: 3 frames");
  expect(clients.click(0, 0.7, 0.452)).toBe(true);
  clients.frames(1);
  expect(shellOf(clients, 1).participants[0].bindings.delay).toBe(2);
  clients.frames(60);
  expect(lastText(clients, 1, "Input delay:")).toBe("Input delay: P1 2 · P2 Auto (2) → 2 frames");
  clients.everywhere(() => {
    const s = shellState();
    if (s !== undefined) chooseDelay(s.participants[1].bindings, 8);
  });
  clients.frames(60);
  expect(lastText(clients, 1, "Input delay:")).toContain("P1 2 · P2 8 → 8 frames");
  expect(lastText(clients, 1, "Input delay:")).toContain("Input delay of 8+ frames: this connection will feel sluggish");
});

function injected(rttMs: number, lossPercent: number, seed: number): SyncDelivery {
  let state = seed;
  const last = new Map<number, number>();
  const oneWay = Math.ceil(rttMs / 2 / FRAME_MS);
  const resend = Math.ceil(rttMs / FRAME_MS) + 1;
  return {
    arrivalFrame: (sender, frame) => {
      state = (state * 75) % 65537;
      const lost = state % 100 < lossPercent;
      const arrival = Math.max(frame + 1, last.get(sender) ?? 0, frame + oneWay + (lost ? resend : 0));
      last.set(sender, arrival);
      return arrival;
    },
  };
}

interface Measured {
  readonly delays: number[];
  readonly depthP95: number;
  readonly corrections: number;
  readonly rttMs: number[];
  readonly auto: number[];
  readonly indicator: string[];
}

function onlineMatch(rttMs: number, frames: number): Measured {
  const clients = headless.clients(entryFor(BUILD), [0, 1], { delivery: injected(rttMs, 1, 396 + rttMs) });
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick cpu wren expert");
  for (let frame = 0; frame < 600 && shellOf(clients, 0).game.phase !== Phase.match; frame++) clients.frames(1);
  const checksums = [new Map<number, string>(), new Map<number, string>()];
  const keys = ["W", "R", "I", "N", "U", "E"].map(key => key.charCodeAt(0));
  for (let frame = 0; frame < frames; frame++) {
    const player = frame % 2;
    const key = keys[Math.floor(frame / 7) % keys.length] ?? JUMP_KEY;
    if (frame % 7 === 0) clients.key(player, key, 0, true);
    else if (frame % 7 === 4) clients.key(player, key, 0, false);
    clients.frames(1);
    if (frame % 60 !== 59) continue;
    for (const index of [0, 1]) {
      const shell = shellOf(clients, index);
      clients.clients[index]?.run(() => checksums[index]?.set(shell.runtime.simulationFrame, confirmedChecksum(shell)));
    }
  }
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  let compared = 0;
  for (const [frame, checksum] of checksums[0] ?? []) {
    const other = checksums[1]?.get(frame);
    if (other === undefined) continue;
    compared++;
    if (other !== checksum) throw new Error(`confirmed frame ${frame} differs between the clients`);
  }
  expect(compared).toBeGreaterThan(frames / 120);
  const rollbacks = [0, 1].map(index => shellOf(clients, index).rollback);
  const depths = rollbacks.flatMap(rollback => (rollback?.net.depths ?? []).flatMap((count, depth) => Array.from({ length: count }, () => depth)));
  return {
    delays: rollbacks.map(rollback => rollback?.delay ?? -1),
    depthP95: depths[Math.floor(depths.length * 0.95)] ?? 0,
    corrections: depths.length,
    rttMs: rollbacks.map(rollback => (rollback === undefined ? -1 : smoothedRttMs(rollback.net.estimate))),
    auto: rollbacks.map(rollback => (rollback === undefined ? -1 : autoDelay(rollback.net.policy, rollback.net.estimate))),
    indicator: rollbacks.map(rollback => rollback?.net.shownText ?? ""),
  };
}

function expectSettled(rttMs: number, frames: number): void {
  const measured = onlineMatch(rttMs, frames);
  console.log(`input delay ${rttMs} ms round trip, 1% loss: ${JSON.stringify(measured)}`);
  expect(measured.delays).toEqual([2, 2]);
  expect(measured.auto).toEqual([2, 2]);
  expect(measured.depthP95).toBeLessThanOrEqual(ROLLBACK_BUDGET);
  for (const rtt of measured.rttMs) expect(Math.abs(rtt - rttMs)).toBeLessThanOrEqual(2 * FRAME_MS * 2);
  expect(measured.indicator).toEqual(["", ""]);
}

test("two clients at 120 ms round trip and 1% loss keep delay 2, rollback p95 within R and no divergence [spec #396]", () => {
  expectSettled(120, 150);
});

sweep("two clients at 0, 60 and 120 ms round trip and 1% loss keep delay 2, rollback p95 within R and no divergence [spec #396]", () => {
  for (const rttMs of [0, 60, 120]) expectSettled(rttMs, 1200);
});

test("a one-way trip past delay + R shows the connection-poor indicator in the match [spec #396]", () => {
  const measured = onlineMatch(400, 150);
  for (const text of measured.indicator) expect(text).toContain("Connection poor");
});
