export type Direction = "top" | "side" | "bottom";
export const DIRECTIONS: readonly Direction[] = ["top", "side", "bottom"];

export interface StockLoss { readonly selfDestruct: boolean; readonly blast?: Direction; readonly percent?: number; readonly recovering?: boolean }
export interface ProfileSide {
  readonly fighter: string;
  readonly stocksPlayed: number;
  readonly stockLosses: readonly StockLoss[];
  readonly kosByMove: Readonly<Record<number, number>>;
  readonly damageDealt: number;
  readonly rangedDamage: number;
  readonly edges: { readonly edgeGuardHits: number; readonly edgeGuardKills: number };
  readonly hitDistances?: Readonly<Record<number, number>>;
}
export interface ProfileMatch { readonly sides: readonly [ProfileSide, ProfileSide] }

export interface Intent {
  readonly fighter: string;
  readonly kill: Direction | "mixed";
  readonly edgeGuard: "strong" | "average" | "weak";
  readonly recovery: "hard" | "average" | "exploitable";
  readonly range: "close" | "mid" | "far";
}

export interface Profile {
  readonly fighter: string;
  readonly matches: number;
  readonly kos: number;
  readonly koShare: Readonly<Record<Direction, number>>;
  readonly koShareMeasured: boolean;
  readonly averageKoPercent: number | undefined;
  readonly offstageDeathsPerStock: number;
  readonly edgeGuardKillsPerMatch: number;
  readonly edgeGuardConversion: number;
  readonly medianHitDistance: number | undefined;
  readonly rangedShare: number;
}

interface Tally {
  matches: number; kos: number; measuredKos: number; koPercentSum: number; koPercentCount: number;
  directions: Record<Direction, number>; stocks: number; offstageDeaths: number;
  edgeGuardKills: number; edgeGuardHits: number; damage: number; ranged: number; distances: Record<number, number>; distanceRecorded: boolean;
}

const emptyTally = (): Tally => ({ matches: 0, kos: 0, measuredKos: 0, koPercentSum: 0, koPercentCount: 0, directions: { top: 0, side: 0, bottom: 0 }, stocks: 0, offstageDeaths: 0, edgeGuardKills: 0, edgeGuardHits: 0, damage: 0, ranged: 0, distances: {}, distanceRecorded: false });

export function medianBin(histogram: Readonly<Record<number, number>>, width: number): number | undefined {
  const bins = Object.entries(histogram).map(([bin, count]) => [Number(bin), count] as const).sort((a, b) => a[0] - b[0]);
  const total = bins.reduce((sum, [, count]) => sum + count, 0);
  if (total === 0) return undefined;
  let seen = 0;
  for (const [bin, count] of bins) {
    seen += count;
    if (seen * 2 >= total) return (bin + 0.5) * width;
  }
  return undefined;
}

export function profiles(matches: readonly ProfileMatch[], moveDirection: (fighter: string, move: number) => Direction | undefined): Profile[] {
  const tallies = new Map<string, Tally>();
  const tally = (fighter: string): Tally => {
    const found = tallies.get(fighter) ?? emptyTally();
    tallies.set(fighter, found);
    return found;
  };
  for (const match of matches) for (const index of [0, 1] as const) {
    const own = match.sides[index], other = match.sides[index === 0 ? 1 : 0];
    const t = tally(own.fighter);
    t.matches++;
    t.stocks += own.stocksPlayed;
    t.offstageDeaths += other.edges.edgeGuardKills + own.stockLosses.filter((loss) => loss.selfDestruct && loss.recovering !== false).length;
    t.edgeGuardKills += own.edges.edgeGuardKills;
    t.edgeGuardHits += own.edges.edgeGuardHits;
    t.damage += own.damageDealt;
    t.ranged += own.rangedDamage;
    if (own.hitDistances !== undefined) {
      t.distanceRecorded = true;
      for (const [bin, count] of Object.entries(own.hitDistances)) t.distances[Number(bin)] = (t.distances[Number(bin)] ?? 0) + count;
    }
    const kos = other.stockLosses.filter((loss) => !loss.selfDestruct);
    t.kos += kos.length;
    for (const loss of kos) {
      if (loss.blast !== undefined) { t.directions[loss.blast]++; t.measuredKos++; }
      if (loss.percent !== undefined) { t.koPercentSum += loss.percent; t.koPercentCount++; }
    }
    if (kos.length > 0 && kos.every((loss) => loss.blast === undefined)) {
      for (const [move, count] of Object.entries(own.kosByMove)) {
        const direction = moveDirection(own.fighter, Number(move));
        if (direction !== undefined) t.directions[direction] += count;
      }
    }
  }
  return [...tallies].map(([fighter, t]) => {
    const directed = t.directions.top + t.directions.side + t.directions.bottom;
    const share = (direction: Direction) => directed === 0 ? 0 : t.directions[direction] / directed;
    return {
      fighter, matches: t.matches, kos: t.kos,
      koShare: { top: share("top"), side: share("side"), bottom: share("bottom") },
      koShareMeasured: t.measuredKos > 0,
      averageKoPercent: t.koPercentCount === 0 ? undefined : t.koPercentSum / t.koPercentCount,
      offstageDeathsPerStock: t.stocks === 0 ? 0 : t.offstageDeaths / t.stocks,
      edgeGuardKillsPerMatch: t.matches === 0 ? 0 : t.edgeGuardKills / t.matches,
      edgeGuardConversion: t.edgeGuardHits === 0 ? 0 : t.edgeGuardKills / t.edgeGuardHits,
      medianHitDistance: t.distanceRecorded ? medianBin(t.distances, 10) : undefined,
      rangedShare: t.damage === 0 ? 0 : t.ranged / t.damage,
    };
  }).sort((a, b) => a.fighter.localeCompare(b.fighter));
}

