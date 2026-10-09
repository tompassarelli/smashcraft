import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { clearPresentationHistory } from "../match/pacingAndPresentation";
import { Phase } from "../match/rules";
import { createFrameControls } from "../match/controls";
import { captureFrame, createMatchFrameInput } from "../match/frameInput";
import { captureNext, executeCaptured, executeNext, replayState, testMatch } from "../match/testMatch";
import { stateChecksum } from "../replay/canonical";
import { firstPoseDifference, firstStateDifference } from "../replay/difference";
import { ReplayCorrections, ReplayHistory } from "../replay/history";
import { captureReplaySnapshot, createReplaySnapshot, restoreReplaySnapshot } from "../replay/snapshot";
import { Character } from "../sim/codes";
import { fighterAt, isActive } from "../sim/roster";
import {
  DRAIN_FLASH_FRAMES, STATIC_AURA, STATIC_DRAIN_FLASH, STATIC_WING_TRAIL, type SpecialEffectState, createSpecialEffectState,
  firstSpecialEffectDifference, projectSpecialEffect,
} from "./specialEffectState";

const STATIC_KINDS = [STATIC_AURA, STATIC_WING_TRAIL, STATIC_DRAIN_FLASH] as const;

test("the drain flash ages by executed frames, restores from a snapshot and projects read-only [invariant]", () => {
  const match = testMatch(9, Character.demonHunter);
  const f = fighterAt(match.world, 3);
  f.visuals.manaDrained = 1;
  executeNext(match);
  assertEquals(match.runtime.specials.drainAge[3], 0);
  const snapshot = createReplaySnapshot();
  const projected = createReplaySnapshot();
  for (let age = 0; age <= DRAIN_FLASH_FRAMES; age++) {
    captureReplaySnapshot(snapshot, match.world, match.game, match.inputs, match.runtime);
    for (let repeat = 0; repeat <= 3; repeat++) {
      for (const kind of STATIC_KINDS) projectSpecialEffect(match.runtime.specials, f, 3, kind);
    }
    captureReplaySnapshot(projected, match.world, match.game, match.inputs, match.runtime);
    assertEquals(firstStateDifference(snapshot, projected), undefined);
    assertEquals(firstPoseDifference(snapshot, projected), undefined);
    const flash = projectSpecialEffect(match.runtime.specials, f, 3, STATIC_DRAIN_FLASH);
    assertEquals(flash.visible, age < DRAIN_FLASH_FRAMES);
    executeNext(match);
  }
  restoreReplaySnapshot(snapshot, match.world, match.game, match.inputs, match.runtime);
  match.runtime.specials.drainAge[3] = 4;
  captureReplaySnapshot(projected, match.world, match.game, match.inputs, match.runtime);
  assertEquals(stateChecksum(snapshot), stateChecksum(projected));
  assertEquals(firstPoseDifference(snapshot, projected), "specials.slot[3].drainAge");
  restoreReplaySnapshot(projected, match.world, match.game, match.inputs, match.runtime);
  assertEquals(match.runtime.specials.drainAge[3], 4);
  assertEquals(match.runtime.specials.drainSerial[3], 1);
  assertTrue(projectSpecialEffect(match.runtime.specials, fighterAt(match.world, 3), 3, STATIC_DRAIN_FLASH).visible);
});

