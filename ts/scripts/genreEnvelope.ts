export const MOVE_CLASSES = ["jab", "tilt", "dash-attack", "smash", "aerial", "special", "grab", "throw", "getup-ledge", "spot-dodge", "roll", "shield-drop", "jump-squat"] as const;
export type MoveClass = (typeof MOVE_CLASSES)[number];
export const FIELDS = ["startup", "active", "endLag", "landingLag", "shieldAdvantage", "killPercent", "total"] as const;
export type Field = (typeof FIELDS)[number];
type Tier = "normal" | "special" | "ex";

export type Measures = Partial<Record<Field, number>>;
export interface Range { readonly low: number; readonly high: number }
export type Envelope = Partial<Record<MoveClass, Partial<Record<Field, Range>>>>;

interface Tolerance { readonly frames: number; readonly shieldAdvantage: number; readonly killPercentShare: number }
export interface Tolerances extends Tolerance { readonly special: Tolerance; readonly ex: Tolerance }

export interface Sample { readonly source: string; readonly moveClass: MoveClass; readonly measures: Measures }
export interface MoveRow { readonly fighter: string; readonly move: string; readonly measures: Measures }
interface FieldMiss { readonly field: Field; readonly value: number; readonly range: Range; readonly excess: number; readonly allowance: number }
export interface Outlier { readonly fighter: string; readonly move: string; readonly moveClass: MoveClass; readonly tier: Tier; readonly distance: number; readonly misses: readonly FieldMiss[] }

const NORMAL_CLASSES: Readonly<Record<string, MoveClass>> = {
  jab: "jab", jab2: "jab", jab3: "jab",
  forwardTilt: "tilt", forwardTiltUp: "tilt", forwardTiltDown: "tilt", upTilt: "tilt", downTilt: "tilt",
  dashAttack: "dash-attack", demonHunterDashAttack: "dash-attack",
  forwardSmash: "smash", upSmash: "smash", downSmash: "smash",
  neutralAir: "aerial", forwardAir: "aerial", backAir: "aerial", upAir: "aerial", downAir: "aerial",
  getupAttack: "getup-ledge", ledgeAttack: "getup-ledge",
  grab: "grab", shot: "special",
};

export function classify(move: string): { readonly moveClass: MoveClass; readonly tier: Tier } | undefined {
  const [head, ...rest] = move.split(".");
  if (head === "normal") {
    const moveClass = NORMAL_CLASSES[rest[0] ?? ""];
    return moveClass === undefined ? undefined : { moveClass, tier: moveClass === "special" ? "special" : "normal" };
  }
  if (head === "special") return { moveClass: "special", tier: rest.some((part) => part === "ex" || part === "true") ? "ex" : "special" };
  if (head === "throw") return { moveClass: "throw", tier: "normal" };
  if (head === "grab") return { moveClass: "grab", tier: "normal" };
  const universal = MOVE_CLASSES.find((name) => name === move);
  return universal === undefined || rest.length > 0 ? undefined : { moveClass: universal, tier: "normal" };
}

function percentile(sorted: readonly number[], share: number): number {
  if (sorted.length === 0) return Number.NaN;
  const position = (sorted.length - 1) * share;
  const below = Math.floor(position);
  const lower = sorted[below] ?? Number.NaN;
  const upper = sorted[Math.min(sorted.length - 1, below + 1)] ?? lower;
  return lower + (upper - lower) * (position - below);
}

export function buildEnvelope(samples: readonly Sample[], fixed: readonly { readonly moveClass: MoveClass; readonly field: Field; readonly range: Range }[], low = 0.05, high = 0.95): Envelope {
  const pools = new Map<string, number[]>();
  for (const sample of samples) for (const field of FIELDS) {
    const value = sample.measures[field];
    if (value === undefined || !Number.isFinite(value)) continue;
    const key = `${sample.moveClass}|${field}|${sample.source}`;
    const pool = pools.get(key) ?? [];
    pool.push(value);
    pools.set(key, pool);
  }
  const envelope: Partial<Record<MoveClass, Partial<Record<Field, Range>>>> = {};
  const widen = (moveClass: MoveClass, field: Field, range: Range): void => {
    const fields = envelope[moveClass] ?? {};
    const prior = fields[field];
    fields[field] = prior === undefined ? range : { low: Math.min(prior.low, range.low), high: Math.max(prior.high, range.high) };
    envelope[moveClass] = fields;
  };
  for (const [key, pool] of pools) {
    const [moveClass, field] = key.split("|") as [MoveClass, Field];
    const sorted = [...pool].sort((a, b) => a - b);
    widen(moveClass, field, { low: Math.round(percentile(sorted, low)), high: Math.round(percentile(sorted, high)) });
  }
  for (const { moveClass, field, range } of fixed) widen(moveClass, field, range);
  return envelope;
}

export function allowance(field: Field, range: Range, tier: Tier, tolerances: Tolerances): number {
  const tolerance = tier === "ex" ? tolerances.ex : tier === "special" ? tolerances.special : tolerances;
  if (field === "shieldAdvantage") return tolerance.shieldAdvantage;
  if (field === "killPercent") return tolerance.killPercentShare * Math.max(Math.abs(range.low), Math.abs(range.high));
  return tolerance.frames;
}

function fieldMiss(field: Field, value: number, range: Range, tier: Tier, tolerances: Tolerances): FieldMiss {
  const excess = Math.max(range.low - value, value - range.high, 0);
  return { field, value, range, excess, allowance: allowance(field, range, tier, tolerances) };
}

export function outliers(rows: readonly MoveRow[], envelope: Envelope, tolerances: Tolerances, noKillValue = Number.POSITIVE_INFINITY): Outlier[] {
  const found: Outlier[] = [];
  for (const row of rows) {
    const kind = classify(row.move);
    if (kind === undefined) continue;
    const ranges = envelope[kind.moveClass] ?? {};
    const misses: FieldMiss[] = [];
    for (const field of FIELDS) {
      const range = ranges[field];
      if (range === undefined) continue;
      const measured = row.measures[field];
      const value = measured ?? (field === "killPercent" && kind.moveClass === "smash" && kind.tier === "normal" && "shieldAdvantage" in row.measures ? noKillValue : undefined);
      if (value === undefined) continue;
      const miss = fieldMiss(field, value, range, kind.tier, tolerances);
      if (miss.excess > miss.allowance) misses.push(miss);
    }
    if (misses.length === 0) continue;
    const distance = Math.max(...misses.map((miss) => Number.isFinite(miss.excess) ? miss.excess / miss.allowance : 10));
    found.push({ fighter: row.fighter, move: row.move, moveClass: kind.moveClass, tier: kind.tier, distance, misses });
  }
  return found.sort((a, b) => b.distance - a.distance || a.fighter.localeCompare(b.fighter) || a.move.localeCompare(b.move));
}
