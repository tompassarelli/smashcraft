import { parseArgs } from "node:util";
import { type FieldOptions, type MatchRecord, playCpuField } from "./cpuField";
import { DROP_VARIANTS, type DropVariant, isDropVariant } from "./dropVariants";
import { SELECTABLE_CHARACTERS, selectableCharacterBySlug } from "../src/game/sim/heroes/registry";
import { isCpuTier, type CpuTier } from "../src/game/match/cpuProfiles";

// #385's camping field: the fighter ahead on stocks camps, with drops off,
// the shipped drops and each field variant, on the same matches. Shards run
// as child processes (--workers, at most 4) over interleaved fighter pairs.

export const CAMPING_RULES = ["off", ...DROP_VARIANTS] as const;
export type CampingRule = (typeof CAMPING_RULES)[number];
const isCampingRule = (value: string): value is CampingRule => value === "off" || isDropVariant(value);

export interface CampingMatch {
  readonly key: string;
  readonly fighters: readonly [string, string];
  readonly winner: number | null;
  readonly apartFrames: number;
  readonly bothInFrames: number;
  readonly campFrames: number;
  readonly dropsTaken: number;
}

function isShardOutput(value: unknown): value is Record<string, CampingMatch[]> {
  return typeof value === "object" && value !== null && Object.values(value).every((matches: unknown) => Array.isArray(matches)
    && matches.every((match: unknown) => typeof match === "object" && match !== null && "key" in match && "fighters" in match && "apartFrames" in match && "campFrames" in match));
}

const compact = (record: MatchRecord): CampingMatch => ({
  key: `${record.fighters[0]}/${record.fighters[1]}/${record.stage}/${record.seed}/${record.variant}`,
  fighters: record.fighters, winner: record.winner, apartFrames: record.apartFrames, bothInFrames: record.bothInFrames,
  campFrames: record.campFrames[0] + record.campFrames[1], dropsTaken: record.dropsTaken[0] + record.dropsTaken[1],
});

const ruleOptions = (rule: CampingRule): Pick<FieldOptions, "drops" | "dropVariant"> =>
  rule === "off" ? { drops: false } : rule === "shipped" ? { drops: true } : { drops: true, dropVariant: rule };

export interface CampingSummary {
  readonly matches: number;
  readonly apartShare: number;
  readonly campShare: number;
  readonly dropsPerMatch: number;
  readonly winRates: Readonly<Record<string, number>>;
  readonly winSpread: number;
  readonly winRange: readonly [number, number];
}

const deviation = (values: readonly number[]): number => {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
};

function winRates(matches: readonly CampingMatch[]): Record<string, number> {
  const wins: Record<string, number> = {}, decisive: Record<string, number> = {};
  for (const match of matches) {
    if (match.winner === null) continue;
    for (const side of [0, 1] as const) {
      const fighter = match.fighters[side];
      decisive[fighter] = (decisive[fighter] ?? 0) + 1;
      if (match.winner === side) wins[fighter] = (wins[fighter] ?? 0) + 1;
    }
  }
  return Object.fromEntries(Object.keys(decisive).sort().map(fighter => [fighter, (wins[fighter] ?? 0) / (decisive[fighter] ?? 1)]));
}

/** The win spread is the standard deviation of the per-fighter win rates. */
export function summarizeCamping(matches: readonly CampingMatch[]): CampingSummary {
  let apart = 0, both = 0, camp = 0, drops = 0;
  for (const match of matches) {
    apart += match.apartFrames;
    both += match.bothInFrames;
    camp += match.campFrames;
    drops += match.dropsTaken;
  }
  const rates = winRates(matches);
  const values = Object.values(rates);
  return {
    matches: matches.length, apartShare: both === 0 ? 0 : apart / both, campShare: both === 0 ? 0 : camp / both, dropsPerMatch: drops / Math.max(1, matches.length),
    winRates: rates, winSpread: values.length === 0 ? 0 : deviation(values), winRange: values.length === 0 ? [0, 0] : [Math.min(...values), Math.max(...values)],
  };
}

/** A seeded 95% bootstrap interval for (rule - off) of the apart share and the win spread, resampling the paired matches. */
export function pairedIntervals(off: readonly CampingMatch[], rule: readonly CampingMatch[], resamples = 1000): { apart: readonly [number, number]; spread: readonly [number, number] } {
  const byKey = new Map(rule.map(match => [match.key, match]));
  const pairs = off.flatMap(match => { const other = byKey.get(match.key); return other === undefined ? [] : [[match, other] as const]; });
  let state = 385;
  const next = () => (state = (Math.imul(state, 1103515245) + 12345) >>> 0) % pairs.length;
  const apart: number[] = [], spread: number[] = [];
  for (let draw = 0; draw < resamples; draw++) {
    const a: CampingMatch[] = [], b: CampingMatch[] = [];
    for (let index = 0; index < pairs.length; index++) {
      const pair = pairs[next()];
      if (pair === undefined) continue;
      a.push(pair[0]);
      b.push(pair[1]);
    }
    const sa = summarizeCamping(a), sb = summarizeCamping(b);
    apart.push(sb.apartShare - sa.apartShare);
    spread.push(sb.winSpread - sa.winSpread);
  }
  const interval = (values: number[]): readonly [number, number] => {
    values.sort((x, y) => x - y);
    return [values[Math.floor(0.025 * values.length)] ?? 0, values[Math.floor(0.975 * values.length)] ?? 0];
  };
  return { apart: interval(apart), spread: interval(spread) };
}

