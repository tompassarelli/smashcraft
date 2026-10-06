// Summarizes the match results a soak run wrote with SOAK_OUTCOMES
// (test/soak/game.ts) per fighter pair and player policy: wins with a 95%
// Wilson interval, time-outs, stock time, the percent a stock was lost at and
// damage per landed hit. Matches with an absent player or a departure are left
// out. Without a fuzzed player identical results of one setup count once: the
// computer has no randomness, so its matches repeat exactly whatever the seed.
// Usage (from ts/): bun scripts/soakOutcomes.ts FILE...
import { Schema } from "effect";
import soak from "./wisp/soak";

/** A stock lost this long after the last hit taken, or with none, was lost without the opponent: a self-destruct. */
const KO_CREDIT_FRAMES = 180;
const FRAMES_PER_SECOND = 60;

const Outcome = Schema.Struct({
  index: Schema.Int, seed: Schema.Int, stage: Schema.String, fighters: Schema.Array(Schema.String), policies: Schema.Array(Schema.String),
  winner: Schema.NullOr(Schema.Int), timedOut: Schema.Boolean, interrupted: Schema.Boolean, frames: Schema.Int,
  players: Schema.Array(Schema.Struct({
    slot: Schema.Int, damageTaken: Schema.Finite, hitsTaken: Schema.Int,
    stockLosses: Schema.Array(Schema.Struct({ frame: Schema.Int, percent: Schema.Finite, sinceHit: Schema.optionalKey(Schema.Int) })),
  })),
});
type Outcome = typeof Outcome.Type;
const readOutcome = Schema.decodeSync(Schema.fromJsonString(Outcome));

/** 95% Wilson score interval of `wins` in `trials`. */
function wilson(wins: number, trials: number): readonly [number, number] {
  if (trials === 0) return [0, 1];
  const z = 1.959964;
  const p = wins / trials;
  const denominator = 1 + (z * z) / trials;
  const center = (p + (z * z) / (2 * trials)) / denominator;
  const half = (z * Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials))) / denominator;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

interface Side {
  wins: number;
  /** Damage and hits this side's fighter landed. */
  dealt: number;
  landed: number;
  koPercents: number[];
  selfDestructs: number;
}

interface Row {
  readonly group: string;
  readonly names: readonly [string, string];
  matches: number;
  draws: number;
  timeOuts: number;
  readonly stockFrames: number[];
  readonly sides: readonly [Side, Side];
}

const side = (): Side => ({ wins: 0, dealt: 0, landed: 0, koPercents: [], selfDestructs: 0 });
const mean = (values: readonly number[]) => (values.length === 0 ? Number.NaN : values.reduce((sum, value) => sum + value, 0) / values.length);
const fixed = (value: number, digits = 1) => (Number.isNaN(value) ? "-" : value.toFixed(digits));

/**
 * The table a pair lands in, and which slot reads as its first side: the
 * computer against the fuzzer, otherwise roster order, and player 1 first in
 * a mirror.
 */
function placement(outcome: Outcome, roster: readonly string[]): { readonly group: string; readonly first: number } | undefined {
  const [a = "", b = ""] = outcome.policies;
  if (outcome.policies.length !== 2 || outcome.interrupted || ![a, b].every((policy) => policy === "cpu" || policy === "fuzz")) return undefined;
  if (a !== b) return { group: "cpu vs fuzz", first: a === "cpu" ? 0 : 1 };
  const [x = "", y = ""] = outcome.fighters;
  return { group: `${a} vs ${b}`, first: roster.indexOf(x) <= roster.indexOf(y) ? 0 : 1 };
}

