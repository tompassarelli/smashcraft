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
  /** One quick match until both clients wrote its trace (1200 callbacks after its first row). */
  const play = (label: string) => {
    for (const client of clients.clients) client.files.delete(TRACE_FILE);
    clients.chat(0, QUICK_MATCH_COMMAND);
    for (let i = 0; i < 1500 && !(trace(0) !== undefined && trace(1) !== undefined); i++) frames(1);
    expect(errors(), label).toEqual([]);
    return [0, 1].map(slot => {
      const { checksums, events } = parseTrace(trace(slot) ?? []);
      return { checksums: [...checksums], events };
    });
  };
  clients.start();
  frames(30);
  const boot = value(clients.client(0), () => structuredClone(shell().game));
  const first = play("first match");
  expect(first[0]?.checksums.length).toBeGreaterThan(10);
  expect(first[0]?.events.length).toBeGreaterThan(10);
  expect(first[1]).toEqual(first[0]);
  // The batch types the reset while the last script's match still runs.
  frames(120);
  clients.chat(0, RESET_COMMAND);
  frames(30);
  for (const client of clients.clients) {
    expect(value(client, () => shell().game)).toEqual(boot);
  }
  const second = play("match after the reset");
  expect(second[0]).toEqual(first[0]);
  expect(second[1]).toEqual(first[1]);
  expect(value(clients.client(0), () => shell().game.phase)).toBe(Phase.match);
}, 60_000);
