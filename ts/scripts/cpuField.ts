// The computer against the field (#105): every ordered pair of selectable
// fighters, both computers, on every soak stage, played in process through
// the game's frame capture and execution as the tape runner plays them. Each
// match is read from outside after every frame: moves started (attack serials
// and special starts), hits and damage landed, stocks lost and the frames
// since the loser last took a hit. The computer has no randomness, so each
// setup is one sample; a variant shifts both spawn points sideways to start a
// different match. Mirrors are left out of the field.
// Usage (from ts/): bun scripts/cpuField.ts [--variants N] [--stocks N] [--minutes N] [--json FILE] [--fighters a,b,...]
import { writeFileSync } from "node:fs";
import { f32 } from "wisp/src/sim/f32";
import { parseArgs } from "node:util";
import { clearAttackBuffer } from "../src/game/input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../src/game/input/participants";
import { createFrameControls } from "../src/game/match/controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "../src/game/match/frameInput";
import { createPacingAndPresentation } from "../src/game/match/pacingAndPresentation";
import { MATCH_TICKS_PER_SECOND, Phase, createMatchState, setParticipants } from "../src/game/match/rules";
import { initializeMatchFighters, matchSpawnX } from "../src/game/match/step";
import { produceComputerInput } from "../src/game/match/botPlay";
import { gameplanOf } from "../src/game/match/botGameplan";
import { type GameplanMove, GameplanSpecial, GameplanThrow } from "../src/game/sim/gameplan";
import { AttackStyle, type Character, SpecialAction } from "../src/game/sim/codes";
import { createFighter, type Fighter } from "../src/game/sim/fighter";
import { SELECTABLE_CHARACTERS, fighterSlug, selectableCharacterBySlug } from "../src/game/sim/heroes/registry";
import { copyControls, createRoster, fighterAt, neutralControls } from "../src/game/sim/roster";
import { mainDeckLeft, mainDeckRight } from "../src/game/sim/stage";
import soak from "./wisp/soak";

/** The soak's stages by the game's stage numbers (test/soak/game.ts). */
const FIELD_STAGES: Readonly<Record<string, number>> = {
  "sky-deck": 0, "three-bridges": 1, "frozen-throne": 2, "drifting-deck": 3, "patterned-decks": 4,
  "wind": 10, "carried": 11, "cannon": 12, "timed-lift": 13, "hellfire": 14,
};
/** A stock lost this long after the last hit taken, or with none, was lost without the opponent (#105 box 3). */
const NO_HIT_FRAMES = 3 * MATCH_TICKS_PER_SECOND;
/** Specials as gameplans and the computer's options number them: neutral, side, up, down. */
export const SPECIAL_MOVE = GameplanSpecial;
/** Spawn shifts, in order, for each variant of a setup. */
const SHIFTS = [0.0, -60.0, 60.0, -120.0, 120.0, -30.0, 30.0, -90.0, 90.0] as const;

const MOVE_NAMES: Readonly<Record<number, string>> = {
  [AttackStyle.jab]: "jab", [AttackStyle.shot]: "shot", [AttackStyle.upSmash]: "up-smash", [AttackStyle.downSmash]: "down-smash",
  [AttackStyle.forwardSmash]: "forward-smash", [AttackStyle.grab]: "grab", [AttackStyle.forwardTilt]: "forward-tilt", [AttackStyle.upTilt]: "up-tilt",
  [AttackStyle.downTilt]: "down-tilt", [AttackStyle.forwardTiltUp]: "forward-tilt-up", [AttackStyle.forwardTiltDown]: "forward-tilt-down",
  [AttackStyle.getupAttack]: "get-up-attack", [AttackStyle.neutralAir]: "neutral-air", [AttackStyle.forwardAir]: "forward-air",
  [AttackStyle.backAir]: "back-air", [AttackStyle.upAir]: "up-air", [AttackStyle.downAir]: "down-air", [AttackStyle.ledgeAttack]: "ledge-attack",
  [AttackStyle.demonHunterDashAttack]: "dash-attack", [AttackStyle.dashAttack]: "dash-attack",
  [SPECIAL_MOVE.neutral]: "neutral-special", [SPECIAL_MOVE.side]: "side-special", [SPECIAL_MOVE.up]: "up-special", [SPECIAL_MOVE.down]: "down-special",
};
const moveName = (move: number): string => MOVE_NAMES[move] ?? `move-${move}`;

