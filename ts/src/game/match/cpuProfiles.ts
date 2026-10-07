import { at } from "wisp/src/runtime/lookup";
import { floorMod } from "wisp/src/sim/intMath";
import type { CpuDecisionPolicy } from "./cpuDecisionPolicy";

export const CPU_OPPONENT_IDS = ["rook", "ember", "flint", "vale", "kite", "wren"] as const;
export type CpuOpponentId = (typeof CPU_OPPONENT_IDS)[number];
export type CpuOpponentChoice = CpuOpponentId | "random";
export const CPU_OPPONENT_CHOICES: readonly CpuOpponentChoice[] = [...CPU_OPPONENT_IDS, "random"];
export const CPU_TIERS = ["rookie", "beginner", "intermediate", "advanced", "expert"] as const;
export type CpuTier = (typeof CPU_TIERS)[number];
export const CPU_OPPONENT_DEFAULT: CpuOpponentId = "wren";
export const CPU_TIER_DEFAULT: CpuTier = "intermediate";

/** Independent authored settings consumed by the shared decision policy. */
export interface CpuProfile extends CpuDecisionPolicy {
  readonly opponent: CpuOpponentId;
  readonly tier: CpuTier;
  readonly reactionFrames: number;
}

export const isCpuOpponent = (value: string): value is CpuOpponentId => CPU_OPPONENT_IDS.some(id => id === value);
export const isCpuOpponentChoice = (value: string): value is CpuOpponentChoice => value === "random" || isCpuOpponent(value);
export const isCpuTier = (value: string): value is CpuTier => CPU_TIERS.some(tier => tier === value);

export function stepCpuOpponent(opponent: CpuOpponentChoice, direction: -1 | 1): CpuOpponentChoice {
  return at(CPU_OPPONENT_CHOICES, floorMod(CPU_OPPONENT_CHOICES.indexOf(opponent) + direction, CPU_OPPONENT_CHOICES.length));
}

export function stepCpuTier(tier: CpuTier, direction: -1 | 1): CpuTier {
  return at(CPU_TIERS, Math.max(0, Math.min(CPU_TIERS.length - 1, CPU_TIERS.indexOf(tier) + direction)));
}

/** One pure match-start draw per slot; products fit Warcraft's 32-bit integers. */
export function resolveCpuOpponent(choice: CpuOpponentChoice, seed: number, slot: number): CpuOpponentId {
  if (choice !== "random") return choice;
  const salted = floorMod(floorMod(seed, 46337) + (slot + 1) * 7919, 46337);
  const mixed = floorMod(salted * salted + 12345, 46337);
  return at(CPU_OPPONENT_IDS, floorMod(mixed ^ floorMod(mixed * 31, 46337), CPU_OPPONENT_IDS.length));
}

