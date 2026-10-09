import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, test } from "wisp/src/runtime/testing";
import { type AttackBuffer, ATTACK_BUFFER_FRAMES, attackBuffer } from "../input/attackBuffer";
import { type FrameControls, createFrameControls } from "../match/controls";
import { Phase, createMatchState } from "../match/rules";
import { stepMatch } from "../match/step";
import { Character } from "../sim/codes";
import { type Fighter, createFighter } from "../sim/fighter";
import { type Controls, copyControls, createRoster, neutralControls } from "../sim/roster";
import { initializeSpikeScenario } from "./scenarios";

function frameControls(first: Controls, second: Controls, firstCommands: AttackBuffer, secondCommands: AttackBuffer): FrameControls {
  const controls = createFrameControls();
  copyControls(controls.inputs[0], first);
  copyControls(controls.inputs[1], second);
  controls.commands[0] = firstCommands;
  controls.commands[1] = secondCommands;
  return controls;
}

test("an offstage Flame Crash spikes downward through the ordinary match step [spec docs/design/illidan.md]", () => {
  for (const side of [-1, 1] as const) {
    const game = createMatchState();
    game.phase = Phase.match;
    const first: Fighter = createFighter(Character.demonHunter, 0.0, side);
    const second: Fighter = createFighter(Character.demonHunter, 0.0, -side);
    initializeSpikeScenario(first, second, 0, side);
    const world = createRoster(3, [first, second]);
    const firstInput = neutralControls();
    const secondInput = neutralControls();
    const firstCommands = attackBuffer(ATTACK_BUFFER_FRAMES);
    const secondCommands = attackBuffer(ATTACK_BUFFER_FRAMES);
    const step = (frame: number) => stepMatch(game, world, frameControls(firstInput, secondInput, firstCommands, secondCommands), frame);

    for (let frame = 1; frame <= 12; frame++) step(frame);
    firstInput.specialPressed = true;
    firstInput.specialZ = -1;
    firstInput.down = true;
    step(13);
    firstInput.specialPressed = false;
    firstInput.specialZ = 0;
    firstInput.down = false;

    for (let frame = 14; frame <= 18; frame++) step(frame);
    const struck = second.status.damage;
    assertGreaterThan(struck, 0.0);
    assertFalse(second.motion.grounded);
    assertLessThan(second.launch.knockbackZ, 0.0);
    assertGreaterThan(second.launch.hitstun, 0);
    const contactHeight = second.motion.z;
    for (let frame = 19; frame <= 30; frame++) step(frame);
    assertEquals(second.status.damage, struck);
    assertLessThan(second.motion.z, contactHeight);
    assertFalse(second.motion.grounded);
  }
});
