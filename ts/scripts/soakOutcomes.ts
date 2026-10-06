// Summarizes the match results a soak run wrote with SOAK_OUTCOMES
// (test/soak/game.ts) per fighter pair and player policy: wins with a 95%
// Wilson interval, time-outs, stock time, the percent a stock was lost at and
// damage per landed hit; then, per fighter the computer played, the times it
// left the stage on its own while its opponent stood on it, its
// self-destructs, the attacks it blocked and dodges it started, and how often
// each authored move landed. Matches with an absent player or a departure are
// left out. Without a fuzzed player identical results of one setup count
// once: the computer has no randomness, so its matches repeat exactly
// whatever the seed.
// Usage (from ts/): bun scripts/soakOutcomes.ts FILE...
import { Schema } from "effect";
import soak from "./wisp/soak";
import { heroDefinition, selectableCharacterBySlug } from "../src/game/sim/heroes/registry";

/** A stock lost this long after the last hit taken, or with none, was lost without the opponent: a self-destruct. */
const KO_CREDIT_FRAMES = 180;
const FRAMES_PER_SECOND = 60;
/** Jab resets one fighter takes in a match that mark a time-out as a reset loop. */
const RESET_LOOP = 5;

const Outcome = Schema.Struct({
  index: Schema.Int, seed: Schema.Int, stage: Schema.String, fighters: Schema.Array(Schema.String), policies: Schema.Array(Schema.String),
  winner: Schema.NullOr(Schema.Int), timedOut: Schema.Boolean, interrupted: Schema.Boolean, frames: Schema.Int,
  players: Schema.Array(Schema.Struct({
    slot: Schema.Int, damageTaken: Schema.Finite, hitsTaken: Schema.Int,
    stockLosses: Schema.Array(Schema.Struct({ frame: Schema.Int, percent: Schema.Finite, sinceHit: Schema.optionalKey(Schema.Int) })),
    landed: Schema.optionalKey(Schema.Record(Schema.String, Schema.Int)),
    departures: Schema.optionalKey(Schema.Array(Schema.Int)),
    blocked: Schema.optionalKey(Schema.Int),
    dodges: Schema.optionalKey(Schema.Int),
    resets: Schema.optionalKey(Schema.Int),
  })),
});
type Outcome = typeof Outcome.Type;
const readOutcome = Schema.decodeSync(Schema.fromJsonString(Outcome));

/**
 * Every move a fighter has, by the soak's move names: normals, aerials, grab
 * and throws, get-up and ledge attacks, and specials (Archer's mount and
 * Illidan's ascent strike nothing; using one counts).
 */
const AUTHORED_MOVES = [
  "jab", "forward-tilt", "forward-tilt-up", "forward-tilt-down", "up-tilt", "down-tilt", "forward-smash", "up-smash", "down-smash",
  "neutral-air", "forward-air", "back-air", "up-air", "down-air", "grab", "pummel", "forward-throw", "back-throw", "up-throw",
  "down-throw", "get-up-attack", "ledge-attack", "neutral-special", "side-special", "up-special", "down-special",
] as const;
const FIGHTER_MOVES: Readonly<Record<string, readonly string[]>> = { illidan: [...AUTHORED_MOVES, "dash-attack"] };
// Every expansion hero has a dash attack of its own.
const movesOf = (fighter: string): readonly string[] =>
  FIGHTER_MOVES[fighter] ?? (heroDefinition(selectableCharacterBySlug(fighter) ?? -1) !== undefined ? [...AUTHORED_MOVES, "dash-attack"] : AUTHORED_MOVES);

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

/** Each match the soak played once: a match played again to confirm a costly frame reports twice. */
function playedMatches(outcomes: readonly Outcome[]): Outcome[] {
  return [...new Map(outcomes.map((outcome) => [`${outcome.seed} ${outcome.index} ${outcome.stage} ${outcome.fighters.join()} ${outcome.policies.join()}`, outcome])).values()];
}

/** One match per result of a setup without a fuzzed player, every match with one. */
function distinctMatches(played: readonly Outcome[]): Outcome[] {
  const distinct = new Map<string, Outcome>();
  for (const outcome of played) {
    // What a player's record saw between frames varies with how many frames each observation confirmed.
    const players = outcome.players.map(({ slot, damageTaken, hitsTaken, stockLosses }) => ({ slot, damageTaken, hitsTaken, stockLosses: stockLosses.map(({ frame, percent }) => ({ frame, percent })) }));
    // Only the fuzzer draws from the seed: other matches of one setup are the same match.
    const seeded = outcome.policies.includes("fuzz");
    const key = JSON.stringify({ ...outcome, index: seeded ? outcome.index : 0, seed: seeded ? outcome.seed : 0, players });
    if (!distinct.has(key)) distinct.set(key, outcome);
  }
  return [...distinct.values()];
}

