









import { readFileSync, writeFileSync } from "node:fs";
import { f32 } from "wisp/src/sim/f32";
import { stateChecksum } from "../src/game/replay/canonical";
import { captureReplaySnapshot, createReplaySnapshot } from "../src/game/replay/snapshot";
import { parseArgs } from "node:util";
import { clearAttackBuffer } from "../src/game/input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../src/game/input/participants";
import { createFrameControls } from "../src/game/match/controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "../src/game/match/frameInput";
import { createPacingAndPresentation } from "../src/game/match/pacingAndPresentation";
import { MATCH_TICKS_PER_SECOND, Phase, createMatchState, setParticipants } from "../src/game/match/rules";
import { initializeMatchFighters, matchSpawnX } from "../src/game/match/step";
import { scheduleMeterDrops } from "../src/game/match/meterDrops";
import { produceComputerInput } from "../src/game/match/botPlay";
import { CORNER_BAND, cornered, insideLip } from "../src/game/match/botCorner";
import { recoveringBelow } from "../src/game/match/botEdgeGuard";
import { inLag } from "../src/game/match/cornerScenarios";
import { isCpuOpponent, isCpuTier, type CpuOpponentId, type CpuTier } from "../src/game/match/cpuProfiles";
import { gameplanOf } from "../src/game/match/botGameplan";
import type { CpuSkill } from "../src/game/match/cpuSkill";
import { type GameplanMove, GameplanSpecial, GameplanThrow } from "../src/game/sim/gameplan";
import { AttackStyle, type Character, DownState, GrabAction, LedgeState, SpecialAction } from "../src/game/sim/codes";
import { createFighter, type Fighter } from "../src/game/sim/fighter";
import { SELECTABLE_CHARACTERS, fighterSlug, selectableCharacterBySlug } from "../src/game/sim/heroes/registry";
import { copyControls, createRoster, fighterAt, neutralControls } from "../src/game/sim/roster";
import { mainDeckLeft, mainDeckRight } from "../src/game/sim/stage";
import soak from "./wisp/soak";
import { admitsThroughHelper, runAdmitted } from "./heavyCapacity";
import { spamOnly } from "./spamPolicy";
import { campInput, campOf } from "./campPolicy";
import { type DropVariant, advanceDropVariant, endDropVariant, startDropVariant } from "./dropVariants";
import baseline from "./balanceBaseline.json";
import { currentKit, currentComputerCode } from "./balanceKit";
import { currentFeel } from "./balanceFeel";
import { kitFailures, feelFailures, type Baseline, type TuningField } from "./balanceOptimizer";
import { BALANCE_SPEC, DISADVANTAGE_FRAMES, PUNISH_RESET_FRAMES, type Measured, type PlayStyleProfile, balanceGate, balanceScore, readProfiles, archetypeFailures, matchupFailures } from "./balance";


export const FIELD_STAGES: Readonly<Record<string, number>> = {
  "sky-deck": 0, "three-bridges": 1, "frozen-throne": 2, "drifting-deck": 3, "patterned-decks": 4,
  "wind": 10, "carried": 11, "cannon": 12, "timed-lift": 13, "hellfire": 14, "stratholme": 6, "tomb-of-sargeras": 7,
};

const NO_HIT_FRAMES = 3 * MATCH_TICKS_PER_SECOND;








export const BALANCE_GATE = { fieldLow: 0.45, fieldHigh: 0.55, opponent: "wren", tier: "expert", perPair: 400 } as const;

const MATCHUP_LOW = BALANCE_SPEC.matchupLow;
const MATCHUP_HIGH = BALANCE_SPEC.matchupHigh;

export const SPECIAL_MOVE = GameplanSpecial;

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
export const moveName = (move: number): string => MOVE_NAMES[move] ?? `move-${move}`;

export const reportedMove = (move: number): number =>
  move === AttackStyle.jab2 || move === AttackStyle.jab3 ? AttackStyle.jab
    : move === AttackStyle.forwardTiltUp || move === AttackStyle.forwardTiltDown ? AttackStyle.forwardTilt
      : move === AttackStyle.demonHunterDashAttack ? AttackStyle.dashAttack : move;


function specialMove(action: number): number | undefined {
  switch (action) { case SpecialAction.riflemanBlaster: case SpecialAction.demonHunterManaBurn: case SpecialAction.heroNeutral:
      return SPECIAL_MOVE.neutral; case SpecialAction.riflemanBear: case SpecialAction.demonHunterFelRush: case SpecialAction.heroSide:
      return SPECIAL_MOVE.side; case SpecialAction.riflemanRecovery: case SpecialAction.demonHunterWingAscent: case SpecialAction.heroUp:
      return SPECIAL_MOVE.up; case SpecialAction.riflemanTrap: case SpecialAction.demonHunterImmolate: case SpecialAction.heroDown:
      return SPECIAL_MOVE.down;
    default:
      return undefined;
  }
}

interface SideRecord {
  readonly fighter: string;

  readonly moves: Record<number, number>;
  hitsLanded: number;
  damageDealt: number;

  manaSpent: number;
  specialsStarted: number;

  specialsRefused: number;

  stocksPlayed: number;
  readonly stockLosses: { readonly frame: number; readonly sinceHit: number | undefined; readonly selfDestruct: boolean }[];

  readonly damageByMove: Record<number, number>;

  readonly kosByMove: Record<number, number>;

  rangedDamage: number;

  approachFrames: number;
  retreatFrames: number;
  readonly punishes: PunishTotals;
  /** Corner and edge play (#386, #387): lags ended by sliding off a main-deck lip, corners entered and left to the centre unhit, hits on an opponent recovering below the deck, those landed from off stage, and stocks they took. */
  readonly edges: EdgePlay;
  /** Ledge play (#386): frames at or below the ledge, frames in, and hits landed and taken from the ledge (holding it or within LEDGE_PLAY_FRAMES of letting go) and on the main deck. */
  readonly ledge?: LedgePlay;
}

export interface LedgePlay {
  belowFrames: number;
  inFrames: number;
  ledgeLanded: number;
  ledgeTaken: number;
  stageLanded: number;
  stageTaken: number;
}

const LEDGE_PLAY_FRAMES = 60;

export interface EdgePlay {
  edgeCancels: number;
  corners: number;
  cornerEscapes: number;
  edgeGuardHits: number;
  offstageHits: number;
  edgeGuardKills: number;
}

const emptyEdgePlay = (): EdgePlay => ({ edgeCancels: 0, corners: 0, cornerEscapes: 0, edgeGuardHits: 0, offstageHits: 0, edgeGuardKills: 0 });








export interface PunishTotals {
  openings: number;

  neutralWins: number;

  neutralConverted: number;
  pokes: number;
  pokeDamage: number;

  oneHit: number;

  kills: number;

  zeroToDeaths: number;

  hits: number;
  damage: number;
  maxHits: number;
  maxDamage: number;
}

export interface MatchRecord {
  readonly skillOverrides?: FieldOptions["skills"];
  readonly stage: string;
  readonly variant: number;
  readonly seed: number;

  readonly opponents: readonly [CpuOpponentId, CpuOpponentId];
  readonly tiers: readonly [CpuTier, CpuTier];
  readonly fighters: readonly [string, string];

