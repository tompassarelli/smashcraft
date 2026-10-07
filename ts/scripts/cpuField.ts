// The computer against the field (#105): every ordered pair of selectable
// fighters, both computers, on every soak stage, played in process through
// the game's frame capture and execution as the tape runner plays them. Each
// match is read from outside after every frame: moves started (attack serials
// and special starts), hits and damage landed, stocks lost and the frames
// since the loser last took a hit. The computer draws every choice under the
// match seed, so each seed of a setup is another sample; a variant also
// shifts both spawn points sideways. Both computers play at --opponents and --tiers (wren,wren and expert,expert by
// default). Mirrors are left out of the field.
// Usage (from ts/): bun scripts/cpuField.ts [--variants N | --per-pair N] [--seeds N] [--tiers A,B] [--stocks N] [--minutes N] [--json FILE] [--fighters a,b,...] [--pairs a:b,c:d] [--merge a.json,b.json]
import { readFileSync, writeFileSync } from "node:fs";
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
import { isCpuOpponent, isCpuTier, type CpuOpponentId, type CpuTier } from "../src/game/match/cpuProfiles";
import { gameplanOf } from "../src/game/match/botGameplan";
import { type GameplanMove, GameplanSpecial, GameplanThrow } from "../src/game/sim/gameplan";
import { AttackStyle, type Character, LedgeState, SpecialAction } from "../src/game/sim/codes";
import { createFighter, type Fighter } from "../src/game/sim/fighter";
import { SELECTABLE_CHARACTERS, fighterSlug, selectableCharacterBySlug } from "../src/game/sim/heroes/registry";
import { copyControls, createRoster, fighterAt, neutralControls } from "../src/game/sim/roster";
import { mainDeckLeft, mainDeckRight } from "../src/game/sim/stage";
import soak from "./wisp/soak";

/** The soak's stages by the game's stage numbers (test/soak/game.ts). */
export const FIELD_STAGES: Readonly<Record<string, number>> = {
  "sky-deck": 0, "three-bridges": 1, "frozen-throne": 2, "drifting-deck": 3, "patterned-decks": 4,
  "wind": 10, "carried": 11, "cannon": 12, "timed-lift": 13, "hellfire": 14, "stratholme": 6, "tomb-of-sargeras": 7,
};
/** A stock lost this long after the last hit taken, or with none, was lost without the opponent (#105 box 3). */
const NO_HIT_FRAMES = 3 * MATCH_TICKS_PER_SECOND;
// A self-destruct (#105 box 3) is a stock lost with no hit taken since the fighter last stood on a deck or held the ledge.
// The 3 s count above is kept as fall time: a far launch that takes longer than 3 s to finish counts there.
/**
 * The balance gate (Tom, 7 Oct; smashcraft:docs/design/roster.md, "Balance
 * gate"): every fighter's win rate against the field lies in [fieldLow,
 * fieldHigh], with both computers playing Wren Expert and at least `perPair` matches
 * a pair. The doc states these numbers; cpuField.tests.ts pins both together.
 */
export const BALANCE_GATE = { fieldLow: 0.40, fieldHigh: 0.60, opponent: "wren", tier: "expert", perPair: 400 } as const;
/** The matchup band, reported but not gated (Balance gate). */
const MATCHUP_LOW = 0.45;
const MATCHUP_HIGH = 0.55;
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
    case SpecialAction.archerHomingArrow: case SpecialAction.riflemanBear: case SpecialAction.demonHunterFelRush: case SpecialAction.heroSide:
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
  /** Mana paid for specials and their branches (sim/mana.ts). */
  manaSpent: number;
  specialsStarted: number;
  /** Special presses refused for want of mana. */
  specialsRefused: number;
  /** Stocks lost plus the one still standing at the end. */
  stocksPlayed: number;
  readonly stockLosses: { readonly frame: number; readonly sinceHit: number | undefined; readonly selfDestruct: boolean }[];
}

export interface MatchRecord {
  readonly stage: string;
  readonly variant: number;
  readonly seed: number;
  /** Each slot's named opponent and difficulty. */
  readonly opponents: readonly [CpuOpponentId, CpuOpponentId];
  readonly tiers: readonly [CpuTier, CpuTier];
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
  /** Only these pairs of fighters, each in both orders, instead of every pair of `fighters`. */
  readonly pairs?: readonly (readonly [Character, Character])[];
  readonly stages?: readonly string[];
  /** Plays spawn variants and seeds, both orders on every stage, until each pair of fighters has this many matches (at most every variant and seed). */
  readonly perPair?: number;
  /** Match seeds each variant plays, from 0 (1 by default). */
  readonly seeds?: number;
  /** The named profiles slots 0 and 1 play (Wren Expert by default). */
  readonly opponents?: readonly [CpuOpponentId, CpuOpponentId];
  readonly tiers?: readonly [CpuTier, CpuTier];
}

