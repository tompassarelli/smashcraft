// Sound events authored in the original fighter models. Packaging generates
// this module from the original MDX events and AnimSounds.slk (ModelSoundInfo's
// generator). This checked-in version has no cues, so fighters play no model sounds.

/** A sound keyed at `seconds` into an original sequence. */
export interface ModelSoundCue {
  readonly sequenceIndex: number;
  readonly seconds: number;
  readonly soundIndex: number;
}

/** The stock sound label, which owns its variants, pitch, channel and attenuation. */
export function modelSoundLabel(_soundIndex: number): string | undefined {
  return undefined;
}

export function modelSoundIs3D(_soundIndex: number): boolean {
  return false;
}

/** Cues 0 to count - 1 exist for this character, ordered as authored. */
export function fighterSoundCueCount(_character: number): number {
  return 0;
}

export function fighterSoundCue(_character: number, _ordinal: number): ModelSoundCue | undefined {
  return undefined;
}
