import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "../../runtime/testing";
import { f32 } from "../../sim/f32";
import type { FighterOriginalClip } from "../assets/fighterOriginalClipInfo";
import type { ModelSoundCue } from "../assets/modelSoundInfo";
import { PARTICIPANT_SLOTS, participantActive } from "../input/participants";
import { type FighterPose, createFighterPose, selectFighterClipIndex, selectFighterClipName } from "../presentation/fighterPose";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import {
  type ModelSoundCatalog,
  type ModelSoundEvent,
  type ModelSoundSink,
  beginModelSoundEpoch,
  confirmModelSounds,
  createModelSoundCursor,
  emitModelSoundInterval,
  modelSoundCrossed,
} from "./modelSounds";

// The original clips and cues these contracts were measured on, copied from
// the generated FighterOriginalClipInfo and ModelSoundInfo the Wurst tests ran with.
const clip = (startSeconds: number, endSeconds: number, looping: boolean): FighterOriginalClip => ({ modelPath: "", startSeconds, endSeconds, looping });
const cue = (sequenceIndex: number, seconds: number, soundIndex: number): ModelSoundCue => ({ sequenceIndex, seconds, soundIndex });
const CLIPS: Readonly<Record<number, Readonly<Record<number, FighterOriginalClip>>>> = {
  [Character.rifleman]: { 5: clip(f32(10.041), f32(10.916), false), 11: clip(f32(18.916), 20.625, false), 40: clip(f32(120.958), f32(122.291), true) },
  [Character.demonHunter]: { 6: clip(12.5, f32(13.416), false), 18: clip(f32(30.183), f32(34.283), false), 108: clip(f32(178.539), f32(179.305), true) },
};
const NAMES: Readonly<Record<number, Readonly<Record<string, number>>>> = {
  [Character.rifleman]: { stand: 40 },
  [Character.demonHunter]: { "walk alternate": 108 },
};
const CUES: Readonly<Record<number, readonly ModelSoundCue[]>> = {
  [Character.rifleman]: [cue(5, f32(0.167), 2), cue(11, 0.0, 1)],
  [Character.demonHunter]: [
    cue(6, 0.0, 3), cue(7, 0.0, 4), cue(18, 0.0, 5), cue(19, 0.0, 7), cue(20, 0.0, 8),
    cue(21, 0.0, 8), cue(58, 0.0, 6), cue(59, 0.0, 6), cue(108, f32(0.133), 9), cue(108, 0.5, 10),
  ],
};
const ORIGINALS: ModelSoundCatalog = {
  clip: (character, clipIndex) => CLIPS[character]?.[clipIndex],
  clipNamed: (character, name) => NAMES[character]?.[name],
  cueCount: (character) => CUES[character]?.length ?? 0,
  cue: (character, ordinal) => CUES[character]?.[ordinal],
};

interface SoundRecording {
  readonly sink: ModelSoundSink;
  count: number;
  readonly perSlot: number[];
  events: string;
  last: ModelSoundEvent | undefined;
}

function soundRecording(): SoundRecording {
  const recording: SoundRecording = {
    sink: (event) => {
      recording.count++;
      recording.perSlot[event.slot] = (recording.perSlot[event.slot] ?? 0) + 1;
      recording.last = event;
      recording.events += `${event.epoch}:${event.frame}:${event.slot}:${event.selectionSerial}:${event.ordinal}:${event.loopIndex};`;
    },
    count: 0,
    perSlot: [0, 0, 0, 0],
    events: "",
    last: undefined,
  };
  return recording;
}

function selectIndex(pose: FighterPose, index: number): FighterPose {
  selectFighterClipIndex(pose, index);
  return pose;
}

test("sound crossings keep start, end and loop boundary", () => {
  assertTrue(modelSoundCrossed(-1.0, 0.0, 0.0, 1.0, false, 0));
  assertFalse(modelSoundCrossed(0.0, 0.0, 0.0, 1.0, false, 0));
  assertTrue(modelSoundCrossed(f32(0.9), 1.0, 1.0, 1.0, false, 0));
  assertFalse(modelSoundCrossed(1.0, 2.0, 1.0, 1.0, false, 0));
  assertTrue(modelSoundCrossed(f32(0.9), 1.0, 1.0, 1.0, true, 0));
  assertTrue(modelSoundCrossed(f32(0.9), 1.0, 0.0, 1.0, true, 1));
  assertFalse(modelSoundCrossed(1.0, f32(1.1), 0.0, 1.0, true, 1));
  assertFalse(modelSoundCrossed(0.0, 10.0, f32(0.2), 1.0, false, 1));
});