/** The special slot a running special action belongs to. */
function specialMove(action: number): number | undefined {
  switch (action) {
    case SpecialAction.archerArrow: case SpecialAction.riflemanBlaster: case SpecialAction.demonHunterManaBurn: case SpecialAction.heroNeutral:
      return SPECIAL_MOVE.neutral;
    case SpecialAction.archerMultishot: case SpecialAction.riflemanBear: case SpecialAction.demonHunterParryStep: case SpecialAction.heroSide:
      return SPECIAL_MOVE.side;
    case SpecialAction.archerRecovery: case SpecialAction.riflemanRecovery: case SpecialAction.demonHunterWingAscent: case SpecialAction.heroUp:
      return SPECIAL_MOVE.up;
    case SpecialAction.archerDisengage: case SpecialAction.riflemanTrap: case SpecialAction.demonHunterImmolate: case SpecialAction.heroDown:
      return SPECIAL_MOVE.down;
    default:
      return undefined;
  }
}

interface SideRecord {
  readonly fighter: string;
  /** Moves started, by move number (AttackStyle, or SPECIAL_MOVE for specials). */
  readonly moves: Record<number, number>;
  hitsLanded: number;
  damageDealt: number;
  readonly stockLosses: { readonly frame: number; readonly sinceHit: number | undefined }[];
}

interface MatchRecord {
  readonly stage: string;
  readonly variant: number;
  readonly fighters: readonly [string, string];
  /** The winning slot, or null for a tie. */
  readonly winner: number | null;
  readonly timedOut: boolean;
  readonly frames: number;
  readonly sides: readonly [SideRecord, SideRecord];
}

export interface FieldOptions {
  readonly variants?: number;
  readonly stocks?: number;
  readonly minutes?: number;
  readonly fighters?: readonly Character[];
  readonly stages?: readonly string[];
}

interface Watch {
  serial: number;
  special: number;
  specialFrame: number;
  hits: number;
  damage: number;
  out: boolean;
  lastHit: number | undefined;
}

const watchOf = (f: Readonly<Fighter>): Watch => ({
  serial: f.attack.serial, special: f.special.action, specialFrame: f.special.frame, hits: f.visuals.hit, damage: f.status.damage, out: f.status.out, lastHit: undefined,
});

const NEUTRAL = neutralControls();

