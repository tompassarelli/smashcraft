import type { HeadlessClient } from "wisp/src/headless/client";
import type { Lockstep } from "wisp/src/headless/lockstep";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { Phase } from "../../src/game/match/rules";
import { Character } from "../../src/game/sim/codes";
import { Key } from "../../src/platform/shell/keyEvents";
import type { Game } from "./botMatch";
import { HandleCensus } from "./handleCensus";

/** Live Warcraft handles of each kind on one client, sorted by kind. */
export type HandleCounts = readonly (readonly [string, number])[];

export const BASELINE_LINEUP: readonly Character[] = [Character.demonHunter, Character.rifleman, Character.warden, Character.demonHunter];

const BASELINE_STAGE = 2;

interface HandleBaseline {
  /** Each client's counts at fighter selection before any match. */
  readonly cold: readonly HandleCounts[];
  /** Each client's counts back at fighter selection after each match. */
  readonly afterMatches: readonly (readonly HandleCounts[])[];
}


/**
 * Plays `matches` four-computer matches on one stage from fighter selection and back, counting every client's
 * live handles of each kind before the first and after each. `gameOf` reads a client's shell game state.
 */
export function playHandleBaseline(clients: Lockstep, functions: readonly (readonly [string, string, number])[], matches: number, gameOf: (this: void, client: HeadlessClient) => Game): HandleBaseline {
  const censuses = clients.clients.map(client => new HandleCensus(client, functions));
  const host = clients.client(0);
  const live = () => censuses.map(census => census.counts());
  const until = (what: string, limit: number, done: () => boolean, each?: (frame: number) => void) => {
    for (let frame = 0; frame < limit && !done(); frame++) {
      each?.(frame);
      clients.frames(1);
    }
    if (!done()) throw new Error(`${what} not reached; phase ${gameOf(host).phase}`);
  };
  const choose = (stage: boolean) => {
    for (const client of clients.clients) {
      const game = gameOf(client);
      game.humanFighterMask = 0;
      BASELINE_LINEUP.forEach((character, slot) => {
        game.computerMask |= 1 << slot;
        game.characterChoices[slot] = character;
        game.characterReadiness[slot] = true;
      });
      game.stockCount = 1;
      game.timeLimitMinutes = 1;
      game.automaticRematch = false;
      if (stage) game.stageChoice = BASELINE_STAGE;
    }
  };

  clients.start();
  clients.frames(30);
  choose(false);
  clients.frames(60);
  const cold = live();
  const afterMatches: HandleCounts[][] = [];
  for (let match = 0; match < matches; match++) {
    choose(false);
    clients.press(0, Key.y);
    until("stage selection", 120, () => gameOf(host).phase === Phase.stageMenu);
    choose(true);
    clients.press(0, Key.y);
    until("the match", 600, () => gameOf(host).phase === Phase.match);
    until("the result", 2 * 3600, () => gameOf(host).phase === Phase.result);
    until("fighter selection", 20 * 60, () => gameOf(host).phase === Phase.characterMenu, (frame) => {
      if (floorMod(frame, 30) === 0) clients.press(floorMod(floorDiv(frame, 30), 2), Key.y);
    });
    clients.frames(60);
    afterMatches.push(live());
  }
  return { cold, afterMatches };
}
