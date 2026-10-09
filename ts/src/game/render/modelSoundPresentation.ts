

import { modelSoundIs3D, modelSoundLabel } from "../assets/modelSoundInfo";
import type { WorldOrigin } from "./effects";
import type { ModelSoundEvent, ModelSoundSink } from "./modelSounds";
import { type SoundBank, SoundKind } from "./soundBank";


const kindOf = (soundIndex: number): SoundKind => modelSoundIs3D(soundIndex) ? SoundKind.label : SoundKind.flatLabel;

export function modelSoundPresentation(origin: Readonly<WorldOrigin>, sounds: SoundBank): ModelSoundSink {
  for (let index = 0; ; index++) {
    const label = modelSoundLabel(index);
    if (label === undefined) break;
    sounds.prepare(kindOf(index), [label]);
  }
  return (event: ModelSoundEvent, x: number, z: number) => {
    const label = modelSoundLabel(event.soundIndex);
    if (label === undefined) return;
    sounds.playAt(kindOf(event.soundIndex), label, origin.x + x, origin.y, origin.z + z);
  };
}
