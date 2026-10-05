/**
 * What became of a local sample offered to a schedule. The response probe
 * writes these numbers to its trace files, so they are a format: never
 * renumber them or reuse a missing number.
 */
export const Capture = {
  captured: 0,
  /** This frame already holds a sample; the earlier one stands. */
  alreadyCaptured: 1,
  wrongEpoch: 2,
  /** The target would pass the last frame. */
  frameExhausted: 3,
  pendingFull: 4,
  /** A different sample is already assigned to this frame. */
  conflict: 6,
  outOfHistory: 7,
  tooFarAhead: 8,
} as const;

export type Capture = (typeof Capture)[keyof typeof Capture];