/** One computer-against-computer match: slot 0 plays `a`, slot 1 plays `b`. */
function playCpuMatch(a: Character, b: Character, stageName: string, variant: number, options: FieldOptions = {}): MatchRecord | undefined {
  const stage = FIELD_STAGES[stageName];
  if (stage === undefined) throw new Error(`no stage named ${stageName}`);
  const shift = SHIFTS[variant % SHIFTS.length] ?? 0.0;
  const xs = [f32(matchSpawnX(0) + shift), f32(matchSpawnX(1) + shift)] as const;
  // A shift that would spawn a fighter off the main deck makes no match.
  if (xs.some((x) => x <= mainDeckLeft(stage) + 40 || x >= mainDeckRight(stage) - 40)) return undefined;
  const match = createMatchState();
  setParticipants(match, 0, 3);
  match.characterChoices[0] = a;
  match.characterChoices[1] = b;
  match.stageChoice = stage;
  match.stockCount = options.stocks ?? 3;
  match.timeLimitMinutes = options.minutes ?? 4;
  match.remainingFrames = match.timeLimitMinutes * 60 * MATCH_TICKS_PER_SECOND;
  match.phase = Phase.match;
  const world = createRoster(3, [createFighter(a, xs[0], 1), createFighter(b, xs[1], -1)]);
  const controls = createFrameControls();
  const produced = createFrameControls();
  const runtime = createPacingAndPresentation();
  const row = createMatchFrameInput();
  initializeMatchFighters(match, world);
  const sides = [a, b].map((character) => ({ fighter: fighterSlug(character), moves: {}, hitsLanded: 0, damageDealt: 0, stockLosses: [] })) as unknown as [SideRecord, SideRecord];
  const watches = [watchOf(fighterAt(world, 0)), watchOf(fighterAt(world, 1))] as const;
  const limit = (match.timeLimitMinutes * 60 + 5) * MATCH_TICKS_PER_SECOND;
  let frame = 0;
  while (match.phase === Phase.match && frame < limit) {
    frame = runtime.simulationFrame + 1;
    for (const slot of PARTICIPANT_SLOTS) {
      copyControls(produced.inputs[slot], NEUTRAL);
      clearAttackBuffer(produced.commands[slot]);
      if (slot <= 1) produceComputerInput(match, world, runtime, slot, frame, produced.inputs[slot], produced.commands[slot]);
    }
    if (!captureFrame(row, frame, world.mask, produced, runtime)) throw new Error(`capture refused frame ${frame}`);
    if (!executeMatchFrame(row, match, world, controls, runtime, frame)) throw new Error(`execution refused frame ${frame}`);
    for (const slot of [0, 1] as const) {
      const f = fighterAt(world, slot);
      const seen = watches[slot];
      const own = sides[slot];
      const other = sides[1 - slot];
      if (f.attack.serial !== seen.serial && f.attack.style !== undefined) own.moves[f.attack.style] = (own.moves[f.attack.style] ?? 0) + 1;
      const special = specialMove(f.special.action);
      if (special !== undefined && (f.special.action !== seen.special || f.special.frame < seen.specialFrame)) own.moves[special] = (own.moves[special] ?? 0) + 1;
      if (f.visuals.hit !== seen.hits && other !== undefined) {
        other.hitsLanded++;
        seen.lastHit = frame;
      }
      if (f.status.damage > seen.damage && other !== undefined) other.damageDealt += f.status.damage - seen.damage;
      if (f.status.out && !seen.out) own.stockLosses.push({ frame, sinceHit: seen.lastHit === undefined ? undefined : frame - seen.lastHit });
      seen.serial = f.attack.serial;
      seen.special = f.special.action;
      seen.specialFrame = f.special.frame;
      seen.hits = f.visuals.hit;
      seen.damage = f.status.damage;
      seen.out = f.status.out;
    }
  }
  return {
    stage: stageName, variant, fighters: [sides[0].fighter, sides[1].fighter],
    winner: match.winner === 0 || match.winner === 1 ? match.winner : null, timedOut: match.timedOut, frames: frame, sides,
  };
}

/** Every ordered pair of different fighters on every stage, `variants` times over. */
function playCpuField(options: FieldOptions = {}, progress?: (done: number, total: number) => void): MatchRecord[] {
  const fighters = options.fighters ?? SELECTABLE_CHARACTERS;
  const stages = options.stages ?? Object.keys(FIELD_STAGES);
  const variants = options.variants ?? 1;
  const total = fighters.length * (fighters.length - 1) * stages.length * variants;
  const records: MatchRecord[] = [];
  let done = 0;
  for (const a of fighters) for (const b of fighters) {
    if (a === b) continue;
    for (const stage of stages) for (let variant = 0; variant < variants; variant++) {
      const record = playCpuMatch(a, b, stage, variant, options);
      if (record !== undefined) records.push(record);
      progress?.(++done, total);
    }
  }
  return records;
}

export interface MoveUse {
  readonly move: number;
  readonly name: string;
  readonly count: number;
  readonly share: number;
}

interface FighterSummary {
  readonly fighter: string;
  readonly matches: number;
  readonly wins: number;
  readonly losses: number;
  readonly ties: number;
  readonly timeOuts: number;
  /** Wins over decisive matches. */
  readonly winRate: number;
  /** Win rate against each opponent, over decisive matches. */
  readonly against: Readonly<Record<string, number>>;
  readonly stockLosses: number;
  /** Stock losses with no hit taken in the previous NO_HIT_FRAMES. */
  readonly noHitLosses: number;
  readonly noHitShare: number;
  readonly damagePerHit: number;
  readonly moves: readonly MoveUse[];
}

