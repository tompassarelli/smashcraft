import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Character } from "../sim/codes";
import { createFighter, type Fighter } from "../sim/fighter";
import { copyControls, createRoster, neutralControls, type Controls } from "../sim/roster";
import { chooseRecoveryInput } from "./botRecovery";
import { produceComputerInput } from "./botPlay";
import { createFrameControls, type FrameControls } from "./controls";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { Phase, createMatchState } from "./rules";
import { stepMatch } from "./step";

function testRoster(first: Fighter, second: Fighter) {
  return createRoster(3, [first, second]);
}

function frameControls(first: Controls, second: Controls): FrameControls {
  const result = createFrameControls();
  copyControls(result.inputs[0], first);
  copyControls(result.inputs[1], second);
  return result;
}

test("computerRecoversFromBothSidesWithAndWithoutJump [spec #184]", () => {
  for (const character of [Character.demonHunter, Character.rifleman]) {
    for (const side of [-1, 1]) for (const jumps of [0, 1]) {
      const fighter = createFighter(character, side * 680.0, -side);
      const opponent = createFighter(character === Character.rifleman ? Character.rifleman : Character.rifleman, 0.0, side);
      const input = neutralControls();
      const opponentInput = neutralControls();
      const game = createMatchState();
      game.phase = Phase.match;
      fighter.motion.z = -40.0;
      fighter.motion.vz = -4.0;
      fighter.motion.grounded = false;
      fighter.motion.surface = undefined;
      fighter.jump.remaining = jumps;
      assertTrue(chooseRecoveryInput(fighter, 0, 0, input));
      for (let frame = 1; frame <= 180; frame++) {
        input.direction = 0;
        input.jumpPressed = false;
        input.jumpHeld = false;
        chooseRecoveryInput(fighter, 0, 0, input);
        stepMatch(game, testRoster(fighter, opponent), frameControls(input, opponentInput), frame);
      }
      assertFalse(fighter.status.out);
      assertEquals(fighter.status.stocks, 3);
      assertTrue(fighter.motion.grounded);
      assertTrue(Math.abs(fighter.motion.x) <= 600.0);
    }
  }
});

test("Blademaster holds Rising Whirlwind upward on the deck instead of steering it off the edge [repro #335]", () => {
  for (const side of [-1, 1]) {
    const fighter = createFighter(Character.blademaster, side * 350.0, side);
    const opponent = createFighter(Character.beastmaster, side * 480.0, -side);
    const world = testRoster(fighter, opponent);
    const game = createMatchState();
    game.phase = Phase.match;
    game.timeLimitMinutes = 0;
    game.cpuOpponents[0] = "wren";
    game.cpuResolvedOpponents[0] = "wren";
    game.cpuTiers[0] = "expert";
    const runtime = createPacingAndPresentation();
    const controls = createFrameControls();
    for (let frame = 1; frame <= 20; frame++) produceComputerInput(game, world, runtime, 0, frame, controls.inputs[0], controls.commands[0]);
    copyControls(controls.inputs[0], neutralControls());
    controls.inputs[0].specialPressed = true;
    controls.inputs[0].specialZ = 1;
    controls.inputs[0].verticalDirection = 1;
    stepMatch(game, world, controls, 21);
    for (let frame = 22; frame <= 70; frame++) {
      copyControls(controls.inputs[0], neutralControls());
      produceComputerInput(game, world, runtime, 0, frame, controls.inputs[0], controls.commands[0]);
      stepMatch(game, world, controls, frame);
      if (frame === 28) {
        assertEquals(fighter.special.aimX, 0.0);
        assertEquals(fighter.special.aimZ, 1.0);
      }
    }
    assertFalse(fighter.status.out);
    assertTrue(Math.abs(fighter.motion.x) <= 600.0);
    assertTrue(fighter.motion.z >= 0.0);
  }
});
