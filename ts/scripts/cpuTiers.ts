






import { parseArgs } from "node:util";
import { CPU_TIERS, type CpuTier } from "../src/game/match/cpuProfiles";
import type { Character } from "../src/game/sim/codes";
import { SELECTABLE_CHARACTERS } from "../src/game/sim/heroes/registry";
import { FIELD_STAGES, playCpuMatch } from "./cpuField";
import { runAdmitted } from "./heavyCapacity";

interface TierResult {
  readonly tier: CpuTier;
  readonly opponent: CpuTier;
  readonly wins: number;
  readonly losses: number;
  readonly ties: number;
}

const PAIRS: readonly (readonly [Character, Character])[] = SELECTABLE_CHARACTERS.flatMap((a) =>
  SELECTABLE_CHARACTERS.filter((b) => b !== a).map((b) => [a, b] as const));
const STAGES = Object.keys(FIELD_STAGES);


function playTiers(tier: CpuTier, opponent: CpuTier, matches: number, { stocks = 3, minutes = 4 } = {}): TierResult {
  let wins = 0;
  let losses = 0;
  let ties = 0;
  for (let k = 0; k < matches; k++) {
    const pair = PAIRS[k % PAIRS.length];
    const stage = STAGES[Math.floor(k / PAIRS.length) % STAGES.length];
    if (pair === undefined || stage === undefined) continue;
    const side = k % 2;
    const tiers = side === 0 ? [tier, opponent] as const : [opponent, tier] as const;
    const record = playCpuMatch(pair[0], pair[1], stage, 0, { stocks, minutes, opponents: ["wren", "wren"], tiers }, k);
    if (record === undefined) continue;
    if (record.winner === null) ties++;
    else if (record.winner === side) wins++;
    else losses++;
  }
  return { tier, opponent, wins, losses, ties };
}

const percent = (wins: number, losses: number) => (wins + losses === 0 ? "-" : `${((100 * wins) / (wins + losses)).toFixed(0)}%`);

if (import.meta.main) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { matches: { type: "string" }, top: { type: "string" }, stocks: { type: "string" }, minutes: { type: "string" } },
    strict: true,
  });
  await runAdmitted("moderate", "smashcraft:cpuTiers", 3600);
  const matches = Number(values.matches ?? 20);
  const topMatches = Number(values.top ?? 100);
  const rules = { stocks: Number(values.stocks ?? 3), minutes: Number(values.minutes ?? 4) };
  const started = performance.now();
  const tiers = CPU_TIERS;

  const wins = new Map<string, number>();
  const ties = new Map<CpuTier, number>();
  const winsOf = (a: CpuTier, b: CpuTier) => wins.get(`${a}:${b}`) ?? 0;
  const tiesOf = (tier: CpuTier) => ties.get(tier) ?? 0;
  for (const a of tiers) for (const b of tiers) {
    if (CPU_TIERS.indexOf(b) <= CPU_TIERS.indexOf(a)) continue;
    const result = playTiers(a, b, matches, rules);
    wins.set(`${a}:${b}`, result.wins);
    wins.set(`${b}:${a}`, result.losses);
    ties.set(a, tiesOf(a) + result.ties);
    ties.set(b, tiesOf(b) + result.ties);
  }
  console.error(`round robin done, ${((performance.now() - started) / 1000).toFixed(0)} s`);
  const top = playTiers("expert", "rookie", topMatches, rules);
  console.log(`${matches} seeded matches per pair of tiers, ${topMatches} for Expert against Rookie (${rules.stocks} stocks, ${rules.minutes}-minute clock, every ordered fighter pair and soak stage in turn), ${((performance.now() - started) / 1000).toFixed(0)} s; win rates over decisive matches.`);
  console.log("");
  console.log(`| Difficulty | ${tiers.map((tier) => `vs ${tier}`).join(" | ")} | Wins | Losses | Ties | Win rate vs the other tiers |`);
  console.log(`| ---: |${tiers.map(() => " ---: |").join("")} ---: | ---: | ---: | ---: |`);
  const rates: number[] = [];
  for (const a of tiers) {
    const won = tiers.reduce((sum, b) => sum + winsOf(a, b), 0);
    const lost = tiers.reduce((sum, b) => sum + winsOf(b, a), 0);
    rates.push(won / Math.max(1, won + lost));
    const cells = tiers.map((b) => (a === b ? "-" : percent(winsOf(a, b), winsOf(b, a))));
    console.log(`| ${a} | ${cells.join(" | ")} | ${won} | ${lost} | ${tiesOf(a)} | ${percent(won, lost)} |`);
  }
  const rising = rates.every((rate, index) => index === 0 || rate > (rates[index - 1] ?? 1));
  console.log("");
  console.log(`Win rate against the other tiers rises at every tier: ${rising ? "yes" : "no"}. Expert beat tier ${"rookie"} in ${top.wins} of ${topMatches} (${top.losses} losses, ${top.ties} ties).`);
}
