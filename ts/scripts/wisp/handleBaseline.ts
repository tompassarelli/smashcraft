import type { HeadlessClient } from "wisp/src/headless/client";
import type { Lockstep } from "wisp/src/headless/lockstep";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { Phase } from "../../src/game/match/rules";
import { Character } from "../../src/game/sim/codes";
import { Key } from "../../src/platform/shell/keyEvents";
import type { Game } from "./botMatch";
import { HandleCensus } from "./handleCensus";
import { smashcraftNativeBehavior } from "./headlessNatives";

/** Live Warcraft handles of each kind on one client, sorted by kind. */
export type HandleCounts = readonly (readonly [string, number])[];

export const BASELINE_LINEUP: readonly Character[] = [Character.demonHunter, Character.rifleman, Character.warden, Character.demonHunter];

export const BASELINE_STAGE = 2;

/** The graphics mode a client reports: Definitive is the first-class look, Classic the fallback. */
export type Look = "classic" | "definitive";

export const LOOKS: readonly Look[] = ["classic", "definitive"];

/** Matches the soak plays in each look: the first match and 20 rematches (#409). */
export const SOAK_MATCHES = 21;

// The first match leaves handles the menu keeps from then on: the stage-loading cover's frames, the effects
// they hold and one fighter body (unit) per fighter, so these kinds return to the first match's counts and
// every other kind to the cold menu's.
const KEPT_KINDS: ReadonlySet<string> = new Set(["effect", "framehandle", "unit"]);

/**
 * Smashcraft's headless natives with the graphics-mode string reporting `look`; each client's reads of it are
 * counted in `reads` by slot, so a run can show the map took its look from them.
 */
export function lookNatives(look: Look, reads: number[]): (this: void, client: HeadlessClient) => Record<string, unknown> {
  return (client) => ({
    ...smashcraftNativeBehavior(),
    GetLocalizedString: (key: string) => {
      if (key !== "SMASHCRAFT_CUE_GRAPHICS") return key;
      reads[client.slot] = (reads[client.slot] ?? 0) + 1;
      return look;
    },
  });
}

export interface HandleBaseline {
  /** Each client's counts at fighter selection before any match. */
  readonly cold: readonly HandleCounts[];
  /** Each client's counts back at fighter selection after each match. */
  readonly afterMatches: readonly (readonly HandleCounts[])[];
}

const countOf = (counts: HandleCounts | undefined, kind: string) => (counts ?? []).find(([name]) => name === kind)?.[1] ?? 0;

/** `kind=count` for each kind, sorted by kind. */
export const handleLine = (counts: HandleCounts | undefined) => (counts ?? []).map(([kind, count]) => `${kind}=${count}`).join(" ");

/**
 * Every way `baseline` breaks #409's invariant, by client: after every match each kind the first match keeps
 * (effects, frames, fighter bodies) equals the first match's count with one body per fighter, and every other
 * kind (sounds, timers, triggers, ...) equals the cold menu's.
 */
export function handleProblems(baseline: HandleBaseline, slots: readonly number[]): string[] {
  const problems: string[] = [];
  const [first] = baseline.afterMatches;
  slots.forEach((slot, index) => {
    const p = `p${slot + 1}`;
    const cold = baseline.cold[index];
    const kept = first?.[index];
    const units = countOf(kept, "unit");
    if (units !== BASELINE_LINEUP.length) problems.push(`${p}: ${units} fighter bodies for ${BASELINE_LINEUP.length} fighters`);
    baseline.afterMatches.forEach((after, match) => {
      const counts = after[index];
      const kinds = new Set([...(cold ?? []), ...(kept ?? []), ...(counts ?? [])].map(([kind]) => kind));
      for (const kind of kinds) {
        const expected = countOf(KEPT_KINDS.has(kind) ? kept : cold, kind);
        const live = countOf(counts, kind);
        if (live !== expected) problems.push(`${p} after match ${match + 1}: ${kind}=${live}, baseline ${expected}`);
      }
    });
  });
  return problems;
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
