// The original-model clip pool: one model per original sequence, so a clip
// plays by setting its time. Packaging generates this module from the private
// prepared clips (FighterOriginalClipInfo's generator). This checked-in
// version is the native-presentation build: no fighter has pooled clips.

export interface FighterOriginalClip {
  readonly modelPath: string;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly looping: boolean;
}

/** The light model's animation while its fighter is shown, and while hidden. */
export const ORIGINAL_LIGHT_ACTIVE_ANIMATION = "Stand";
export const ORIGINAL_LIGHT_INACTIVE_ANIMATION = "Death";
export const ORIGINAL_LIGHT_GATE_SECONDS = 0.5;

/** Clips 0 to count - 1 exist for this character. */
export function originalClipCount(_character: number): number {
  return 0;
}

/** The light model that accompanies this character's clips, if it has one. */
export function originalLightPath(_character: number): string | undefined {
  return undefined;
}

/** The clip for an original sequence index; times are seconds within the clip. */
export function originalClip(_character: number, _sequenceIndex: number): FighterOriginalClip | undefined {
  return undefined;
}

/** The sequence index of an original sequence name, such as "walk alternate". */
export function originalClipNamed(_character: number, _name: string): number | undefined {
  return undefined;
}