/** Moves a fighter started across `records`, most-used first. */
function moveUsage(records: readonly MatchRecord[], fighter: string): MoveUse[] {
  const counts = new Map<number, number>();
  for (const record of records) for (const side of record.sides) {
    if (side.fighter !== fighter) continue;
    for (const [move, count] of Object.entries(side.moves)) counts.set(Number(move), (counts.get(Number(move)) ?? 0) + count);
  }
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  return [...counts.entries()]
    .map(([move, count]) => ({ move, name: moveName(move), count, share: total === 0 ? 0 : count / total }))
    .sort((x, y) => y.count - x.count || x.move - y.move);
}

/**
 * A per-fighter test's view (#105 box 2): the fighter's moves by use, most
 * used first, over its computer matches against every other fighter on
 * `stages` (all soak stages by default). Moves are AttackStyle numbers and
 * SPECIAL_MOVE for specials, as the computer's options number them.
 */
export function fighterMoveUsage(character: Character, options: FieldOptions = {}): MoveUse[] {
  const fighters = options.fighters ?? SELECTABLE_CHARACTERS;
  const stages = options.stages ?? Object.keys(FIELD_STAGES);
  const records: MatchRecord[] = [];
  for (const other of fighters) {
    if (other === character) continue;
    for (const stage of stages) for (let variant = 0; variant < (options.variants ?? 1); variant++) {
      for (const pair of [[character, other], [other, character]] as const) {
        const record = playCpuMatch(pair[0], pair[1], stage, variant, options);
        if (record !== undefined) records.push(record);
      }
    }
  }
  return moveUsage(records, fighterSlug(character));
}

/** Whether every move in `key` is among the fighter's `top` most-used moves. */
export function keyMovesAmongMostUsed(usage: readonly MoveUse[], key: readonly number[], top: number): { readonly ok: boolean; readonly missing: readonly number[] } {
  const leading = new Set(usage.slice(0, top).map((use) => use.move));
  const missing = key.filter((move) => !leading.has(move));
  return { ok: missing.length === 0, missing };
}

/** A gameplan move as fighterMoveUsage counts it: a throw starts with the grab. */
const countedAs = (move: number): number => (move >= GameplanThrow.forward && move <= GameplanThrow.down ? AttackStyle.grab : move);
/** A started move as a gameplan names it: Illidan's dash attack is the dash attack, angled forward tilts the forward tilt. */
const namedAs = (move: number): number =>
  move === AttackStyle.demonHunterDashAttack ? AttackStyle.dashAttack
    : move === AttackStyle.forwardTiltUp || move === AttackStyle.forwardTiltDown ? AttackStyle.forwardTilt : move;

/**
 * The per-fighter gameplan test (#105 box 2): whether the fighter's declared
 * key moves (its spacing tools unless `key` names others) are among its
 * `top` most-used moves in its computer matches against the field.
 */
export function gameplanKeyMovesCheck(character: Character, { top = 6, key, options = {} }: { top?: number; key?: readonly GameplanMove[]; options?: FieldOptions } = {}) {
  const plan = gameplanOf(character);
  if (plan === undefined) throw new Error(`${fighterSlug(character)} declares no gameplan`);
  const merged = new Map<number, MoveUse>();
  for (const use of fighterMoveUsage(character, options)) {
    const move = namedAs(use.move);
    const known = merged.get(move);
    merged.set(move, { move, name: moveName(move), count: (known?.count ?? 0) + use.count, share: (known?.share ?? 0) + use.share });
  }
  const usage = [...merged.values()].sort((x, y) => y.count - x.count || x.move - y.move);
  const declared = [...new Set((key ?? plan.spacing.map((spaced) => spaced.move)).map((move) => namedAs(countedAs(move))))];
  const result = keyMovesAmongMostUsed(usage, declared, top);
  return { ...result, missingNames: result.missing.map(moveName), usage };
}

