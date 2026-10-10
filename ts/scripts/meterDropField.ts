import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { type FieldOptions, type MatchRecord, playCpuMatch } from "./cpuField";
import { type Character } from "../src/game/sim/codes";
import { SELECTABLE_CHARACTERS, selectableCharacterBySlug } from "../src/game/sim/heroes/registry";
import { isCpuTier, type CpuTier } from "../src/game/match/cpuProfiles";

interface DropFieldSummary {
  readonly matches: number;
  readonly apartShare: number;
  readonly apartOnStageShare: number;
  readonly dropsTaken: number;
  readonly winRates: Readonly<Record<string, number>>;
  readonly winRateSpread: number;
}

function summarizeDropField(records: readonly MatchRecord[]): DropFieldSummary {
  let apart = 0, onStage = 0, both = 0, taken = 0;
  const wins: Record<string, number> = {};
  const decisive: Record<string, number> = {};
  for (const record of records) {
    apart += record.apartFrames;
    onStage += record.apartOnStageFrames;
    both += record.bothInFrames;
    taken += record.dropsTaken[0] + record.dropsTaken[1];
    if (record.winner === null) continue;
    for (const side of [0, 1] as const) {
      const fighter = record.fighters[side];
      decisive[fighter] = (decisive[fighter] ?? 0) + 1;
      if (record.winner === side) wins[fighter] = (wins[fighter] ?? 0) + 1;
    }
  }
  const winRates: Record<string, number> = {};
  for (const fighter of Object.keys(decisive).sort()) winRates[fighter] = (wins[fighter] ?? 0) / (decisive[fighter] ?? 1);
  const rates = Object.values(winRates);
  const winRateSpread = rates.length === 0 ? 0 : Math.max(...rates) - Math.min(...rates);
  return { matches: records.length, apartShare: both === 0 ? 0 : apart / both, apartOnStageShare: both === 0 ? 0 : onStage / both, dropsTaken: taken, winRates, winRateSpread };
}

/** Every unordered pair once; the side each fighter starts on alternates with the pair's index so neither slot is favoured. */
function fieldPairs(fighters: readonly Character[]): (readonly [Character, Character])[] {
  const pairs: (readonly [Character, Character])[] = [];
  for (const [first, a] of fighters.entries()) for (const b of fighters.slice(first + 1)) pairs.push(pairs.length % 2 === 0 ? [a, b] : [b, a]);
  return pairs;
}

interface ShardFile {
  readonly shard: string;
  readonly camp: boolean;
  readonly off: MatchRecord[];
  readonly on: MatchRecord[];
}

const isShardFile = (value: unknown): value is ShardFile =>
  typeof value === "object" && value !== null && "off" in value && "on" in value && "camp" in value;

if (import.meta.main) {
  const { values } = parseArgs({ options: { fighters: { type: "string" }, stages: { type: "string" }, seeds: { type: "string" }, "seed-offset": { type: "string" }, tier: { type: "string" }, minutes: { type: "string" }, camp: { type: "boolean" }, shard: { type: "string" }, json: { type: "string" }, merge: { type: "string" } } });
  const pct = (n: number) => `${(100 * n).toFixed(1)}%`;
  const report = (off: MatchRecord[], on: MatchRecord[]) => {
    const offSummary = summarizeDropField(off);
    const onSummary = summarizeDropField(on);
    console.log(`matches ${offSummary.matches} per drop setting; frames more than half a stage apart: drops off ${pct(offSummary.apartShare)}, drops on ${pct(onSummary.apartShare)}; both on the main deck: off ${pct(offSummary.apartOnStageShare)}, on ${pct(onSummary.apartOnStageShare)}; drops taken ${onSummary.dropsTaken}`);
    console.log(`per-fighter win-rate spread (max minus min): drops off ${pct(offSummary.winRateSpread)}, drops on ${pct(onSummary.winRateSpread)}`);
    console.log("fighter\toff\ton");
    for (const fighter of Object.keys(onSummary.winRates)) console.log(`${fighter}\t${pct(offSummary.winRates[fighter] ?? 0)}\t${pct(onSummary.winRates[fighter] ?? 0)}`);
  };
  if (values.merge !== undefined) {
    const shards = values.merge.split(",").map((file) => {
      const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
      if (!isShardFile(parsed)) throw new Error(`${file} is not a meterDropField shard`);
      return parsed;
    });
    const camps = new Set(shards.map((shard) => shard.camp));
    if (camps.size !== 1) throw new Error("shards mix camp and no-camp runs");
    console.log(`Merged ${shards.length} shard(s) of ${values.merge}; camping ${shards[0]?.camp === true ? "on" : "off"}.`);
    report(shards.flatMap((shard) => shard.off), shards.flatMap((shard) => shard.on));
  } else {
    const fighters = values.fighters === undefined ? SELECTABLE_CHARACTERS : values.fighters.split(",").map((slug) => {
      const character = selectableCharacterBySlug(slug);
      if (character === undefined) throw new Error(`no fighter ${slug}`);
      return character;
    });
    const tier: CpuTier = values.tier !== undefined && isCpuTier(values.tier) ? values.tier : "expert";
    const [shardIndex, shardCount] = (values.shard ?? "0/1").split("/").map(Number);
    if (shardIndex === undefined || shardCount === undefined || !(shardCount >= 1) || !(shardIndex >= 0 && shardIndex < shardCount)) throw new Error("--shard takes K/N with 0 <= K < N");
    const base: FieldOptions = {
      tiers: [tier, tier], minutes: Number(values.minutes ?? 4), camp: values.camp === true,
    };
    const stages = values.stages?.split(",") ?? ["frozen-throne"];
    const seed = Number(values["seed-offset"] ?? 0);
    const pairs = fieldPairs(fighters).filter((_, index) => index % shardCount === shardIndex);
    const play = (drops: boolean) => pairs.flatMap(([a, b]) => stages.map((stage) => playCpuMatch(a, b, stage, 0, { ...base, drops }, seed))).filter((record): record is MatchRecord => record !== undefined);
    const started = performance.now();
    const off = play(false);
    const on = play(true);
    console.error(`shard ${shardIndex}/${shardCount}: ${pairs.length} pairs, ${off.length} matches per setting, ${((performance.now() - started) / 1000).toFixed(0)} s`);
    if (values.json !== undefined) writeFileSync(values.json, `${JSON.stringify({ shard: `${shardIndex}/${shardCount}`, camp: base.camp, off, on })}\n`);
    report(off, on);
  }
}
