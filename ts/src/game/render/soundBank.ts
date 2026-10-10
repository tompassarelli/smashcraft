export const SoundKind = { combatFile: 0, combatLabel: 1, label: 2, flatLabel: 3, interfaceFile: 4 } as const;
export type SoundKind = (typeof SoundKind)[keyof typeof SoundKind];

const KIND_COUNT = 5;
const VOICES = 2;

interface Ring {
  readonly voices: sound[];
  next: number;
}

function createVoice(kind: SoundKind, name: string): sound {
  switch (kind) {
    case SoundKind.combatFile: {
      const cue = CreateSound(name, false, true, true, 10, 10, "CombatSoundsEAX");
      SetSoundDistances(cue, 600.0, 3500.0);
      SetSoundDistanceCutoff(cue, 3000.0);
      return cue;
    }
    case SoundKind.interfaceFile: {
      const cue = CreateSound(name, false, false, false, 10, 10, "DefaultEAXON");
      SetSoundDuration(cue, GetSoundFileDuration(name));
      return cue;
    }
    case SoundKind.flatLabel: return CreateSoundFromLabel(name, false, false, true, 10000, 10000);
    default: return CreateSoundFromLabel(name, false, true, true, 10000, 10000);
  }
}

// Warcraft handles must be born on the same turn on every client, so presentation only replays handles made here at shared startup.
export class SoundBank {
  private readonly rings: { [name: string]: Ring | undefined }[] = [];

  constructor() {
    for (let kind = 0; kind < KIND_COUNT; kind++) this.rings.push({});
  }

  prepare(kind: SoundKind, names: readonly string[]): void {
    const rings = this.rings[kind];
    if (rings === undefined) return;
    for (const name of names) {
      if (rings[name] !== undefined) continue;
      const voices: sound[] = [];
      for (let voice = 0; voice < VOICES; voice++) voices.push(createVoice(kind, name));
      rings[name] = { voices, next: 0 };
    }
  }

  private take(kind: SoundKind, name: string): sound | undefined {
    const ring = this.rings[kind]?.[name];
    if (ring === undefined) return undefined;
    const cue = ring.voices[ring.next];
    ring.next = ring.next + 1 >= ring.voices.length ? 0 : ring.next + 1;
    if (cue !== undefined) StopSound(cue, false, false);
    return cue;
  }

  playAt(kind: SoundKind, name: string, x: number, y: number, z: number, volume?: number, pitch?: number): sound | undefined {
    const cue = this.take(kind, name);
    if (cue === undefined) return undefined;
    SetSoundPosition(cue, x, y, z);
    if (volume !== undefined) SetSoundVolume(cue, volume);
    if (pitch !== undefined) SetSoundPitch(cue, pitch);
    StartSound(cue);
    return cue;
  }

  play(kind: SoundKind, name: string, volume?: number): sound | undefined {
    const cue = this.take(kind, name);
    if (cue === undefined) return undefined;
    if (volume !== undefined) SetSoundVolume(cue, volume);
    StartSound(cue);
    return cue;
  }
}
