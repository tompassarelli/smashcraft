



import {
  type FighterOriginalClip,
  originalClip,
  originalClipNamed,
} from "../assets/fighterOriginalClipInfo";
import { type ModelSoundCue, fighterSoundCue, fighterSoundCueCount } from "../assets/modelSoundInfo";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { FRAME_SECONDS, type FighterPose } from "../presentation/fighterPose";
import { f32 } from "wisp/src/sim/f32";
import { toInt } from "../../runtime/numbers";
import type { Fighter } from "../sim/fighter";


export interface ModelSoundEvent {
  readonly epoch: number;
  readonly frame: number;
  readonly slot: number;
  readonly selectionSerial: number;
  readonly ordinal: number;
  readonly loopIndex: number;
  readonly soundIndex: number;
}


export type ModelSoundSink = (event: ModelSoundEvent, x: number, z: number) => void;


export interface ModelSoundCatalog {
  readonly clip: (this: void, character: number, clipIndex: number) => FighterOriginalClip | undefined;
  readonly clipNamed: (this: void, character: number, name: string) => number | undefined;
  readonly cueCount: (this: void, character: number) => number;
  readonly cue: (this: void, character: number, ordinal: number) => ModelSoundCue | undefined;
}

export const ORIGINAL_MODEL_SOUNDS: ModelSoundCatalog = {
  clip: originalClip,
  clipNamed: originalClipNamed,
  cueCount: fighterSoundCueCount,
  cue: fighterSoundCue,
};


interface SoundSelection {
  epoch: number;
  frame: number;
  slot: number;
  character: number;
  selectionSerial: number;
  clipIndex: number | undefined;
}


export function modelSoundCrossed(fromSeconds: number, throughSeconds: number, cueSeconds: number, duration: number, looping: boolean, loopIndex: number): boolean {
  if (loopIndex < 0 || cueSeconds < 0.0 || cueSeconds > duration || throughSeconds < fromSeconds) return false;
  if (loopIndex > 0 && (!looping || duration <= 0.0)) return false;
  const eventSeconds = f32(cueSeconds + f32(loopIndex * duration));
  return eventSeconds > fromSeconds && eventSeconds <= throughSeconds;
}






export function emitModelSoundInterval(catalog: ModelSoundCatalog, sink: ModelSoundSink, selection: Readonly<SoundSelection>, fromSeconds: number, throughSeconds: number, x: number, z: number): void {
  const { character, clipIndex } = selection;
  const clip = clipIndex === undefined ? undefined : catalog.clip(character, clipIndex);
  if (clip === undefined || throughSeconds < fromSeconds) return;
  const duration = f32(clip.endSeconds - clip.startSeconds);
  let firstLoop = 0;
  let lastLoop = 0;
  if (clip.looping && duration > 0.0) {
    firstLoop = toInt(f32(Math.max(0.0, fromSeconds) / duration));
    lastLoop = toInt(f32(Math.max(0.0, throughSeconds) / duration));
  }
  const cues = catalog.cueCount(character);
  for (let loopIndex = firstLoop; loopIndex <= lastLoop; loopIndex++) {
    for (let ordinal = 0; ordinal < cues; ordinal++) {
      const cue = catalog.cue(character, ordinal);
      if (cue === undefined || cue.sequenceIndex !== clipIndex || !modelSoundCrossed(fromSeconds, throughSeconds, cue.seconds, duration, clip.looping, loopIndex)) continue;
      const { epoch, frame, slot, selectionSerial } = selection;
      sink({ epoch, frame, slot, selectionSerial, ordinal, loopIndex, soundIndex: cue.soundIndex }, x, z);
    }
  }
}


interface SlotSounds {
  lastFrame: number | undefined;

  readonly shown: SoundSelection;
  seconds: number;
  rate: number;

  audible: boolean;
  wasOut: boolean;
}

export interface ModelSoundCursor {
  readonly catalog: ModelSoundCatalog;
  epoch: number | undefined;
  readonly slots: readonly SlotSounds[];

  readonly next: SoundSelection;
}

const emptySelection = (): SoundSelection => ({ epoch: 0, frame: 0, slot: 0, character: 0, selectionSerial: 0, clipIndex: undefined });

export function createModelSoundCursor(catalog: ModelSoundCatalog): ModelSoundCursor {
  return {
    catalog,
    epoch: undefined,
    slots: PARTICIPANT_SLOTS.map(() => ({ lastFrame: undefined, shown: emptySelection(), seconds: 0.0, rate: 0.0, audible: false, wasOut: false })),
    next: emptySelection(),
  };
}


export function beginModelSoundEpoch(cursor: ModelSoundCursor, epoch: number): boolean {
  if (cursor.epoch !== undefined && epoch <= cursor.epoch) return false;
  cursor.epoch = epoch;
  for (const slot of cursor.slots) {
    slot.lastFrame = undefined;
    slot.audible = false;
  }
  return true;
}







export function confirmModelSounds(cursor: ModelSoundCursor, epoch: number, frame: number, slot: number, fighter: Readonly<Fighter>, pose: Readonly<FighterPose>, sink: ModelSoundSink): boolean {
  const state = cursor.slots[slot];
  if (epoch !== cursor.epoch || state === undefined || frame !== (state.lastFrame ?? -1) + 1) return false;
  const { catalog, next } = cursor;
  const { shown } = state;
  next.epoch = epoch;
  next.frame = frame;
  next.slot = slot;
  next.character = fighter.character;
  next.selectionSerial = pose.selectionSerial;
  next.clipIndex = pose.clipIndex ?? catalog.clipNamed(fighter.character, pose.clipName);
  const changed = state.lastFrame === undefined || shown.character !== next.character || shown.selectionSerial !== next.selectionSerial || shown.clipIndex !== next.clipIndex;
  const x = fighter.motion.x;
  const z = fighter.motion.z;
  if (state.lastFrame !== undefined && state.audible) {

    const through = changed ? f32(state.seconds + f32(state.rate * FRAME_SECONDS)) : pose.clipTime;
    shown.epoch = epoch;
    shown.slot = slot;
    shown.frame = frame;
    emitModelSoundInterval(catalog, sink, shown, state.seconds, through, x, z);
  }
  if (changed) emitModelSoundInterval(catalog, sink, next, -1.0, pose.clipTime, x, z);
  state.lastFrame = frame;
  shown.character = next.character;
  shown.selectionSerial = next.selectionSerial;
  shown.clipIndex = next.clipIndex;
  state.seconds = pose.clipTime;
  state.rate = pose.rate;


  if (changed || !fighter.status.out) state.audible = true;
  else if (!state.wasOut) state.audible = false;
  state.wasOut = fighter.status.out;
  return true;
}