  readonly winner: number | null;
  readonly timedOut: boolean;
  readonly frames: number;
  readonly sides: readonly [SideRecord, SideRecord];

  readonly apartFrames: number;
  readonly apartOnStageFrames: number;
  readonly bothInFrames: number;
  readonly dropsTaken: readonly [number, number];
  /** Frames each side spent camping under FieldOptions.camp. */
  readonly campFrames: readonly [number, number];
  readonly ended?: boolean;
  readonly checksums?: readonly (readonly [number, string])[];
  readonly strings?: readonly ZeroToDeath[];
  /** Under FieldOptions.playtest: every string of two or more hits, and the longest span with no damage or stock change (#403). */
  readonly combos?: readonly ComboRecord[];
  readonly quiet?: { readonly from: number; readonly frames: number };
}

/** One string as the playtester sees it: per hit the move, the attacker's move instance (consecutive hits of one instance are one move) and the damage; gaps are the victim's actionable frames between hits. */
export interface ComboRecord {
  readonly victim: number;
  readonly frame: number;
  readonly start: number;
  readonly moves: readonly number[];
  readonly instances: readonly number[];
  readonly damages: readonly number[];
  readonly gaps: readonly number[];
}

export interface ZeroToDeath {
  readonly victim: number;
  readonly frame: number;
  readonly hits: number;
  readonly damage: number;
  readonly gaps: readonly number[];
  readonly tail: number;
}

export interface FieldOptions {
  readonly skills?: readonly [CpuSkill | undefined, CpuSkill | undefined];
  readonly variants?: number;
  readonly stocks?: number;
  readonly minutes?: number;
  readonly fighters?: readonly Character[];

  readonly pairs?: readonly (readonly [Character, Character])[];
  readonly stages?: readonly string[];

  readonly perPair?: number;

  readonly seeds?: number;
  readonly seedOffset?: number;

  readonly opponents?: readonly [CpuOpponentId, CpuOpponentId];
  readonly tiers?: readonly [CpuTier, CpuTier];

  readonly spam?: Readonly<Partial<Record<string, number>>>;

  readonly drops?: boolean;

  readonly frameCap?: number;

  readonly checksumEvery?: number;
  /** A field-only change to the drops (dropVariants.ts); the shipped rule when absent. */
  readonly dropVariant?: DropVariant;
  /** The fighter ahead on stocks camps (campPolicy.ts). */
  readonly camp?: boolean;
  /** Field-only: "melee" restores full ledge intangibility on every grab (no #386 decay). */
  readonly ledgeRule?: "melee";
  /** Record every string and the longest quiet span for the overnight playtester (#403). */
  readonly playtest?: boolean;
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

  lastSafe: number | undefined;

  lastStarted: number | undefined;
  starts: number;

  lastHitMove: number | undefined;

  punish: Punish | undefined;

  stockFirstHit: boolean;
  grounded: boolean;
  lagging: boolean;
  cornered: boolean;
  recovering: boolean;
  edgeGuarded: boolean;
  ledgeUntil: number;
}

interface Punish {
  hits: number;
  damage: number;
  quiet: number;
  neutral: boolean;
  disadvantage: boolean;

  stunned: number;
  fromStockStart: boolean;
  free: number;
  gaps: number[];
  start: number;
  moves: number[];
  instances: number[];
  damages: number[];
}

const watchOf = (f: Readonly<Fighter>): Watch => ({
  serial: f.attack.serial, special: f.special.action, specialFrame: f.special.frame, specialForm: f.special.form, mana: f.mana.points, denied: f.visuals.manaDenied, hits: f.visuals.hit, damage: f.status.damage, out: f.status.out, lastHit: undefined, lastSafe: undefined, lastStarted: undefined, starts: 0, lastHitMove: undefined, punish: undefined, stockFirstHit: true,
  grounded: f.motion.grounded, lagging: false, cornered: false, recovering: false, edgeGuarded: false, ledgeUntil: -1,
});


function strikingMove(f: Readonly<Fighter>): number | undefined {
  if (f.grab.target !== undefined || (f.grab.action >= GrabAction.hold && f.grab.action <= GrabAction.throwDown)) return AttackStyle.grab;
  const special = specialMove(f.special.action);
  if (special !== undefined) return special;
  return f.attack.style === undefined ? undefined : reportedMove(f.attack.style);
}


const unactionable = (f: Readonly<Fighter>): boolean =>
  f.launch.hitlag > 0 || f.launch.hitstun > 0 || f.grab.owner !== undefined || f.down.state !== DownState.none;

const emptyPunishes = (): PunishTotals => ({ openings: 0, neutralWins: 0, neutralConverted: 0, pokes: 0, pokeDamage: 0, oneHit: 0, kills: 0, zeroToDeaths: 0, hits: 0, damage: 0, maxHits: 0, maxDamage: 0 });


function closePunish(totals: PunishTotals, punish: Punish, kill: boolean, strings?: ZeroToDeath[], victim = 0, frame = 0, combos?: ComboRecord[]): void {
  if (combos !== undefined && punish.hits >= 2) combos.push({ victim, frame, start: punish.start, moves: punish.moves, instances: punish.instances, damages: punish.damages, gaps: punish.gaps });
  if (punish.hits < 2) totals.oneHit++;
  if (punish.hits < 2 && !punish.disadvantage && !kill) {
    totals.pokes++;
    totals.pokeDamage += punish.damage;
    return;
  }
  totals.openings++;
  if (punish.neutral) {
    totals.neutralWins++;
    if (punish.hits >= 2) totals.neutralConverted++;
  }
  totals.hits += punish.hits;
  totals.damage += punish.damage;
  totals.maxHits = Math.max(totals.maxHits, punish.hits);
  totals.maxDamage = Math.max(totals.maxDamage, punish.damage);
  if (kill) {
    totals.kills++;
    if (punish.fromStockStart) {
      totals.zeroToDeaths++;
      strings?.push({ victim, frame, hits: punish.hits, damage: punish.damage, gaps: punish.gaps, tail: punish.free });
    }
  }
}

const NEUTRAL = neutralControls();


const onMainDeck = (f: Readonly<Fighter>, stage: number): boolean =>
  f.motion.x >= mainDeckLeft(stage) && f.motion.x <= mainDeckRight(stage) && f.motion.z >= 0.0;