test("a late correction removes or restores a drain flash at its completed age [invariant]", () => {
  for (const initiallyHits of [0, 1]) {
    const match = testMatch(9, Character.demonHunter);
    const live = replayState(match);
    const specials = match.runtime.specials;
    const illidan = fighterAt(match.world, 3);
    const victim = fighterAt(match.world, 0);
    victim.character = Character.rifleman;
    victim.mana.points = 50;

    illidan.motion.x = -45.0;
    illidan.facing = 1;
    victim.motion.x = 45.0;
    victim.facing = -1;
    const history = new ReplayHistory();
    assertTrue(history.beginEpoch(91, 1, 12));
    for (let frame = 1; frame <= 8; frame++) {
      const input = match.inputs.inputs[3];
      input.specialPressed = frame === 1 && initiallyHits === 1;
      input.specialX = input.specialPressed ? 1 : 0;
      input.direction = input.specialX;
      captureNext(match);
      assertTrue(history.saveSpeculative(91, match.row, live));
      executeCaptured(match);
    }
    assertEquals(projectSpecialEffect(specials, victim, 0, STATIC_DRAIN_FLASH).visible, initiallyHits === 1);
    const age = specials.drainAge[0];
    if (initiallyHits === 1) assertTrue(age < DRAIN_FLASH_FRAMES);
    const replacement = createFrameControls();
    replacement.inputs[3].specialPressed = initiallyHits === 0;
    replacement.inputs[3].specialX = 1 - initiallyHits;
    replacement.inputs[3].direction = 1 - initiallyHits;
    const row = createMatchFrameInput();
    assertTrue(captureFrame(row, 1, 9, replacement, match.runtime));
    const corrections = new ReplayCorrections();
    assertTrue(corrections.beginEpoch(91));
    assertTrue(corrections.add(row));
    assertEquals(history.correct(91, corrections, live), 1);
    assertEquals(projectSpecialEffect(specials, victim, 0, STATIC_DRAIN_FLASH).visible, initiallyHits === 0);
    assertEquals(specials.drainSerial[0], 1 - initiallyHits);
    if (initiallyHits === 0) assertTrue(specials.drainAge[0] < DRAIN_FLASH_FRAMES);
    else assertEquals(specials.drainAge[0], DRAIN_FLASH_FRAMES);
  }
});

test("sparse and four-player drain flashes match whether projected or not, and reset [invariant]", () => {
  for (const mask of [9, 15]) {
    const sequential = testMatch(mask, Character.demonHunter);
    const catchup = testMatch(mask, Character.demonHunter);
    for (let frame = 1; frame <= 8; frame++) {
      for (const slot of PARTICIPANT_SLOTS) {
        if (!isActive(sequential.world, slot) || frame !== slot + 1) continue;
        fighterAt(sequential.world, slot).visuals.manaDrained++;
        fighterAt(catchup.world, slot).visuals.manaDrained++;
      }
      executeNext(sequential);
      executeNext(catchup);
      for (const slot of PARTICIPANT_SLOTS) {
        if (!isActive(sequential.world, slot)) continue;
        for (const kind of STATIC_KINDS) {
          projectSpecialEffect(sequential.runtime.specials, fighterAt(sequential.world, slot), slot, kind);
          projectSpecialEffect(sequential.runtime.specials, fighterAt(sequential.world, slot), slot, kind);
        }
      }
    }
    const specials: SpecialEffectState = sequential.runtime.specials;
    assertEquals(firstSpecialEffectDifference(specials, catchup.runtime.specials), undefined);
    for (const slot of PARTICIPANT_SLOTS) {
      if (isActive(sequential.world, slot)) {
        const flash = projectSpecialEffect(specials, fighterAt(sequential.world, slot), slot, STATIC_DRAIN_FLASH);
        assertTrue(flash.visible);
      } else {
        assertEquals(specials.drainSerial[slot], 0);
        assertEquals(specials.drainAge[slot], DRAIN_FLASH_FRAMES);
      }
    }
    const last = fighterAt(sequential.world, 3);
    last.status.out = true;
    last.status.respawn = 60;
    executeNext(sequential);
    assertFalse(projectSpecialEffect(specials, last, 3, STATIC_DRAIN_FLASH).visible);
    assertEquals(specials.drainAge[3], DRAIN_FLASH_FRAMES);
    catchup.game.timeLimitMinutes = 1;
    catchup.game.remainingFrames = 1;
    executeNext(catchup);
    assertEquals(catchup.game.phase, Phase.result);
    const empty = createSpecialEffectState();
    assertEquals(firstSpecialEffectDifference(catchup.runtime.specials, empty), undefined);
    clearPresentationHistory(sequential.runtime);
    assertEquals(firstSpecialEffectDifference(specials, empty), undefined);
    sequential.game.phase = Phase.characterMenu;
    specials.drainAge[0] = 1;
    executeNext(sequential);
    assertEquals(firstSpecialEffectDifference(specials, empty), undefined);
  }
});