/** Explicit rows preserve each identity's individual primary and secondary growth. */
export const CPU_PROFILES: readonly CpuProfile[] = [
  { opponent: "rook", tier: "rookie", reactionFrames: 36, executionPercent: 45, judgmentPercent: 35, spacingPercent: 55, historyCapacity: 8, historyStride: 4, readEvidence: 2, readConfidence: 60, repeatPercent: 65, punishWeight: 80, pressurePercent: 25, variancePercent: 15, guessPercent: 15 },
  { opponent: "rook", tier: "beginner", reactionFrames: 32, executionPercent: 62, judgmentPercent: 52, spacingPercent: 68, historyCapacity: 12, historyStride: 3, readEvidence: 3, readConfidence: 65, repeatPercent: 50, punishWeight: 90, pressurePercent: 35, variancePercent: 18, guessPercent: 12 },
  { opponent: "rook", tier: "intermediate", reactionFrames: 27, executionPercent: 80, judgmentPercent: 75, spacingPercent: 82, historyCapacity: 20, historyStride: 2, readEvidence: 4, readConfidence: 70, repeatPercent: 35, punishWeight: 105, pressurePercent: 50, variancePercent: 22, guessPercent: 8 },
  { opponent: "rook", tier: "advanced", reactionFrames: 21, executionPercent: 91, judgmentPercent: 88, spacingPercent: 92, historyCapacity: 28, historyStride: 1, readEvidence: 5, readConfidence: 75, repeatPercent: 22, punishWeight: 115, pressurePercent: 65, variancePercent: 28, guessPercent: 5 },
  { opponent: "rook", tier: "expert", reactionFrames: 18, executionPercent: 96, judgmentPercent: 96, spacingPercent: 97, historyCapacity: 32, historyStride: 1, readEvidence: 5, readConfidence: 80, repeatPercent: 15, punishWeight: 120, pressurePercent: 75, variancePercent: 35, guessPercent: 3 },
  { opponent: "ember", tier: "rookie", reactionFrames: 30, executionPercent: 60, judgmentPercent: 20, spacingPercent: 35, historyCapacity: 4, historyStride: 4, readEvidence: 2, readConfidence: 40, repeatPercent: 80, punishWeight: 35, pressurePercent: 90, variancePercent: 70, guessPercent: 40 },
  { opponent: "ember", tier: "beginner", reactionFrames: 27, executionPercent: 72, judgmentPercent: 40, spacingPercent: 52, historyCapacity: 6, historyStride: 3, readEvidence: 2, readConfidence: 50, repeatPercent: 65, punishWeight: 45, pressurePercent: 90, variancePercent: 65, guessPercent: 30 },
  { opponent: "ember", tier: "intermediate", reactionFrames: 21, executionPercent: 84, judgmentPercent: 65, spacingPercent: 72, historyCapacity: 12, historyStride: 2, readEvidence: 3, readConfidence: 60, repeatPercent: 45, punishWeight: 60, pressurePercent: 90, variancePercent: 60, guessPercent: 20 },
  { opponent: "ember", tier: "advanced", reactionFrames: 15, executionPercent: 93, judgmentPercent: 82, spacingPercent: 86, historyCapacity: 20, historyStride: 1, readEvidence: 4, readConfidence: 65, repeatPercent: 32, punishWeight: 75, pressurePercent: 90, variancePercent: 55, guessPercent: 12 },
  { opponent: "ember", tier: "expert", reactionFrames: 12, executionPercent: 97, judgmentPercent: 94, spacingPercent: 95, historyCapacity: 28, historyStride: 1, readEvidence: 5, readConfidence: 75, repeatPercent: 22, punishWeight: 90, pressurePercent: 88, variancePercent: 50, guessPercent: 8 },
  { opponent: "flint", tier: "rookie", reactionFrames: 30, executionPercent: 65, judgmentPercent: 25, spacingPercent: 35, historyCapacity: 4, historyStride: 4, readEvidence: 2, readConfidence: 45, repeatPercent: 80, punishWeight: 50, pressurePercent: 60, variancePercent: 20, guessPercent: 20 },
  { opponent: "flint", tier: "beginner", reactionFrames: 27, executionPercent: 78, judgmentPercent: 40, spacingPercent: 58, historyCapacity: 8, historyStride: 3, readEvidence: 3, readConfidence: 55, repeatPercent: 68, punishWeight: 65, pressurePercent: 62, variancePercent: 22, guessPercent: 15 },
  { opponent: "flint", tier: "intermediate", reactionFrames: 21, executionPercent: 88, judgmentPercent: 65, spacingPercent: 78, historyCapacity: 12, historyStride: 2, readEvidence: 3, readConfidence: 65, repeatPercent: 52, punishWeight: 80, pressurePercent: 65, variancePercent: 25, guessPercent: 10 },
  { opponent: "flint", tier: "advanced", reactionFrames: 15, executionPercent: 95, judgmentPercent: 84, spacingPercent: 90, historyCapacity: 20, historyStride: 1, readEvidence: 4, readConfidence: 70, repeatPercent: 38, punishWeight: 90, pressurePercent: 70, variancePercent: 30, guessPercent: 7 },
  { opponent: "flint", tier: "expert", reactionFrames: 12, executionPercent: 98, judgmentPercent: 95, spacingPercent: 96, historyCapacity: 28, historyStride: 1, readEvidence: 5, readConfidence: 75, repeatPercent: 28, punishWeight: 100, pressurePercent: 75, variancePercent: 35, guessPercent: 4 },
  { opponent: "vale", tier: "rookie", reactionFrames: 36, executionPercent: 50, judgmentPercent: 30, spacingPercent: 45, historyCapacity: 6, historyStride: 4, readEvidence: 2, readConfidence: 65, repeatPercent: 75, punishWeight: 90, pressurePercent: 15, variancePercent: 10, guessPercent: 10 },
  { opponent: "vale", tier: "beginner", reactionFrames: 30, executionPercent: 65, judgmentPercent: 50, spacingPercent: 62, historyCapacity: 10, historyStride: 3, readEvidence: 3, readConfidence: 70, repeatPercent: 60, punishWeight: 100, pressurePercent: 25, variancePercent: 12, guessPercent: 8 },
  { opponent: "vale", tier: "intermediate", reactionFrames: 24, executionPercent: 80, judgmentPercent: 72, spacingPercent: 80, historyCapacity: 16, historyStride: 2, readEvidence: 4, readConfidence: 75, repeatPercent: 42, punishWeight: 110, pressurePercent: 45, variancePercent: 18, guessPercent: 6 },
  { opponent: "vale", tier: "advanced", reactionFrames: 18, executionPercent: 92, judgmentPercent: 88, spacingPercent: 90, historyCapacity: 24, historyStride: 1, readEvidence: 5, readConfidence: 80, repeatPercent: 28, punishWeight: 115, pressurePercent: 60, variancePercent: 25, guessPercent: 4 },
  { opponent: "vale", tier: "expert", reactionFrames: 15, executionPercent: 97, judgmentPercent: 96, spacingPercent: 95, historyCapacity: 32, historyStride: 1, readEvidence: 5, readConfidence: 80, repeatPercent: 20, punishWeight: 115, pressurePercent: 72, variancePercent: 32, guessPercent: 3 },
  { opponent: "kite", tier: "rookie", reactionFrames: 36, executionPercent: 50, judgmentPercent: 25, spacingPercent: 45, historyCapacity: 4, historyStride: 4, readEvidence: 2, readConfidence: 40, repeatPercent: 45, punishWeight: 40, pressurePercent: 65, variancePercent: 90, guessPercent: 45 },
  { opponent: "kite", tier: "beginner", reactionFrames: 30, executionPercent: 65, judgmentPercent: 42, spacingPercent: 60, historyCapacity: 6, historyStride: 3, readEvidence: 2, readConfidence: 50, repeatPercent: 32, punishWeight: 50, pressurePercent: 65, variancePercent: 85, guessPercent: 35 },
  { opponent: "kite", tier: "intermediate", reactionFrames: 24, executionPercent: 82, judgmentPercent: 65, spacingPercent: 75, historyCapacity: 12, historyStride: 2, readEvidence: 3, readConfidence: 60, repeatPercent: 22, punishWeight: 65, pressurePercent: 68, variancePercent: 78, guessPercent: 25 },
  { opponent: "kite", tier: "advanced", reactionFrames: 18, executionPercent: 92, judgmentPercent: 84, spacingPercent: 88, historyCapacity: 20, historyStride: 1, readEvidence: 4, readConfidence: 65, repeatPercent: 12, punishWeight: 80, pressurePercent: 72, variancePercent: 70, guessPercent: 15 },
  { opponent: "kite", tier: "expert", reactionFrames: 14, executionPercent: 96, judgmentPercent: 95, spacingPercent: 96, historyCapacity: 28, historyStride: 1, readEvidence: 5, readConfidence: 75, repeatPercent: 8, punishWeight: 95, pressurePercent: 78, variancePercent: 65, guessPercent: 9 },
  { opponent: "wren", tier: "rookie", reactionFrames: 36, executionPercent: 50, judgmentPercent: 30, spacingPercent: 40, historyCapacity: 4, historyStride: 4, readEvidence: 2, readConfidence: 50, repeatPercent: 70, punishWeight: 55, pressurePercent: 40, variancePercent: 25, guessPercent: 20 },
  { opponent: "wren", tier: "beginner", reactionFrames: 30, executionPercent: 67, judgmentPercent: 48, spacingPercent: 58, historyCapacity: 8, historyStride: 3, readEvidence: 3, readConfidence: 60, repeatPercent: 55, punishWeight: 70, pressurePercent: 48, variancePercent: 28, guessPercent: 15 },
  { opponent: "wren", tier: "intermediate", reactionFrames: 24, executionPercent: 82, judgmentPercent: 70, spacingPercent: 74, historyCapacity: 16, historyStride: 2, readEvidence: 3, readConfidence: 65, repeatPercent: 40, punishWeight: 85, pressurePercent: 60, variancePercent: 35, guessPercent: 10 },
  { opponent: "wren", tier: "advanced", reactionFrames: 18, executionPercent: 93, judgmentPercent: 87, spacingPercent: 89, historyCapacity: 24, historyStride: 1, readEvidence: 4, readConfidence: 70, repeatPercent: 27, punishWeight: 95, pressurePercent: 70, variancePercent: 40, guessPercent: 7 },
  { opponent: "wren", tier: "expert", reactionFrames: 12, executionPercent: 97, judgmentPercent: 96, spacingPercent: 96, historyCapacity: 32, historyStride: 1, readEvidence: 5, readConfidence: 75, repeatPercent: 20, punishWeight: 105, pressurePercent: 78, variancePercent: 45, guessPercent: 4 },
];

export function cpuProfile(opponent: CpuOpponentId, tier: CpuTier): CpuProfile {
  return at(CPU_PROFILES, CPU_OPPONENT_IDS.indexOf(opponent) * CPU_TIERS.length + CPU_TIERS.indexOf(tier));
}
