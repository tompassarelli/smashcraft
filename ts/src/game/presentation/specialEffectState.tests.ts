import { assertEquals, assertFalse, assertTrue, test } from "waygate/src/runtime/testing";
import { f32 } from "waygate/src/sim/f32";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { Phase } from "../match/rules";
import { resetPoses } from "../match/runtime";
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
import { DEMONHUNTER_PARRY_END, DEMONHUNTER_PARRY_START } from "../sim/hits";
import { fighterAt, isActive } from "../sim/roster";
import { DEMONHUNTER_IMMOLATE_ACTIVE, DEMONHUNTER_IMMOLATE_STARTUP, DEMONHUNTER_WING_STARTUP } from "../sim/specials";
import { characterModelScale } from "./modelScale";
import {
  PARRY_FLASH_FRAMES, STATIC_AURA, STATIC_PARRY_FLASH, STATIC_WING_TRAIL, type SpecialEffectState, createSpecialEffectState,
  firstSpecialEffectDifference, projectSpecialEffect,
} from "./specialEffectState";

const SCALE = characterModelScale(Character.demonHunter);
const STATIC_KINDS = [STATIC_AURA, STATIC_WING_TRAIL, STATIC_PARRY_FLASH] as const;

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
  f.special.action = SpecialAction.demonHunterParryStep;
  for (let frame = DEMONHUNTER_PARRY_START - 1; frame <= DEMONHUNTER_PARRY_END + 1; frame++) {
    f.special.frame = frame;
    assertEquals(projectSpecialEffect(state, f, 3, STATIC_AURA).visible, frame >= DEMONHUNTER_PARRY_START && frame <= DEMONHUNTER_PARRY_END);
  }
  f.special.action = SpecialAction.demonHunterWingAscent;
  f.special.frame = DEMONHUNTER_WING_STARTUP - 1;
  assertFalse(projectSpecialEffect(state, f, 3, STATIC_WING_TRAIL).visible);
  f.special.frame++;
  const wing = projectSpecialEffect(state, f, 3, STATIC_WING_TRAIL);
  assertTrue(wing.visible);
  assertEquals(wing.x, 123.0);
  f.special.action = SpecialAction.none;
  assertFalse(projectSpecialEffect(state, f, 3, STATIC_WING_TRAIL).visible);
  assertFalse(projectSpecialEffect(state, undefined, 1, STATIC_PARRY_FLASH).visible);
});

test("the parry flash ages by executed frames, restores from a snapshot and projects read-only", () => {
  const match = testMatch(9, Character.demonHunter);
  const f = fighterAt(match.world, 3);
  f.visuals.parry = 1;
  executeNext(match);
  assertEquals(match.runtime.specials.parryAge[3], 0);
  const snapshot = createReplaySnapshot();
  const projected = createReplaySnapshot();
  for (let age = 0; age <= PARRY_FLASH_FRAMES; age++) {
    captureReplaySnapshot(snapshot, match.world, match.game, match.inputs, match.runtime);
    for (let repeat = 0; repeat <= 3; repeat++) {
      for (const kind of STATIC_KINDS) projectSpecialEffect(match.runtime.specials, f, 3, kind);
    }
    captureReplaySnapshot(projected, match.world, match.game, match.inputs, match.runtime);
    assertEquals(firstStateDifference(snapshot, projected), undefined);
    assertEquals(firstPoseDifference(snapshot, projected), undefined);
    const flash = projectSpecialEffect(match.runtime.specials, f, 3, STATIC_PARRY_FLASH);
    assertEquals(flash.visible, age < PARRY_FLASH_FRAMES);
    executeNext(match);
  }
  restoreReplaySnapshot(snapshot, match.world, match.game, match.inputs, match.runtime);
  match.runtime.specials.parryAge[3] = 4;
  captureReplaySnapshot(projected, match.world, match.game, match.inputs, match.runtime);
  assertEquals(stateChecksum(snapshot), stateChecksum(projected));
  assertEquals(firstPoseDifference(snapshot, projected), "specials.slot[3].parryAge");
  restoreReplaySnapshot(projected, match.world, match.game, match.inputs, match.runtime);
  assertEquals(match.runtime.specials.parryAge[3], 4);
  assertEquals(match.runtime.specials.parrySerial[3], 1);
  assertTrue(projectSpecialEffect(match.runtime.specials, fighterAt(match.world, 3), 3, STATIC_PARRY_FLASH).visible);
});