interface Watch {
  serial: number;
  special: number;
  specialForm: number;
  mana: number;
  denied: number;
  specialFrame: number;
  hits: number;
  damage: number;
  out: boolean;
  lastHit: number | undefined;
  /** The last frame it stood on a deck or held the ledge. */
  lastSafe: number | undefined;
}

const watchOf = (f: Readonly<Fighter>): Watch => ({
  serial: f.attack.serial, special: f.special.action, specialFrame: f.special.frame, specialForm: f.special.form, mana: f.mana.points, denied: f.visuals.manaDenied, hits: f.visuals.hit, damage: f.status.damage, out: f.status.out, lastHit: undefined, lastSafe: undefined,
});

const NEUTRAL = neutralControls();

/** One computer-against-computer match under `seed`: slot 0 plays `a`, slot 1 plays `b`. */
export function playCpuMatch(a: Character, b: Character, stageName: string, variant: number, options: FieldOptions = {}, seed = 0): MatchRecord | undefined {
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
  const opponents = options.opponents ?? ["wren", "wren"];
  const tiers = options.tiers ?? ["expert", "expert"];
  for (const slot of [0, 1] as const) {
    match.cpuOpponents[slot] = opponents[slot];
    match.cpuResolvedOpponents[slot] = opponents[slot];
    match.cpuTiers[slot] = tiers[slot];
  }
  match.matchSeed = seed;
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
  const side = (character: Character): SideRecord => ({ fighter: fighterSlug(character), moves: {}, hitsLanded: 0, damageDealt: 0, manaSpent: 0, specialsStarted: 0, specialsRefused: 0, stocksPlayed: 0, stockLosses: [] });
  const sides: [SideRecord, SideRecord] = [side(a), side(b)];
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
      const startedSpecial = special !== undefined && (f.special.action !== seen.special || f.special.frame < seen.specialFrame);
      if (startedSpecial) {
        own.moves[special] = (own.moves[special] ?? 0) + 1;
        own.specialsStarted++;
      }
      const branched = special !== undefined && f.special.action === seen.special && f.special.form !== seen.specialForm;
      if ((startedSpecial || branched) && f.mana.points < seen.mana) own.manaSpent += seen.mana - f.mana.points;
      own.specialsRefused += f.visuals.manaDenied - seen.denied;
      if (f.visuals.hit !== seen.hits && other !== undefined) {
        other.hitsLanded++;
        seen.lastHit = frame;
      }
      if (f.status.damage > seen.damage && other !== undefined) other.damageDealt += f.status.damage - seen.damage;
      // Standing in hitlag or hitstun isn't standing: the hit that put it there still counts.
      if (!f.status.out && f.launch.hitlag <= 0 && f.launch.hitstun <= 0 && (f.motion.grounded || f.ledge.state !== LedgeState.none)) seen.lastSafe = frame;
      if (f.status.out && !seen.out) {
        const selfDestruct = seen.lastHit === undefined || (seen.lastSafe !== undefined && seen.lastHit < seen.lastSafe);
        own.stockLosses.push({ frame, sinceHit: seen.lastHit === undefined ? undefined : frame - seen.lastHit, selfDestruct });
        seen.lastHit = undefined;
      }
      seen.serial = f.attack.serial;
      seen.special = f.special.action;
      seen.specialFrame = f.special.frame;
      seen.specialForm = f.special.form;
      seen.mana = f.mana.points;
      seen.denied = f.visuals.manaDenied;
      seen.hits = f.visuals.hit;
      seen.damage = f.status.damage;
      seen.out = f.status.out;
    }
  }
  for (const slot of [0, 1] as const) sides[slot].stocksPlayed = sides[slot].stockLosses.length + (fighterAt(world, slot).status.stocks > 0 ? 1 : 0);
  return {
    stage: stageName, variant, seed, opponents, tiers, fighters: [sides[0].fighter, sides[1].fighter],
    winner: match.winner === 0 || match.winner === 1 ? match.winner : null, timedOut: match.timedOut, frames: frame, sides,
  };
}

