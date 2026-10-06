import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Character, LedgeState } from "../sim/codes";
import { createFighter, type Fighter } from "../sim/fighter";
import { copyControls, createRoster, neutralControls, type Controls } from "../sim/roster";
import { chooseRecoveryInput } from "./botRecovery";
import { createFrameControls, type FrameControls } from "./controls";
import { Phase, createMatchState } from "./rules";
import { stepMatch } from "./step";
import { attackBuffer } from "../input/attackBuffer";

function testRoster(first: Fighter, second: Fighter) {
  return createRoster(3, [first, second]);
}

function frameControls(first: Controls, second: Controls): FrameControls {
  const result = createFrameControls();
  copyControls(result.inputs[0], first);
  copyControls(result.inputs[1], second);
  return result;
}

test("computerRecoversFromBothSidesWithAndWithoutJump", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    for (const side of [-1, 1]) for (const jumps of [0, 1]) {
      const fighter = createFighter(character, side * 680.0, -side);
      const opponent = createFighter(character === Character.archer ? Character.rifleman : Character.archer, 0.0, side);
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
      assertEquals(input.direction, -side);
      assertEquals(input.jumpPressed, jumps > 0);
      assertEquals(input.specialPressed, jumps === 0);
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

test("computerPreservesJumpDuringAscentAndClimbsLedge", () => {
  const fighter = createFighter(Character.archer, 680.0, -1);
  const input = neutralControls();
  fighter.motion.grounded = false;
  fighter.motion.vz = 10.0;
  fighter.motion.z = 70.0;
  assertTrue(chooseRecoveryInput(fighter, 0, 0, input));
  assertFalse(input.jumpPressed);
  assertFalse(input.specialPressed);
  fighter.ledge.state = LedgeState.hang;
  fighter.ledge.side = 1;
  assertTrue(chooseRecoveryInput(fighter, 0, 0, input));
  assertEquals(input.ledgeVerticalPressed, 1);
});
