// Issue #46: in Tom's 0.0.47 playtest player 1's helper journaled, player 2's
// client had none, a computer Illidan made three, and the match stopped at
// 7:00 on its first frames with nothing on screen. Here in two simulated
// clients of the playable build, with Battle.net's measured sync latency.
import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { Action, bit } from "../src/game/input/actions";
import type { ParticipantInputs } from "../src/game/input/participants";
import { ShadowInputSchedule } from "../src/game/netcode/shadowSchedule";
import { PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { KEYBOARD_FALLBACK_MESSAGE } from "../src/game/shell/messages";
import { fighterAt } from "../src/game/sim/roster";
import { Key } from "../src/platform/shell/keyEvents";
import { shell } from "../src/platform/shell/state";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { JournalHelpers } from "./rematch/journalHelper";
import { WAITING, confirmedFrame, expectSynchronized, shows, startPlayableMatch, value } from "./rematch/playableMatch";

/** The keys each client's player holds down. */
const held = new Map<number, Set<number>>();
const headless = installHeadless({
  ...PREDICTED_HEADLESS,
  natives: (client) => ({ BlzIsKeyPressed: (key: number) => held.get(client.slot)?.has(key) === true }),
});
afterAll(headless.restore);

/** Player 2's confirmed rows, as client 0 runs them: every action any of them held or pressed. */
let player2Actions = 0;
const readConfirmed = ShadowInputSchedule.prototype.readConfirmed;
afterAll(() => {
  ShadowInputSchedule.prototype.readConfirmed = readConfirmed;
});
ShadowInputSchedule.prototype.readConfirmed = function (this: ShadowInputSchedule, epoch: number, inputs: ParticipantInputs) {
  const read = readConfirmed.call(this, epoch, inputs);
  if (read && GetPlayerId(GetLocalPlayer()) === 0) player2Actions |= inputs[1].held | inputs[1].pressed;
  return read;
};

test("a human without a controller helper plays on the keyboard: the match runs, their fighter stands still until a key moves it, and Y pauses", () => {
  const helpers = new JournalHelpers(PLAYABLE_BUILD.id, true);
  helpers.silent.add(1);
  const { clients, frames, clientA: a, clientB: b } = startPlayableMatch(headless, helpers, true);
  const player2X = (client: typeof a) => value(client, () => fighterAt(shell().world, 1).motion.x);
  const paused = () => clients.clients.map(client => value(client, () => shell().session.paused));
  // Every client names the player the start waits for.
  frames(60);
  expect([shows(a, WAITING), shows(b, WAITING)]).toEqual([true, true]);
  // Two seconds after the match began, player 2 plays on the keyboard, and their screen says so.
  frames(90);
  expect([shows(a, KEYBOARD_FALLBACK_MESSAGE), shows(b, KEYBOARD_FALLBACK_MESSAGE)]).toEqual([false, true]);
  expect([shows(a, "Start: pause."), shows(b, "Y: pause.")]).toEqual([true, true]);
  // The match runs on every client, with player 2's fighter on neutral input.
  const started = [confirmedFrame(a), confirmedFrame(b)];
  frames(20);
  expect([shows(a, WAITING), shows(b, WAITING)]).toEqual([false, false]);
  expect(player2Actions).toBe(0);
  // Player 2 holds QWERTY's move right.
  const before = player2X(a);
  held.set(1, new Set([Key.r]));
  frames(20);
  held.delete(1);
  frames(20);
  expect(player2Actions & bit(Action.moveRight)).not.toBe(0);
  expect(player2X(a)).toBeGreaterThan(before);
  expect(player2X(b)).toBe(player2X(a));
  // At game speed: 60 frames of play confirm on both clients.
  const running = [confirmedFrame(a) - (started[0] ?? 0), confirmedFrame(b) - (started[1] ?? 0)];
  for (const advanced of running) expect(advanced).toBeGreaterThanOrEqual(50);
  // Player 2's Y pauses: player 1's helper and player 2's keyboard agree the frame.
  clients.press(1, Key.y);
  frames(45);
  expect(paused()).toEqual([true, true]);
  const stopped = confirmedFrame(a);
  frames(15);
  expect([confirmedFrame(a), confirmedFrame(b)]).toEqual([stopped, stopped]);
  clients.press(1, Key.y);
  frames(40);
  expect(paused()).toEqual([false, false]);
  for (const client of [a, b]) expect(confirmedFrame(client)).toBeGreaterThan(stopped + 5);
  expectSynchronized(clients);
  console.log(`no helper: match running from confirmed frame ${started.join("/")} at 150 frames, +${running.join("/")} in the next 60; player 2 moved ${player2X(a) - before} right; paused at ${stopped}`);
});
