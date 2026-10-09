export interface MatchSpec {
  readonly index: number;
  readonly seed: number;
  readonly a: string;
  readonly b: string;
  readonly stage: string;
  readonly tier: string;
}

export interface Observation {
  readonly frames: number;
  readonly ended: boolean;
  readonly winner: number | null;
  readonly timedOut: boolean;
  readonly stockLosses: number;
  readonly strings: readonly { readonly victim: number; readonly frame: number; readonly hits: number; readonly damage: number }[];
  readonly checksums: readonly (readonly [number, string])[];
  readonly kos: readonly { readonly fighter: string; readonly move: string; readonly count: number }[];
}

export interface Run {
  readonly spec: MatchSpec;
  readonly first: Observation;
  readonly second: Observation | undefined;
  readonly wallMs: number;
}

export type Play = (spec: MatchSpec, frameCap: number) => Observation;

export const FINDING_KINDS = ["never-ends", "zero-to-death", "win-rate-band", "move-share", "stage-no-kos", "desync"] as const;
export type FindingKind = (typeof FINDING_KINDS)[number];

export interface Finding {
  readonly kind: FindingKind;
  readonly subject: string;
  readonly detail: string;
  readonly spec?: MatchSpec;
  readonly frame?: number;
}

export interface Config {
  readonly frameCap: number;
  readonly minStringHits: number;
  readonly winLow: number;
  readonly winHigh: number;
  readonly minDecisive: number;
  readonly moveShareMax: number;
  readonly minMoveKos: number;
  readonly minStageMatches: number;
}

export const DEFAULT_CONFIG: Config = {
  frameCap: 14700,
  minStringHits: 3,
  winLow: 0.35,
  winHigh: 0.65,
  minDecisive: 30,
  moveShareMax: 0.5,
  minMoveKos: 15,
  minStageMatches: 5,
};

export interface Roster {
  readonly fighters: readonly string[];
  readonly stages: readonly string[];
  readonly tiers: readonly string[];
}

export function planMatches(roster: Roster, first: number, count: number): MatchSpec[] {
  const { fighters, stages, tiers } = roster;
  if (fighters.length < 2 || stages.length === 0 || tiers.length === 0) throw new Error("a plan needs two fighters, a stage and a tier");
  const specs: MatchSpec[] = [];
  for (let index = first; index < first + count; index++) {
    const a = index % fighters.length;
    const round = Math.floor(index / fighters.length);
    const b = (a + 1 + (round % (fighters.length - 1))) % fighters.length;
    specs.push({ index, seed: index, a: fighters[a] ?? "", b: fighters[b] ?? "", stage: stages[index % stages.length] ?? "", tier: tiers[index % tiers.length] ?? "" });
  }
  return specs;
}

export function shardRanges(total: number, shards: number): { readonly first: number; readonly count: number }[] {
  const used = Math.max(1, Math.min(shards, total));
  const base = Math.floor(total / used);
  const extra = total % used;
  const ranges: { first: number; count: number }[] = [];
  let first = 0;
  for (let shard = 0; shard < used; shard++) {
    const count = base + (shard < extra ? 1 : 0);
    ranges.push({ first, count });
    first += count;
  }
  return ranges;
}

export function runPlaytest(specs: readonly MatchSpec[], play: Play, frameCap: number, repeat: boolean, clock: () => number): Run[] {
  return specs.map((spec) => {
    const started = clock();
    const first = play(spec, frameCap);
    const second = repeat ? play(spec, frameCap) : undefined;
    return { spec, first, second, wallMs: clock() - started };
  });
}

export function matchId(spec: MatchSpec): string {
  return `${spec.a}-vs-${spec.b}@${spec.stage}/${spec.tier}#seed${spec.seed}`;
}

export function wilson(wins: number, trials: number): readonly [number, number] {
  if (trials === 0) return [0, 1];
  const z = 1.959964;
  const p = wins / trials;
  const denominator = 1 + (z * z) / trials;
  const center = (p + (z * z) / (2 * trials)) / denominator;
  const half = (z * Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials))) / denominator;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

