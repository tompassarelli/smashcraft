import type { HeadlessClient } from "wisp/src/headless/client";
import type { Lockstep } from "wisp/src/headless/lockstep";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { Phase } from "../../src/game/match/rules";
import { STAGE_CATALOG } from "../../src/game/menu/stageCatalog";
import { Character } from "../../src/game/sim/codes";
import type { Game } from "./botMatch";
import { Key } from "../../src/platform/shell/keyEvents";
import { HandleCensus, liveHandleProblems } from "./handleCensus";

const LINEUP: readonly Character[] = [Character.demonHunter, Character.rifleman, Character.blademaster, Character.jaina];
const STAGE = STAGE_CATALOG[2]?.id ?? 0;
const MATCH_LIMIT = 3 * 3600;

/** Every handle kind box 1 of #409 names; each must be live at the menu, so the check can't pass empty. */
export const COUNTED_KINDS = ["effect", "framehandle", "sound", "timer", "trigger", "unit"];

export interface HandleBaseline {
  /** Live handles per client at fighter selection after one match. */
  readonly baseline: readonly Readonly<Record<string, number>>[];
  /** Live handles per client at fighter selection after a match and its automatic rematch. */
  readonly after: readonly Readonly<Record<string, number>>[];
  /** Each `pN: kind baseline -> now` that differs, or a kind the census never saw. */
  readonly problems: readonly string[];
}

/**
 * Four computers play one match and return to fighter selection, the menu baseline (the first match
 * creates the stage loading cover, and the menu's bodies follow the lineup); then a match and its
 * automatic rematch, back to fighter selection. Counts come from HandleCensus on each client.
 */
export function measureHandleBaseline(clients: Lockstep, functions: readonly (readonly [string, string, number])[], gameOf: (client: HeadlessClient) => Game): HandleBaseline {
  const censuses = clients.clients.map((client) => new HandleCensus(client, functions));
  const host = clients.client(0);
  const until = (what: string, limit: number, done: () => boolean, each?: (index: number) => void) => {
    for (let index = 0; index < limit && !done(); index++) {
      each?.(index);
      clients.frames(1);
    }
    if (!done()) throw new Error(`${what} not reached at frame ${clients.frame}`);
  };
  const choose = (rematch: boolean) => {
    for (const client of clients.clients) {
      const game = gameOf(client);
      game.humanFighterMask = 0;
      for (let slot = 0; slot < 4; slot++) {
        game.computerMask |= 1 << slot;
        game.characterChoices[slot] = LINEUP[slot] ?? Character.rifleman;
        game.characterReadiness[slot] = true;
      }
      game.stockCount = 1;
      game.timeLimitMinutes = 1;
      game.stageChoice = STAGE;
      // The automatic rematch draws from the pool; a one-stage pool keeps the menu's backdrop comparable.
      game.stagePool.only = true;
      game.stagePool.selectedMask = 1 << STAGE;
      game.stagePool.remainingMask = 0;
      game.automaticRematch = rematch;
    }
  };
  const menu = () => censuses.map((census) => {
    const counts: Record<string, number> = {};
    for (const [kind, count] of census.counts()) counts[kind] = count;
    return counts;
  });
  const cycle = (rematch: boolean) => {
    choose(rematch);
    clients.press(0, Key.y);
    until("stage selection", 120, () => gameOf(host).phase === Phase.stageMenu);
    choose(rematch);
    clients.press(0, Key.y);
    until("the match", 600, () => gameOf(host).phase === Phase.match);
    until("the result", MATCH_LIMIT, () => gameOf(host).phase === Phase.result);
    if (rematch) {
      until("the rematch", 20 * 60, () => gameOf(host).phase === Phase.match);
      for (const client of clients.clients) gameOf(client).automaticRematch = false;
      until("the rematch's result", MATCH_LIMIT, () => gameOf(host).phase === Phase.result);
    }
    until("fighter selection", 20 * 60, () => gameOf(host).phase === Phase.characterMenu, (index) => {
      if (floorMod(index, 30) === 0) clients.press(floorMod(floorDiv(index, 30), 2), Key.y);
    });
    clients.frames(60);
    return menu();
  };

  clients.start();
  clients.frames(30);
  const baseline = cycle(false);
  const after = cycle(true);
  const problems: string[] = [];
  baseline.forEach((counts, slot) => {
    for (const kind of COUNTED_KINDS) if ((counts[kind] ?? 0) === 0) problems.push(`p${slot}: no live ${kind} at the menu`);
    for (const problem of liveHandleProblems(counts, after[slot] ?? {})) problems.push(`p${slot}: ${problem}`);
  });
  return { baseline, after, problems };
}

/** One line per client: `pN kind=baseline->after,...`. */
export const handleBaselineLines = (result: HandleBaseline): string[] => result.baseline.map((counts, slot) => {
  const after = result.after[slot] ?? {};
  return `p${slot} ${Object.keys(counts).sort().map((kind) => `${kind}=${counts[kind]}->${after[kind] ?? 0}`).join(",")}`;
});