test("sound original loop crossings have no dropping cap", () => {
  const record = soundRecording();
  const walk = assertDefined(ORIGINALS.clip(Character.demonHunter, 108));
  assertTrue(walk.looping);
  const duration = f32(walk.endSeconds - walk.startSeconds);
  const selection = { epoch: 4, frame: 8, slot: 3, character: Character.demonHunter, selectionSerial: 7, clipIndex: 108 };
  emitModelSoundInterval(ORIGINALS, record.sink, selection, -1.0, f32(duration * 300.0), 0.0, 0.0);
  assertEquals(record.count, 600);
  const last = assertDefined(record.last);
  assertEquals(last.loopIndex, 299);
  assertEquals(last.ordinal, 9);
  assertEquals(last.slot, 3);
  assertEquals(last.selectionSerial, 7);
  assertEquals(last.epoch, 4);
  assertEquals(last.frame, 8);
});

test("sound confirmed selection start and intentional repeat", () => {
  const sounds = createModelSoundCursor(ORIGINALS);
  const record = soundRecording();
  const fighter = createFighter(Character.demonHunter, 0.0, 1);
  const pose = selectIndex(createFighterPose(), 6);
  assertTrue(beginModelSoundEpoch(sounds, 2));
  assertTrue(confirmModelSounds(sounds, 2, 0, 3, fighter, pose, record.sink));
  assertEquals(record.count, 1);
  assertFalse(confirmModelSounds(sounds, 2, 0, 3, fighter, pose, record.sink));
  assertEquals(record.count, 1);
  selectIndex(pose, 6);
  assertTrue(confirmModelSounds(sounds, 2, 1, 3, fighter, pose, record.sink));
  assertEquals(record.count, 2);
  assertEquals(record.last?.selectionSerial, 2);
  assertFalse(confirmModelSounds(sounds, 2, 3, 3, fighter, pose, record.sink));
  assertTrue(confirmModelSounds(sounds, 2, 2, 3, fighter, pose, record.sink));
  assertEquals(record.count, 2);
  assertFalse(beginModelSoundEpoch(sounds, 2));
  assertTrue(beginModelSoundEpoch(sounds, 3));
  assertFalse(confirmModelSounds(sounds, 2, 3, 3, fighter, pose, record.sink));
  assertTrue(confirmModelSounds(sounds, 3, 0, 3, fighter, pose, record.sink));
  assertEquals(record.count, 3);
  assertEquals(record.last?.epoch, 3);
});

test("sound interrupted previous interval and frozen rate", () => {
  const sounds = createModelSoundCursor(ORIGINALS);
  const record = soundRecording();
  const fighter = createFighter(Character.rifleman, 0.0, 1);
  const pose = selectIndex(createFighterPose(), 5);
  pose.clipTime = f32(0.16);
  pose.rate = 1.0;
  assertTrue(beginModelSoundEpoch(sounds, 6));
  assertTrue(confirmModelSounds(sounds, 6, 0, 0, fighter, pose, record.sink));
  assertEquals(record.count, 0);
  selectFighterClipName(pose, "stand");
  pose.rate = 0.0;
  assertTrue(confirmModelSounds(sounds, 6, 1, 0, fighter, pose, record.sink));
  assertEquals(record.count, 1);
  assertEquals(record.last?.selectionSerial, 1);
  assertEquals(record.last?.ordinal, 0);
  selectIndex(pose, 5);
  pose.clipTime = f32(0.16);
  assertTrue(confirmModelSounds(sounds, 6, 2, 0, fighter, pose, record.sink));
  assertTrue(confirmModelSounds(sounds, 6, 3, 0, fighter, pose, record.sink));
  assertEquals(record.count, 1);
  selectFighterClipName(pose, "stand");
  assertTrue(confirmModelSounds(sounds, 6, 4, 0, fighter, pose, record.sink));
  assertEquals(record.count, 1);
});

