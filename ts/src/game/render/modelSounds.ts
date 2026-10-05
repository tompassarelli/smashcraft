// Sounds keyed in the original fighter models, played from confirmed frames
// only. The cursor belongs to confirmed presentation: no replay snapshot or
// frame executor holds it, so a rollback can never replay a sound, and every
// confirmed frame is visited once in order, so catching up drops none.
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

/** One authored sound reached by one selection: distinct per epoch, frame, slot, selection, cue and loop. */
export interface ModelSoundEvent {
  readonly epoch: number;
  readonly frame: number;
  readonly slot: number;
  readonly selectionSerial: number;
  readonly ordinal: number;
  readonly loopIndex: number;
  readonly soundIndex: number;
}

/** Plays an event at a fighter position relative to the world origin. */
export type ModelSoundSink = (event: ModelSoundEvent, x: number, z: number) => void;

/** Original clips and their sound cues, generated from the original models. */
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

/** The clip a fighter shows: chosen by index or by original sequence name. */
interface SoundSelection {
  epoch: number;
  frame: number;
  slot: number;
  character: number;
  selectionSerial: number;
  clipIndex: number | undefined;
}

/** Whether loop `loopIndex` of a cue at `cueSeconds` falls in (fromSeconds, throughSeconds]. */
export function modelSoundCrossed(fromSeconds: number, throughSeconds: number, cueSeconds: number, duration: number, looping: boolean, loopIndex: number): boolean {
  if (loopIndex < 0 || cueSeconds < 0.0 || cueSeconds > duration || throughSeconds < fromSeconds) return false;
  if (loopIndex > 0 && (!looping || duration <= 0.0)) return false;
  const eventSeconds = f32(cueSeconds + f32(loopIndex * duration));
  return eventSeconds > fromSeconds && eventSeconds <= throughSeconds;
}

/**
 * Emits every cue of the selected clip in (fromSeconds, throughSeconds], each
 * loop of a looping clip separately. Simultaneous keys and a clip-end key
 * beside the next loop's start key are distinct events; no cap drops catch-up cues.
 */
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

/** What the cursor remembers of a slot's last confirmed frame. */
interface SlotSounds {
  lastFrame: number | undefined;
  /** The selection shown at lastFrame; its epoch, frame and slot fields are scratch for emitting. */
  readonly shown: SoundSelection;
  seconds: number;
  rate: number;
  /** Whether the shown selection may still sound; a hidden, unchanged one stops. */
  audible: boolean;
  wasOut: boolean;
}

export interface ModelSoundCursor {
  readonly catalog: ModelSoundCatalog;
  epoch: number | undefined;
  readonly slots: readonly SlotSounds[];
  /** Preallocated: confirmed frames visit every participant every frame. */
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

/** Starts a match epoch, which must be newer than the last; frame zero of each slot then seeds its selection. */
export function beginModelSoundEpoch(cursor: ModelSoundCursor, epoch: number): boolean {
  if (cursor.epoch !== undefined && epoch <= cursor.epoch) return false;
  cursor.epoch = epoch;
  for (const slot of cursor.slots) {
    slot.lastFrame = undefined;
    slot.audible = false;
  }
  return true;
}

/**
 * Consumes one slot's confirmed frame: the frame after the last one consumed,
 * or zero after the epoch began. A duplicate, stale or skipped frame is refused
 * and consumes nothing. Emits the cues the shown clip passed since the last
 * frame and the cues a newly selected clip has already reached.
 */
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
    // The previous clip runs one more frame at its own rate before a new one replaces it.
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
  // A newly selected out or death clip keeps its authored sounds; hiding an
  // unchanged selection at a KO stops only that stale selection.
  if (changed || !fighter.status.out) state.audible = true;
  else if (!state.wasOut) state.audible = false;
  state.wasOut = fighter.status.out;
  return true;
}