export function firstDivergence(x: Observation, y: Observation): number | undefined {
  const length = Math.min(x.checksums.length, y.checksums.length);
  for (let i = 0; i < length; i++) {
    const left = x.checksums[i];
    const right = y.checksums[i];
    if (left !== undefined && right !== undefined && (left[0] !== right[0] || left[1] !== right[1])) return Math.min(left[0], right[0]);
  }
  if (x.checksums.length !== y.checksums.length) return x.checksums[length]?.[0] ?? y.checksums[length]?.[0] ?? Math.min(x.frames, y.frames);
  if (x.frames !== y.frames || x.winner !== y.winner || x.ended !== y.ended) return Math.min(x.frames, y.frames);
  return undefined;
}

const byRank = (x: Finding, y: Finding) => (x.kind === y.kind ? (x.spec?.index ?? 0) - (y.spec?.index ?? 0) || x.subject.localeCompare(y.subject) : FINDING_KINDS.indexOf(x.kind) - FINDING_KINDS.indexOf(y.kind));

export function classify(runs: readonly Run[], config: Config = DEFAULT_CONFIG): Finding[] {
  const findings: Finding[] = [];
  const wins = new Map<string, { wins: number; decisive: number }>();
  const stages = new Map<string, { matches: number; losses: number }>();
  const kos = new Map<string, Map<string, number>>();
  for (const { spec, first, second } of runs) {
    if (!first.ended) {
      findings.push({ kind: "never-ends", subject: matchId(spec), spec, frame: first.frames, detail: `still in play at frame ${first.frames}, the cap of ${config.frameCap}` });
    }
    for (const string of first.strings) {
      if (string.hits < config.minStringHits) continue;
      const victim = string.victim === 0 ? spec.a : spec.b;
      const attacker = string.victim === 0 ? spec.b : spec.a;
      findings.push({ kind: "zero-to-death", subject: matchId(spec), spec, frame: string.frame, detail: `${attacker} took ${victim} from 0% to a stock lost in ${string.hits} hits and ${string.damage.toFixed(0)}% by frame ${string.frame}` });
    }
    if (second !== undefined) {
      const at = firstDivergence(first, second);
      if (at !== undefined) findings.push({ kind: "desync", subject: matchId(spec), spec, frame: at, detail: `two runs of one seed differ from frame ${at}` });
    }
    const stage = stages.get(spec.stage) ?? { matches: 0, losses: 0 };
    stage.matches++;
    stage.losses += first.stockLosses;
    stages.set(spec.stage, stage);
    if (first.winner === 0 || first.winner === 1) {
      for (const [slot, name] of [[0, spec.a], [1, spec.b]] as const) {
        const row = wins.get(name) ?? { wins: 0, decisive: 0 };
        row.decisive++;
        if (first.winner === slot) row.wins++;
        wins.set(name, row);
      }
    }
    for (const ko of first.kos) {
      const moves = kos.get(ko.fighter) ?? new Map<string, number>();
      moves.set(ko.move, (moves.get(ko.move) ?? 0) + ko.count);
      kos.set(ko.fighter, moves);
    }
  }
  for (const [fighter, row] of wins) {
    if (row.decisive < config.minDecisive) continue;
    const rate = row.wins / row.decisive;
    if (rate < config.winLow || rate > config.winHigh) {
      const [low, high] = wilson(row.wins, row.decisive);
      findings.push({ kind: "win-rate-band", subject: fighter, detail: `${fighter} won ${row.wins} of ${row.decisive} decisive matches (${(100 * rate).toFixed(0)}%, 95% interval ${(100 * low).toFixed(0)}-${(100 * high).toFixed(0)}%), outside ${(100 * config.winLow).toFixed(0)}-${(100 * config.winHigh).toFixed(0)}%` });
    }
  }
  for (const [fighter, moves] of kos) {
    let total = 0;
    for (const count of moves.values()) total += count;
    if (total < config.minMoveKos) continue;
    for (const [move, count] of moves) {
      if (count / total > config.moveShareMax) {
        findings.push({ kind: "move-share", subject: `${fighter} ${move}`, detail: `${fighter}'s ${move} took ${count} of its ${total} KOs (${((100 * count) / total).toFixed(0)}%), above ${(100 * config.moveShareMax).toFixed(0)}%` });
      }
    }
  }
  for (const [stage, row] of stages) {
    if (row.matches >= config.minStageMatches && row.losses === 0) {
      findings.push({ kind: "stage-no-kos", subject: stage, detail: `${stage} saw no stock lost in ${row.matches} matches` });
    }
  }
  return findings.sort(byRank);
}

