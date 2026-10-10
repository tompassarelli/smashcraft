import { afterAll, expect } from "bun:test";
import { Effect } from "effect";
import { installHeadless } from "wisp/scripts/wisp/headless";
import type { Lockstep } from "wisp/src/headless/lockstep";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import { Phase } from "../src/game/match/rules";
import type { MapBuild } from "../src/game/shell/build";
import { PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { QUICK_MATCH_COMMAND, RESET_COMMAND } from "../src/game/shell/devSettings";
import { CHECKSUM_FRAMES, EPOCH_CALLBACKS } from "../src/platform/shell/responseProbe";
import { responsePageFile } from "../src/runtime/gameFiles";
import { shellState } from "../src/platform/shell/state";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { ResponsePage } from "../scripts/wisp/boundary";
import { entryFor } from "./desync/journeys";
import { sweep } from "./sweep";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

const NATIVE_INPUT: MapBuild = { ...PLAYABLE_BUILD, id: "typescript-native-input", responseProbe: true, epochProbe: true, devConsole: true };
const KEYS = ["Q", "T", "I"].map(key => key.charCodeAt(0));

function probeState(clients: Lockstep, index: number) {
  let found: { run: number; recording: boolean; exporting: boolean; epoch: number | undefined; phase: number } | undefined;
  clients.clients[index]?.run(() => {
    const s = shellState();
    const probe = s?.probe;
    if (s !== undefined && probe !== undefined) found = { run: probe.run, recording: probe.recording, exporting: probe.exporting, epoch: s.rollback?.epoch, phase: s.game.phase };
  });
  if (found === undefined) throw new Error(`client ${index} has no probe`);
  return found;
}

interface Window {
  readonly header: string;
  readonly epochLine: string;
  readonly delay: string;
  readonly checksums: Map<number, string>;
  readonly lastChecksumFrame: number;
}

function exported(clients: Lockstep, index: number, run: number): Window {
  const client = clients.clients[index];
  if (client === undefined) throw new Error(`no client ${index}`);
  const lines: string[] = [];
  for (let page = 0; ; page++) {
    const file = client.files.get(responsePageFile(index, run, page));
    if (file === undefined) break;
    // the page `bun wisp integrity` reads must decode
    Effect.runSync(ResponsePage.decode(`page ${page}`, ["function PreloadFiles takes nothing returns nothing", ...file.map(line => `call Preload( "${line}" )`), "endfunction"].join("\n")));
    lines.push(...file);
  }
  const checksums = new Map<number, string>();
  let lastChecksumFrame = -1;
  for (const line of lines) {
    const [kind, , stage, , frame, sum] = line.split(" ");
    if (kind !== "I" || stage !== "checksum") continue;
    checksums.set(Number(frame), sum ?? "");
    lastChecksumFrame = Number(frame);
  }
  const delay = lines.find(line => / delay /.test(line))?.replace(/^I \d+ /, "") ?? "";
  return { delay, header: lines.find(line => line.startsWith("integrity ")) ?? "", epochLine: lines.find(line => line.startsWith("epoch ")) ?? "", checksums, lastChecksumFrame };
}

sweep("native-input records each match epoch from its first callback for at most 6,000 callbacks, checksums confirmed frames every 600 equally on both clients, and reports an epoch it could not record [k1 scenario]", () => {
  const clients = headless.clients(entryFor(NATIVE_INPUT), [0, 1], { delivery: syncDelivery(MEASURED_BATTLE_NET, 396) });
  let tick = 0;
  const play = (frames: number) => {
    for (let frame = 0; frame < frames; frame++, tick++) {
      const key = KEYS[Math.floor(tick / 7) % KEYS.length] ?? 0;
      if (tick % 7 === 0) clients.key(tick % 2, key, 0, true);
      else if (tick % 7 === 4) clients.key(tick % 2, key, 0, false);
      clients.frames(1);
    }
  };
  const until = (what: string, limit: number, done: () => boolean) => {
    for (let frame = 0; frame < limit && !done(); frame++) play(1);
    if (!done()) throw new Error(`${what} not reached: ${JSON.stringify([probeState(clients, 0), probeState(clients, 1)])}`);
  };
  const both = (read: (state: ReturnType<typeof probeState>) => boolean) => [0, 1].every(index => read(probeState(clients, index)));
  const quick = () => {
    const epoch = probeState(clients, 0).epoch;
    if (epoch !== undefined) {
      clients.chat(0, RESET_COMMAND);
      play(30);
    }
    clients.chat(0, QUICK_MATCH_COMMAND);
    until("a new match epoch", 900, () => both(state => state.phase === Phase.match && state.epoch !== epoch));
    play(1);
    return probeState(clients, 0).epoch ?? -1;
  };
  clients.start();
  clients.frames(30);

  const first = quick();
  expect(both(state => state.recording && state.run === 1)).toBe(true);
  until("the first window's export", EPOCH_CALLBACKS + 60, () => both(state => state.exporting));
  const missed = quick();
  expect(both(state => state.run === 1)).toBe(true);
  until("the first export", 1800, () => both(state => !state.exporting));
  const third = quick();
  expect(both(state => state.recording && state.run === 2)).toBe(true);
  until("the third window's export", EPOCH_CALLBACKS + 60, () => both(state => state.exporting));
  until("the third export", 1800, () => both(state => !state.exporting));
  for (const client of clients.clients) expect(client.errors).toEqual([]);

  for (const [run, epoch, incomplete] of [[1, first, "none"], [2, third, String(missed)]] as const) {
    const windows = [0, 1].map(index => exported(clients, index, run));
    for (const window of windows) {
      expect(window.header).toMatch(/ dropped=0$/);
      const [, agreed, requests] = /^delay (?:\d+) (\d+) ([\d,]+)$/.exec(window.delay) ?? [];
      expect(window.delay.startsWith(`delay ${epoch} `)).toBe(true);
      expect(Number(agreed)).toBe(Math.max(...(requests ?? "").split(",").map(Number)));
      if (run === 1) expect(window.delay).toBe(`delay ${epoch} 2 2,2`);
      expect(window.epochLine).toBe(`epoch recorded=${epoch} incomplete=${incomplete}`);
      const periodic = [...window.checksums.keys()].filter(frame => frame !== window.lastChecksumFrame);
      expect(periodic.length).toBeGreaterThanOrEqual(5);
      periodic.forEach((frame, index) => expect(frame).toBe((index + 1) * CHECKSUM_FRAMES));
    }
    const [a, b] = windows;
    expect(b?.delay).toBe(a?.delay ?? "");
    let compared = 0;
    for (const [frame, sum] of a?.checksums ?? []) {
      const other = b?.checksums.get(frame);
      if (other === undefined) continue;
      compared++;
      expect(`${frame} ${other}`).toBe(`${frame} ${sum}`);
    }
    expect(compared).toBeGreaterThanOrEqual(5);
  }
}, 300_000);