export type Tercile = "low" | "middle" | "high";
export function tercile(value: number, roster: readonly number[]): Tercile {
  const below = roster.filter((other) => other < value).length;
  const rank = roster.length <= 1 ? 0.5 : below / (roster.length - 1);
  return rank < 1 / 3 ? "low" : rank > 2 / 3 ? "high" : "middle";
}

export interface Contradiction { readonly fighter: string; readonly trait: string; readonly intent: string; readonly measured: string }

export function contradictions(measured: readonly Profile[], intents: readonly Intent[]): Contradiction[] {
  const found: Contradiction[] = [];
  const pct = (value: number) => `${Math.round(100 * value)}%`;
  const metric = (pick: (profile: Profile) => number | undefined) => measured.flatMap((profile) => { const value = pick(profile); return value === undefined ? [] : [value]; });
  for (const intent of intents) {
    const profile = measured.find((candidate) => candidate.fighter === intent.fighter);
    if (profile === undefined) continue;
    const check = (trait: string, expected: string, value: number | undefined, pick: (profile: Profile) => number | undefined, wantHigh: boolean | undefined, shown: string) => {
      if (value === undefined || wantHigh === undefined) return;
      const place = tercile(value, metric(pick));
      if ((wantHigh && place === "low") || (!wantHigh && place === "high")) found.push({ fighter: intent.fighter, trait, intent: expected, measured: `${shown} (roster ${place} third)` });
    };
    check("edge-guard power", intent.edgeGuard, profile.edgeGuardKillsPerMatch, (p) => p.edgeGuardKillsPerMatch, intent.edgeGuard === "strong" ? true : intent.edgeGuard === "weak" ? false : undefined, `${profile.edgeGuardKillsPerMatch.toFixed(2)} edge-guard kills a match`);
    check("hard to edge-guard", intent.recovery, profile.offstageDeathsPerStock, (p) => p.offstageDeathsPerStock, intent.recovery === "hard" ? false : intent.recovery === "exploitable" ? true : undefined, `${pct(profile.offstageDeathsPerStock)} of stocks lost off stage`);
    if (intent.kill === "side" && profile.koShare.side < 0.5) found.push({ fighter: intent.fighter, trait: "KOs off the side", intent: "side", measured: `${pct(profile.koShare.side)} of KOs off the side${profile.koShareMeasured ? "" : " (est.)"}` });
    if (intent.kill === "top" || intent.kill === "bottom") {
      const direction = intent.kill;
      check(`KOs off the ${direction}`, direction, profile.koShare[direction], (p) => p.koShare[direction], true, `${pct(profile.koShare[direction])} of KOs off the ${direction}${profile.koShareMeasured ? "" : " (est.)"}`);
    }
    const spacing = profile.medianHitDistance ?? profile.rangedShare;
    const spacingShown = profile.medianHitDistance === undefined ? `${pct(profile.rangedShare)} ranged damage` : `median hit at ${profile.medianHitDistance.toFixed(0)} Melee units`;
    check("spacing", intent.range, spacing, (p) => p.medianHitDistance ?? p.rangedShare, intent.range === "far" ? true : intent.range === "close" ? false : undefined, spacingShown);
  }
  return found;
}
