// `-dev reset` (smashcraft:docs/native-bot-session.md, "Many scripts in one
// match"): a native pad batch plays its scripts back to back in one game, so a
// match after the reset must equal the first match of a new game. Two
// integrity-build clients on journal helpers play the same workload in the
// first quick match and, after a reset typed mid-match, in the next one; the
// integrity trace's confirmed-state checksums and fighter lines, which native
// parity compares, are the same.
import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
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

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

test("a match after -dev reset equals the first match of the game: same trace checksums and fighter lines on both clients", () => {
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0, 1]);
  const helpers = new JournalHelpers(INTEGRITY_BUILD.id, true);
  helpers.workload = { denseCycles: 6, walkers: [] };
  const frames = (n: number) => { for (let i = 0; i < n; i++) { clients.frames(1); helpers.service(clients); } };
  const errors = () => clients.clients.flatMap(client => client.errors.map(error => `p${client.slot}: ${error}`));
  const trace = (slot: number) => clients.client(slot).files.get(TRACE_FILE);
  const saved = () => [...clients.client(0).files.keys()].filter(name => name.startsWith("smashcraft-repro-"));
  /** One quick match until both clients wrote its trace (4500 callbacks after its first row). */
  const play = (label: string, command = QUICK_MATCH_COMMAND) => {
    for (const client of clients.clients) client.files.delete(TRACE_FILE);
    clients.chat(0, command);
    const moments = new Set(saved());
    frames(1000);
    // Native parity also compares a moment's whole starting state, inactive slots included.
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
  // A new game loads the map's modules afresh; tests share them, so an earlier test's match must not leave its steps' observations here.
  clearObservedActions();
  clients.start();
  frames(30);
  const boot = value(clients.client(0), () => structuredClone({ game: shell().game, controls: shell().controls }));
  const first = play("first match");
  expect(first.traces[0]?.checksums.length).toBeGreaterThan(10);
  expect(first.traces[0]?.events.length).toBeGreaterThan(10);
  expect(first.traces[1]).toEqual(first.traces[0]);
  // The batch types the reset while the last script's match still runs; scripts between
  // add a computer (slot C) and play the camera scenario, which must leave nothing behind.
  const reset = () => {
    frames(120);
    clients.chat(0, RESET_COMMAND);
    frames(30);
    for (const client of clients.clients) {
      expect(value(client, () => ({ game: shell().game, controls: shell().controls }))).toEqual(boot);
    }
  };
  reset();
  play("computer match", "-dev quick cpu wren expert");
  reset();
  play("camera match", "-dev camera");
  reset();
  const second = play("match after the reset");
  // The trace takes a checksum once a second of game callbacks, and Warcraft's binary32
  // game clock (wisp#56) runs a different number of callbacks a frame later in a game, so
  // the frames it lands on may shift; at every frame both matches hold, the state is equal.
  expect(second.moment).toEqual(first.moment);
  for (const slot of [0, 1]) {
    const [was, now] = [first.traces[slot], second.traces[slot]];
    expect(now?.events).toEqual(was?.events);
    const before = new Map(was?.checksums);
    const shared = (now?.checksums ?? []).filter(([frame]) => before.has(frame));
    expect(shared.length).toBeGreaterThan(10);
    expect(shared).toEqual(shared.map(([frame]) => [frame, before.get(frame)]));
  }
  expect(value(clients.client(0), () => shell().game.phase)).toBe(Phase.match);
}, 60_000);