function summarize(outcomes: readonly Outcome[], roster: readonly string[]): Row[] {
  // A match played again to confirm a costly frame reports twice.
  const byMatch = new Map(outcomes.map((outcome) => [`${outcome.seed} ${outcome.index} ${outcome.stage} ${outcome.fighters.join()} ${outcome.policies.join()}`, outcome]));
  const distinct = new Map<string, Outcome>();
  for (const outcome of byMatch.values()) {
    // sinceHit is as observed after each frame, so it varies with how many frames each one confirmed.
    const players = outcome.players.map((player) => ({ ...player, stockLosses: player.stockLosses.map(({ frame, percent }) => ({ frame, percent })) }));
    // Only the fuzzer draws from the seed: other matches of one setup are the same match.
    const seeded = outcome.policies.includes("fuzz");
    distinct.set(JSON.stringify({ ...outcome, index: seeded ? outcome.index : 0, seed: seeded ? outcome.seed : 0, players }), outcome);
  }
  const rows = new Map<string, Row>();
  for (const outcome of distinct.values()) {
    const place = placement(outcome, roster);
    if (place === undefined) continue;
    const slots = [place.first, 1 - place.first] as const;
    const names = [outcome.fighters[slots[0]] ?? "", outcome.fighters[slots[1]] ?? ""] as const;
    const key = `${place.group}\u0000${names.join("\u0000")}`;
    const row = rows.get(key) ?? { group: place.group, names, matches: 0, draws: 0, timeOuts: 0, stockFrames: [], sides: [side(), side()] };
    rows.set(key, row);
    row.matches++;
    if (outcome.timedOut) row.timeOuts++;
    if (outcome.winner === null) row.draws++;
    slots.forEach((slot, place) => {
      const own = row.sides[place];
      const player = outcome.players.find((candidate) => candidate.slot === slot);
      const opponent = outcome.players.find((candidate) => candidate.slot === 1 - slot);
      if (own === undefined || player === undefined || opponent === undefined) return;
      if (outcome.winner === slot) own.wins++;
      own.dealt += opponent.damageTaken;
      own.landed += opponent.hitsTaken;
      for (const loss of player.stockLosses) {
        row.stockFrames.push(loss.frame);
        if (loss.sinceHit !== undefined && loss.sinceHit <= KO_CREDIT_FRAMES) own.koPercents.push(loss.percent);
        else own.selfDestructs++;
      }
    });
  }
  const order = (row: Row) => [row.group, ...row.names.map((name) => roster.indexOf(name))].join(" ");
  return [...rows.values()].sort((a, b) => order(a).localeCompare(order(b)));
}

function table(rows: readonly Row[]): string {
  const lines: string[] = [];
  for (const group of [...new Set(rows.map((row) => row.group))]) {
    lines.push("", `### ${group}`, "",
      "| A vs B | Matches | A wins | B wins | Draws | A win rate (95% CI) | Time-outs | Stock time s | KO % A / B | Self-destructs A / B | Damage per hit A / B |",
      "| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- | --- | --- |");
    for (const row of rows.filter((candidate) => candidate.group === group)) {
      const [a, b] = row.sides;
      const decisive = a.wins + b.wins;
      const [low, high] = wilson(a.wins, decisive);
      const rate = decisive === 0 ? "-" : `${((100 * a.wins) / decisive).toFixed(0)}% (${(100 * low).toFixed(0)}-${(100 * high).toFixed(0)})`;
      lines.push(`| ${row.names.join(" vs ")} | ${row.matches} | ${a.wins} | ${b.wins} | ${row.draws} | ${rate} | ${row.timeOuts} | ${fixed(mean(row.stockFrames) / FRAMES_PER_SECOND)}`
        + ` | ${fixed(mean(a.koPercents), 0)} / ${fixed(mean(b.koPercents), 0)} (n ${a.koPercents.length} / ${b.koPercents.length}) | ${a.selfDestructs} / ${b.selfDestructs}`
        + ` | ${fixed(a.dealt / a.landed, 2)} / ${fixed(b.dealt / b.landed, 2)} |`);
    }
  }
  return lines.join("\n");
}

if (import.meta.main) {
  const files = process.argv.slice(2);
  if (files.length === 0) throw new Error("usage: bun scripts/soakOutcomes.ts FILE...");
  const outcomes = (await Promise.all(files.map((file) => Bun.file(file).text())))
    .flatMap((text) => text.split("\n").filter((line) => line.trim() !== "").map((line) => readOutcome(line)));
  console.log(`${outcomes.length} results read; A is the first fighter (the computer in cpu vs fuzz). KO % counts stocks lost within ${KO_CREDIT_FRAMES / FRAMES_PER_SECOND} s of a hit.`);
  console.log(table(summarize(outcomes, soak.roster.fighters)));
}
