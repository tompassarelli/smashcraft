import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { clearPresentationHistory } from "../match/pacingAndPresentation";
import { Phase } from "../match/rules";
import { queueAttack } from "../input/attackBuffer";
import { createFrameControls } from "../match/controls";
import { captureFrame, createMatchFrameInput } from "../match/frameInput";
import { captureNext, executeCaptured, executeNext, replayState, testMatch } from "../match/testMatch";
import { stateChecksum } from "../replay/canonical";
import { firstPoseDifference, firstStateDifference } from "../replay/difference";
import { ReplayCorrections, ReplayHistory } from "../replay/history";
import { captureReplaySnapshot, createReplaySnapshot, restoreReplaySnapshot } from "../replay/snapshot";
import { AttackStyle, Character, SpecialAction } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { fighterAt, isActive } from "../sim/roster";
import {
  CHAOS_STRIKE_FIRST, CHAOS_STRIKE_FORM, CHAOS_STRIKE_LAST, DEMONHUNTER_IMMOLATE_ACTIVE, DEMONHUNTER_IMMOLATE_STARTUP, DEMONHUNTER_WING_STARTUP,
  FEL_RUSH_FIRST, FEL_RUSH_LAST, FEL_RUSH_TELL_LAST, VENGEFUL_RETREAT_FORM, VENGEFUL_RETREAT_MOVE_LAST,
} from "../sim/specials";
import { characterModelScale } from "./modelScale";
import {
  DRAIN_FLASH_FRAMES, STATIC_AURA, STATIC_DRAIN_FLASH, STATIC_WING_TRAIL, type SpecialEffectState, createSpecialEffectState,
  firstSpecialEffectDifference, projectSpecialEffect,
} from "./specialEffectState";

const SCALE = characterModelScale(Character.demonHunter);
const STATIC_KINDS = [STATIC_AURA, STATIC_WING_TRAIL, STATIC_DRAIN_FLASH] as const;

test("static special windows follow the selected fighter and stay on its body", () => {
  const state = createSpecialEffectState();
  const f = createFighter(Character.demonHunter, 123.0, -1);
  f.motion.z = 42.0;
  f.special.action = SpecialAction.demonHunterImmolate;
  f.special.frame = DEMONHUNTER_IMMOLATE_STARTUP - 1;
  assertFalse(projectSpecialEffect(state, f, 3, STATIC_AURA).visible);
  f.special.frame++;
  const aura = projectSpecialEffect(state, f, 3, STATIC_AURA);
  assertTrue(aura.visible);
  assertEquals(aura.x, 123.0);
  f.special.frame = DEMONHUNTER_IMMOLATE_STARTUP + DEMONHUNTER_IMMOLATE_ACTIVE;
  assertFalse(projectSpecialEffect(state, f, 3, STATIC_AURA).visible);
  // Fel Rush: the aura flares through the tell, the trail follows the rush.
  f.special.action = SpecialAction.demonHunterFelRush;
  for (let frame = 0; frame <= FEL_RUSH_LAST + 1; frame++) {
    f.special.frame = frame;
    assertEquals(projectSpecialEffect(state, f, 3, STATIC_AURA).visible, frame >= 1 && frame <= FEL_RUSH_TELL_LAST);
    assertEquals(projectSpecialEffect(state, f, 3, STATIC_WING_TRAIL).visible, frame >= FEL_RUSH_FIRST && frame <= FEL_RUSH_LAST);
  }
  f.special.form = VENGEFUL_RETREAT_FORM;
  for (let frame = 1; frame <= VENGEFUL_RETREAT_MOVE_LAST + 1; frame++) {
    f.special.frame = frame;
    assertEquals(projectSpecialEffect(state, f, 3, STATIC_WING_TRAIL).visible, frame <= VENGEFUL_RETREAT_MOVE_LAST);
  }
  f.special.form = CHAOS_STRIKE_FORM;
  for (let frame = 1; frame <= CHAOS_STRIKE_LAST + 1; frame++) {
    f.special.frame = frame;
    assertEquals(projectSpecialEffect(state, f, 3, STATIC_AURA).visible, frame >= CHAOS_STRIKE_FIRST && frame <= CHAOS_STRIKE_LAST);
  }
  f.special.form = 0;
  f.special.action = SpecialAction.demonHunterWingAscent;
  f.special.frame = DEMONHUNTER_WING_STARTUP - 1;
  assertFalse(projectSpecialEffect(state, f, 3, STATIC_WING_TRAIL).visible);
  f.special.frame++;
  const wing = projectSpecialEffect(state, f, 3, STATIC_WING_TRAIL);
  assertTrue(wing.visible);
  assertEquals(wing.x, 123.0);
  f.special.action = SpecialAction.none;
  assertFalse(projectSpecialEffect(state, f, 3, STATIC_WING_TRAIL).visible);
  assertFalse(projectSpecialEffect(state, undefined, 1, STATIC_DRAIN_FLASH).visible);
});

test("the drain flash ages by executed frames, restores from a snapshot and projects read-only", () => {
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

test("a late correction removes or restores a drain flash at its completed age", () => {
  for (const initiallyHits of [0, 1]) {
    const match = testMatch(9, Character.demonHunter);
    const live = replayState(match);
    const specials = match.runtime.specials;
    const illidan = fighterAt(match.world, 3);
    const victim = fighterAt(match.world, 0);
    victim.character = Character.archer;
    victim.mana.points = 50;
    // Illidan at -45 facing right Fel Rushes through the Archer at 45 facing left.
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

test("sparse and four-player drain flashes match whether projected or not, and reset", () => {
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
        assertEquals(specials.drainAge[slot], 7 - slot);
        const flash = projectSpecialEffect(specials, fighterAt(sequential.world, slot), slot, STATIC_DRAIN_FLASH);
        assertTrue(flash.visible);
        assertEquals(flash.x, f32(-240.0 + slot * 150.0));
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