test("a late correction removes or restores a parry flash at its completed age", () => {
  for (const initiallyParries of [0, 1]) {
    const match = testMatch(9, Character.demonHunter);
    const live = replayState(match);
    const specials = match.runtime.specials;
    const defender = fighterAt(match.world, 3);
    const attacker = fighterAt(match.world, 0);
    attacker.character = Character.archer;
    // Wurst's parry scenario: the defender at -45 facing right, the jabbing attacker at 45 facing left.
    defender.motion.x = -45.0;
    defender.facing = 1;
    attacker.motion.x = 45.0;
    attacker.facing = -1;
    const history = new ReplayHistory();
    assertTrue(history.beginEpoch(91, 1, 12));
    for (let frame = 1; frame <= 8; frame++) {
      const input = match.inputs.inputs[3];
      input.specialPressed = frame === 1;
      input.specialX = frame === 1 ? initiallyParries : 0;
      input.direction = frame === 1 ? initiallyParries : 0;
      if (frame === 1) queueAttack(match.inputs.commands[0], { style: AttackStyle.jab, facing: -1, frame, mayCharge: false });
      captureNext(match);
      assertTrue(history.saveSpeculative(91, match.row, live));
      executeCaptured(match);
    }
    assertEquals(projectSpecialEffect(specials, defender, 3, STATIC_PARRY_FLASH).visible, initiallyParries === 1);
    if (initiallyParries === 1) assertEquals(specials.parryAge[3], 3);
    const replacement = createFrameControls();
    replacement.inputs[3].specialPressed = true;
    replacement.inputs[3].specialX = 1 - initiallyParries;
    replacement.inputs[3].direction = 1 - initiallyParries;
    queueAttack(replacement.commands[0], { style: AttackStyle.jab, facing: -1, frame: 1, mayCharge: false });
    const row = createMatchFrameInput();
    assertTrue(captureFrame(row, 1, 9, replacement, match.runtime));
    const corrections = new ReplayCorrections();
    assertTrue(corrections.beginEpoch(91));
    assertTrue(corrections.add(row));
    assertEquals(history.correct(91, corrections, live), 1);
    assertEquals(projectSpecialEffect(specials, defender, 3, STATIC_PARRY_FLASH).visible, initiallyParries === 0);
    assertEquals(specials.parrySerial[3], 1 - initiallyParries);
    assertEquals(specials.parryAge[3], initiallyParries === 0 ? 3 : PARRY_FLASH_FRAMES);
  }
});

test("sparse and four-player parry flashes match whether projected or not, and reset", () => {
  for (const mask of [9, 15]) {
    const sequential = testMatch(mask, Character.demonHunter);
    const catchup = testMatch(mask, Character.demonHunter);
    for (let frame = 1; frame <= 8; frame++) {
      for (const slot of PARTICIPANT_SLOTS) {
        if (!isActive(sequential.world, slot) || frame !== slot + 1) continue;
        fighterAt(sequential.world, slot).visuals.parry++;
        fighterAt(catchup.world, slot).visuals.parry++;
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
        assertEquals(specials.parryAge[slot], 7 - slot);
        const flash = projectSpecialEffect(specials, fighterAt(sequential.world, slot), slot, STATIC_PARRY_FLASH);
        assertTrue(flash.visible);
        assertEquals(flash.x, f32(f32(-240.0 + slot * 150.0) + f32(35 * SCALE)));
      } else {
        assertEquals(specials.parrySerial[slot], 0);
        assertEquals(specials.parryAge[slot], PARRY_FLASH_FRAMES);
      }
    }
    const last = fighterAt(sequential.world, 3);
    last.status.out = true;
    last.status.respawn = 60;
    executeNext(sequential);
    assertFalse(projectSpecialEffect(specials, last, 3, STATIC_PARRY_FLASH).visible);
    assertEquals(specials.parryAge[3], PARRY_FLASH_FRAMES);
    catchup.game.timeLimitMinutes = 1;
    catchup.game.remainingFrames = 1;
    executeNext(catchup);
    assertEquals(catchup.game.phase, Phase.result);
    const empty = createSpecialEffectState();
    assertEquals(firstSpecialEffectDifference(catchup.runtime.specials, empty), undefined);
    resetPoses(sequential.runtime);
    assertEquals(firstSpecialEffectDifference(specials, empty), undefined);
    sequential.game.phase = Phase.characterMenu;
    specials.parryAge[0] = 1;
    executeNext(sequential);
    assertEquals(firstSpecialEffectDifference(specials, empty), undefined);
  }
});
