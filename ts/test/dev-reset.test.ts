








import { afterAll, expect } from "bun:test";
import { rmSync } from "node:fs";
import { installHeadless } from "wisp/scripts/wisp/headless";
import type { MapEntry } from "wisp/src/headless/client";
import { Phase } from "../src/game/match/rules";
import { clearObservedActions } from "../src/game/match/step";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { QUICK_MATCH_COMMAND, RESET_COMMAND } from "../src/game/shell/devSettings";
import { install, startBuild } from "../src/platform/main";
import { shell } from "../src/platform/shell/state";
import { TRACE_FILE, parseTrace } from "../scripts/integrity/padParity";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { JournalHelpers } from "./rematch/journalHelper";
import { value } from "./rematch/playableMatch";
import { sweep } from "./sweep";
const headless = installHeadless(SMASHCRAFT_HEADLESS);
const copies: string[] = [];
afterAll(() => {
  headless.restore();
  for (const copy of copies) rmSync(copy, { recursive: true });
});

type Played = ReturnType<ReturnType<typeof session>["play"]>;


function session() {
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0, 1]);
  const helpers = new JournalHelpers(INTEGRITY_BUILD.id, true);
  helpers.workload = { denseCycles: 6, walkers: [] };
  const frames = (n: number) => { for (let i = 0; i < n; i++) { clients.frames(1); helpers.service(clients); } };
  const errors = () => clients.clients.flatMap(client => client.errors.map(error => `p${client.slot}: ${error}`));
  const trace = (slot: number) => clients.client(slot).files.get(TRACE_FILE);
  const saved = () => [...clients.client(0).files.keys()].filter(name => name.startsWith("smashcraft-repro-"));

  const play = (label: string, command = QUICK_MATCH_COMMAND) => {
    for (const client of clients.clients) client.files.delete(TRACE_FILE);
    clients.chat(0, command);
    const moments = new Set(saved());
    frames(1000);

    helpers.requestMoment(0);
    for (let i = 0; i < 4500 && !(trace(0) !== undefined && trace(1) !== undefined); i++) frames(1);
    expect(errors(), label).toEqual([]);
    const moment = saved().filter(name => !moments.has(name)).map(name => clients.client(0).files.get(name));
    if (command === QUICK_MATCH_COMMAND) expect(moment.length, label).toBe(1);
    const traces = [0, 1].map(slot => {
      const { checksums, events } = parseTrace(trace(slot) ?? []);
      return { checksums: [...checksums], events };
    });
    return { traces, moment };
  };

  clearObservedActions();
  clients.start();
  frames(30);
  const boot = value(clients.client(0), () => structuredClone({ game: shell().game, controls: shell().controls }));

  const reset = () => {
    frames(120);
    clients.chat(0, RESET_COMMAND);
    frames(30);
    for (const client of clients.clients) {
      expect(value(client, () => ({ game: shell().game, controls: shell().controls }))).toEqual(boot);
    }
  };

  const reload = (entry: MapEntry) => {
    clients.reload(headless.modules(entry));
    for (let i = 0; i < 120 && clients.unappliedReloads().length > 0; i++) frames(1);
    expect(clients.unappliedReloads()).toEqual([]);
  };
  return { clients, play, reset, reload };
}

function expectFirstMatch(first: Played) {
  expect(first.traces[0]?.checksums.length).toBeGreaterThan(10);
  expect(first.traces[0]?.events.length).toBeGreaterThan(10);
  expect(first.traces[1]).toEqual(first.traces[0]);
}

function expectSameMatch(first: Played, second: Played) {
  // Warcraft’s binary32 clock shifts trace sample frames (wisp#56); compare states on shared frames.


  expect(second.moment).toEqual(first.moment);
  for (const slot of [0, 1]) {
    const [was, now] = [first.traces[slot], second.traces[slot]];
    expect(now?.events).toEqual(was?.events);
    const before = new Map(was?.checksums);
    const shared = (now?.checksums ?? []).filter(([frame]) => before.has(frame));
    expect(shared.length).toBeGreaterThan(10);
    expect(shared).toEqual(shared.map(([frame]) => [frame, before.get(frame)]));
  }
}

sweep("a match after -dev reset equals the first match of the game: same trace checksums and fighter lines on both clients [k1 scenario]", () => {
  const { clients, play, reset } = session();
  const first = play("first match");
  expectFirstMatch(first);

  reset();
  play("computer match", "-dev quick cpu wren expert");
  reset();
  play("camera match", "-dev camera");
  reset();
  expectSameMatch(first, play("match after the reset"));
  expect(value(clients.client(0), () => shell().game.phase)).toBe(Phase.match);
}, 180_000);
