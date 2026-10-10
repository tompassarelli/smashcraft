import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import type { FighterOriginalClip } from "../assets/fighterOriginalClipInfo";
import type { ModelSoundCue } from "../assets/modelSoundInfo";
import { PARTICIPANT_SLOTS, participantActive } from "../input/participants";
import { type FighterPose, createFighterPose, selectFighterClipIndex, selectFighterClipName } from "../presentation/fighterPose";
import { createFrameControls } from "../match/controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "../match/frameInput";
import { createPacingAndPresentation } from "../match/pacingAndPresentation";
import { Phase, createMatchState, setHumanMask } from "../match/rules";
import { ReplayCorrections, ReplayHistory } from "../replay/history";
import type { ReplayState } from "../replay/snapshot";
import { Character } from "../sim/codes";
import { createRoster, fighterAt } from "../sim/roster";
import { createFighter } from "../sim/fighter";
import {
  type ModelSoundCatalog,
  type ModelSoundEvent,
  type ModelSoundSink,
  beginModelSoundEpoch,
  confirmModelSounds,
  createModelSoundCursor,
  } from "./modelSounds";



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

test("sound sparse four slots and catch-up match sequential [k1 scenario]", () => {
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
  }
});

test("sound from speculative and corrected numerical rollback never dispatches; confirmation does once [k1 scenario]", () => {
  const game = createMatchState();
  setHumanMask(game, 9);
  game.phase = Phase.match;
  game.timeLimitMinutes = 0;
  const live: ReplayState = { world: createRoster(9), match: game, controls: createFrameControls(), runtime: createPacingAndPresentation() };
  const { world, runtime } = live;
  const history = new ReplayHistory();
  const row = createMatchFrameInput();
  const sounds = createModelSoundCursor(ORIGINALS);
  const record = soundRecording();
  assertTrue(beginModelSoundEpoch(sounds, 11));
  assertTrue(history.beginEpoch(11, 1, 12));
  const confirmActive = (frame: number) => PARTICIPANT_SLOTS.filter(slot => participantActive(world.mask, slot))
    .map(slot => confirmModelSounds(sounds, 11, frame, slot, fighterAt(world, slot), runtime.poses[slot], record.sink));
  for (const slot of PARTICIPANT_SLOTS) {
    if (!participantActive(world.mask, slot)) continue;
    const fighter = createFighter(Character.rifleman, -200.0 + slot * 150.0, 1);


    fighter.status.frozenFrames = 60;
    world.fighters[slot] = fighter;
    selectIndex(runtime.poses[slot], 5).clipTime = f32(0.16);
  }
  for (const confirmed of confirmActive(0)) assertTrue(confirmed);
  for (let frame = 1; frame <= 4; frame++) {
    assertTrue(captureFrame(row, frame, 9, live.controls, runtime));
    assertTrue(history.saveSpeculative(11, row, live));
    assertTrue(executeMatchFrame(row, game, world, live.controls, runtime, frame));
  }
  assertEquals(record.count, 0);
  const replacement = createFrameControls();
  replacement.inputs[3].direction = -1;
  assertTrue(captureFrame(row, 1, 9, replacement, runtime));
  const corrections = new ReplayCorrections();
  assertTrue(corrections.beginEpoch(11));
  assertTrue(corrections.add(row));
  assertEquals(history.correct(11, corrections, live), 1);
  assertEquals(record.count, 0);
  assertTrue(history.replay(11, 1, 4, live));
  assertEquals(record.count, 0);

  for (let frame = 1; frame <= 4; frame++) {
    assertTrue(history.replay(11, frame, frame, live));
    for (const confirmed of confirmActive(frame)) assertTrue(confirmed);
    for (const confirmed of confirmActive(frame)) assertFalse(confirmed);
  }
  assertEquals(record.count, 2);
  assertTrue(history.replay(11, 1, 4, live));
  assertEquals(record.count, 2);
});

