import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { at } from "wisp/src/runtime/lookup";
import { queueAttack } from "../input/attackBuffer";
import { createBufferedFrameControls } from "../match/controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "../match/frameInput";
import { createPacingAndPresentation } from "../match/pacingAndPresentation";
import { createMatchState, Phase } from "../match/rules";
import { initializeMatchFighters } from "../match/step";
import { contactDamageClip } from "../presentation/damagePose";
import { AttackStyle, Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { createRoster, fighterAt } from "../sim/roster";
import { initializePainScenario } from "./painFixture";

test("the high-hit fixture interrupts Grom's jab at his authored head in both facings [repro #181]", () => {
  const game = createMatchState();
  game.phase = Phase.match;
  const world = createRoster(3, [createFighter(Character.grom, -240.0, 1), createFighter(Character.grom, 240.0, -1)]);
  initializeMatchFighters(game, world);
  assertTrue(initializePainScenario("pain-high-small", world));
  const controls = createBufferedFrameControls(), row = createMatchFrameInput(), runtime = createPacingAndPresentation();
  for (let frame = 1; frame <= 150; frame++) {
    if (frame === 146) for (const slot of [0, 1]) queueAttack(at(controls.commands, slot), { style: AttackStyle.jab, facing: 0, frame, mayCharge: false });
    assertTrue(captureFrame(row, frame, world.mask, controls, runtime));
    assertTrue(executeMatchFrame(row, game, world, controls, runtime, frame));
    if (frame === 149) for (const slot of [0, 1]) assertEquals(fighterAt(world, slot).attack.style, AttackStyle.jab);
  }
  for (const slot of [0, 1]) {
    const fighter = fighterAt(world, slot);
    assertEquals(fighter.status.damage, 8.0);
    assertEquals(fighter.visuals.hitHeight, 2);
    assertEquals(fighter.visuals.hitStrength, 0);
    assertEquals(at(runtime.poses, slot).clipIndex, contactDamageClip(fighter).index);
  }
});
