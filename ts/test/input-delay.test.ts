import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import type { SyncDelivery } from "wisp/src/headless/lockstep";
import type { Lockstep } from "wisp/src/headless/lockstep";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import { f32 } from "wisp/src/sim/f32";
import { Phase } from "../src/game/match/rules";
import { AUTO_DELAY } from "../src/game/netcode/delayPolicy";
import type { MapBuild } from "../src/game/shell/build";
import { PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { chooseDelay } from "../src/game/ui/bindingSettings";
import { type ShellState, localSlot, shellState } from "../src/platform/shell/state";
import { startProbe } from "../src/platform/shell/responseProbe";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { entryFor } from "./desync/journeys";
import { confirmedChecksum } from "../src/platform/shell/diagnostics";
import { sweep } from "./sweep";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

const BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "typescript-input-delay", devConsole: true };
const PROBED: MapBuild = { ...BUILD, responseProbe: true };
const JUMP_KEY = "I".charCodeAt(0);

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

test("against the computer a press reaches the simulation 2 frames later by default, and the fixed setting's frames when set [k3 measure #396]", () => {
  expect(pressToFrame(AUTO_DELAY)).toBe(2);
  expect(pressToFrame(0)).toBe(0);
});

sweep("every fixed delay from 0 to 8 reaches the simulation exactly that many frames after the press [k3 measure #396]", () => {
  for (let choice = 0; choice <= 8; choice++) expect(pressToFrame(choice)).toBe(choice);
});

const RELAY_TURN_MS = 30;
const LOSS_PERCENT = 1;
const TCP_MIN_RTO_MS = 200;

function relay(rttMs: number, seed: number): SyncDelivery {
  const resendTurns = Math.ceil((rttMs + TCP_MIN_RTO_MS) / RELAY_TURN_MS);
  const extraTurns = Array.from({ length: resendTurns + 1 }, (_, turns) => (turns === 0 ? f32((100 - LOSS_PERCENT) / 100) : turns === resendTurns ? f32(LOSS_PERCENT / 100) : 0));
  return syncDelivery({ latencyMs: rttMs, turnMs: RELAY_TURN_MS, extraTurns }, seed);
}

function percentile(histogram: readonly number[], fraction: number): number {
  const total = histogram.reduce((sum, count) => sum + count, 0);
  const rank = Math.ceil(total * fraction);
  let seen = 0;
  for (let value = 0; value < histogram.length; value++) {
    seen += histogram[value] ?? 0;
    if (total > 0 && seen >= rank) return value;
  }
  return 0;
}

function ranked(sorted: readonly number[], fraction: number): number {
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
}

interface ClientMeasure {
  readonly delay: number;
  readonly lateness: { readonly rows: number; readonly p50: number; readonly p95: number; readonly max: number };
  readonly corrections: { readonly count: number; readonly p50: number; readonly p95: number; readonly max: number };
  readonly indicator: string;
}

function remoteLateness(clients: Lockstep, index: number): number[] {
  let own = -1;
  let entries: readonly string[] = [];
  clients.clients[index]?.run(() => {
    own = localSlot();
    entries = shellState()?.probe?.integrity ?? [];
  });
  const lateness: number[] = [];
  for (const entry of entries) {
    const [, stage, , slot, frame, , , , frontier] = entry.split(" ");
    if (stage === "receive" && Number(slot) !== own) lateness.push(Number(frontier) - Number(frame));
  }
  return lateness;
}

function onlineMatch(delivery: SyncDelivery, frames: number): ClientMeasure[] {
  const clients = headless.clients(entryFor(PROBED), [0, 1], { delivery });
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick cpu wren expert");
  for (let frame = 0; frame < 600 && shellOf(clients, 0).game.phase !== Phase.match; frame++) clients.frames(1);
  clients.everywhere(() => {
    const probe = shellState()?.probe;
    if (probe !== undefined) startProbe(probe, false);
  });
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
  return [0, 1].map(index => {
    const rollback = shellOf(clients, index).rollback;
    const depths = rollback?.net.depths ?? [];
    const late = remoteLateness(clients, index).sort((a, b) => a - b);
    return {
      delay: rollback?.delay ?? -1,
      lateness: { rows: late.length, p50: ranked(late, 0.5), p95: ranked(late, 0.95), max: late.at(-1) ?? 0 },
      corrections: { count: depths.reduce((sum, count) => sum + count, 0), p50: percentile(depths, 0.5), p95: percentile(depths, 0.95), max: depths.findLastIndex(count => count > 0) },
      indicator: rollback?.net.shownText ?? "",
    };
  });
}

const SETTINGS: readonly { readonly name: string; readonly delivery: (seed: number) => SyncDelivery }[] = [
  ...[0, 60, 120].map(rttMs => ({ name: `relay ${rttMs} ms, ${RELAY_TURN_MS} ms turns, ${LOSS_PERCENT}% loss`, delivery: (seed: number) => relay(rttMs, seed) })),
  { name: "measured Battle.net", delivery: (seed: number) => syncDelivery(MEASURED_BATTLE_NET, seed) },
];

function measure(name: string, delivery: SyncDelivery, frames: number): ClientMeasure[] {
  const measured = onlineMatch(delivery, frames);
  measured.forEach((client, index) => console.log(`input delay ${name}, client ${index}: delay ${client.delay}, edge-row lateness ${JSON.stringify(client.lateness)}, corrections ${JSON.stringify(client.corrections)}`));
  expect(measured.map(client => client.delay)).toEqual([2, 2]);
  return measured;
}

test("two clients through a 60 ms relay with 1% loss agree on delay 2 and stay in sync [k1 scenario]", () => {
  measure(SETTINGS[1]?.name ?? "", relay(60, 456), 150);
});

sweep("two clients through a 0, 60 and 120 ms relay and on measured Battle.net delivery report each client's lateness and correction depth [k1 scenario]", () => {
  for (const setting of SETTINGS) measure(setting.name, setting.delivery(396), 1200);
}, 120_000);
