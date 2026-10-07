/** Independent decision dimensions; opponent identities compose these with mechanical skill (#184). */
export interface CpuDecisionPolicy {
  readonly judgmentPercent: number;
  readonly spacingPercent: number;
  readonly historyCapacity: number;
  readonly historyStride: number;
  readonly readEvidence: number;
  readonly readConfidence: number;
  readonly repeatPercent: number;
  readonly punishWeight: number;
  readonly guessPercent: number;
  readonly executionPercent: number;
  readonly pressurePercent: number;
  readonly variancePercent: number;
}

/** The current level consumer uses these five general profiles until #184 migrates selection. */
export const GENERAL_DECISION_POLICIES: readonly CpuDecisionPolicy[] = [
  { judgmentPercent: 25, spacingPercent: 40, historyCapacity: 4, historyStride: 4, readEvidence: 2, readConfidence: 50, repeatPercent: 70, punishWeight: 50, guessPercent: 15, executionPercent: 50, pressurePercent: 50, variancePercent: 15 },
  { judgmentPercent: 40, spacingPercent: 55, historyCapacity: 8, historyStride: 3, readEvidence: 3, readConfidence: 60, repeatPercent: 55, punishWeight: 65, guessPercent: 12, executionPercent: 65, pressurePercent: 50, variancePercent: 12 },
  { judgmentPercent: 60, spacingPercent: 70, historyCapacity: 12, historyStride: 2, readEvidence: 3, readConfidence: 65, repeatPercent: 40, punishWeight: 80, guessPercent: 10, executionPercent: 80, pressurePercent: 50, variancePercent: 10 },
  { judgmentPercent: 80, spacingPercent: 85, historyCapacity: 20, historyStride: 1, readEvidence: 4, readConfidence: 70, repeatPercent: 25, punishWeight: 90, guessPercent: 8, executionPercent: 90, pressurePercent: 50, variancePercent: 8 },
  { judgmentPercent: 95, spacingPercent: 95, historyCapacity: 32, historyStride: 1, readEvidence: 5, readConfidence: 75, repeatPercent: 15, punishWeight: 100, guessPercent: 5, executionPercent: 96, pressurePercent: 50, variancePercent: 5 },
];