export function playCpuMatch(a: Character, b: Character, stageName: string, variant: number, options: FieldOptions = {}, seed = 0): MatchRecord | undefined {
  const stage = FIELD_STAGES[stageName];
  if (stage === undefined) throw new Error(`no stage named ${stageName}`);
  const shift = SHIFTS[variant % SHIFTS.length] ?? 0.0;
  const xs = [f32(matchSpawnX(0) + shift), f32(matchSpawnX(1) + shift)] as const;

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
  match.drops.on = options.drops === true;
  scheduleMeterDrops(match);
  const dropRule = options.dropVariant === undefined || !match.drops.on ? undefined : startDropVariant(options.dropVariant, match);
  const world = createRoster(3, [createFighter(a, xs[0], 1), createFighter(b, xs[1], -1)]);
  const controls = createFrameControls();
  const produced = createFrameControls();
  const runtime = createPacingAndPresentation();
  const row = createMatchFrameInput();
  initializeMatchFighters(match, world);
  const side = (character: Character): SideRecord => ({
    fighter: fighterSlug(character), moves: {}, hitsLanded: 0, damageDealt: 0, manaSpent: 0, specialsStarted: 0, specialsRefused: 0, stocksPlayed: 0, stockLosses: [],
    damageByMove: {}, kosByMove: {}, rangedDamage: 0, approachFrames: 0, retreatFrames: 0, punishes: emptyPunishes(), edges: emptyEdgePlay(),
    ledge: { belowFrames: 0, inFrames: 0, ledgeLanded: 0, ledgeTaken: 0, stageLanded: 0, stageTaken: 0 },
  });
  const spam = [options.spam?.[fighterSlug(a)], options.spam?.[fighterSlug(b)]] as const;
  const sides: [SideRecord, SideRecord] = [side(a), side(b)];
  const watches = [watchOf(fighterAt(world, 0)), watchOf(fighterAt(world, 1))] as const;
  const halfStage = f32(f32(mainDeckRight(stage) - mainDeckLeft(stage)) * 0.5);
  let apartFrames = 0;
  let apartOnStageFrames = 0;
  let bothInFrames = 0;
  let pickups = 0;
  const takes: [number, number] = [0, 0];
  const limit = options.frameCap ?? (match.timeLimitMinutes * 60 + 5) * MATCH_TICKS_PER_SECOND;
  const checksumEvery = options.checksumEvery ?? 0;
  const checksums: [number, string][] = [];
  const strings: ZeroToDeath[] = [];
  const combos: ComboRecord[] | undefined = options.playtest === true ? [] : undefined;
  let lastChange = 0;
  let quiet = { from: 0, frames: 0 };
  const snapshot = checksumEvery > 0 ? createReplaySnapshot() : undefined;
  const checksumNow = (at: number) => {
    if (snapshot === undefined) return;
    captureReplaySnapshot(snapshot, world, match, controls, runtime);
    checksums.push([at, stateChecksum(snapshot)]);
  };
  const camps = options.camp === true ? [campOf(seed, 0, a), campOf(seed, 1, b)] as const : undefined;
  let frame = 0;
  while (match.phase === Phase.match && frame < limit) {
    frame = runtime.simulationFrame + 1;
    for (const slot of PARTICIPANT_SLOTS) {
      copyControls(produced.inputs[slot], NEUTRAL);
      clearAttackBuffer(produced.commands[slot]);
      if (slot === 0 || slot === 1) produceComputerInput(match, world, runtime, slot, frame, produced.inputs[slot], produced.commands[slot], options.skills?.[slot]);
      const only = slot === 0 || slot === 1 ? spam[slot] : undefined;
      if (only !== undefined) spamOnly(fighterAt(world, slot), fighterAt(world, 1 - slot), only, stage, frame, produced.inputs[slot], produced.commands[slot]);
      if (camps !== undefined && (slot === 0 || slot === 1)) campInput(camps[slot], fighterAt(world, slot), fighterAt(world, 1 - slot), stage, frame, produced.inputs[slot], produced.commands[slot]);
    }
    if (!captureFrame(row, frame, world.mask, produced, runtime)) throw new Error(`capture refused frame ${frame}`);
    if (!executeMatchFrame(row, match, world, controls, runtime, frame)) throw new Error(`execution refused frame ${frame}`);
    if (dropRule !== undefined) advanceDropVariant(dropRule, match, world);
    if (options.ledgeRule === "melee") for (const slot of [0, 1] as const) fighterAt(world, slot).ledge.grabs = 0;
    if (match.drops.pickupSerial !== pickups) {
      pickups = match.drops.pickupSerial;
      if (match.drops.lastTaker === 0 || match.drops.lastTaker === 1) takes[match.drops.lastTaker]++;
    }
    const first = fighterAt(world, 0), second = fighterAt(world, 1);
    if (!first.status.out && !second.status.out) {
      bothInFrames++;
      if (Math.abs(f32(first.motion.x - second.motion.x)) > halfStage) {
        apartFrames++;
        if (onMainDeck(first, stage) && onMainDeck(second, stage)) apartOnStageFrames++;
      }
    }
    if (checksumEvery > 0 && frame % checksumEvery === 0) checksumNow(frame);
    for (const slot of [0, 1] as const) {
      const f = fighterAt(world, slot);
      const seen = watches[slot];
      const own = sides[slot];
      const other = sides[1 - slot];
      const opponent = fighterAt(world, 1 - slot);
      const opponentSeen = watches[slot === 0 ? 1 : 0];
      if (f.attack.serial !== seen.serial && f.attack.style !== undefined) {
        own.moves[f.attack.style] = (own.moves[f.attack.style] ?? 0) + 1;
        seen.lastStarted = reportedMove(f.attack.style);
        seen.starts++;
      }
      const special = specialMove(f.special.action);
      const startedSpecial = special !== undefined && (f.special.action !== seen.special || f.special.frame < seen.specialFrame);
      if (startedSpecial) {
        own.moves[special] = (own.moves[special] ?? 0) + 1;
        own.specialsStarted++;
        seen.lastStarted = special;
        seen.starts++;
      }
      if (!f.status.out && !unactionable(f) && Math.abs(f.motion.vx) > 1.0) {
        if (f32(f.motion.vx * f32(opponent.motion.x - f.motion.x)) > 0) own.approachFrames++;
        else own.retreatFrames++;
      }
      const branched = special !== undefined && f.special.action === seen.special && f.special.form !== seen.specialForm;
      if ((startedSpecial || branched) && f.mana.points < seen.mana) own.manaSpent += seen.mana - f.mana.points;
      own.specialsRefused += f.visuals.manaDenied - seen.denied;
      const hit = f.visuals.hit !== seen.hits;
      const ledge = own.ledge;
      if (f.ledge.state !== LedgeState.none) seen.ledgeUntil = frame + LEDGE_PLAY_FRAMES;
      if (ledge !== undefined && !f.status.out) {
        ledge.inFrames++;
        if (f.ledge.state !== LedgeState.none || f.motion.z < 0.0) ledge.belowFrames++;
      }
      if (hit && other?.ledge !== undefined && ledge !== undefined) {
        if (seen.ledgeUntil >= frame) ledge.ledgeTaken++;
        else if (onMainDeck(f, stage)) ledge.stageTaken++;
        if (opponent.ledge.state !== LedgeState.none || opponentSeen.ledgeUntil >= frame) other.ledge.ledgeLanded++;
        else if (onMainDeck(opponent, stage)) other.ledge.stageLanded++;
      }
      const dealt = f.status.damage > seen.damage ? f.status.damage - seen.damage : 0;
      if (hit && other !== undefined) {
        other.hitsLanded++;
        seen.lastHit = frame;
        if (seen.recovering) {
          other.edges.edgeGuardHits++;
          seen.edgeGuarded = true;
          if (!opponent.motion.grounded && insideLip(stage, opponent.motion.x) < 0.0) other.edges.offstageHits++;
        }
      }
      const lagging = inLag(f);
      if (seen.grounded && !f.motion.grounded && seen.lagging && !lagging && f.launch.hitstun <= 0 && !f.special.fall && insideLip(stage, f.motion.x) < 0.0) own.edges.edgeCancels++;
      const inCorner = !f.status.out && cornered(f, opponent, stage);
      if (inCorner && !seen.cornered) own.edges.corners++;
      if (seen.cornered && !inCorner && !hit && !f.status.out && insideLip(stage, f.motion.x) > CORNER_BAND) own.edges.cornerEscapes++;
      seen.cornered = inCorner && !hit;
      if ((hit || dealt > 0) && other !== undefined) {
        const striking = strikingMove(opponent);
        const move = striking ?? opponentSeen.lastStarted;
        if (move !== undefined) {
          seen.lastHitMove = move;
          if (dealt > 0) other.damageByMove[move] = (other.damageByMove[move] ?? 0) + dealt;
        }
        if (striking === undefined) other.rangedDamage += dealt;
        other.damageDealt += dealt;
        if (seen.punish === undefined) {
          seen.punish = { hits: 0, damage: 0, quiet: 0, neutral: opponentSeen.punish === undefined, disadvantage: false, stunned: 0, fromStockStart: seen.stockFirstHit, free: 0, gaps: [], start: seen.damage, moves: [], instances: [], damages: [] };
          seen.stockFirstHit = false;
        }
        if (hit && seen.punish.hits > 0) {
          seen.punish.gaps.push(seen.punish.free);
          seen.punish.free = 0;
        }
        seen.punish.hits += hit ? 1 : 0;
        seen.punish.damage += dealt;
        if (combos !== undefined) {
          const p = seen.punish;
          if (hit) {
            p.moves.push(move ?? -1);
            p.instances.push(opponentSeen.starts);
            p.damages.push(dealt);
          } else if (p.damages.length > 0) p.damages[p.damages.length - 1] = (p.damages[p.damages.length - 1] ?? 0) + dealt;
        }
        seen.punish.quiet = 0;
      } else if (seen.punish !== undefined && other !== undefined) {
        const punish = seen.punish;
        if (!f.status.out && !unactionable(f)) punish.free++;

        if (unactionable(f)) {
          punish.quiet = 0;
          if (punish.hits === 1 && ++punish.stunned >= DISADVANTAGE_FRAMES) punish.disadvantage = true;
        } else if (f.motion.grounded && ++punish.quiet > PUNISH_RESET_FRAMES) {
          closePunish(other.punishes, punish, false, undefined, slot, frame, combos);
          seen.punish = undefined;
        }
      }

      if (seen.punish !== undefined && (f.down.state !== DownState.none || f.ledge.state !== LedgeState.none || f.motion.x < mainDeckLeft(stage) || f.motion.x > mainDeckRight(stage) || f.motion.z < 0.0)) seen.punish.disadvantage = true;

      if (!f.status.out && f.launch.hitlag <= 0 && f.launch.hitstun <= 0 && (f.motion.grounded || f.ledge.state !== LedgeState.none)) {
        seen.lastSafe = frame;
        seen.edgeGuarded = false;
      }
      if (f.status.out && !seen.out) {
        const selfDestruct = seen.lastHit === undefined || (seen.lastSafe !== undefined && seen.lastHit < seen.lastSafe);
        own.stockLosses.push({ frame, sinceHit: seen.lastHit === undefined ? undefined : frame - seen.lastHit, selfDestruct });
        if (!selfDestruct && other !== undefined && seen.lastHitMove !== undefined) other.kosByMove[seen.lastHitMove] = (other.kosByMove[seen.lastHitMove] ?? 0) + 1;
        if (!selfDestruct && other !== undefined && seen.edgeGuarded) other.edges.edgeGuardKills++;
        seen.edgeGuarded = false;
        if (seen.punish !== undefined && other !== undefined) closePunish(other.punishes, seen.punish, !selfDestruct, strings, slot, frame, combos);
        seen.punish = undefined;
        seen.stockFirstHit = true;
        seen.lastHit = undefined;
        seen.lastHitMove = undefined;
      }
      seen.serial = f.attack.serial;
      seen.special = f.special.action;
      seen.specialFrame = f.special.frame;
      seen.specialForm = f.special.form;
      seen.mana = f.mana.points;
      seen.denied = f.visuals.manaDenied;
      seen.hits = f.visuals.hit;
      if (f.status.damage !== seen.damage || f.status.out !== seen.out) {
        if (frame - lastChange > quiet.frames) quiet = { from: lastChange, frames: frame - lastChange };
        lastChange = frame;
      }
      seen.damage = f.status.damage;
      seen.out = f.status.out;
      seen.grounded = f.motion.grounded;
      seen.lagging = lagging;
      seen.recovering = recoveringBelow(f, stage);
    }
  }
  for (const slot of [0, 1] as const) {
    const open = watches[slot].punish;
    if (open !== undefined) closePunish(sides[slot === 0 ? 1 : 0].punishes, open, false, undefined, slot, frame, combos);
  }
  if (frame - lastChange > quiet.frames) quiet = { from: lastChange, frames: frame - lastChange };
  if (checksumEvery > 0) checksumNow(frame);
  if (dropRule !== undefined) endDropVariant(dropRule, match);
  for (const slot of [0, 1] as const) sides[slot].stocksPlayed = sides[slot].stockLosses.length + (fighterAt(world, slot).status.stocks > 0 ? 1 : 0);
  return {
    stage: stageName, variant, seed, opponents, tiers, skillOverrides: options.skills, fighters: [sides[0].fighter, sides[1].fighter],
    winner: match.winner === 0 || match.winner === 1 ? match.winner : null, timedOut: match.timedOut, frames: frame, sides,
    apartFrames, apartOnStageFrames, bothInFrames, dropsTaken: takes, campFrames: camps === undefined ? [0, 0] : [camps[0].frames, camps[1].frames],
    ended: match.phase !== Phase.match, ...(checksumEvery > 0 ? { checksums } : {}), strings,
    ...(combos === undefined ? {} : { combos, quiet }),
  };
}