const selfDestruct = (loss: { readonly sinceHit?: number }) => loss.sinceHit === undefined || loss.sinceHit > KO_CREDIT_FRAMES;

function summarize(outcomes: readonly Outcome[], roster: readonly string[]): Row[] {
  const rows = new Map<string, Row>();
  for (const outcome of outcomes) {
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
        if (selfDestruct(loss)) own.selfDestructs++;
        else own.koPercents.push(loss.percent);
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

/**
 * Per fighter the computer played, pooled over every match it played: matches, times it
 * left the stage on its own while the opponent stood on it, self-destructs,
 * attacks blocked and dodges; then each authored move's landings, with the
 * moves that never landed.
 */
function computerTables(outcomes: readonly Outcome[], roster: readonly string[]): string {
  const conduct = new Map(roster.map((fighter) => [fighter, { matches: 0, departures: 0, selfDestructs: 0, blocked: 0, dodges: 0, timeOuts: 0, resetTimeOuts: 0, landed: new Map<string, number>() }]));
  for (const outcome of outcomes) {
    if (outcome.interrupted) continue;
    // A match that runs out of time while a fighter lies under jab resets is a reset loop, not a fight.
    const resetLoop = outcome.timedOut && outcome.players.some((player) => (player.resets ?? 0) >= RESET_LOOP);
    outcome.policies.forEach((policy, slot) => {
      const record = conduct.get(outcome.fighters[slot] ?? "");
      const player = outcome.players.find((candidate) => candidate.slot === slot);
      if (policy !== "cpu" || record === undefined || player === undefined) return;
      record.matches++;
      record.departures += player.departures?.length ?? 0;
      record.selfDestructs += player.stockLosses.filter(selfDestruct).length;
      record.blocked += player.blocked ?? 0;
      record.dodges += player.dodges ?? 0;
      if (outcome.timedOut) record.timeOuts++;
      if (resetLoop) record.resetTimeOuts++;
      for (const [move, count] of Object.entries(player.landed ?? {})) record.landed.set(move, (record.landed.get(move) ?? 0) + count);
    });
  }
  const fighters = roster.filter((fighter) => (conduct.get(fighter)?.matches ?? 0) > 0);
  if (fighters.length === 0) return "";
  const lines = ["", "### The computer", "",
    `| Fighter | Matches | Left the stage on its own | Self-destructs | Attacks blocked | Dodges | Time-outs | Time-outs with ${RESET_LOOP}+ jab resets |`,
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"];
  for (const fighter of fighters) {
    const record = conduct.get(fighter);
    if (record !== undefined) lines.push(`| ${fighter} | ${record.matches} | ${record.departures} | ${record.selfDestructs} | ${record.blocked} | ${record.dodges} | ${record.timeOuts} | ${record.resetTimeOuts} |`);
  }
  const moves = [...new Set(fighters.flatMap(movesOf))];
  lines.push("", `| Move landed | ${fighters.join(" | ")} |`, `| --- |${fighters.map(() => " ---: |").join("")}`);
  for (const move of moves) {
    lines.push(`| ${move} | ${fighters.map((fighter) => (movesOf(fighter).includes(move) ? String(conduct.get(fighter)?.landed.get(move) ?? 0) : "-")).join(" | ")} |`);
  }
  const missing = fighters.flatMap((fighter) => {
    const never = movesOf(fighter).filter((move) => (conduct.get(fighter)?.landed.get(move) ?? 0) === 0);
    return never.length === 0 ? [] : [`${fighter}: ${never.join(", ")}`];
  });
  lines.push("", missing.length === 0 ? "Every authored move landed for every fighter the computer played." : `Never landed: ${missing.join("; ")}.`);
  return lines.join("\n");
}

if (import.meta.main) {
  const files = process.argv.slice(2);
  if (files.length === 0) throw new Error("usage: bun scripts/soakOutcomes.ts FILE...");
  const read = (await Promise.all(files.map((file) => Bun.file(file).text())))
    .flatMap((text) => text.split("\n").filter((line) => line.trim() !== "").map((line) => readOutcome(line)));
  // The soak plays a match again to confirm a costly frame, and that replay
  // writes the same result a second time: count each match once.
  const matchKeys = new Set<string>();
  const outcomes = read.filter(({ index, seed }) => {
    const key = `${index}:${seed}`;
    if (matchKeys.has(key)) return false;
    matchKeys.add(key);
    return true;
  });
  console.log(`${outcomes.length} results read (${read.length - outcomes.length} replayed results left out); A is the first fighter (the computer in cpu vs fuzz). KO % counts stocks lost within ${KO_CREDIT_FRAMES / FRAMES_PER_SECOND} s of a hit.`);
  const played = playedMatches(outcomes);
  console.log(table(summarize(distinctMatches(played), soak.roster.fighters)));
  console.log(computerTables(played, soak.roster.fighters));
}
