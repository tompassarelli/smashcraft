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

test("computerRecoversFromBothSidesWithAndWithoutJump [k1 scenario]", () => {
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
