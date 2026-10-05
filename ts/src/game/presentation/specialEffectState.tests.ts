import { assertEquals, assertFalse, assertTrue, test } from "../../runtime/testing";
import { f32 } from "../../sim/f32";
import { Character, SpecialAction } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { advanceSpecialEffect, createSpecialEffectState, firstSpecialEffectDifference, projectSpecialEffect, PARRY_FLASH_FRAMES, STATIC_PARRY_FLASH } from "./specialEffectState";

test("parry flash advances on executed frames and projects without consuming state", () => {
  const fighter = createFighter(Character.demonHunter, -240.0, 1);
  const state = createSpecialEffectState();
  fighter.visuals.parry = 1;
  advanceSpecialEffect(state, fighter, 3);
  assertEquals(state.parryAge[3], 0);
  const saved = { parryAge: state.parryAge.slice(), parrySerial: state.parrySerial.slice() };
  const flash = projectSpecialEffect(state, fighter, 3, STATIC_PARRY_FLASH);
  assertTrue(flash.visible);
  assertEquals(flash.alpha, 255);
  assertEquals(flash.x, -240.0 + 35.0 * f32(0.8));
  assertEquals(firstSpecialEffectDifference(saved, state), undefined);
  for (let age = 1; age <= PARRY_FLASH_FRAMES; age++) advanceSpecialEffect(state, fighter, 3);
  assertFalse(projectSpecialEffect(state, fighter, 3, STATIC_PARRY_FLASH).visible);
});

test("out fighters clear parry presentation history", () => {
  const fighter = createFighter(Character.demonHunter, 0.0, 1);
  const state = createSpecialEffectState();
  fighter.visuals.parry = 1;
  advanceSpecialEffect(state, fighter, 0);
  fighter.status.out = true;
  advanceSpecialEffect(state, fighter, 0);
  assertEquals(state.parryAge[0], PARRY_FLASH_FRAMES);
  assertFalse(projectSpecialEffect(state, fighter, 0, STATIC_PARRY_FLASH).visible);
  assertEquals(SpecialAction.demonHunterParryStep, 10);
});
