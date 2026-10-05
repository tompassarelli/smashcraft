// Plays confirmed model sounds in the world. Each cue is a fresh sound from its
// stock label, released when it finishes; engine mixing and voice limits are
// the game's.
import { modelSoundIs3D, modelSoundLabel } from "../assets/modelSoundInfo";
import type { WorldOrigin } from "./effects";
import type { ModelSoundEvent, ModelSoundSink } from "./modelSounds";

/** A sink that plays each event at its fighter position, offset from the world origin. */
export function modelSoundPresentation(origin: Readonly<WorldOrigin>): ModelSoundSink {
  return (event: ModelSoundEvent, x: number, z: number) => {
    const label = modelSoundLabel(event.soundIndex);
    if (label === undefined) return;
    const cue = CreateSoundFromLabel(label, false, modelSoundIs3D(event.soundIndex), true, 10000, 10000);
    SetSoundPosition(cue, origin.x + x, origin.y, origin.z + z);
    StartSound(cue);
    KillSoundWhenDone(cue);
  };
}
