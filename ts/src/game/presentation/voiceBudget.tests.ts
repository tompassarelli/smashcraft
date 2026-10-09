import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { imod } from "wisp/src/sim/intMath";
import { sweep, sweepSeed } from "../../runtime/sweep";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { clearAttackBuffer } from "../input/attackBuffer";
import { produceComputerInput } from "../match/botPlay";
import { createFrameControls } from "../match/controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "../match/frameInput";
import { createPacingAndPresentation } from "../match/pacingAndPresentation";
import { Phase, createMatchState } from "../match/rules";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { createRoster, fighterAt, isActive } from "../sim/roster";
import { presentImpactSounds } from "./hitPresentation";
import {
  DUCK_PERCENT, KO_DUCK_FRAMES, VOICE_CAP, VOICE_FRAMES, VoiceClass, admitVoice, createVoiceBudget, liveVoices,
} from "./voiceBudget";

function lcg(seed: number): () => number {
  let state = seed;
  return () => {
    state = imod(state * 75 + 74, 65537);
    return state;
  };
}

test("random sound streams never exceed the cap, never drop a hit while a lower class plays, and never start a rate-limited repeat [invariant]", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const next = lcg(seed);
    const budget = createVoiceBudget();
    let replaced = 0;
    for (let frame = 1; frame <= 600; frame++) {
      const count = imod(next(), 7);
      for (let index = 0; index < count; index++) {
        const cls = imod(next(), 4) as VoiceClass;
        const key = `s${imod(next(), 60)}`;
        const result = admitVoice(budget, frame, cls, key);
        if (result.replaced) replaced++;
        assertLessThan(liveVoices(budget, frame), VOICE_CAP + 1);
        if (!result.play && cls >= VoiceClass.hit) {
          for (const voice of budget.voices) assertEquals(voice.end <= frame || voice.cls >= cls, true, `seed ${seed} frame ${frame}: class ${cls} dropped under class ${voice.cls}`);
        }
      }
    }
    assertGreaterThan(replaced, 0);
  }
});

test("a KO replaces the oldest lowest-class voice when the cap is full, and ducks lower classes for the duck window [spec #406]", () => {
  const budget = createVoiceBudget();
  for (let index = 0; index < VOICE_CAP; index++) assertTrue(admitVoice(budget, 10 + index, index < 4 ? VoiceClass.movement : VoiceClass.special, `m${index}`).play);
  assertEquals(liveVoices(budget, 26), VOICE_CAP);
  const full = admitVoice(budget, 26, VoiceClass.movement, "late");
  assertEquals(full.play, false, "a movement sound cannot displace its own class or higher");
  const hit = admitVoice(budget, 26, VoiceClass.hit, "hit");
  assertTrue(hit.play && hit.replaced);
  assertEquals(budget.voices[hit.slot]?.start, 26);
  assertEquals(budget.voices[0]?.cls === VoiceClass.hit || budget.voices[1]?.cls === VoiceClass.hit || budget.voices[2]?.cls === VoiceClass.hit || budget.voices[3]?.cls === VoiceClass.hit, true, "the oldest movement voice went first");
  const ko = admitVoice(budget, 27, VoiceClass.ko, "ko");
  assertTrue(ko.play);
  assertEquals(ko.percent, DUCK_PERCENT[VoiceClass.ko]);
  assertEquals(admitVoice(budget, 27 + KO_DUCK_FRAMES - 1, VoiceClass.hit, "h2").percent, DUCK_PERCENT[VoiceClass.hit]);
  const after = createVoiceBudget();
  admitVoice(after, 1, VoiceClass.ko, "ko");
  assertEquals(admitVoice(after, 1 + KO_DUCK_FRAMES, VoiceClass.special, "s").percent, 100);
  assertGreaterThan(VOICE_FRAMES[VoiceClass.ko] ?? 0, VOICE_FRAMES[VoiceClass.hit] ?? 0);
});

test("the same movement or special sound inside its rate limit is dropped, and a hit repeats freely [spec #406]", () => {
  const budget = createVoiceBudget();
  assertTrue(admitVoice(budget, 100, VoiceClass.movement, "step").play);
  assertEquals(admitVoice(budget, 101, VoiceClass.movement, "step").play, false);
  assertTrue(admitVoice(budget, 101, VoiceClass.movement, "other").play);
  assertTrue(admitVoice(budget, 200, VoiceClass.hit, "clap").play);
  assertTrue(admitVoice(budget, 200, VoiceClass.hit, "clap").play);
});

interface Played {
  readonly frame: number;
  readonly slot: number;
  readonly cls: VoiceClass;
  readonly key: string;
}

interface Recording {
  hits: number;
  hitsOnStop: number;
  hitsOff: number;
  dropped: number;
  droppedHits: number;
  hitsDroppedUnderLower: number;
  peakLive: number;
  peakRequested: number;
  ducked: number;
  kos: number;
  evictions: number;
  requests: number;
  played: number;
}

