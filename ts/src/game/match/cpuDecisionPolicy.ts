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
