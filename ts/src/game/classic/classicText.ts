// Classic's player-facing text: the selection summary, each fight's
// transmission, the result prompts, the ending card and its results line.
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { CPU_TIERS } from "../match/cpuProfiles";
import { MATCH_TICKS_PER_SECOND, type MatchState } from "../match/rules";
import { fighterName } from "../sim/heroes/registry";
import { BossPhase, bossClock, bossDefinition, bossMoment } from "./bosses";
import { CLASSIC_FIGHTS } from "./classic";
import { classicRoute } from "./routes";
import { RunOutcome } from "./runState";

const titleCase = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);
export const tierName = (tier: number): string => titleCase(CPU_TIERS[tier] ?? "rookie");

/** The difficulty stepper's value at fighter selection. */
export const classicTierSetting = (tier: number): string => `Classic start: ${tierName(tier)}`;

/** Beside the stepper: the chosen fighter's route story and boss. */
export function classicRouteSummary(character: number): string {
  const route = classicRoute(character);
  if (route === undefined) return "";
  return `${route.story}\nFinal battle: ${bossDefinition(route.boss)?.name ?? ""}`;
}

/** Shown as a fight starts: its round and the transmission. */
export function classicIntro(game: Readonly<MatchState>): string {
  const entry = game.run.current;
  if (entry === undefined) return "";
  const round = game.run.fight === CLASSIC_FIGHTS - 1 ? "Final battle" : `Round ${game.run.fight + 1} of ${CLASSIC_FIGHTS}`;
  return `${round} — ${entry.speaker}: "${entry.intro}"`;
}

/** Match frames as m:ss. */
export function runTime(frames: number): string {
  const seconds = floorDiv(frames, MATCH_TICKS_PER_SECOND);
  const rest = floorMod(seconds, 60);
  return `${floorDiv(seconds, 60)}:${rest < 10 ? "0" : ""}${rest}`;
}

/** The ending card's results line. */
export function classicResults(game: Readonly<MatchState>): string {
  const { run } = game;
  const continues = run.continues === 1 ? "1 continue" : `${run.continues} continues`;
  return `Time ${runTime(run.frames)} · ${Math.floor(run.damageTaken)}% damage taken · ${continues} · finished on ${tierName(run.tier)}`;
}

/** The ending card: speaker, two or three transmission lines, and the results line. */
export function classicEnding(game: Readonly<MatchState>): { speaker: string; lines: readonly string[]; results: string } {
  const route = classicRoute(game.run.fighter);
  return { speaker: fighterName(game.run.fighter), lines: route?.ending ?? [], results: classicResults(game) };
}

/** The result's status line during a run. */
export function classicResultMessage(game: Readonly<MatchState>): string {
  const { run } = game;
  if (run.cleared) return `${fighterName(run.fighter)} cleared Classic!`;
  if (run.outcome === RunOutcome.won) return `Round ${run.fight + 1} cleared!`;
  return "Defeated.";
}

/** The help under the result during a run. */
export function classicResultHelp(game: Readonly<MatchState>, confirm: string): string {
  const { run } = game;
  if (run.cleared) return `Press ${confirm} to return to fighter selection.`;
  if (run.outcome === RunOutcome.won) {
    const next = run.fight + 1 === CLASSIC_FIGHTS - 1 ? "the final battle" : `round ${run.fight + 2}`;
    return `Press ${confirm} for ${next}. Back ends the run.`;
  }
  return `Press ${confirm} to continue one tier easier (${tierName(Math.max(0, run.tier - 1))}). Back ends the run.`;
}

/** The notice line through a boss match: its health, and the strike it is warning of. */
export function bossNotice(game: Readonly<MatchState>): string {
  const { boss } = game.run;
  const definition = bossDefinition(boss.kind);
  if (definition === undefined) return "";
  const health = `${definition.name}: ${boss.health} / ${boss.maxHealth}`;
  const now = bossMoment(definition, bossClock(game.matchFrame, game.startHold));
  const strike = definition.strikes[now.index];
  if (now.strike < 0 || strike === undefined || now.phase !== BossPhase.tell) return health;
  return `${health}\n${strike.name}!`;
}
