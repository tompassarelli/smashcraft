// Computer levels measured against each other (smashcraft:docs/design/cpu-levels.md):
// every pair of different levels plays `--matches` seeded matches, then level
// 9 plays `--top` against level 1. Matches cycle through every ordered pair of
// different fighters and every soak stage, each under its own match seed, the
// two levels on alternating sides. Prints the level matrix, each level's win
// rate against the other levels and whether it rises with the level.
// Usage (from ts/): bun scripts/cpuLevels.ts [--matches N] [--top N] [--stocks N] [--minutes N]
import { parseArgs } from "node:util";
import { CPU_LEVEL_MAX, CPU_LEVEL_MIN } from "../src/game/match/cpuLevel";
import type { Character } from "../src/game/sim/codes";
import { SELECTABLE_CHARACTERS } from "../src/game/sim/heroes/registry";
import { FIELD_STAGES, playCpuMatch } from "./cpuField";

export interface LevelResult {
  readonly level: number;
  readonly opponent: number;
  readonly wins: number;
  readonly losses: number;
  readonly ties: number;
}

const PAIRS: readonly (readonly [Character, Character])[] = SELECTABLE_CHARACTERS.flatMap((a) =>
  SELECTABLE_CHARACTERS.filter((b) => b !== a).map((b) => [a, b] as const));
const STAGES = Object.keys(FIELD_STAGES);

/** `matches` seeded matches of `level` against `opponent`; match k plays seed k. */
export function playLevels(level: number, opponent: number, matches: number, { stocks = 3, minutes = 4 } = {}): LevelResult {
  let wins = 0;
  let losses = 0;
  let ties = 0;
  for (let k = 0; k < matches; k++) {
    const pair = PAIRS[k % PAIRS.length];
    const stage = STAGES[Math.floor(k / PAIRS.length) % STAGES.length];
    if (pair === undefined || stage === undefined) continue;
    const side = k % 2;
    const levels = side === 0 ? [level, opponent] as const : [opponent, level] as const;
    const record = playCpuMatch(pair[0], pair[1], stage, 0, { stocks, minutes, levels }, k);
    if (record === undefined) continue;
    if (record.winner === null) ties++;
    else if (record.winner === side) wins++;
    else losses++;
  }
  return { level, opponent, wins, losses, ties };
}

const percent = (wins: number, losses: number) => (wins + losses === 0 ? "-" : `${((100 * wins) / (wins + losses)).toFixed(0)}%`);

if (import.meta.main) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { matches: { type: "string" }, top: { type: "string" }, stocks: { type: "string" }, minutes: { type: "string" } },
    strict: true,
  });
  const matches = Number(values.matches ?? 20);
  const topMatches = Number(values.top ?? 100);
  const rules = { stocks: Number(values.stocks ?? 3), minutes: Number(values.minutes ?? 4) };
  const started = performance.now();
  const levels: number[] = [];
  for (let level = CPU_LEVEL_MIN; level <= CPU_LEVEL_MAX; level++) levels.push(level);
  // wins[a][b]: a's wins against b.
  const wins = levels.map(() => levels.map(() => 0));
  const ties = levels.map(() => 0);
  for (const a of levels) for (const b of levels) {
    if (b <= a) continue;
    const result = playLevels(a, b, matches, rules);
    wins[a - 1]![b - 1] = result.wins;
    wins[b - 1]![a - 1] = result.losses;
    ties[a - 1]! += result.ties;
    ties[b - 1]! += result.ties;
  }
  console.error(`round robin done, ${((performance.now() - started) / 1000).toFixed(0)} s`);
  const top = playLevels(CPU_LEVEL_MAX, CPU_LEVEL_MIN, topMatches, rules);
  console.log(`${matches} seeded matches per pair of levels, ${topMatches} for level ${CPU_LEVEL_MAX} against ${CPU_LEVEL_MIN} (${rules.stocks} stocks, ${rules.minutes}-minute clock, every ordered fighter pair and soak stage in turn), ${((performance.now() - started) / 1000).toFixed(0)} s; win rates over decisive matches.`);
  console.log("");
  console.log(`| Level | ${levels.map((level) => `vs ${level}`).join(" | ")} | Wins | Losses | Ties | Win rate vs the other levels |`);
  console.log(`| ---: |${levels.map(() => " ---: |").join("")} ---: | ---: | ---: | ---: |`);
  const rates: number[] = [];
  for (const a of levels) {
    const row = wins[a - 1]!;
    const won = row.reduce((sum, count) => sum + count, 0);
    const lost = levels.reduce((sum, b) => sum + wins[b - 1]![a - 1]!, 0);
    rates.push(won / Math.max(1, won + lost));
    const cells = levels.map((b) => (a === b ? "-" : percent(row[b - 1]!, wins[b - 1]![a - 1]!)));
    console.log(`| ${a} | ${cells.join(" | ")} | ${won} | ${lost} | ${ties[a - 1]} | ${percent(won, lost)} |`);
  }
  const rising = rates.every((rate, index) => index === 0 || rate > (rates[index - 1] ?? 1));
  console.log("");
  console.log(`Win rate against the other levels rises at every level: ${rising ? "yes" : "no"}. Level ${CPU_LEVEL_MAX} beat level ${CPU_LEVEL_MIN} in ${top.wins} of ${topMatches} (${top.losses} losses, ${top.ties} ties).`);
}
