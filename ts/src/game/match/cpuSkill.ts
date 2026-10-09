import { at } from "wisp/src/runtime/lookup";
import { floorDiv } from "wisp/src/sim/intMath";
import { botChoice, useMatchSeed } from "./botRandom";
import { DownState, LedgeState } from "../sim/codes";
import { canAttack } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import type { CpuDecisionPolicy } from "./cpuDecisionPolicy";
import { CPU_OPPONENT_DEFAULT, CPU_OPPONENT_IDS, CPU_PROFILES, CPU_TIER_DEFAULT, CPU_TIERS, type CpuOpponentId, type CpuProfile, type CpuTier } from "./cpuProfiles";

export interface CpuSkill {
  readonly tier?: CpuTier;
  /** Debug ceiling experiments disable mistakes without changing the five playable tiers. */
  readonly executionMistakes?: boolean;
  readonly decision: CpuDecisionPolicy;
  /** Age of the opponent observation used for decisions, in input frames. */
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


/** Legal mechanical reliability follows execution; tactical mistakes follow judgment/spacing. */
function mechanics(profile: CpuProfile): CpuSkill {
  const missed = 100 - profile.executionPercent;
  return {
    tier: profile.tier,
    decision: profile, reactionFrames: profile.reactionFrames,
    defendTenths: Math.min(7, floorDiv(profile.judgmentPercent * 7 + 99, 100)),
    attackPause: 3 + floorDiv(missed, 2), attackSpread: 8 + floorDiv(missed, 2),
    misplay: floorDiv(Math.max(0, 96 - profile.spacingPercent), 2), idle: floorDiv(Math.max(0, 80 - profile.pressurePercent), 4),
    gameplanWeights: true,
    techMiss: missed, techOutOf: 100, grabMashFrames: 2 + floorDiv(missed, 5),
    freezeMashFrames: 6 + floorDiv(missed, 5), mixesUp: true, grabsShields: true,
    kitTenths: floorDiv(profile.executionPercent + 9, 10),
    punishTenths: floorDiv(profile.judgmentPercent + 9, 10),
    punishMisjudge: floorDiv(100 - profile.spacingPercent, 5),
  };
}

const SKILLS: readonly CpuSkill[] = CPU_PROFILES.map(profile => mechanics(profile));
const PERCEIVED_SKILLS: readonly CpuSkill[] = SKILLS.map(skill => ({ ...skill, reactionFrames: 0 }));

export function cpuSkill(opponent: CpuOpponentId = CPU_OPPONENT_DEFAULT, tier: CpuTier = CPU_TIER_DEFAULT): CpuSkill {
  return at(SKILLS, CPU_OPPONENT_IDS.indexOf(opponent) * CPU_TIERS.length + CPU_TIERS.indexOf(tier));
}

/** Perception already waited; defense and punish must not impose the same delay again. */
export function perceivedCpuSkill(opponent: CpuOpponentId, tier: CpuTier): CpuSkill {
  return at(PERCEIVED_SKILLS, CPU_OPPONENT_IDS.indexOf(opponent) * CPU_TIERS.length + CPU_TIERS.indexOf(tier));
}

export const FULL_SKILL: CpuSkill = cpuSkill("wren", "expert");

/** A guard, tech or ledge answer is already prepared; neutral needs a fresh choice. */
export function cpuReactionFloor(fighter: Fighter, skill: CpuSkill): number {
  if (fighter.shield.raised || fighter.down.state !== DownState.none || fighter.ledge.state !== LedgeState.none) return Math.max(14, skill.reactionFrames);
  // Retreat is available; each additional legal shield, jump or attack adds a frame.
  const options = 1 + (fighter.motion.grounded ? 1 : 0) + (fighter.jump.remaining > 0 ? 1 : 0) + (canAttack(fighter) ? 1 : 0);
  return Math.max(skill.reactionFrames, 16 + options - 1);
}

/** Each newly observed cue draws 0–2 extra frames under the shared match seed. */
export function cpuReactionFrames(fighter: Fighter, skill: CpuSkill, seed: number, slot: number, cue: number): number {
  useMatchSeed(seed);
  const spread = botChoice(cue, slot * 17 + fighter.character, 3);
  useMatchSeed(0);
  return cpuReactionFloor(fighter, skill) + spread;
}
