/** Frames of before-frame snapshots the replay history keeps; input history matches it. */
export const REPLAY_HISTORY_CAPACITY = 64;

/** The most frames one correction may replay, which bounds the rollback window. */
export const REPLAY_MAX_CORRECTION_FRAMES = 24;