function summarizeField(records: readonly MatchRecord[]): FighterSummary[] {
  const names = [...new Set(records.flatMap((record) => record.fighters))];
  const order = soak.roster.fighters;
  names.sort((x, y) => order.indexOf(x) - order.indexOf(y));
  return names.map((fighter) => {
    let matches = 0, wins = 0, losses = 0, ties = 0, timeOuts = 0, hits = 0, damage = 0, stockLosses = 0, noHit = 0;
    const versus = new Map<string, { wins: number; decisive: number }>();
    for (const record of records) {
      const slot = record.fighters.indexOf(fighter);
      if (slot < 0) continue;
      const side = record.sides[slot];
      const opponent = record.fighters[1 - slot] ?? "";
      if (side === undefined) continue;
      matches++;
      if (record.timedOut) timeOuts++;
      const pair = versus.get(opponent) ?? { wins: 0, decisive: 0 };
      versus.set(opponent, pair);
      if (record.winner === null) ties++;
      else {
        pair.decisive++;
        if (record.winner === slot) {
          wins++;
          pair.wins++;
        } else losses++;
      }
      hits += side.hitsLanded;
      damage += side.damageDealt;
      for (const loss of side.stockLosses) {
        stockLosses++;
        if (loss.sinceHit === undefined || loss.sinceHit > NO_HIT_FRAMES) noHit++;
      }
    }
    const against: Record<string, number> = {};
    for (const [opponent, pair] of versus) against[opponent] = pair.decisive === 0 ? Number.NaN : pair.wins / pair.decisive;
    return {
      fighter, matches, wins, losses, ties, timeOuts, winRate: wins + losses === 0 ? Number.NaN : wins / (wins + losses), against,
      stockLosses, noHitLosses: noHit, noHitShare: stockLosses === 0 ? 0 : noHit / stockLosses, damagePerHit: hits === 0 ? Number.NaN : damage / hits,
      moves: moveUsage(records, fighter),
    };
  });
}

const percent = (value: number) => (Number.isNaN(value) ? "-" : `${(100 * value).toFixed(0)}%`);

function fieldTable(summaries: readonly FighterSummary[]): string {
  const lines = [
    "| Fighter | Matches | Wins | Losses | Ties | Time-outs | Win rate vs field | Stock losses | No-hit losses (share) | Damage per hit | Top moves (share of moves started) |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | --- |",
  ];
  for (const s of summaries) {
    const top = s.moves.slice(0, 6).map((use) => `${use.name} ${percent(use.share)}`).join(", ");
    lines.push(`| ${s.fighter} | ${s.matches} | ${s.wins} | ${s.losses} | ${s.ties} | ${s.timeOuts} | ${percent(s.winRate)} | ${s.stockLosses} | ${s.noHitLosses} (${percent(s.noHitShare)}) | ${s.damagePerHit.toFixed(2)} | ${top} |`);
  }
  const names = summaries.map((s) => s.fighter);
  lines.push("", `| Row's win rate vs | ${names.join(" | ")} |`, `| --- |${names.map(() => " ---: |").join("")}`);
  for (const s of summaries) lines.push(`| ${s.fighter} | ${names.map((name) => (name === s.fighter ? "-" : percent(s.against[name] ?? Number.NaN))).join(" | ")} |`);
  return lines.join("\n");
}

if (import.meta.main) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { variants: { type: "string" }, stocks: { type: "string" }, minutes: { type: "string" }, json: { type: "string" }, fighters: { type: "string" } },
    strict: true,
  });
  const fighters = values.fighters?.split(",").map((slug) => {
    const character = selectableCharacterBySlug(slug);
    if (character === undefined) throw new Error(`no fighter named ${slug}`);
    return character;
  });
  const options: FieldOptions = {
    variants: Number(values.variants ?? 1), stocks: Number(values.stocks ?? 3), minutes: Number(values.minutes ?? 4),
    ...(fighters === undefined ? {} : { fighters }),
  };
  const started = performance.now();
  let reported = 0;
  const records = playCpuField(options, (done, total) => {
    const now = performance.now();
    if (now - reported > 10000 || done === total) {
      reported = now;
      console.error(`${done}/${total} matches, ${((now - started) / 1000).toFixed(0)} s`);
    }
  });
  const summaries = summarizeField(records);
  console.log(`${records.length} computer matches (${options.stocks} stocks, ${options.minutes}-minute clock, ${options.variants} spawn variant(s) per ordered pair and stage), ${((performance.now() - started) / 1000).toFixed(0)} s; win rate over decisive matches; a no-hit loss is a stock lost with no hit taken in the previous ${NO_HIT_FRAMES / MATCH_TICKS_PER_SECOND} s.`);
  console.log("");
  console.log(fieldTable(summaries));
  if (values.json !== undefined) writeFileSync(values.json, `${JSON.stringify({ options, summaries, records }, null, 1)}\n`);
}