export function playCpuField(options: FieldOptions = {}, progress?: (done: number, total: number) => void): MatchRecord[] {
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
        const record = playCpuMatch(x, y, stage, variant, options, seed + (options.seedOffset ?? 0));
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

  readonly winRate: number;

  readonly against: Readonly<Record<string, number>>;

  readonly played: Readonly<Record<string, number>>;

  readonly decisive: Readonly<Record<string, number>>;
  readonly stockLosses: number;

  readonly selfDestructs: number;
  readonly selfDestructShare: number;

  readonly noHitLosses: number;
  readonly noHitShare: number;
  readonly damagePerHit: number;

  readonly manaPerStock: number;

  readonly refusedShare: number;
  readonly moves: readonly MoveUse[];
  readonly style: StyleSummary;
}

export interface MoveDamage {
  readonly move: number;
  readonly name: string;
  readonly damage: number;
  readonly share: number;
}


export interface StyleSummary {

  readonly damage: readonly MoveDamage[];
  readonly kos: readonly MoveDamage[];
  readonly topDamageShare: number;
  readonly top2DamageShare: number;

  readonly aerials: Readonly<Record<string, number>>;

  readonly airShare: number;

  readonly approachShare: number;

  readonly rangedShare: number;

  readonly specials: Readonly<Record<string, number>>;

  readonly variety: number;

  readonly kills: number;

  readonly slippiOpeningsPerKill: number;

  readonly oneHitShare: number;

  readonly openingsPerKill: number;

