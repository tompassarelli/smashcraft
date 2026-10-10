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

test("twenty attack choices from a delayed moving target match its current-position reference [k2 property]", () => {
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

test("hero special reach from a delayed moving target matches its current-position reference [k2 property]", () => {
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
