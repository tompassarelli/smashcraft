export const VoiceClass = { movement: 0, special: 1, hit: 2, ko: 3 } as const;
export type VoiceClass = (typeof VoiceClass)[keyof typeof VoiceClass];

export const VOICE_CAP = 16;

export const VOICE_FRAMES: readonly number[] = [20, 45, 36, 120];

export const RATE_LIMIT_FRAMES: readonly number[] = [6, 4, 0, 0];

export const KO_DUCK_FRAMES = 90;

export const DUCK_PERCENT: readonly number[] = [30, 50, 75, 100];

export interface Voice {
  cls: VoiceClass;
  key: string;
  start: number;
  end: number;
}

export interface Admission {
  play: boolean;
  slot: number;
  replaced: boolean;
  percent: number;
}

export interface VoiceBudget {
  readonly voices: Voice[];
  readonly lastStart: { [key: string]: number | undefined };
  duckUntil: number;
  readonly admission: Admission;
}

export function createVoiceBudget(): VoiceBudget {
  const voices: Voice[] = [];
  for (let slot = 0; slot < VOICE_CAP; slot++) voices.push({ cls: VoiceClass.movement, key: "", start: 0, end: 0 });
  return { voices, lastStart: {}, duckUntil: 0, admission: { play: false, slot: -1, replaced: false, percent: 100 } };
}

export function resetVoiceBudget(budget: VoiceBudget): void {
  for (const voice of budget.voices) {
    voice.cls = VoiceClass.movement;
    voice.key = "";
    voice.start = 0;
    voice.end = 0;
  }
  for (const key of Object.keys(budget.lastStart)) budget.lastStart[key] = undefined;
  budget.duckUntil = 0;
}

export function liveVoices(budget: Readonly<VoiceBudget>, frame: number): number {
  let live = 0;
  for (const voice of budget.voices) if (voice.end > frame) live++;
  return live;
}

function refuse(admission: Admission): Admission {
  admission.play = false;
  admission.slot = -1;
  admission.replaced = false;
  admission.percent = 0;
  return admission;
}

/**
 * Decides whether one sound of class `cls` and identity `key` starts on `frame`.
 * A sound that plays takes a free slot or replaces the oldest live voice of a lower class;
 * a hit or KO with no lower voice live replaces the oldest voice of its own class, so it
 * always starts on its frame. A lower class is refused when every live voice is of its own
 * class or higher, or when it repeats the same sound inside its rate limit. Starts under a
 * KO duck by class.
 */
export function admitVoice(budget: VoiceBudget, frame: number, cls: VoiceClass, key: string): Admission {
  const admission = budget.admission;
  const limit = RATE_LIMIT_FRAMES[cls] ?? 0;
  const last = budget.lastStart[key];
  if (limit > 0 && last !== undefined && frame - last < limit) return refuse(admission);
  let slot = -1;
  let oldest = -1;
  for (let index = 0; index < VOICE_CAP; index++) {
    const voice = budget.voices[index];
    if (voice === undefined) continue;
    if (voice.end <= frame) {
      slot = index;
      break;
    }
    if (voice.cls > cls || (voice.cls === cls && cls < VoiceClass.hit)) continue;
    const current = oldest < 0 ? undefined : budget.voices[oldest];
    if (current === undefined || voice.cls < current.cls || (voice.cls === current.cls && voice.start < current.start)) oldest = index;
  }
  const replaced = slot < 0;
  if (replaced) slot = oldest;
  if (slot < 0) return refuse(admission);
  const taken = budget.voices[slot];
  if (taken === undefined) return refuse(admission);
  taken.cls = cls;
  taken.key = key;
  taken.start = frame;
  taken.end = frame + (VOICE_FRAMES[cls] ?? 0);
  budget.lastStart[key] = frame;
  if (cls === VoiceClass.ko) budget.duckUntil = frame + KO_DUCK_FRAMES;
  admission.play = true;
  admission.slot = slot;
  admission.replaced = replaced;
  admission.percent = frame < budget.duckUntil ? DUCK_PERCENT[cls] ?? 100 : 100;
  return admission;
}