/**
 * Every pair of different fighters, both orders, on every stage, `variants`
 * times over; with `perPair`, as many variants as each pair needs to reach
 * that many matches (spawn shifts that leave a deck make none).
 */
function playCpuField(options: FieldOptions = {}, progress?: (done: number, total: number) => void): MatchRecord[] {
  const fighters = options.fighters ?? SELECTABLE_CHARACTERS;
  const stages = options.stages ?? Object.keys(FIELD_STAGES);
  const perPair = options.perPair;
  const variants = perPair === undefined ? options.variants ?? 1 : SHIFTS.length;
  const seeds = options.seeds ?? 1;
  const pairs = options.pairs ?? fighters.flatMap((a, first) => fighters.slice(first + 1).map((b) => [a, b] as const));
  const total = pairs.length * (perPair ?? 2 * stages.length * variants * seeds);
  const records: MatchRecord[] = [];
  let done = 0;
  for (const [a, b] of pairs) {
    let played = 0;
    for (let variant = 0; variant < variants && (perPair === undefined || played < perPair); variant++) {
      for (let seed = 0; seed < seeds && (perPair === undefined || played < perPair); seed++) for (const stage of stages) for (const [x, y] of [[a, b], [b, a]] as const) {
        const record = playCpuMatch(x, y, stage, variant, options, seed);
        if (record !== undefined) {
          records.push(record);
          played++;
        }
        progress?.(Math.min(++done, total), total);
      }
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

export interface FighterSummary {
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
  /** Matches played against each opponent. */
  readonly played: Readonly<Record<string, number>>;
  /** Decisive matches against each opponent. */
  readonly decisive: Readonly<Record<string, number>>;
  readonly stockLosses: number;
  /** Stock losses with no hit taken since the fighter last stood on a deck or held the ledge. */
  readonly selfDestructs: number;
  readonly selfDestructShare: number;
  /** Fall time: stock losses with no hit taken in the previous NO_HIT_FRAMES. */
  readonly noHitLosses: number;
  readonly noHitShare: number;
  readonly damagePerHit: number;
  /** Mana paid for specials per stock played. */
  readonly manaPerStock: number;
  /** Special presses refused for want of mana, over special presses (started plus refused). */
  readonly refusedShare: number;
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
    // A mirror plays only when asked for alone; its two orders are the same match.
    if (other === character && fighters.length > 1) continue;
    for (const stage of stages) for (let variant = 0; variant < (options.variants ?? 1); variant++) {
      for (const pair of other === character ? [[character, other] as const] : [[character, other], [other, character]] as const) {
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
 * `top` (8) most-used moves in its computer matches: by default its mirror
 * on every stage at 3 stocks and 4 minutes, about a second a fighter, so the
 * check depends only on its own kit and gameplan, never another lane's.
 */
export function gameplanKeyMovesCheck(character: Character, { top = 8, key, options = {} }: { top?: number; key?: readonly GameplanMove[]; options?: FieldOptions } = {}) {
  const plan = gameplanOf(character);
  if (plan === undefined) throw new Error(`${fighterSlug(character)} declares no gameplan`);
  const merged = new Map<number, MoveUse>();
  for (const use of fighterMoveUsage(character, { fighters: [character], ...options })) {
    const move = namedAs(use.move);
    const known = merged.get(move);
    merged.set(move, { move, name: moveName(move), count: (known?.count ?? 0) + use.count, share: (known?.share ?? 0) + use.share });
  }
  const usage = [...merged.values()].sort((x, y) => y.count - x.count || x.move - y.move);
  const declared = [...new Set((key ?? plan.spacing.map((spaced) => spaced.move)).map((move) => namedAs(countedAs(move))))];
  const result = keyMovesAmongMostUsed(usage, declared, top);
  return { ...result, missingNames: result.missing.map(moveName), usage };
}

export interface MatchupReport {
  readonly matchups: number;
  /** Matchups whose win rate lies inside 45-55%. */
  readonly inside: number;
  /** Matchups whose 95% interval (normal approximation over decisive matches) overlaps 45-55%. */
  readonly overlapping: number;
  /** Median over matchups of the distance between the row's win rate and 50%. */
  readonly medianDeviation: number;
  readonly smallestPlayed: number;
  /** Matchups whose interval misses the band, as "row-column rate". */
  readonly missing: readonly string[];
}

/** The matchup spread over each unordered pair once, from the earlier fighter's row: reported, not gated. */
export function matchupReport(summaries: readonly Pick<FighterSummary, "fighter" | "against" | "played" | "decisive">[]): MatchupReport {
  const names = summaries.map((s) => s.fighter);
  const deviations: number[] = [];
  const missing: string[] = [];
  let inside = 0, overlapping = 0, smallestPlayed = Number.POSITIVE_INFINITY;
  summaries.forEach((s, row) => {
    for (const name of names.slice(row + 1)) {
      // A pair this run never played (a --pairs shard) is no matchup.
      if ((s.played[name] ?? 0) === 0) continue;
      const rate = s.against[name] ?? Number.NaN;
      const n = s.decisive[name] ?? 0;
      smallestPlayed = Math.min(smallestPlayed, s.played[name] ?? 0);
      if (rate >= MATCHUP_LOW && rate <= MATCHUP_HIGH) inside++;
      const half = n === 0 ? 0 : 1.96 * Math.sqrt((rate * (1 - rate)) / n);
      if (rate - half <= MATCHUP_HIGH && rate + half >= MATCHUP_LOW) overlapping++;
      else missing.push(`${s.fighter}-${name} ${percent(rate)}`);
      deviations.push(Number.isNaN(rate) ? 0.5 : Math.abs(rate - 0.5));
    }
  });
  deviations.sort((x, y) => x - y);
  const middle = deviations.length >> 1;
  const medianDeviation = deviations.length === 0 ? 0 : deviations.length % 2 === 1 ? deviations[middle] ?? 0 : ((deviations[middle - 1] ?? 0) + (deviations[middle] ?? 0)) / 2;
  return { matchups: deviations.length, inside, overlapping, medianDeviation, smallestPlayed, missing };
}

export interface BalanceVerdict {
  /** Fighters whose win rate against the field lies outside the gate's band, as "fighter rate". */
  readonly outside: readonly string[];
  /** Whether the run measured what the gate names: its level for both computers and its matches a pair. */
  readonly gateRun: boolean;
  readonly passes: boolean;
}

/** The balance gate's verdict on a field: every fighter inside the band, on a run at the gate's named profile and matches a pair. */
export function balanceVerdict(summaries: readonly Pick<FighterSummary, "fighter" | "winRate">[], profiles: readonly { readonly opponent: CpuOpponentId; readonly tier: CpuTier }[], smallestPlayed: number): BalanceVerdict {
  const outside = summaries.filter((s) => !(s.winRate >= BALANCE_GATE.fieldLow && s.winRate <= BALANCE_GATE.fieldHigh)).map((s) => `${s.fighter} ${percent(s.winRate)}`);
  const gateRun = profiles.length > 0 && profiles.every((profile) => profile.opponent === BALANCE_GATE.opponent && profile.tier === BALANCE_GATE.tier) && smallestPlayed >= BALANCE_GATE.perPair;
  return { outside, gateRun, passes: gateRun && summaries.length > 0 && outside.length === 0 };
}

function summarizeField(records: readonly MatchRecord[]): FighterSummary[] {
  const names = [...new Set(records.flatMap((record) => record.fighters))];
  const order = soak.roster.fighters;
  names.sort((x, y) => order.indexOf(x) - order.indexOf(y));
  return names.map((fighter) => {
    let matches = 0, wins = 0, losses = 0, ties = 0, timeOuts = 0, hits = 0, damage = 0, stockLosses = 0, noHit = 0, selfDestructs = 0;
    let manaSpent = 0, stocksPlayed = 0, specialsStarted = 0, specialsRefused = 0;
    const versus = new Map<string, { wins: number; decisive: number; matches: number }>();
    for (const record of records) {
      const slot = record.fighters.indexOf(fighter);
      if (slot < 0) continue;
      const side = record.sides[slot];
      const opponent = record.fighters[1 - slot] ?? "";
      if (side === undefined) continue;
      matches++;
      if (record.timedOut) timeOuts++;
      const pair = versus.get(opponent) ?? { wins: 0, decisive: 0, matches: 0 };
      versus.set(opponent, pair);
      pair.matches++;
      if (record.winner === null) ties++;
      else {
        pair.decisive++;
        if (record.winner === slot) {
          wins++;
          pair.wins++;
        } else losses++;
      }
      hits += side.hitsLanded;
      manaSpent += side.manaSpent;
      stocksPlayed += side.stocksPlayed;
      specialsStarted += side.specialsStarted;
      specialsRefused += side.specialsRefused;
      damage += side.damageDealt;
      for (const loss of side.stockLosses) {
        stockLosses++;
        if (loss.sinceHit === undefined || loss.sinceHit > NO_HIT_FRAMES) noHit++;
        if (loss.selfDestruct) selfDestructs++;
      }
    }
    const against: Record<string, number> = {};
    const played: Record<string, number> = {};
    const decisive: Record<string, number> = {};
    for (const [opponent, pair] of versus) {
      against[opponent] = pair.decisive === 0 ? Number.NaN : pair.wins / pair.decisive;
      played[opponent] = pair.matches;
      decisive[opponent] = pair.decisive;
    }
    return {
      fighter, matches, wins, losses, ties, timeOuts, winRate: wins + losses === 0 ? Number.NaN : wins / (wins + losses), against, played, decisive,
      stockLosses, selfDestructs, selfDestructShare: stockLosses === 0 ? 0 : selfDestructs / stockLosses, noHitLosses: noHit, noHitShare: stockLosses === 0 ? 0 : noHit / stockLosses, damagePerHit: hits === 0 ? Number.NaN : damage / hits,
      manaPerStock: stocksPlayed === 0 ? Number.NaN : manaSpent / stocksPlayed,
      refusedShare: specialsStarted + specialsRefused === 0 ? 0 : specialsRefused / (specialsStarted + specialsRefused),
      moves: moveUsage(records, fighter),
    };
  });
}

const percent = (value: number) => (Number.isNaN(value) ? "-" : `${(100 * value).toFixed(0)}%`);

function fieldTable(summaries: readonly FighterSummary[], records: readonly MatchRecord[]): string {
  const lines = [
    "| Fighter | Matches | Wins | Losses | Ties | Time-outs | Win rate vs field | Stock losses | Self-destructs (share) | Lost over 3 s after a hit (share) | Damage per hit | Mana spent per stock | Specials refused for mana (share of presses) | Top moves (share of moves started) |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: | --- |",
  ];
  for (const s of summaries) {
    const top = s.moves.slice(0, 6).map((use) => `${use.name} ${percent(use.share)}`).join(", ");
    lines.push(`| ${s.fighter} | ${s.matches} | ${s.wins} | ${s.losses} | ${s.ties} | ${s.timeOuts} | ${percent(s.winRate)} | ${s.stockLosses} | ${s.selfDestructs} (${percent(s.selfDestructShare)}) | ${s.noHitLosses} (${percent(s.noHitShare)}) | ${s.damagePerHit.toFixed(2)} | ${s.manaPerStock.toFixed(0)} | ${s.refusedShare === 0 ? "0%" : `${(100 * s.refusedShare).toFixed(1)}%`} | ${top} |`);
  }
  const names = summaries.map((s) => s.fighter);
  lines.push("", `| Row's win rate vs (matches) | ${names.join(" | ")} |`, `| --- |${names.map(() => " ---: |").join("")}`);
  const cell = (s: FighterSummary, name: string) => (name === s.fighter ? "-" : `${percent(s.against[name] ?? Number.NaN)} (${s.played[name] ?? 0})`);
  for (const s of summaries) lines.push(`| ${s.fighter} | ${names.map((name) => cell(s, name)).join(" | ")} |`);
  const report = matchupReport(summaries);
  const verdict = balanceVerdict(summaries, records.flatMap((record) => record.opponents.map((opponent, index) => ({ opponent, tier: record.tiers[index] ?? "expert" }))), report.smallestPlayed);
  const { fieldLow, fieldHigh, opponent, tier, perPair } = BALANCE_GATE;
  lines.push(
    "",
    `Balance gate (every fighter ${percent(fieldLow)}-${percent(fieldHigh)} against the field, ${opponent} ${tier}, at least ${perPair} a pair): ${verdict.passes ? "passes" : verdict.gateRun ? "fails" : "not a gate run"}.${verdict.outside.length === 0 ? "" : ` Outside: ${verdict.outside.join(", ")}.`}`,
    "",
    `Matchups (reported, not gated): inside ${percent(MATCHUP_LOW)}-${percent(MATCHUP_HIGH)} ${report.inside} of ${report.matchups}, at least ${report.smallestPlayed} matches each; 95% interval overlapping that band ${report.overlapping} of ${report.matchups}; median distance from 50% ${(100 * report.medianDeviation).toFixed(1)} points.`,
  );
  return lines.join("\n");
}

/** Whether a parsed --json file's records look like this script's match records. */
function isMatchRecords(value: unknown): value is MatchRecord[] {
  return Array.isArray(value) && value.every((record: unknown) => typeof record === "object" && record !== null && "fighters" in record && "sides" in record && "winner" in record);
}

/** The match records an earlier `--json` run wrote. */
function shardRecords(file: string): MatchRecord[] {
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  const records = typeof parsed === "object" && parsed !== null && "records" in parsed ? parsed.records : undefined;
  if (!isMatchRecords(records)) throw new Error(`${file} holds no cpuField --json records`);
  return records;
}

if (import.meta.main) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { variants: { type: "string" }, "per-pair": { type: "string" }, seeds: { type: "string" }, opponents: { type: "string" }, tiers: { type: "string" }, stocks: { type: "string" }, minutes: { type: "string" }, json: { type: "string" }, merge: { type: "string" }, fighters: { type: "string" }, pairs: { type: "string" } },
    strict: true,
  });
  const fighterNamed = (slug: string) => {
    const character = selectableCharacterBySlug(slug);
    if (character === undefined) throw new Error(`no fighter named ${slug}`);
    return character;
  };
  const fighters = values.fighters?.split(",").map(fighterNamed);
  const pairs = values.pairs?.split(",").map((pair) => {
    const [a, b, extra] = pair.split(":");
    if (a === undefined || b === undefined || extra !== undefined || a === b) throw new Error(`--pairs takes pairs of different fighters, like archer:rifleman; not ${pair}`);
    return [fighterNamed(a), fighterNamed(b)] as const;
  });
  const tierNamed = (value: string): CpuTier => {
    if (!isCpuTier(value)) throw new Error(`no difficulty named ${value}`);
    return value;
  };
  const opponentNamed = (value: string): CpuOpponentId => {
    if (!isCpuOpponent(value)) throw new Error(`no opponent named ${value}`);
    return value;
  };
  const tiers = values.tiers?.split(",").map(tierNamed);
  const opponents = values.opponents?.split(",").map(opponentNamed);
  if (tiers !== undefined && tiers.length !== 2) throw new Error("--tiers takes two difficulties");
  if (opponents !== undefined && opponents.length !== 2) throw new Error("--opponents takes two names");
  const options: FieldOptions = {
    variants: Number(values.variants ?? 1), seeds: Number(values.seeds ?? 1), stocks: Number(values.stocks ?? 3), minutes: Number(values.minutes ?? 4),
    ...(tiers === undefined ? {} : { tiers: [tiers[0] ?? "expert", tiers[1] ?? "expert"] as const }),
    ...(opponents === undefined ? {} : { opponents: [opponents[0] ?? "wren", opponents[1] ?? "wren"] as const }),
    ...(fighters === undefined ? {} : { fighters }),
    ...(pairs === undefined ? {} : { pairs }),
    ...(values["per-pair"] === undefined ? {} : { perPair: Number(values["per-pair"]) }),
  };
  const started = performance.now();
  let reported = 0;
  // --merge a.json,b.json: summarize the records of earlier --json runs (shards of one field) instead of playing.
  const merged = values.merge?.split(",").flatMap(shardRecords);
  const records = merged ?? playCpuField(options, (done, total) => {
    const now = performance.now();
    if (now - reported > 10000 || done === total) {
      reported = now;
      console.error(`${done}/${total} matches, ${((now - started) / 1000).toFixed(0)} s`);
    }
  });
  const summaries = summarizeField(records);
  if (merged !== undefined) console.log(`Merged from ${values.merge}; the line below describes this command's options, not the shards'.`);
  console.log(`${records.length} computer matches (${options.stocks} stocks, ${options.minutes}-minute clock, ${options.perPair === undefined ? `${options.variants} spawn variant(s) of ${options.seeds} seed(s) per ordered pair and stage` : `spawn variants and ${options.seeds} seed(s) each until each pair has ${options.perPair} matches`}, computer tiers ${(options.tiers ?? ["expert", "expert"]).join(" and ")}), ${((performance.now() - started) / 1000).toFixed(0)} s; win rate over decisive matches; a self-destruct is a stock lost with no hit taken since the fighter last stood on a deck or held the ledge; the fall-time column counts stocks lost over ${NO_HIT_FRAMES / MATCH_TICKS_PER_SECOND} s after the last hit.`);
  console.log("");
  console.log(fieldTable(summaries, records));
  if (values.json !== undefined) writeFileSync(values.json, `${JSON.stringify({ options, summaries, records }, null, 1)}\n`);
}
