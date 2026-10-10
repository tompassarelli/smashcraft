import { assertEquals, assertFalse, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { Action } from "../input/actions";
import { actionFor, presetBindings } from "../input/keyBindings";
import { attackBuffer, queueAttack } from "../input/attackBuffer";
import { normalAttackStyle } from "../input/combat";
import { AttackStyle, Character } from "../sim/codes";
import { createFighter, type Fighter } from "../sim/fighter";
import { copyControls, createRoster, neutralControls, type Controls } from "../sim/roster";
import { createFrameControls } from "./controls";
import { Phase, createMatchState } from "./rules";
import { stepMatch } from "./step";

function testRoster(first: Fighter, second: Fighter) {
  return createRoster(3, [first, second]);
}

function frameControls(first: Controls, second: Controls, firstCommands: ReturnType<typeof attackBuffer>, secondCommands: ReturnType<typeof attackBuffer>) {
  const result = createFrameControls();
  copyControls(result.inputs[0], first);
  copyControls(result.inputs[1], second);
  result.commands[0] = firstCommands;
  result.commands[1] = secondCommands;
  return result;
}

test("bothFightersCanGrabNormallyAndFromShieldWithAttackOrGrabKey [k3 measure docs/player-guide.md]", () => {
  assertEquals(actionFor(presetBindings("standard"), 79), Action.grab);
  for (const character of [Character.demonHunter, Character.rifleman]) for (let grabInput = 0; grabInput <= 2; grabInput++) {
    const game = createMatchState();
    game.phase = Phase.match;
    const fighter = createFighter(character, 0.0, 1);
    const target = createFighter(character === Character.rifleman ? Character.rifleman : Character.rifleman, 45.0, -1);
    const input = neutralControls();
    const otherInput = neutralControls();
    const commands = attackBuffer(0);
    const otherCommands = attackBuffer(0);
    input.shield = grabInput !== 0;
    fighter.shield.raised = input.shield;
    const style = grabInput === 1 ? normalAttackStyle(0, 0, false, true) : AttackStyle.grab;
    queueAttack(commands, { style, facing: 0, frame: 1, mayCharge: false });
    stepMatch(game, testRoster(fighter, target), frameControls(input, otherInput, commands, otherCommands), 1);
    assertEquals(fighter.attack.style, AttackStyle.grab);
    assertFalse(fighter.shield.raised);
    assertEquals(fighter.shield.releaseLag, 0);
    for (let frame = 2; frame <= 8; frame++) {
      stepMatch(game, testRoster(fighter, target), frameControls(input, otherInput, commands, otherCommands), frame);
    }
    assertGreaterThan(target.grab.grabbedFrames, 0);
  }
});