  readonly damagePerOpening: number;
  readonly neutralConversion: number;
  readonly averageComboHits: number;
  readonly maxComboHits: number;
  readonly maxComboDamage: number;
  readonly zeroToDeathShare: number;
  readonly pokesPerKill: number;
  readonly pokeDamagePerKill: number;
}

const AERIAL_MOVES = [AttackStyle.neutralAir, AttackStyle.forwardAir, AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir] as const;
const SPECIAL_MOVES: readonly number[] = [SPECIAL_MOVE.neutral, SPECIAL_MOVE.side, SPECIAL_MOVE.up, SPECIAL_MOVE.down];





export const REPORTED_MOVES: readonly number[] = [
  AttackStyle.jab, AttackStyle.forwardTilt, AttackStyle.upTilt, AttackStyle.downTilt, AttackStyle.forwardSmash, AttackStyle.upSmash, AttackStyle.downSmash,
  AttackStyle.dashAttack, AttackStyle.grab, ...AERIAL_MOVES, ...SPECIAL_MOVES,
];

const varietyMove = (move: number): number => (move === AttackStyle.shot ? AttackStyle.jab : reportedMove(move));


export function moveVariety(counts: ReadonlyMap<number, number>, kit = REPORTED_MOVES.length): number {
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  if (total === 0 || kit < 2) return 0;
  let entropy = 0;
  for (const count of counts.values()) if (count > 0) entropy -= (count / total) * Math.log(count / total);
  return entropy / Math.log(kit);
}

const ratio = (top: number, bottom: number) => (bottom === 0 ? Number.NaN : top / bottom);

function shares(totals: ReadonlyMap<number, number>): MoveDamage[] {
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
  return [...totals.entries()].map(([move, damage]) => ({ move, name: moveName(move), damage, share: total === 0 ? 0 : damage / total }))
    .sort((x, y) => y.damage - x.damage || x.move - y.move);
}


export function styleSummary(records: readonly MatchRecord[], fighter: string): StyleSummary {
  const damage = new Map<number, number>();
  const kos = new Map<number, number>();
  const started = new Map<number, number>();
  const punish = emptyPunishes();
  let ranged = 0, dealt = 0, approach = 0, retreat = 0;
  for (const record of records) for (const side of record.sides) {
    if (side.fighter !== fighter) continue;
    for (const [move, value] of Object.entries(side.damageByMove)) damage.set(Number(move), (damage.get(Number(move)) ?? 0) + value);
    for (const [move, value] of Object.entries(side.kosByMove)) kos.set(Number(move), (kos.get(Number(move)) ?? 0) + value);
    for (const [move, value] of Object.entries(side.moves)) started.set(varietyMove(Number(move)), (started.get(varietyMove(Number(move))) ?? 0) + value);
    ranged += side.rangedDamage;
    dealt += side.damageDealt;
    approach += side.approachFrames;
    retreat += side.retreatFrames;
    const p = side.punishes;
    punish.openings += p.openings;
    punish.neutralWins += p.neutralWins;
    punish.neutralConverted += p.neutralConverted;
    punish.pokes += p.pokes;
    punish.pokeDamage += p.pokeDamage;
    punish.oneHit += p.oneHit;
    punish.kills += p.kills;
    punish.zeroToDeaths += p.zeroToDeaths;
    punish.hits += p.hits;
    punish.damage += p.damage;
    punish.maxHits = Math.max(punish.maxHits, p.maxHits);
    punish.maxDamage = Math.max(punish.maxDamage, p.maxDamage);
  }
  const damageShares = shares(damage);
  const kit = new Map([...started].filter(([move]) => REPORTED_MOVES.includes(move)));
  const aerialTotal = AERIAL_MOVES.reduce((sum, move) => sum + (started.get(move) ?? 0), 0);
  const normalTotal = [...kit].filter(([move]) => !SPECIAL_MOVES.includes(move)).reduce((sum, [, count]) => sum + count, 0);
  const startedTotal = [...started.values()].reduce((sum, count) => sum + count, 0);
  const kills = punish.kills;
  const punishes = punish.openings + punish.pokes;
  return {
    damage: damageShares,
    kos: shares(kos),
    topDamageShare: damageShares[0]?.share ?? 0,
    top2DamageShare: (damageShares[0]?.share ?? 0) + (damageShares[1]?.share ?? 0),
    aerials: Object.fromEntries(AERIAL_MOVES.map((move) => [moveName(move), aerialTotal === 0 ? 0 : (started.get(move) ?? 0) / aerialTotal])),
    airShare: ratio(aerialTotal, normalTotal),
    approachShare: ratio(approach, approach + retreat),
    rangedShare: ratio(ranged, dealt),
    specials: Object.fromEntries(SPECIAL_MOVES.map((move) => [moveName(move), startedTotal === 0 ? 0 : (started.get(move) ?? 0) / startedTotal])),
    variety: moveVariety(kit),
    kills,
    slippiOpeningsPerKill: ratio(punishes, kills),
    oneHitShare: ratio(punish.oneHit, punishes),
    openingsPerKill: ratio(punish.openings, kills),
    damagePerOpening: ratio(punish.damage, punish.openings),
    neutralConversion: ratio(punish.neutralConverted, punish.neutralWins),
    averageComboHits: ratio(punish.hits, punish.openings),
    maxComboHits: punish.maxHits,
    maxComboDamage: punish.maxDamage,
    zeroToDeathShare: ratio(punish.zeroToDeaths, kills),
    pokesPerKill: ratio(punish.pokes, kills),
    pokeDamagePerKill: ratio(punish.pokeDamage, kills),
  };
}


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







export function fighterMoveUsage(character: Character, options: FieldOptions = {}): MoveUse[] {
  const fighters = options.fighters ?? SELECTABLE_CHARACTERS;
  const stages = options.stages ?? Object.keys(FIELD_STAGES);
  const records: MatchRecord[] = [];
  for (const other of fighters) {

    if (other === character && fighters.length > 1) continue;
    for (let seed = 0; seed < (options.seeds ?? 1); seed++) for (const stage of stages) for (let variant = 0; variant < (options.variants ?? 1); variant++) {
      for (const pair of other === character ? [[character, other] as const] : [[character, other], [other, character]] as const) {
        const record = playCpuMatch(pair[0], pair[1], stage, variant, options, seed + (options.seedOffset ?? 0));
        if (record !== undefined) records.push(record);
      }
    }
  }
  return moveUsage(records, fighterSlug(character));
}


export function keyMovesAmongMostUsed(usage: readonly MoveUse[], key: readonly number[], top: number): { readonly ok: boolean; readonly missing: readonly number[] } {
  const leading = new Set(usage.slice(0, top).map((use) => use.move));
  const missing = key.filter((move) => !leading.has(move));
  return { ok: missing.length === 0, missing };
}


const countedAs = (move: number): number => (move >= GameplanThrow.forward && move <= GameplanThrow.down ? AttackStyle.grab : move);

const namedAs = (move: number): number =>
  move === AttackStyle.demonHunterDashAttack ? AttackStyle.dashAttack
    : move === AttackStyle.forwardTiltUp || move === AttackStyle.forwardTiltDown ? AttackStyle.forwardTilt : move;








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
  const total = usage.reduce((sum, use) => sum + use.count, 0);
  const keyShares = declared.map((move) => ({ name: moveName(move), share: total === 0 ? 0 : (merged.get(move)?.count ?? 0) / total }));
  return { ...result, missingNames: result.missing.map(moveName), usage, keyShares, meanShare: usage.length === 0 ? 0 : 1 / usage.length };
}

