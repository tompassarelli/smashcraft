// The native bot session's match (smashcraft:docs/native-bot-session.md) in
// headless clients of the integrity build, for `bun wisp perf bot` and
// `perf bot-four` in 32-bit Lua: two players whose helpers journal the
// session's pad beats, computer opponents, three stocks and a one-minute
// clock, with Warcraft's measured sync latency. Each frame's typed text is
// reported to the measurement, so the predicted native cost includes Warcraft's
// edit-box stall. Plain TypeScript and Warcraft natives, so it compiles to Lua.
import type { HeadlessClient } from "wisp/src/headless/client";
import type { Lockstep } from "wisp/src/headless/lockstep";
import type { PerfMeasure } from "wisp/src/headless/luaPerf";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { Action, bit } from "../../src/game/input/actions";
import { type InputRow, inputRow } from "../../src/game/input/inputRow";
import { Phase } from "../../src/game/match/rules";
import { INTEGRITY_BUILD } from "../../src/game/shell/currentBuild";
import { Character } from "../../src/game/sim/codes";
import { Key } from "../../src/platform/shell/keyEvents";
import { JournalHelpers } from "../../test/rematch/journalHelper";

interface BotMatch {
  /** Computer fighters by slot; slots 0 and 1 are the two players. */
  readonly computers: readonly (readonly [slot: number, character: Character])[];
}

/** `parity capture --bot`: a computer Illidan. */
export const BOT_THREE: BotMatch = { computers: [[2, Character.demonHunter]] };
/** `--bot-four`: a computer Illidan and a computer Archer. */
export const BOT_FOUR: BotMatch = { computers: [[2, Character.demonHunter], [3, Character.archer]] };
/** `perf bot-NAME`: one computer of any selectable fighter, by its slug (sim/heroes/registry.ts). */
export const botMatchAgainst = (character: Character): BotMatch => ({ computers: [[2, character]] });

/** Frames between beats: 400 ms. */
const REST = 24;
const SHIELD = 12;
const DASH = 18;
const TAPS = [Action.attack, Action.jump, Action.special];
const CYCLE = 3 * REST + (SHIELD + REST) + 2 * (DASH + REST);
const RIGHT = bit(Action.moveRight) | bit(Action.smashRight);
const LEFT = bit(Action.moveLeft) | bit(Action.smashLeft);

/**
 * The bot beat on frame `frame` of a helper's clock, from 1: 5 ms taps of A
 * (attack), Y (jump) and X (special), a 200 ms full left trigger, then 300 ms
 * full-tilt dashes right and left, each followed by 400 ms of rest
 * (smashcraft:ts/scripts/integrity/journey.ts, BOT_BEATS).
 */
function botBeatRow(frame: number): InputRow {
  let at = floorMod(frame - 1, CYCLE);
  let row: InputRow | undefined;
  const held = (bits: number, frames: number, axisX: number, triggerLeft: number) =>
    inputRow(at < frames ? { held: bits, pressed: at === 0 ? bits : 0, axisX, triggerLeft } : { released: at === frames ? bits : 0 });
  if (at < 3 * REST) {
    const tap = floorMod(at, REST) === 0 ? bit(TAPS[floorDiv(at, REST)] ?? Action.attack) : 0;
    row = inputRow({ pressed: tap, released: tap });
  } else if ((at -= 3 * REST) < SHIELD + REST) row = held(bit(Action.leftTrigger), SHIELD, 0, 255);
  else if ((at -= SHIELD + REST) < DASH + REST) row = held(RIGHT, DASH, 127, 0);
  else {
    at -= DASH + REST;
    row = held(LEFT, DASH, -127, 0);
  }
  if (row === undefined) throw new Error(`no bot beat row for frame ${frame}`);
  return row;
}

interface Game {
  phase: number;
  stockCount: number;
  timeLimitMinutes: number;
  computerMask: number;
  readonly characterChoices: number[];
  readonly characterReadiness: boolean[];
}

/** The shell global a client's bundle keeps, as far as the match setup reads it. */
const hasGame = (shell: unknown): shell is { readonly game: Game } => typeof shell === "object" && shell !== null && "game" in shell;

/** A client's match state, read from its own globals: in Lua each client runs the bundle in its own environment. */
function gameOf(client: HeadlessClient): Game {
  const shell = client.natives.__smashcraftShell;
  if (!hasGame(shell)) throw new Error(`p${client.slot} has no shell`);
  return shell.game;
}

/**
 * Plays the match, its frames counted from the first match frame, for up to
 * `frames` frames or until it ends. Returns the problems: a desync and each
 * error report.
 */
/** Plays the match in the integrity build, or in the build `buildId` names, such as the playable one. */
export function playBotMatch(clients: Lockstep, match: BotMatch, frames: number, measure: PerfMeasure, buildId: string = INTEGRITY_BUILD.id): { problems: number; lines: string[] } {
  const helpers = new JournalHelpers(buildId, true);
  helpers.rows = (_slot, frame) => botBeatRow(frame);
  const host = clients.client(0);
  const frame = () => {
    clients.frames(1);
    helpers.service(clients);
    helpers.typed.forEach((characters, slot) => {
      if (characters > 0) measure.typed(slot, characters);
    });
  };
  const until = (what: string, done: () => boolean) => {
    for (let index = 0; index < 120 && !done(); index++) frame();
    if (!done()) throw new Error(`${what} not reached`);
  };
  clients.start();
  for (let index = 0; index < 30; index++) frame();
  for (const client of clients.clients) clients.press(client.slot, Key.n);
  for (let index = 0; index < 5; index++) frame();
  // The same computers, stocks and clock on every client keep them synchronized.
  for (const client of clients.clients) {
    const game = gameOf(client);
    for (const [slot, character] of match.computers) {
      game.computerMask |= 1 << slot;
      game.characterChoices[slot] = character;
      game.characterReadiness[slot] = true;
    }
  }
  clients.press(0, Key.y);
  until("stage selection", () => gameOf(host).phase === Phase.stageMenu);
  for (const client of clients.clients) {
    const game = gameOf(client);
    game.stockCount = 3;
    game.timeLimitMinutes = 1;
  }
  clients.press(0, Key.y);
  until("the match", () => gameOf(host).phase === Phase.match);
  measure.begin();
  for (let index = 0; index < frames && gameOf(host).phase === Phase.match; index++) frame();
  const lines: string[] = [];
  const divergence = clients.firstDivergence();
  if (divergence !== undefined) lines.push(`desync: ${divergence}`);
  for (const client of clients.clients) for (const error of client.errors) lines.push(`p${client.slot}: ${error}`);
  return { problems: lines.length, lines };
}
