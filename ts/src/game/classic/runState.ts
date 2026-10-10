





import type { CpuOpponentId, CpuTier } from "../match/cpuProfiles";
import type { StageTile } from "../menu/stageCatalog";
import type { Character } from "../sim/codes";
import type { ParticipantSlot } from "../input/participants";


export const BossKind = { none: 0, lichKing: 1, archimonde: 2, kiljaeden: 3 } as const;
export type BossKind = (typeof BossKind)[keyof typeof BossKind];


export const WinCondition = {

  ko: 0,

  survive: 1,

  koWithinClock: 2,

  defeatBoss: 3,
} as const;
export type WinCondition = (typeof WinCondition)[keyof typeof WinCondition];

export interface ConfiguredOpponent {
  readonly character: Character;
  readonly opponent: CpuOpponentId;
  readonly tier: CpuTier;

  readonly stocks?: number;
  readonly damage?: number;
}


export interface ConfiguredMatch {

  readonly id: string;

  readonly player?: Character;
  readonly opponents: readonly ConfiguredOpponent[];
  readonly stage: StageTile;
  readonly stocks: number;

  readonly playerStocks?: number;

  readonly timeMinutes: number;
  readonly playerDamage: number;
  readonly hazards: boolean;
  readonly win: WinCondition;
  readonly boss: BossKind;

  readonly bossHealth: number;

  readonly last: boolean;

  readonly speaker: string;
  readonly intro: string;
}

export const RunOutcome = { none: 0, won: 1, lost: 2 } as const;
export type RunOutcome = (typeof RunOutcome)[keyof typeof RunOutcome];


export interface BossState {
  kind: BossKind;
  health: number;
  maxHealth: number;

  strike: number;
  aimX: number;

  hitMask: number;

  lastSerial: number;
  lastWindow: number;

  flash: number;
}

export interface ConfiguredRun {
  active: boolean;
  current: ConfiguredMatch | undefined;
  player: ParticipantSlot;

  fighter: Character;

  fight: number;

  tier: number;
  outcome: RunOutcome;

  cleared: boolean;

  frames: number;
  damageTaken: number;
  lastDamage: number;
  continues: number;

  savedHumanFighters: number;
  savedComputers: number;
  savedStocks: number;
  savedMinutes: number;
  savedHazards: boolean;
  savedItems: boolean;
  readonly boss: BossState;
}

function createBossState(): BossState {
  return { kind: BossKind.none, health: 0, maxHealth: 0, strike: -1, aimX: 0.0, hitMask: 0, lastSerial: -1, lastWindow: 0, flash: 0 };
}

export function createConfiguredRun(): ConfiguredRun {
  return {
    active: false, current: undefined, player: 0, fighter: 1, fight: 0, tier: 0, outcome: RunOutcome.none, cleared: false,
    frames: 0, damageTaken: 0.0, lastDamage: 0.0, continues: 0,
    savedHumanFighters: 0, savedComputers: 0, savedStocks: 3, savedMinutes: 7, savedHazards: true, savedItems: false,
    boss: createBossState(),
  };
}

export function resetBossState(boss: BossState, kind: BossKind, health: number): void {
  boss.kind = kind;
  boss.health = health;
  boss.maxHealth = health;
  boss.strike = -1;
  boss.aimX = 0.0;
  boss.hitMask = 0;
  boss.lastSerial = -1;
  boss.lastWindow = 0;
  boss.flash = 0;
}

function copyBossState(target: BossState, source: Readonly<BossState>): void {
  target.kind = source.kind;
  target.health = source.health;
  target.maxHealth = source.maxHealth;
  target.strike = source.strike;
  target.aimX = source.aimX;
  target.hitMask = source.hitMask;
  target.lastSerial = source.lastSerial;
  target.lastWindow = source.lastWindow;
  target.flash = source.flash;
}

export function copyConfiguredRun(target: ConfiguredRun, source: Readonly<ConfiguredRun>): void {
  target.active = source.active;

  target.current = source.current;
  target.player = source.player;
  target.fighter = source.fighter;
  target.fight = source.fight;
  target.tier = source.tier;
  target.outcome = source.outcome;
  target.cleared = source.cleared;
  target.frames = source.frames;
  target.damageTaken = source.damageTaken;
  target.lastDamage = source.lastDamage;
  target.continues = source.continues;
  target.savedHumanFighters = source.savedHumanFighters;
  target.savedComputers = source.savedComputers;
  target.savedStocks = source.savedStocks;
  target.savedMinutes = source.savedMinutes;
  target.savedHazards = source.savedHazards;
  target.savedItems = source.savedItems;
  copyBossState(target.boss, source.boss);
}

const INT_FIELDS = ["player", "fighter", "fight", "tier", "outcome", "frames", "continues", "savedHumanFighters", "savedComputers", "savedStocks", "savedMinutes"] as const;
const BOSS_INT_FIELDS = ["kind", "health", "maxHealth", "strike", "hitMask", "lastSerial", "lastWindow", "flash"] as const;


export function writeConfiguredRun(
  run: Readonly<ConfiguredRun>, int: (name: string, value: number) => void, bool: (name: string, value: boolean) => void,
  real: (name: string, value: number) => void, text: (name: string, value: string) => void,
): void {
  bool("match.run.active", run.active);
  text("match.run.current", run.current?.id ?? "");
  for (const key of INT_FIELDS) int(`match.run.${key}`, run[key]);
  bool("match.run.cleared", run.cleared);
  bool("match.run.savedHazards", run.savedHazards);
  bool("match.run.savedItems", run.savedItems);
  real("match.run.damageTaken", run.damageTaken);
  real("match.run.lastDamage", run.lastDamage);
  for (const key of BOSS_INT_FIELDS) int(`match.run.boss.${key}`, run.boss[key]);
  real("match.run.boss.aimX", run.boss.aimX);
}

export function firstRunDifference(expected: Readonly<ConfiguredRun>, actual: Readonly<ConfiguredRun>): string | undefined {
  if (expected.active !== actual.active) return "match.run.active";
  if (expected.current !== actual.current) return "match.run.current";
  for (const key of INT_FIELDS) if (expected[key] !== actual[key]) return `match.run.${key}`;
  if (expected.cleared !== actual.cleared) return "match.run.cleared";
  if (expected.savedHazards !== actual.savedHazards) return "match.run.savedHazards";
  if (expected.savedItems !== actual.savedItems) return "match.run.savedItems";
  if (expected.damageTaken !== actual.damageTaken) return "match.run.damageTaken";
  if (expected.lastDamage !== actual.lastDamage) return "match.run.lastDamage";
  for (const key of BOSS_INT_FIELDS) if (expected.boss[key] !== actual.boss[key]) return `match.run.boss.${key}`;
  if (expected.boss.aimX !== actual.boss.aimX) return "match.run.boss.aimX";
  return undefined;
}