const OPTIONS = {
  fighters: { type: "string" }, stages: { type: "string" }, seeds: { type: "string" }, tier: { type: "string" }, minutes: { type: "string" },
  rules: { type: "string" }, workers: { type: "string" }, shard: { type: "string" },
} as const;

if (import.meta.main) {
  const { values } = parseArgs({ options: OPTIONS });
  const rules = (values.rules?.split(",") ?? [...CAMPING_RULES]).map(rule => {
    if (!isCampingRule(rule)) throw new Error(`no drop rule ${rule}; one of ${CAMPING_RULES.join(", ")}`);
    return rule;
  });
  if (values.shard !== undefined) {
    const [index, count] = values.shard.split("/").map(Number);
    const fighters = values.fighters === undefined ? SELECTABLE_CHARACTERS : values.fighters.split(",").map(slug => {
      const character = selectableCharacterBySlug(slug);
      if (character === undefined) throw new Error(`no fighter ${slug}`);
      return character;
    });
    const pairs = fighters.flatMap((a, first) => fighters.slice(first + 1).map(b => [a, b] as const)).filter((_, pair) => pair % (count ?? 1) === index);
    const tier: CpuTier = values.tier !== undefined && isCpuTier(values.tier) ? values.tier : "expert";
    const base: FieldOptions = { pairs, stages: values.stages?.split(",") ?? ["frozen-throne", "hellfire"], seeds: Number(values.seeds ?? 1), tiers: [tier, tier], minutes: Number(values.minutes ?? 4), camp: true };
    const out: Record<string, CampingMatch[]> = {};
    for (const rule of rules) out[rule] = playCpuField({ ...base, ...ruleOptions(rule) }).map(compact);
    process.stdout.write(JSON.stringify(out));
  } else {
    const workers = Math.min(4, Number(values.workers ?? 4));
    const passed = Object.entries(values).flatMap(([name, value]) => name === "workers" || value === undefined ? [] : [`--${name}`, String(value)]);
    const started = performance.now();
    const shards = await Promise.all(Array.from({ length: workers }, async (_, index) => {
      const child = Bun.spawn(["bun", import.meta.path, ...passed, "--shard", `${index}/${workers}`], { stdout: "pipe", stderr: "inherit" });
      const text = await new Response(child.stdout).text();
      if (await child.exited !== 0) throw new Error(`shard ${index} failed`);
      const parsed: unknown = JSON.parse(text);
      if (!isShardOutput(parsed)) throw new Error(`shard ${index} printed no camping matches`);
      return parsed;
    }));
    const by = Object.fromEntries(rules.map(rule => [rule, shards.flatMap(shard => shard[rule] ?? [])]));
    const pct = (n: number) => `${(100 * n).toFixed(1)}%`;
    const pp = (n: number) => `${n >= 0 ? "+" : ""}${(100 * n).toFixed(1)}`;
    const off = by.off;
    console.log(`camping field: ${by[rules[0] ?? "off"]?.length ?? 0} matches per rule (every pair of ${values.fighters?.split(",").length ?? SELECTABLE_CHARACTERS.length} fighters, both sides, stages ${values.stages ?? "frozen-throne,hellfire"}, ${values.seeds ?? 1} seed(s), ${values.tier ?? "expert"} vs ${values.tier ?? "expert"}, ${values.minutes ?? 4} min), ${workers} workers, ${((performance.now() - started) / 1000).toFixed(0)} s`);
    console.log("| rule | apart | Δ apart vs off (95% CI) | win spread (SD) | Δ spread vs off (95% CI) | win range | camping | drops/match |");
    console.log("|---|---|---|---|---|---|---|---|");
    for (const rule of rules) {
      const matches = by[rule] ?? [];
      const summary = summarizeCamping(matches);
      const ci = off === undefined || rule === "off" ? undefined : pairedIntervals(off, matches);
      const delta = (now: number, before: number, interval: readonly [number, number] | undefined) => interval === undefined ? "—" : `${pp(now - before)} pp [${pp(interval[0])}, ${pp(interval[1])}]`;
      const before = off === undefined ? undefined : summarizeCamping(off);
      console.log(`| ${rule} | ${pct(summary.apartShare)} | ${delta(summary.apartShare, before?.apartShare ?? 0, ci?.apart)} | ${(100 * summary.winSpread).toFixed(1)} pp | ${delta(summary.winSpread, before?.winSpread ?? 0, ci?.spread)} | ${pct(summary.winRange[0])}–${pct(summary.winRange[1])} | ${pct(summary.campShare)} | ${summary.dropsPerMatch.toFixed(1)} |`);
    }
  }
}
