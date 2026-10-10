import { parseArgs } from "node:util";
import { type FieldOptions, type MatchRecord, playCpuField } from "./cpuField";
import { SELECTABLE_CHARACTERS, selectableCharacterBySlug } from "../src/game/sim/heroes/registry";
import { isCpuTier, type CpuTier } from "../src/game/match/cpuProfiles";

interface DropFieldSummary {
  readonly matches: number;
  readonly apartShare: number;
  readonly apartOnStageShare: number;
  readonly dropsTaken: number;
  readonly winRates: Readonly<Record<string, number>>;
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
  return { matches: records.length, apartShare: both === 0 ? 0 : apart / both, apartOnStageShare: both === 0 ? 0 : onStage / both, dropsTaken: taken, winRates };
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { fighters: { type: "string" }, stages: { type: "string" }, seeds: { type: "string" }, "seed-offset": { type: "string" }, tier: { type: "string" }, minutes: { type: "string" } } });
  const fighters = values.fighters === undefined ? SELECTABLE_CHARACTERS : values.fighters.split(",").map(slug => {
    const character = selectableCharacterBySlug(slug);
    if (character === undefined) throw new Error(`no fighter ${slug}`);
    return character;
  });
  const tier: CpuTier = values.tier !== undefined && isCpuTier(values.tier) ? values.tier : "expert";
  const base: FieldOptions = {
    fighters, stages: values.stages?.split(",") ?? ["frozen-throne", "wind", "hellfire", "stratholme"], seeds: Number(values.seeds ?? 1),
    seedOffset: Number(values["seed-offset"] ?? 0), tiers: [tier, tier], minutes: Number(values.minutes ?? 4),
  };
  const off = summarizeDropField(playCpuField({ ...base, drops: false }));
  const on = summarizeDropField(playCpuField({ ...base, drops: true }));
  const pct = (n: number) => `${(100 * n).toFixed(1)}%`;
  console.log(`matches ${off.matches} a side; frames more than half a stage apart: drops off ${pct(off.apartShare)}, drops on ${pct(on.apartShare)}; both on the main deck: off ${pct(off.apartOnStageShare)}, on ${pct(on.apartOnStageShare)}; drops taken ${on.dropsTaken}`);
  console.log("fighter\toff\ton");
  for (const fighter of Object.keys(on.winRates)) console.log(`${fighter}\t${pct(off.winRates[fighter] ?? 0)}\t${pct(on.winRates[fighter] ?? 0)}`);
}
