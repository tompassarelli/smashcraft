// Classic (#284): a run through the chosen fighter's route, six configured
// matches whose computers climb the five tiers from the chosen start, a
// continue that retries the lost fight one tier easier, and the ending card
// (smashcraft:docs/design/classic-mode.md).
import { at } from "wisp/src/runtime/lookup";
import { CPU_TIERS, type CpuOpponentId } from "../match/cpuProfiles";
import { type MatchState, Phase, characterReady, endConfiguredRun, firstHumanSlot } from "../match/rules";
import { fighterName } from "../sim/heroes/registry";
import { bossDefinition, bossHealth } from "./bosses";
import { applyConfiguredMatch, beginConfiguredRun } from "./configuredMatch";
import { classicRoute, type ClassicRoute } from "./routes";
import { BossKind, type ConfiguredMatch, type ConfiguredOpponent, RunOutcome, WinCondition } from "./runState";

/** Five rival fights, then the boss. */
export const CLASSIC_FIGHTS = 6;
/** Tier steps above the run's difficulty for each fight; the boss's health uses the last. */
export const CLASSIC_TIER_RAMP: readonly number[] = [0, 0, 1, 1, 2, 2];
/** Each fight's named opponent; the team fight's second rival is Wren. */
const IDENTITIES: readonly CpuOpponentId[] = ["vale", "ember", "flint", "kite", "rook"];
/** The player's and each rival's stocks per fight: quick one-stock openers, two stocks from the team fight on. */
const PLAYER_STOCKS: readonly number[] = [1, 1, 1, 2, 2, 2];
const RIVAL_STOCKS: readonly number[] = [1, 1, 1, 1, 2];
const FIGHT_MINUTES: readonly number[] = [3, 3, 3, 3, 4, 5];

export const fightTier = (tier: number, fight: number): number => Math.min(CPU_TIERS.length - 1, tier + (CLASSIC_TIER_RAMP[fight] ?? 0));

/** Fight `fight` of `route` at run difficulty `tier`, as one configured match. */
export function classicEntry(route: Readonly<ClassicRoute>, fight: number, tier: number): ConfiguredMatch {
  const level = fightTier(tier, fight);
  const last = fight === CLASSIC_FIGHTS - 1;
  const id = `classic.${route.fighter}.${fight}.${level}`;
  if (last) {
    const boss = bossDefinition(route.boss);
    return {
      id, opponents: [], stage: boss?.stage ?? 2, stocks: at(PLAYER_STOCKS, fight), timeMinutes: at(FIGHT_MINUTES, fight), playerDamage: 0,
      hazards: false, win: WinCondition.defeatBoss, boss: route.boss, bossHealth: bossHealth(route.boss, level), last: true,
      speaker: boss?.name ?? "", intro: boss?.intro ?? "",
    };
  }
  const plan = at(route.fights, fight);
  const opponents: ConfiguredOpponent[] = plan.rivals.map((character, index) => ({
    character, opponent: index === 0 ? at(IDENTITIES, fight) : "wren", tier: at(CPU_TIERS, level), stocks: at(RIVAL_STOCKS, fight),
  }));
  return {
    id, opponents, stage: plan.stage, stocks: at(PLAYER_STOCKS, fight), timeMinutes: at(FIGHT_MINUTES, fight), playerDamage: 0,
    hazards: true, win: WinCondition.ko, boss: BossKind.none, bossHealth: 0, last: false,
    speaker: fighterName(at(plan.rivals, 0)), intro: plan.line,
  };
}

/** The route of the run in progress. */
export const runRoute = (game: Readonly<MatchState>): ClassicRoute | undefined => (game.run.active ? classicRoute(game.run.fighter) : undefined);

/** Fighter selection with Classic chosen: the first player's start begins a run on their fighter's route. */
export function startClassic(game: MatchState, slot: number): boolean {
  const first = firstHumanSlot(game);
  if (game.phase !== Phase.characterMenu || !game.classic || game.run.active || first === undefined || slot !== first || !characterReady(game, slot)) return false;
  const fighter = game.characterChoices[first];
  const route = classicRoute(fighter);
  if (route === undefined) return false;
  beginConfiguredRun(game, first, fighter);
  game.run.tier = game.classicTier;
  applyConfiguredMatch(game, classicEntry(route, 0, game.run.tier));
  return true;
}

export const ClassicStep = { none: 0, fight: 1, menu: 2 } as const;
export type ClassicStep = (typeof ClassicStep)[keyof typeof ClassicStep];

/**
 * The player's confirm at a result: after a win the next fight, after a loss
 * a continue (the same fight a tier easier), after the ending card the menu.
 */
export function continueClassic(game: MatchState, slot: number): ClassicStep {
  const { run } = game;
  const route = runRoute(game);
  if (game.phase !== Phase.result || route === undefined || slot !== run.player) return ClassicStep.none;
  if (run.cleared) {
    endConfiguredRun(game);
    return ClassicStep.menu;
  }
  if (run.outcome === RunOutcome.won) run.fight++;
  else {
    run.tier = Math.max(0, run.tier - 1);
    run.continues++;
  }
  applyConfiguredMatch(game, classicEntry(route, run.fight, run.tier));
  return ClassicStep.fight;
}

/** The player's back at a result: the run ends and play returns to fighter selection. */
export function quitClassic(game: MatchState, slot: number): boolean {
  if (game.phase !== Phase.result || !game.run.active || slot !== game.run.player) return false;
  endConfiguredRun(game);
  return true;
}

/** Developer captures: the run in progress jumps to its final battle. */
export function skipToClassicBoss(game: MatchState): void {
  const route = runRoute(game);
  if (route === undefined || game.phase !== Phase.stageMenu) return;
  game.run.fight = CLASSIC_FIGHTS - 1;
  applyConfiguredMatch(game, classicEntry(route, game.run.fight, game.run.tier));
}