export interface MatchupReport {
  readonly matchups: number;

  readonly inside: number;

  readonly overlapping: number;

  readonly medianDeviation: number;
  readonly smallestPlayed: number;

  readonly missing: readonly string[];
}


export function matchupReport(summaries: readonly Pick<FighterSummary, "fighter" | "against" | "played" | "decisive">[]): MatchupReport {
  const names = summaries.map((s) => s.fighter);
  const deviations: number[] = [];
  const missing: string[] = [];
  let inside = 0, overlapping = 0, smallestPlayed = Number.POSITIVE_INFINITY;
  summaries.forEach((s, row) => {
    for (const name of names.slice(row + 1)) {

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

  readonly outside: readonly string[];

  readonly gateRun: boolean;
  readonly passes: boolean;
}


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
      style: styleSummary(records, fighter),
    };
  });
}

const percent = (value: number) => (Number.isNaN(value) ? "-" : `${(100 * value).toFixed(0)}%`);

/** Ledge play (#386): the share of in-play frames at or below the ledge, and per fighter the share of hit exchanges it wins from the ledge against on the main deck, flagged when the ledge share is higher at 95% (two-proportion z > 1.96). */
export function ledgePlayLines(records: readonly MatchRecord[]): string[] {
  let below = 0, inFrames = 0;
  const by: Record<string, LedgePlay> = {};
  for (const record of records) for (const side of record.sides) {
    const ledge = side.ledge;
    if (ledge === undefined) continue;
    below += ledge.belowFrames;
    inFrames += ledge.inFrames;
    const row = by[side.fighter] ??= { belowFrames: 0, inFrames: 0, ledgeLanded: 0, ledgeTaken: 0, stageLanded: 0, stageTaken: 0 };
    for (const key of ["belowFrames", "inFrames", "ledgeLanded", "ledgeTaken", "stageLanded", "stageTaken"] as const) row[key] += ledge[key];
  }
  if (inFrames === 0) return [];
  const pct = (n: number) => `${(100 * n).toFixed(1)}%`;
  const lines = [`Ledge play: ${pct(below / inFrames)} of in-play frames at or below the ledge.`, "", "| Fighter | at/below ledge | exchanges won from the ledge | on stage | ledge higher at 95% |", "|---|---|---|---|---|"];
  let higher = 0;
  for (const fighter of Object.keys(by).sort()) {
    const row = by[fighter];
    if (row === undefined) continue;
    const n1 = row.ledgeLanded + row.ledgeTaken, n2 = row.stageLanded + row.stageTaken;
    const p1 = n1 === 0 ? 0 : row.ledgeLanded / n1, p2 = n2 === 0 ? 0 : row.stageLanded / n2;
    const pooled = n1 + n2 === 0 ? 0 : (row.ledgeLanded + row.stageLanded) / (n1 + n2);
    const se = Math.sqrt(pooled * (1 - pooled) * (1 / Math.max(1, n1) + 1 / Math.max(1, n2)));
    const flagged = n1 > 0 && n2 > 0 && se > 0 && (p1 - p2) / se > 1.96;
    if (flagged) higher++;
    lines.push(`| ${fighter} | ${pct(row.belowFrames / Math.max(1, row.inFrames))} | ${pct(p1)} of ${n1} | ${pct(p2)} of ${n2} | ${flagged ? "yes" : "no"} |`);
  }
  lines.push("", `Ledge play: ${higher} fighter(s) win more exchanges from the ledge than on stage at 95%.`);
  return lines;
}

/** Corner and edge play per computer tier, per side-match: the #386 and #387 measures. */
export function edgePlayLines(records: readonly MatchRecord[]): string[] {
  const tiers = new Map<string, { sides: number; minutes: number; play: EdgePlay }>();
  for (const record of records) for (const slot of [0, 1] as const) {
    const tier = record.tiers[slot];
    const row = tiers.get(tier) ?? { sides: 0, minutes: 0, play: emptyEdgePlay() };
    const edges = record.sides[slot].edges;
    row.sides++;
    row.minutes += record.frames / MATCH_TICKS_PER_SECOND / 60;
    row.play.edgeCancels += edges.edgeCancels;
    row.play.corners += edges.corners;
    row.play.cornerEscapes += edges.cornerEscapes;
    row.play.edgeGuardHits += edges.edgeGuardHits;
    row.play.offstageHits += edges.offstageHits;
    row.play.edgeGuardKills += edges.edgeGuardKills;
    tiers.set(tier, row);
  }
  return [...tiers].map(([tier, { sides, minutes, play }]) => {
    const per = (n: number) => (n / sides).toFixed(2);
    return `Corner and edge play, ${tier} (${sides} sides, ${minutes.toFixed(0)} min): ${per(play.edgeCancels)} edge cancels, ${per(play.corners)} corners with ${play.corners === 0 ? "-" : `${Math.round(100 * play.cornerEscapes / play.corners)}%`} escaped to the centre unhit, ${per(play.edgeGuardHits)} edge-guard hits (${per(play.offstageHits)} from off stage) and ${per(play.edgeGuardKills)} edge-guard kills a side.`;
  });
}

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
    `Matchup gate (${BALANCE_SPEC.matchupMatches} a pair): ${summaries.every(summary => matchupFailures(Object.fromEntries(Object.entries(summary.against).map(([name, rate]) => [name, { rate, matches: summary.played[name] ?? 0 }]))).length === 0) ? "passes" : "fails"}; inside ${percent(MATCHUP_LOW)}-${percent(MATCHUP_HIGH)} ${report.inside} of ${report.matchups}, at least ${report.smallestPlayed} matches each; 95% interval overlapping that band ${report.overlapping} of ${report.matchups}; median distance from 50% ${(100 * report.medianDeviation).toFixed(1)} points.`,
  );
  return lines.join("\n");
}

const share = (value: number) => (Number.isNaN(value) ? "-" : `${(100 * value).toFixed(0)}%`);
const fixed = (value: number, digits = 1) => (Number.isNaN(value) ? "-" : value.toFixed(digits));


export function moveNamed(name: string): number | undefined {
  if (name === "dash-attack") return AttackStyle.dashAttack;
  const found = Object.entries(MOVE_NAMES).find(([, known]) => known === name);
  return found === undefined ? undefined : Number(found[0]);
}


export function measuredOf(summary: FighterSummary, spamWinRate: number | undefined): Measured {
  const s = summary.style;
  return {
    fighter: summary.fighter, winRate: summary.winRate, decisiveMatches: summary.wins + summary.losses, ...(s.damage[0] === undefined ? {} : { topMove: s.damage[0].name }), topDamageShare: s.topDamageShare, aerials: s.aerials, airShare: s.airShare,
    matchups: Object.fromEntries(Object.entries(summary.against).map(([name, rate]) => [name, { rate, matches: summary.played[name] ?? 0 }])),
    approachShare: s.approachShare, rangedShare: s.rangedShare, specials: s.specials, variety: s.variety, ...(spamWinRate === undefined ? {} : { spamWinRate }),
  };
}