test("sound sparse four slots and catch-up match sequential", () => {
  for (const mask of [9, 15]) {
    const fighters = PARTICIPANT_SLOTS.map((slot) => createFighter(Character.demonHunter, slot * 100.0, 1));
    const poses = PARTICIPANT_SLOTS.map(() => createFighterPose());
    const active = PARTICIPANT_SLOTS.filter((slot) => participantActive(mask, slot));
    const sequential = createModelSoundCursor(ORIGINALS);
    const catchup = createModelSoundCursor(ORIGINALS);
    const a = soundRecording();
    const b = soundRecording();
    assertTrue(beginModelSoundEpoch(sequential, 7));
    assertTrue(beginModelSoundEpoch(catchup, 7));
    for (const slot of active) {
      const pose = assertDefined(poses[slot]);
      const fighter = assertDefined(fighters[slot]);
      selectFighterClipName(pose, "walk alternate");
      assertTrue(confirmModelSounds(sequential, 7, 0, slot, fighter, pose, a.sink));
      assertTrue(confirmModelSounds(catchup, 7, 0, slot, fighter, pose, b.sink));
    }
    // Six confirmed rows serviced by one callback must all reach the cursor.
    for (const [cursor, record, repeat] of [[sequential, a, false], [catchup, b, true]] as const) {
      for (let frame = 1; frame <= 6; frame++) {
        for (const slot of active) {
          const pose = assertDefined(poses[slot]);
          const fighter = assertDefined(fighters[slot]);
          pose.clipTime = f32(frame * f32(0.2));
          assertTrue(confirmModelSounds(cursor, 7, frame, slot, fighter, pose, record.sink));
          if (repeat) assertFalse(confirmModelSounds(cursor, 7, frame, slot, fighter, pose, record.sink));
        }
      }
    }
    assertEquals(a.events, b.events);
    for (const slot of PARTICIPANT_SLOTS) assertEquals(a.perSlot[slot], participantActive(mask, slot) ? 3 : 0);
  }
});

test("sound out selection plays once and a hidden loop does not continue", () => {
  const sounds = createModelSoundCursor(ORIGINALS);
  const record = soundRecording();
  const fighter = createFighter(Character.demonHunter, 0.0, 1);
  const pose = selectIndex(createFighterPose(), 108);
  assertTrue(beginModelSoundEpoch(sounds, 9));
  assertTrue(confirmModelSounds(sounds, 9, 0, 0, fighter, pose, record.sink));
  fighter.status.out = true;
  selectIndex(pose, 18);
  assertTrue(confirmModelSounds(sounds, 9, 1, 0, fighter, pose, record.sink));
  assertEquals(record.count, 1);
  pose.clipTime = 3.0;
  assertTrue(confirmModelSounds(sounds, 9, 2, 0, fighter, pose, record.sink));
  assertEquals(record.count, 1);
});

test("sound hidden unchanged selection stops but a new out clip keeps delayed cues", () => {
  const sounds = createModelSoundCursor(ORIGINALS);
  const record = soundRecording();
  const fighter = createFighter(Character.demonHunter, 0.0, 1);
  const pose = selectIndex(createFighterPose(), 108);
  assertTrue(beginModelSoundEpoch(sounds, 12));
  assertTrue(confirmModelSounds(sounds, 12, 0, 3, fighter, pose, record.sink));
  fighter.status.out = true;
  pose.clipTime = f32(0.05);
  assertTrue(confirmModelSounds(sounds, 12, 1, 3, fighter, pose, record.sink));
  pose.clipTime = 2.0;
  assertTrue(confirmModelSounds(sounds, 12, 2, 3, fighter, pose, record.sink));
  assertEquals(record.count, 0);
  // A real delayed cue shows the rule is about a new selection while hidden,
  // not a special case for cues at zero.
  fighter.character = Character.rifleman;
  selectIndex(pose, 5);
  assertTrue(confirmModelSounds(sounds, 12, 3, 3, fighter, pose, record.sink));
  assertEquals(record.count, 0);
  pose.clipTime = f32(0.2);
  assertTrue(confirmModelSounds(sounds, 12, 4, 3, fighter, pose, record.sink));
  assertEquals(record.count, 1);
  pose.clipTime = 2.0;
  assertTrue(confirmModelSounds(sounds, 12, 5, 3, fighter, pose, record.sink));
  assertEquals(record.count, 1);
});