export interface Summary {
  readonly matches: number;
  readonly repeated: number;
  readonly fighters: number;
  readonly stages: number;
  readonly tiers: number;
  readonly frames: number;
  readonly wallMs: number;
  readonly msPerMatch: number;
  readonly slowestMs: number;
}

export function summarize(runs: readonly Run[]): Summary {
  const fighters = new Set<string>();
  const stages = new Set<string>();
  const tiers = new Set<string>();
  let frames = 0;
  let wallMs = 0;
  let slowestMs = 0;
  let repeated = 0;
  for (const run of runs) {
    fighters.add(run.spec.a);
    fighters.add(run.spec.b);
    stages.add(run.spec.stage);
    tiers.add(run.spec.tier);
    frames += run.first.frames;
    wallMs += run.wallMs;
    slowestMs = Math.max(slowestMs, run.wallMs);
    if (run.second !== undefined) repeated++;
  }
  return { matches: runs.length, repeated, fighters: fighters.size, stages: stages.size, tiers: tiers.size, frames, wallMs, msPerMatch: runs.length === 0 ? 0 : wallMs / runs.length, slowestMs };
}

export function shardsFor(matches: number, msPerMatch: number, cores: number, targetMinutes: number): number {
  const perCore = Math.max(1, Math.floor((targetMinutes * 60000) / Math.max(1, msPerMatch)));
  return Math.max(1, Math.ceil(matches / (perCore * cores)));
}

const LIST_LIMIT = 25;

export function issueBody(kind: FindingKind, findings: readonly Finding[], header: string): string {
  const mine = findings.filter((finding) => finding.kind === kind);
  const lines = [header, ""];
  if (mine.length === 0) {
    lines.push(`No ${kind} finding in this run.`);
    return lines.join("\n");
  }
  lines.push(`${mine.length} ${kind} finding${mine.length === 1 ? "" : "s"}:`, "");
  for (const finding of mine.slice(0, LIST_LIMIT)) {
    const repro = finding.spec === undefined ? "" : ` Reproduce: \`bun scripts/playtest.ts --repro ${finding.spec.index}\`, seed ${finding.spec.seed}${finding.frame === undefined ? "" : `, frame ${finding.frame}`}.`;
    lines.push(`- ${finding.subject}: ${finding.detail}.${repro}`);
  }
  if (mine.length > LIST_LIMIT) lines.push(`- and ${mine.length - LIST_LIMIT} more in the run's report artifact.`);
  return lines.join("\n");
}

export function renderReport(runs: readonly Run[], findings: readonly Finding[], config: Config, header: string): string {
  const s = summarize(runs);
  const lines = [
    `# Overnight playtest`,
    "",
    header,
    "",
    `${s.matches} matches (${s.repeated} played twice to compare state hashes) over ${s.fighters} fighters, ${s.stages} stages and ${s.tiers} computer levels, ${s.frames} frames.`,
    `Wall time ${(s.wallMs / 1000).toFixed(1)} s, ${s.msPerMatch.toFixed(0)} ms a match (both runs), slowest ${s.slowestMs.toFixed(0)} ms.`,
    "",
    `Bands: fighter win rate ${(100 * config.winLow).toFixed(0)}-${(100 * config.winHigh).toFixed(0)}% over at least ${config.minDecisive} decisive matches; a move at most ${(100 * config.moveShareMax).toFixed(0)}% of its fighter's KOs over at least ${config.minMoveKos}; a zero-to-death string is ${config.minStringHits} or more hits; a stage with no KOs needs ${config.minStageMatches} matches; frame cap ${config.frameCap}.`,
    "",
    "| Finding | Count |",
    "| --- | --- |",
    ...FINDING_KINDS.map((kind) => `| ${kind} | ${findings.filter((finding) => finding.kind === kind).length} |`),
  ];
  for (const kind of FINDING_KINDS) {
    const mine = findings.filter((finding) => finding.kind === kind);
    if (mine.length === 0) continue;
    lines.push("", `## ${kind}`, "");
    for (const finding of mine.slice(0, LIST_LIMIT)) {
      lines.push(`- ${finding.subject}${finding.spec === undefined ? "" : ` (seed ${finding.spec.seed}${finding.frame === undefined ? "" : `, frame ${finding.frame}`})`}: ${finding.detail}`);
    }
    if (mine.length > LIST_LIMIT) lines.push(`- and ${mine.length - LIST_LIMIT} more`);
  }
  return lines.join("\n");
}