export function tuningFieldOf(records: readonly MatchRecord[], kits: TuningField["kits"], probes: ReadonlyMap<string, number>): TuningField {
  const seeds = [...new Set(records.map(record => record.seed))].sort((a,b) => a-b);
  const measured = (rows: readonly MatchRecord[]) => summarizeField(rows).map(summary => measuredOf(summary, probes.get(summary.fighter)));
  const seedPairs = Object.fromEntries(seeds.map(seed => {
    const counts: Record<string, number> = {};
    for (const record of records) if (record.seed === seed) {
      const key = [...record.fighters].sort().join(":");
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return [seed, counts];
  }));
  return { seeds, computerCode: currentComputerCode(), computerProfiles: JSON.stringify([...new Set(records.map(record => JSON.stringify([record.opponents,record.tiers,record.skillOverrides ?? []])))].sort()), seedPairs, fighters: measured(records), kits, samples: Object.fromEntries(seeds.map(seed => [seed, measured(records.filter(record => record.seed === seed))])) };
}


export function balanceTables(summaries: readonly FighterSummary[], probes: ReadonlyMap<string, { readonly move: string; readonly winRate: number; readonly matches: number }>, profiles: ReadonlyMap<string, PlayStyleProfile>): string {
  const lines = [
    "",
    "Damage and stocks by move (share of the fighter's damage dealt and stocks taken; a hit is credited to the move its body was striking with, else to the last move it started):",
    "",
    "| Fighter | Win rate | Top move share of damage | Top-2 share | Damage by move | Stocks taken by move | Move variety | Air share of normals | Aerials (n/f/b/u/d) | Approach share of movement | Ranged share of damage | Specials (n/s/u/d, share of moves) |",
    "| --- | ---: | ---: | ---: | --- | --- | ---: | ---: | --- | ---: | ---: | --- |",
  ];
  for (const summary of summaries) {
    const s = summary.style;
    const aerial = (name: string) => share(s.aerials[name] ?? 0);
    const special = (name: string) => share(s.specials[name] ?? 0);
    lines.push(`| ${summary.fighter} | ${share(summary.winRate)} | ${s.damage[0]?.name ?? "-"} ${share(s.topDamageShare)} | ${share(s.top2DamageShare)} | ${s.damage.slice(0, 4).map((use) => `${use.name} ${share(use.share)}`).join(", ")} | ${s.kos.slice(0, 3).map((use) => `${use.name} ${share(use.share)}`).join(", ")} | ${fixed(s.variety, 2)} | ${share(s.airShare)} | ${["neutral-air", "forward-air", "back-air", "up-air", "down-air"].map(aerial).join("/")} | ${share(s.approachShare)} | ${share(s.rangedShare)} | ${["neutral-special", "side-special", "up-special", "down-special"].map(special).join("/")} |`);
  }
  lines.push(
    "",
    `Openings and punishes (Slippi's conversions: a punish lasts until the opponent has spent ${PUNISH_RESET_FRAMES} frames in control on the ground; a lone hit that left it able to act within ${DISADVANTAGE_FRAMES} frames, on the deck and not on the floor, is a poke. Targets: Slippi count ${BALANCE_SPEC.slippiOpeningsLow}-${BALANCE_SPEC.slippiOpeningsHigh}, pokes excluded ${BALANCE_SPEC.openingsLow}-${BALANCE_SPEC.openingsHigh}; ! marks a one-hit share over ${share(BALANCE_SPEC.oneHitWarn)}):`,
    "",
    "| Fighter | Stocks taken by an opening | Openings per kill (Slippi count) | Openings per kill (pokes excluded) | One-hit share | Pokes per kill | Poke damage per kill | Damage per opening | Neutral wins converted | Combo hits (average / most) | Most combo damage | Zero-to-death share of stocks |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |",
  );
  for (const summary of summaries) {
    const s = summary.style;
    lines.push(`| ${summary.fighter} | ${s.kills} | ${fixed(s.slippiOpeningsPerKill)} | ${fixed(s.openingsPerKill)} | ${share(s.oneHitShare)}${s.oneHitShare > BALANCE_SPEC.oneHitWarn ? " !" : ""} | ${fixed(s.pokesPerKill)} | ${fixed(s.pokeDamagePerKill, 0)} | ${fixed(s.damagePerOpening)} | ${share(s.neutralConversion)} | ${fixed(s.averageComboHits)} / ${s.maxComboHits} | ${fixed(s.maxComboDamage, 0)} | ${share(s.zeroToDeathShare)} |`);
  }
  const { winLow, winHigh, spamMax, topMoveMax } = BALANCE_SPEC;
  lines.push(
    "",
    `Gate (balance.md: win rate ${share(winLow)}-${share(winHigh)}, spam probe at most ${share(spamMax)} against Expert, no move over ${share(topMoveMax)} of damage but a profile's signature move) and balance score (percentage points outside each target, weighted; potential openings per kill and recovery come from their own tools):`,
    "",
    "| Fighter | Archetype | Spam probe (move, win rate, matches) | Gate | Score | Win | Profile | Variety | Top move | Probe | Openings | Recovery | Profile misses |",
    "| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  );
  const failing: string[] = [];
  const identity: string[] = [], feel: string[] = [], bounds: string[] = [];
  const fixedBaseline: Baseline = baseline;
  for (const summary of summaries) {
    const probe = probes.get(summary.fighter);
    const profile = profiles.get(summary.fighter);
    const measured = measuredOf(summary, probe?.winRate);
    const gate = balanceGate(measured, profile);
    const score = balanceScore(measured, profile);
    if (profile !== undefined) identity.push(...archetypeFailures(measured, profile).map(message => `${summary.fighter} ${message}`));
    const character = selectableCharacterBySlug(summary.fighter);
    const start = fixedBaseline[summary.fighter];
    if (character === undefined || start === undefined) { bounds.push(`${summary.fighter} baseline missing`); feel.push(`${summary.fighter} baseline missing`); }
    else {
      const current = currentKit(character);
      bounds.push(...kitFailures(current.values, start.values).map(message => `${summary.fighter} ${message}`));
      const unchanged = JSON.stringify(current.values) === JSON.stringify(start.values);
      feel.push(...feelFailures(unchanged ? start.feel : currentFeel(character), start.feel).map(message => `${summary.fighter} ${message}`));
    }
    if (gate.failures.length > 0) failing.push(`${summary.fighter} (${gate.failures.join("; ")})`);
    const term = (value: number | undefined) => (value === undefined ? "-" : value.toFixed(1));
    lines.push(`| ${summary.fighter} | ${profile?.archetype ?? "no profile"} | ${probe === undefined ? "not run" : `${probe.move} ${share(probe.winRate)} (${probe.matches})`} | ${gate.balanced ? "balanced" : gate.failures.length > 0 ? `fails: ${gate.failures.join("; ")}` : "probe not run"} | ${score.total.toFixed(1)} | ${term(score.win)} | ${term(score.profile)} | ${term(score.variety)} | ${term(score.spam)} | ${term(score.probe)} | ${term(score.openings)} | ${term(score.recovery)} | ${score.misses.join(", ")} |`);
  }
  const roster = SELECTABLE_CHARACTERS.map(fighterSlug);
  const complete = summaries.length === roster.length && summaries.every(summary => roster.every(name => name === summary.fighter || (summary.played[name] ?? 0) >= BALANCE_SPEC.matchupMatches));
  if (!complete) failing.push("whole field incomplete (every roster matchup requires 400 matches)");
  failing.push(...bounds, ...feel);
  lines.push("", `Archetype-trait gate: ${identity.length === 0 ? "passes" : "fails"}.${identity.length === 0 ? "" : ` ${identity.join("; ")}.`}`,
    `Fixed baseline bounds (±${BALANCE_SPEC.kitFraction * 100}% damage/knockback, ±${BALANCE_SPEC.kitFrames} frames): ${bounds.length === 0 ? "passes" : "fails"}.${bounds.length === 0 ? "" : ` ${bounds.join("; ")}.`}`,
    `Feel locks (block sign, kill percent ±${BALANCE_SPEC.killFraction * 100}%): ${feel.length === 0 ? "passes" : "fails"}.${feel.length === 0 ? "" : ` ${feel.join("; ")}.`}`);
  const probed = summaries.every((summary) => probes.has(summary.fighter));
  lines.push("", `Balanced (win band, spam probe, move share, matchup, archetype, fixed baseline, feel): ${!probed ? "probe not run" : failing.length === 0 ? "passes" : "fails"}.${failing.length === 0 ? "" : ` Failing: ${failing.join(", ")}.`}`);
  return lines.join("\n");
}


function probeResults(files: readonly string[]): Map<string, { move: string; winRate: number; matches: number }> {
  const out = new Map<string, { move: string; winRate: number; matches: number }>();
  for (const file of files) {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (!isFieldFile(parsed)) throw new Error(`${file} holds no cpuField --json probe`);
    const { options, summaries } = parsed;
    for (const [fighter, move] of Object.entries(options.spam ?? {})) {
      const summary = summaries.find((s) => s.fighter === fighter);
      if (summary === undefined || move === undefined) continue;
      out.set(fighter, { move: moveName(move), winRate: summary.winRate, matches: summary.matches });
    }
  }
  return out;
}


function isFieldFile(value: unknown): value is { readonly options: FieldOptions; readonly summaries: FighterSummary[] } {
  return typeof value === "object" && value !== null && "options" in value && typeof value.options === "object" && value.options !== null
    && "summaries" in value && Array.isArray(value.summaries) && value.summaries.every((s: unknown) => typeof s === "object" && s !== null && "fighter" in s && "style" in s);
}


function isMatchRecords(value: unknown): value is MatchRecord[] {
  return Array.isArray(value) && value.every((record: unknown) => typeof record === "object" && record !== null && "fighters" in record && "sides" in record && "winner" in record);
}


function shardRecords(file: string): MatchRecord[] {
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  const records = typeof parsed === "object" && parsed !== null && "records" in parsed ? parsed.records : undefined;
  if (!isMatchRecords(records)) throw new Error(`${file} holds no cpuField --json records`);
  return records;
}

if (import.meta.main) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { variants: { type: "string" }, "per-pair": { type: "string" }, seeds: { type: "string" }, "seed-offset": { type: "string" }, opponents: { type: "string" }, tiers: { type: "string" }, stocks: { type: "string" }, minutes: { type: "string" }, json: { type: "string" }, merge: { type: "string" }, fighters: { type: "string" }, pairs: { type: "string" },
      "probe-fighter": { type: "string" }, from: { type: "string" }, probe: { type: "string" }, "ledge-rule": { type: "string" } },
    strict: true,
  });
  const fighterNamed = (slug: string) => {
    const character = selectableCharacterBySlug(slug);
    if (character === undefined) throw new Error(`no fighter named ${slug}`);
    return character;
  };
  const fighters = values.fighters?.split(",").map(fighterNamed);

  const probeFighter = values["probe-fighter"] === undefined ? undefined : fighterNamed(values["probe-fighter"]);
  let spam: Record<string, number> | undefined;
  if (probeFighter !== undefined) {
    if (values.from === undefined) throw new Error("--probe-fighter takes --from FIELD.json, the field whose top damage move it spams");
    const parsed: unknown = JSON.parse(readFileSync(values.from, "utf8"));
    const top = isFieldFile(parsed) ? parsed.summaries.find((s) => s.fighter === fighterSlug(probeFighter))?.style.damage[0]?.name : undefined;
    const move = top === undefined ? undefined : moveNamed(top);
    if (move === undefined) throw new Error(`${values.from} has no top damage move for ${fighterSlug(probeFighter)}`);
    spam = { [fighterSlug(probeFighter)]: move };
  }
  const probePairs = probeFighter === undefined ? undefined : SELECTABLE_CHARACTERS.filter((other) => other !== probeFighter).map((other) => [probeFighter, other] as const);
  const pairs = probePairs ?? values.pairs?.split(",").map((pair) => {
    const [a, b, extra] = pair.split(":");
    if (a === undefined || b === undefined || extra !== undefined || a === b) throw new Error(`--pairs takes pairs of different fighters, like illidan:rifleman; not ${pair}`);
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
    variants: Number(values.variants ?? 1), seeds: Number(values.seeds ?? 1), seedOffset: Number(values["seed-offset"] ?? 0), stocks: Number(values.stocks ?? 3), minutes: Number(values.minutes ?? 4),
    ...(tiers === undefined ? {} : { tiers: [tiers[0] ?? "expert", tiers[1] ?? "expert"] as const }),
    ...(opponents === undefined ? {} : { opponents: [opponents[0] ?? "wren", opponents[1] ?? "wren"] as const }),
    ...(fighters === undefined ? {} : { fighters }),
    ...(pairs === undefined ? {} : { pairs }),
    ...(values["per-pair"] === undefined ? {} : { perPair: Number(values["per-pair"]) }),
    ...(spam === undefined ? {} : { spam }),
    ...(values["ledge-rule"] === "melee" ? { ledgeRule: "melee" as const } : {}),
  };
  if (values["ledge-rule"] !== undefined && values["ledge-rule"] !== "melee") throw new Error("--ledge-rule takes melee");
  if (values.merge === undefined) {
    const pairCount = pairs?.length ?? ((fighters ?? SELECTABLE_CHARACTERS).length * ((fighters ?? SELECTABLE_CHARACTERS).length - 1)) / 2;
    if (pairCount > 1 && admitsThroughHelper()) {
      const sameOf = (two: readonly string[] | undefined, flag: string) => two !== undefined && two[0] === two[1] ? ` ${flag} ${two[0]}` : "";
      console.error(`GitHub's free runners play this sweep in about 4 minutes and leave this machine free: bun wisp farm balance${pairs === undefined ? "" : ` --matchups ${values.pairs}`}${sameOf(opponents, "--opponent")}${sameOf(tiers, "--tier")}${values["per-pair"] === undefined ? "" : ` --per-pair ${values["per-pair"]}`}${values.seeds === undefined ? "" : ` --seeds ${values.seeds}`} --wait`);
    }
    await runAdmitted("moderate", "smashcraft:cpuField", 3600);
  }
  const started = performance.now();
  let reported = 0;

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
  console.log(edgePlayLines(records).join("\n"));
  console.log("");
  console.log(ledgePlayLines(records).join("\n"));
  console.log("");
  console.log(balanceTables(summaries, probeResults(values.probe?.split(",").filter(Boolean) ?? []), readProfiles()));
  if (values.json !== undefined) writeFileSync(values.json, `${JSON.stringify({ options, summaries, records }, null, 1)}\n`);
}
