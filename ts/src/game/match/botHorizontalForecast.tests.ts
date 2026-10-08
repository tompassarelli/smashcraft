import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { attackBuffer } from "../input/attackBuffer";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { neutralControls } from "../sim/roster";
import { aheadX, chooseAttack } from "./botMoves";
import { perceivedCpuSkill } from "./cpuSkill";
import { heroSpecialUse } from "./botHeroKit";
import { SpecialSlot } from "../sim/heroSpecials";
import { SELECTABLE_CHARACTERS } from "../sim/heroes/registry";

test("a delayed horizontal attack forecast advances the observed target without advancing the attacker [invariant]", () => {
  const own = createFighter(Character.rifleman, 0.0, 1);
  const delayed = createFighter(Character.rifleman, 300.0, -1);
  delayed.motion.deltaX = -12.0;
  const current = createFighter(Character.rifleman, 156.0, -1);
  current.motion.deltaX = -12.0;
  assertEquals(aheadX(own, delayed, 8, undefined, 12), 60.0);
  own.motion.vx = 4.0;
  assertEquals(aheadX(own, delayed, 8, undefined, 12), aheadX(own, current, 8));
  assertEquals(delayed.motion.x, 300.0);
  assertEquals(delayed.motion.deltaX, -12.0);
});

test("twenty attack choices from a delayed moving target match its current-position reference [invariant]", () => {
  const own = createFighter(Character.rifleman, 0.0, 1);
  const delayed = createFighter(Character.rifleman, 300.0, -1);
  delayed.motion.deltaX = -12.0;
  const current = createFighter(Character.rifleman, 156.0, -1);
  current.motion.deltaX = -12.0;
  const skill = { ...perceivedCpuSkill("wren", "expert"), gameplanWeights: false, kitTenths: 0, misplay: 0 };
  for (let frame = 1; frame <= 20; frame++) {
    const predictedInput = neutralControls();
    const currentInput = neutralControls();
    const predictedCommands = attackBuffer(6);
    const currentCommands = attackBuffer(6);
    const predicted = chooseAttack(own, delayed, 0, frame, frame, true, predictedInput, predictedCommands, 0, -1, skill, 12);
    const actual = chooseAttack(own, current, 0, frame, frame, true, currentInput, currentCommands, 0, -1, skill);
    assertEquals(predicted, actual);
    assertEquals(predictedCommands.pending?.style, currentCommands.pending?.style);
    assertEquals(predictedCommands.pending?.facing, currentCommands.pending?.facing);
    assertEquals(predictedInput.specialPressed, currentInput.specialPressed);
    assertEquals(predictedInput.specialX, currentInput.specialX);
    assertEquals(predictedInput.specialZ, currentInput.specialZ);
  }
});

test("hero special reach from a delayed moving target matches its current-position reference [invariant]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const own = createFighter(character, 0.0, 1);
    if (own.tuning.specials === undefined) continue;
    for (const velocity of [-12.0, 12.0]) for (let x = 0; x <= 500; x += 20) {
      const delayed = createFighter(Character.rifleman, x, -1);
      delayed.motion.deltaX = velocity;
      const current = createFighter(Character.rifleman, x + velocity * 12, -1);
      current.motion.deltaX = velocity;
      for (const slot of [SpecialSlot.neutral, SpecialSlot.side, SpecialSlot.up, SpecialSlot.down]) {
        assertEquals(heroSpecialUse(own, delayed, 0, slot, 12), heroSpecialUse(own, current, 0, slot));
      }
      assertEquals(delayed.motion.x, x);
    }
  }
});

test("Forsaken Paladin catches a retreat with Fury and waits for an approach beyond hammer range [spec #275]", () => {
  const own = createFighter(Character.forsakenPaladin, 0.0, 1);
  const target = createFighter(Character.rifleman, 240.0, -1);
  const skill = { ...perceivedCpuSkill("wren", "expert"), misplay: 0 };
  for (const velocity of [-1.0, 0.0, 1.0]) {
    target.motion.deltaX = velocity;
    const input = neutralControls();
    const commands = attackBuffer(6);
    chooseAttack(own, target, 0, 1, 1, true, input, commands, 0, -1, skill);
    assertEquals(input.specialPressed && input.specialX !== 0, velocity > 0.0);
  }
  target.motion.x = 100.0;
  target.motion.deltaX = 0.0;
  let closeCharges = 0;
  for (let frame = 1; frame <= 64; frame++) {
    const input = neutralControls();
    chooseAttack(own, target, 0, frame, frame, true, input, attackBuffer(6), 0, -1, skill);
    if (input.specialPressed && input.specialX !== 0) closeCharges++;
  }
  assertGreaterThan(closeCharges, 0);
});
