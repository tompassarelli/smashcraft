






import type { HeadlessClient } from "wisp/src/headless/client";
import type { Lockstep } from "wisp/src/headless/lockstep";
import type { PerfMeasure } from "wisp/src/headless/luaPerf";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { at } from "wisp/src/runtime/lookup";
import { Action, bit } from "../../src/game/input/actions";
import { type InputRow, inputRow } from "../../src/game/input/inputRow";
import { Phase } from "../../src/game/match/rules";
import type { MapBuild } from "../../src/game/shell/build";
import { INTEGRITY_BUILD } from "../../src/game/shell/currentBuild";
import { Character } from "../../src/game/sim/codes";
import { Key } from "../../src/platform/shell/keyEvents";
import { JournalHelpers } from "../../test/rematch/journalHelper";

interface BotMatch {

  readonly computers: readonly (readonly [slot: number, character: Character])[];

  readonly stagger?: number;
}


export const BOT_THREE: BotMatch = { computers: [[2, Character.demonHunter]] };

export const BOT_FOUR: BotMatch = { computers: [[2, Character.demonHunter], [3, Character.warden]] };

export const botMatchAgainst = (character: Character): BotMatch => ({ computers: [[2, character]] });

export const HUMAN_DUEL: BotMatch = { computers: [], stagger: 7 };

export const HUMAN_FOUR: BotMatch = { computers: [], stagger: 7 };


const REST = 24;
const SHIELD = 12;
const DASH = 18;
const TAPS = [Action.attack, Action.jump, Action.special];
const CYCLE = 3 * REST + (SHIELD + REST) + 2 * (DASH + REST);
const RIGHT = bit(Action.moveRight) | bit(Action.smashRight);
const LEFT = bit(Action.moveLeft) | bit(Action.smashLeft);







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


const KEY_ATTACK = 0x4e;
const KEY_JUMP = 0x49;
const KEY_SPECIAL = 0x55;
const KEY_SHIELD = 0x51;
const KEY_LEFT = 0x57;
export const KEY_RIGHT = 0x52;
const TAP_KEYS = [KEY_ATTACK, KEY_JUMP, KEY_SPECIAL];


export function botBeatKeys(frame: number): readonly [tap: number, held: number] {
  let at = floorMod(frame - 1, CYCLE);
  if (at < 3 * REST) return [floorMod(at, REST) === 0 ? TAP_KEYS[floorDiv(at, REST)] ?? KEY_ATTACK : 0, 0];
  if ((at -= 3 * REST) < SHIELD + REST) return [0, at < SHIELD ? KEY_SHIELD : 0];
  if ((at -= SHIELD + REST) < DASH + REST) return [0, at < DASH ? KEY_RIGHT : 0];
  at -= DASH + REST;
  return [0, at < DASH ? KEY_LEFT : 0];
}

export interface Game {
  phase: number;
  stockCount: number;
  timeLimitMinutes: number;
  computerMask: number;
  humanFighterMask: number;
  stageChoice: number;
  automaticRematch: boolean;
  readonly characterChoices: number[];
  readonly characterReadiness: boolean[];
}


const hasGame = (shell: unknown): shell is { readonly game: Game } => typeof shell === "object" && shell !== null && "game" in shell;


export function gameOf(client: HeadlessClient): Game {
  const shell = client.natives.__smashcraftShell;
  if (!hasGame(shell)) throw new Error(`p${client.slot} has no shell`);
  return shell.game;
}










export function playBotMatch(clients: Lockstep, match: BotMatch, frames: number, measure: PerfMeasure, build: MapBuild = INTEGRITY_BUILD): { problems: number; lines: string[] } {
  const keyboard = build.input.kind !== "journal";
  const helpers = new JournalHelpers(build.id, true);
  helpers.rows = (_slot, frame) => botBeatRow(frame);
  const host = clients.client(0);

  let beating = false;
  let beat = 0;
  const stagger = match.stagger ?? 0;
  const held = clients.clients.map(() => 0);
  const tapped = clients.clients.map(() => 0);
  const pressBeat = () => {
    if (!keyboard || !beating || gameOf(host).phase !== Phase.match) return;
    beat++;
    clients.clients.forEach((player, index) => {
      const at = beat - index * stagger;
      const [tap, hold] = at < 1 ? [0, 0] : botBeatKeys(at);
      tapped[index] = tap;
      const last = held[index] ?? 0;
      if (hold !== last && last !== 0) for (const client of clients.clients) client.key(player.slot, last, 0, false);
      if (hold !== last && hold !== 0) for (const client of clients.clients) client.key(player.slot, hold, 0, true);
      if (tap !== 0) for (const client of clients.clients) client.key(player.slot, tap, 0, true);
      held[index] = hold;
    });
  };
  // Confirmed frames reach clients at different turns, so a handle made or freed during play desyncs Warcraft even when every client makes the same calls.
  const handleCalls: string[] = [];
  const scanned = clients.clients.map(() => 0);
  const scanHandles = () => {
    clients.clients.forEach((client, index) => {
      const from = Math.max(at(scanned, index), client.forgotten);
      for (let call = from; call < client.forgotten + client.log.length; call++) {
        const name = client.log[call - client.forgotten]?.name ?? "";
        if (handleCalls.length < 8 && (name.startsWith("Create") || name.startsWith("Destroy") || name.startsWith("Remove") || name === "AddSpecialEffect" || name === "AddSpecialEffectTarget" || name === "AddLightning" || name === "AddLightningEx")) {
          handleCalls.push(`p${client.slot} call ${call}: ${name}`);
        }
      }
      scanned[index] = client.forgotten + client.log.length;
    });
  };
  const frame = () => {
    pressBeat();
    clients.frames(1);
    if (beating) scanHandles();
    clients.clients.forEach((player, index) => {
      const tap = tapped[index] ?? 0;
      if (tap === 0) return;
      for (const client of clients.clients) client.key(player.slot, tap, 0, false);
      tapped[index] = 0;
    });
    if (!keyboard) helpers.service(clients);
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

  for (const client of clients.clients) clients.press(client.slot, keyboard ? KEY_RIGHT : Key.n);
  for (let index = 0; index < 5; index++) frame();

  for (const client of clients.clients) {
    const game = gameOf(client);
    for (const [slot, character] of match.computers) {
      game.computerMask |= 1 << slot;
      game.characterChoices[slot] = character;
      game.characterReadiness[slot] = true;
    }

    if (match.computers.length === 0) for (const player of clients.clients) game.characterReadiness[player.slot] = true;
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
  clients.clients.forEach((client, index) => { scanned[index] = client.forgotten + client.log.length; });
  beating = true;
  for (let index = 0; index < frames && gameOf(host).phase === Phase.match; index++) frame();
  const lines: string[] = [];
  const divergence = clients.firstDivergence();
  if (divergence !== undefined) lines.push(`desync: ${divergence}`);
  for (const call of handleCalls) lines.push(`handle made or freed during play: ${call}`);
  for (const client of clients.clients) for (const error of client.errors) lines.push(`p${client.slot}: ${error}`);
  return { problems: lines.length, lines };
}