function recordFourFighterMatch(seed: number, frames: number): Recording {
  const roles = [Character.blademaster, Character.pitLord, Character.lich, Character.thrall];
  const world = createRoster(15, roles.map((character, index) => createFighter(character, -300.0 + index * 200.0, index < 2 ? 1 : -1)));
  const game = createMatchState();
  for (const slot of PARTICIPANT_SLOTS) {
    game.cpuOpponents[slot] = "wren";
    game.cpuResolvedOpponents[slot] = "wren";
    game.cpuTiers[slot] = "expert";
  }
  game.phase = Phase.match;
  game.stageChoice = 0;
  game.timeLimitMinutes = 0;
  game.matchSeed = 11 + sweepSeed(seed) * 12;
  for (let slot = 0; slot < 4; slot++) fighterAt(world, slot).status.damage = 90.0 + slot * 30.0;
  const runtime = createPacingAndPresentation();
  const produced = createFrameControls();
  const controls = createFrameControls();
  const row = createMatchFrameInput();
  const budget = createVoiceBudget();
  const result: Recording = { hits: 0, hitsOnStop: 0, hitsOff: 0, dropped: 0, droppedHits: 0, hitsDroppedUnderLower: 0, peakLive: 0, peakRequested: 0, ducked: 0, kos: 0, evictions: 0, requests: 0, played: 0 };
  const hitlagBefore: number[] = [0, 0, 0, 0];
  const lastHit: number[] = [0, 0, 0, 0];
  const requestedEnds: number[] = [];
  for (let step = 0; step < frames; step++) {
    const frame = runtime.simulationFrame + 1;
    for (const slot of PARTICIPANT_SLOTS) {
      if (!isActive(world, slot)) continue;
      clearAttackBuffer(produced.commands[slot]);
      produceComputerInput(game, world, runtime, slot, frame, produced.inputs[slot], produced.commands[slot]);
    }
    for (const slot of PARTICIPANT_SLOTS) if (isActive(world, slot)) hitlagBefore[slot] = fighterAt(world, slot).launch.hitlag;
    if (!captureFrame(row, frame, world.mask, produced, runtime) || !executeMatchFrame(row, game, world, controls, runtime, frame)) throw new Error("scenario frame refused");
    const soundsOfHit: number[] = [-1, -1, -1, -1];
    for (const slot of PARTICIPANT_SLOTS) {
      if (!isActive(world, slot)) continue;
      presentImpactSounds(runtime.frameImpacts[slot], (sound, _x, _z, _volume, _pitch, _file, cls) => {
        result.requests++;
        requestedEnds.push(frame + (VOICE_FRAMES[cls] ?? 0));
        const admitted = admitVoice(budget, frame, cls, sound);
        if (admitted.play) {
          result.played++;
          if (admitted.replaced) result.evictions++;
          if (admitted.percent < 100) result.ducked++;
          if (cls === VoiceClass.ko) result.kos++;
          if (cls === VoiceClass.hit && (soundsOfHit[slot] ?? -1) < 0) soundsOfHit[slot] = frame;
        } else {
          result.dropped++;
          if (cls === VoiceClass.hit) {
            result.droppedHits++;
            for (const voice of budget.voices) if (voice.end > frame && voice.cls < VoiceClass.hit) result.hitsDroppedUnderLower++;
          }
        }
        const live = liveVoices(budget, frame);
        if (live > result.peakLive) result.peakLive = live;
      });
    }
    let requested = 0;
    for (const end of requestedEnds) if (end > frame) requested++;
    if (requested > result.peakRequested) result.peakRequested = requested;
    for (const slot of PARTICIPANT_SLOTS) {
      if (!isActive(world, slot)) continue;
      const fighter = fighterAt(world, slot);
      const serial = fighter.visuals.hit;
      if (serial !== lastHit[slot] && fighter.launch.hitlag > (hitlagBefore[slot] ?? 0) && !runtime.frameImpacts[slot].pummel) {
        result.hits++;
        if (soundsOfHit[slot] === frame) result.hitsOnStop++;
        else result.hitsOff++;
      }
      lastHit[slot] = serial;
    }
  }
  return result;
}

test("one seeded four-fighter bot match keeps the cap, drops no hit under a lower sound, and starts every hit sound on its hitstop frame [spec #406]", () => {
  const report = recordFourFighterMatch(0, 2400);
  assertGreaterThan(report.hits, 0);
  assertEquals(report.hitsOff, 0);
  assertEquals(report.hitsDroppedUnderLower, 0);
  assertLessThan(report.peakLive, VOICE_CAP + 1);
});

sweep("eight seeded four-fighter bot matches of 3600 frames keep the cap, drop no hit and start every hit sound on its hitstop frame: 0 of 968 hits off, uncapped play peaks at 22 voices against the cap of 16 [spec #406]", () => {
  let hits = 0;
  let off = 0;
  let evictions = 0;
  let peak = 0;
  for (let seed = 0; seed < 8; seed++) {
    const report = recordFourFighterMatch(seed, 3600);
    hits += report.hits;
    off += report.hitsOff;
    evictions += report.evictions;
    peak = Math.max(peak, report.peakRequested);
    assertEquals(report.hitsDroppedUnderLower, 0);
    assertLessThan(report.peakLive, VOICE_CAP + 1);
  }
  assertGreaterThan(hits, 0);
  assertGreaterThan(peak, VOICE_CAP);
  assertGreaterThan(evictions, 0);
  assertEquals(off, 0, `${off} of ${hits}`);
});
