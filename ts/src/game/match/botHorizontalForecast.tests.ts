import { assertEquals, test } from "wisp/src/runtime/testing";
import { attackBuffer } from "../input/attackBuffer";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { neutralControls } from "../sim/roster";
import { aheadX, chooseAttack } from "./botMoves";
import { perceivedCpuSkill } from "./cpuSkill";

test("a delayed horizontal attack forecast advances the observed target without advancing the attacker", () => {
  const own = createFighter(Character.archer, 0.0, 1);
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

test("twenty attack choices from a delayed moving target match its current-position reference", () => {
  const own = createFighter(Character.archer, 0.0, 1);
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
