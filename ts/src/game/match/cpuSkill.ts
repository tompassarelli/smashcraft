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
  readonly basicMoves?: readonly number[];
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
  /** Whether it climbs and drops through platforms to cancel aerials (smashcraft:docs/gameplay-design.md, "Platforms"); below, it stands on every platform it climbs. */
  readonly platformCancels: boolean;
  /** Whether it edge-cancels toward a cornered opponent, presses the corner and escapes one by a readable option (botCorner.ts); below, it plays the corner as neutral. */
  readonly cornerPlay: boolean;
  /** Moments, in tenths, it short-hops an aerial off the lip a shielding or ledge-hanging opponent is at, so the edge cancel frees its landing (botCorner.ts); 0 never carries one off. */
  readonly edgeCancelTenths: number;
  /** Corner escape choices, in tenths, that leave by a full hop or a roll; the rest shield where they stand (botCorner.ts). */
  readonly cornerEscapeTenths: number;
  /** Moments, in tenths, it meets an opponent recovering below the deck with its edge-guard tool (botEdgeGuard.ts); 0 never leaves the stage to guard. */
  readonly edgeGuardTenths: number;
  /** Frames it overestimates a punish window by, so a slow move it throws may come out after the opponent can act. */
  readonly punishMisjudge: number;
  readonly contestTenths: number;
  readonly contestDelay: number;
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
    platformCancels: profile.tier === "advanced" || profile.tier === "expert",
    cornerPlay: profile.tier === "advanced" || profile.tier === "expert",
    edgeCancelTenths: profile.tier === "expert" ? 10 : profile.tier === "advanced" ? 9 : 0,
    cornerEscapeTenths: profile.tier === "expert" ? 10 : profile.tier === "advanced" ? 8 : 0,
    edgeGuardTenths: profile.tier === "expert" ? 8 : profile.tier === "advanced" ? 5 : 0,
    contestTenths: floorDiv(profile.judgmentPercent + 9, 10), contestDelay: profile.reactionFrames,
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
export function cpuReactionFloor(fighter: Readonly<Fighter>, skill: CpuSkill): number {
  if (fighter.shield.raised || fighter.down.state !== DownState.none || fighter.ledge.state !== LedgeState.none) return Math.max(14, skill.reactionFrames);
  // Retreat is available; each additional legal shield, jump or attack adds a frame.
  const options = 1 + (fighter.motion.grounded ? 1 : 0) + (fighter.jump.remaining > 0 ? 1 : 0) + (canAttack(fighter) ? 1 : 0);
  return Math.max(skill.reactionFrames, 16 + options - 1);
}

// Slippi master tech-chase percentiles: p5=15, p10=16, p25=19, p50=21, p90=33.
// The p75 and endpoint interpolate the measured 22.7 mean and 6.1-frame deviation.
const REACTION_PERCENTILES = [0, 14, 5, 15, 10, 16, 25, 19, 50, 21, 75, 26, 90, 33, 100, 39] as const;

const reactionCurve: number[] = [];
for (let percentile = 0; percentile < 100; percentile++) {
  for (let index = 2; index < REACTION_PERCENTILES.length; index += 2) {
    const end = at(REACTION_PERCENTILES, index);
    if (percentile >= end) continue;
    const start = at(REACTION_PERCENTILES, index - 2), low = at(REACTION_PERCENTILES, index - 1), high = at(REACTION_PERCENTILES, index + 1);
    reactionCurve.push(low + floorDiv(2 * (percentile - start) * (high - low) + end - start, 2 * (end - start)));
    break;
  }
}

const reactionDraws = [0, 1, 2, 3].map(() => ({ seed: -1, character: -1, cue: -1, reaction: 0 }));

/** Measured high-tier reaction curves, clipped to the kind of answer's human floor. */
export function cpuReactionFrames(fighter: Readonly<Fighter>, skill: CpuSkill, seed: number, slot: number, cue: number, floor = cpuReactionFloor(fighter, skill)): number {
  const draw = at(reactionDraws, slot);
  if (draw.seed !== seed || draw.character !== fighter.character || draw.cue !== cue) {
    useMatchSeed(seed);
    draw.reaction = at(reactionCurve, botChoice(cue, slot * 17 + fighter.character, 100));
    draw.seed = seed;
    draw.character = fighter.character;
    draw.cue = cue;
  }
  useMatchSeed(0);
  const reaction = draw.reaction;
  const tier = skill.tier;
  const offset = tier === "intermediate" ? 2 : tier === "advanced" ? 1 : 0;
  return tier === "beginner" || tier === "rookie" ? floor + reaction - 14 : Math.max(floor, reaction + offset);
}
