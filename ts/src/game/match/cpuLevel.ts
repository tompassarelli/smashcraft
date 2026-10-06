// Computer difficulty levels 1-9 (smashcraft:docs/design/cpu-levels.md).
// A level is a fixed set of human-like limits on the one computer: how long
// a threat must show before it answers, how often it answers, how long it
// waits between attacks, how often it throws a move that can't reach, how
// often it stands still, whether it weighs its fighter's gameplan, and how
// well it influences launches, techs, mashes and returns, and how often and
// how exactly it punishes a committed opponent. Level 9 is the
// computer at full strength. Each probability is a whole numerator over a
// whole denominator, drawn with botChoice, so every runtime agrees.
import { at } from "wisp/src/runtime/lookup";
import { floorMod } from "wisp/src/sim/intMath";

export const CPU_LEVEL_MIN = 1;
export const CPU_LEVEL_MAX = 9;
/** A computer slot plays this level until a player chooses another. */
export const CPU_LEVEL_DEFAULT = 9;

export interface CpuSkill {
  readonly level: number;
  /** Frames an attacker's move must have run before the computer answers it. */
  readonly reactionFrames: number;
  /** Threats answered, in tenths; the rest are taken. */
  readonly defendTenths: number;
  /** Frames between attacks: base plus a choice below spread. */
  readonly attackPause: number;
  readonly attackSpread: number;
  /** Attack decisions, in hundredths, that throw a move chosen without regard for its reach. */
  readonly misplay: number;
  /** Half-second stretches, in hundredths, it stands where it is instead of approaching or attacking. */
  readonly idle: number;
  /** Whether it weighs moves by its fighter's gameplan; below, every move in reach is as likely. */
  readonly gameplanWeights: boolean;
  /** Hits, in tenths, whose launch it influences toward the middle. */
  readonly diTenths: number;
  /** Tumbling landings it misses the tech on: techMiss of techOutOf. */
  readonly techMiss: number;
  readonly techOutOf: number;
  /** Frames between presses mashing out of a grab, or a broken shield. */
  readonly grabMashFrames: number;
  /** Frames between presses mashing out of a freeze. */
  readonly freezeMashFrames: number;
  /** Whether it aims returns at the ledge and mixes up its ledge and get-up options; below, it climbs and stands. */
  readonly mixesUp: boolean;
  /** Whether it grabs a shielding target. */
  readonly grabsShields: boolean;
  /** Moments, in tenths, it takes a kit's advanced option when one suits (botKitOptions.ts): a cross-up, a feint, a recall, a burst, a full charge. */
  readonly kitTenths: number;
  /** Punish windows (botPunish.ts), in tenths, it recognizes and answers: an opponent's end lag, missed grab, landing or dropped shield. */
  readonly punishTenths: number;
  /** Frames it overestimates a punish window by, so a slow move it throws may come out after the opponent can act. */
  readonly punishMisjudge: number;
}

const skill = (level: number, reactionFrames: number, defendTenths: number, attackPause: number, attackSpread: number, misplay: number, idle: number,
  diTenths: number, techMiss: number, techOutOf: number, grabMashFrames: number, freezeMashFrames: number, kitTenths: number, punishTenths: number, punishMisjudge: number): CpuSkill => ({
  level, reactionFrames, defendTenths, attackPause, attackSpread, misplay, idle, gameplanWeights: level >= 4, diTenths, techMiss, techOutOf,
  grabMashFrames, freezeMashFrames, mixesUp: level >= 4, grabsShields: level >= 5, kitTenths,
  punishTenths, punishMisjudge,
});

/** By level, 1 first. */
export const CPU_SKILLS: readonly CpuSkill[] = [
  //    level react defend pause spread misplay idle  DI  tech miss/of  mash freeze kit punish misjudge
  skill(1, 30, 0, 60, 60, 45, 55, 0, 1, 1, 14, 16, 0, 1, 12),
  skill(2, 25, 1, 46, 50, 35, 40, 1, 9, 10, 12, 14, 0, 2, 10),
  skill(3, 20, 2, 36, 42, 26, 28, 3, 4, 5, 10, 12, 0, 3, 8),
  skill(4, 16, 3, 28, 34, 18, 18, 4, 7, 10, 8, 10, 3, 4, 6),
  skill(5, 13, 4, 21, 28, 12, 10, 5, 3, 5, 6, 9, 4, 5, 5),
  skill(6, 10, 5, 15, 24, 7, 5, 6, 1, 2, 5, 8, 5, 6, 4),
  skill(7, 7, 5, 11, 21, 4, 2, 8, 2, 5, 4, 7, 7, 7, 3),
  skill(8, 4, 6, 8, 19, 2, 0, 9, 3, 8, 3, 6, 8, 9, 1),
  skill(9, 0, 7, 6, 18, 0, 0, 10, 1, 3, 2, 6, 10, 10, 0),
];

export const isCpuLevel = (level: number): boolean => level === Math.floor(level) && level >= CPU_LEVEL_MIN && level <= CPU_LEVEL_MAX;

/** The level's skill; anything outside 1-9 plays level 9. */
export const cpuSkill = (level: number): CpuSkill => (isCpuLevel(level) ? at(CPU_SKILLS, level - 1) : at(CPU_SKILLS, CPU_LEVEL_MAX - 1));

export const FULL_SKILL: CpuSkill = at(CPU_SKILLS, CPU_LEVEL_MAX - 1);

/** Seeds stay below this, so a seed and its salt are exact integers in Bun and Warcraft's Lua. */
export const MATCH_SEED_RANGE = 1 << 20;

/** The seed the match after one with `seed` plays. */
export const nextMatchSeed = (seed: number): number => floorMod(seed + 1, MATCH_SEED_RANGE);
