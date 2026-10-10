import { assertEquals, test } from "wisp/src/runtime/testing";
import { Character, GroundAction } from "./codes";
import { type Fighter } from "./fighter";
import { createReferenceFighter } from "./referenceRig";
import { advanceSolo, controls } from "./testWorld";
import {
  type GroundMovementRules,
  INITIAL_DASH_FRAMES,
  NTSC_CAPTAIN_FALCON_GROUND_MOVEMENT_RULES,
  NTSC_FALCO_GROUND_MOVEMENT_RULES,
  NTSC_FOX_GROUND_MOVEMENT_RULES,
} from "./tuning";

const NTSC_RIGS: readonly GroundMovementRules[] = [NTSC_FOX_GROUND_MOVEMENT_RULES, NTSC_FALCO_GROUND_MOVEMENT_RULES, NTSC_CAPTAIN_FALCON_GROUND_MOVEMENT_RULES];


function groundActionFighter(x: number, facing: number, rules: GroundMovementRules, action: GroundAction, actionFrame: number, dashDirection: number, vx: number): Fighter {
  const fighter = createReferenceFighter(Character.sylvanas, x, facing);
  fighter.tuning.ground = rules;
  fighter.ground.action = action;
  fighter.ground.actionFrame = actionFrame;
  fighter.ground.dashFrame = INITIAL_DASH_FRAMES + 1;
  fighter.ground.dashDirection = dashDirection;
  fighter.motion.vx = vx;
  return fighter;
}

test("the retail dash-to-run command uses the actor's encoded enable frame [k4 reference melee]", () => {
  NTSC_RIGS.forEach((rules, rig) => {
    const fighter = createReferenceFighter(Character.sylvanas, 0.0, 1);
    const input = controls({ direction: 1 });
    fighter.tuning.ground = rules;
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.ground.action, GroundAction.dash);
    assertEquals(fighter.ground.actionFrame, 1);
    const enableFrame = rig === 2 ? 16 : 12;
    for (let frame = 2; frame <= enableFrame - 1; frame++) {
      advanceSolo(fighter, 0, input, 0.0);
      assertEquals(fighter.ground.action, GroundAction.dash);
      assertEquals(fighter.ground.actionFrame, frame);
    }
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.ground.action, GroundAction.run);
    assertEquals(fighter.ground.actionFrame, 0);
  });
});

test("a turn-run waits for the retail facing command boundary [k4 reference melee]", () => {
  for (const rules of [NTSC_FOX_GROUND_MOVEMENT_RULES, NTSC_CAPTAIN_FALCON_GROUND_MOVEMENT_RULES]) {
    const fighter = groundActionFighter(0.0, 1, rules, GroundAction.run, 4, 1, 13.199999809265137);
    const input = controls({ direction: -1 });
    const turnRunEndFrame = rules === NTSC_FOX_GROUND_MOVEMENT_RULES ? 20 : 22;
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.ground.action, GroundAction.turnRun);
    assertEquals(fighter.ground.actionFrame, 0);
    assertEquals(fighter.facing, 1);
    for (let frame = 1; frame <= 9; frame++) advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.facing, 1);
    assertEquals(fighter.ground.actionFrame, 9);


    for (let frame = 1; frame <= 9; frame++) {
      advanceSolo(fighter, 0, input, 0.0);
      assertEquals(fighter.facing, 1);
      assertEquals(fighter.ground.actionFrame, 9);
    }
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.facing, -1);
    assertEquals(fighter.ground.action, GroundAction.turnRun);
    assertEquals(fighter.ground.actionFrame, 9);
    for (let frame = 10; frame <= turnRunEndFrame - 1; frame++) {
      advanceSolo(fighter, 0, input, 0.0);
      assertEquals(fighter.ground.action, GroundAction.turnRun);
      assertEquals(fighter.ground.actionFrame, frame);
    }
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.ground.action, GroundAction.run);
    assertEquals(fighter.ground.actionFrame, 0);
    assertEquals(fighter.facing, -1);
  }
});

test("a run-brake turn input closes at the actor's frame-fifteen command [k4 reference melee]", () => {
  const allowed = groundActionFighter(0.0, 1, NTSC_FOX_GROUND_MOVEMENT_RULES, GroundAction.runBrake, 13, 1, 9.0);
  const denied = groundActionFighter(100.0, 1, NTSC_FOX_GROUND_MOVEMENT_RULES, GroundAction.runBrake, 14, 1, 9.0);
  const input = controls({ direction: -1 });
  advanceSolo(allowed, 0, input, 0.0);
  assertEquals(allowed.ground.action, GroundAction.turnRun);
  assertEquals(allowed.ground.actionFrame, 14);
  for (let frame = 1; frame <= 15; frame++) {
    advanceSolo(allowed, 0, input, 0.0);
    if (allowed.facing === 1) assertEquals(allowed.ground.actionFrame, 15);
  }
  assertEquals(allowed.facing, -1);
  for (let frame = 1; frame <= 20; frame++) {
    if (allowed.ground.action === GroundAction.turnRun) advanceSolo(allowed, 0, input, 0.0);
  }
  assertEquals(allowed.ground.action, GroundAction.run);
  assertEquals(allowed.ground.actionFrame, 0);
  advanceSolo(denied, 0, input, 0.0);
  assertEquals(denied.ground.action, GroundAction.runBrake);
  assertEquals(denied.ground.actionFrame, 15);
  assertEquals(denied.facing, 1);
});

test("a turn-run uses the retail velocity threshold in world units [k4 reference melee]", () => {
  const input = controls({ direction: -1 });


  for (const [vx, turns] of [[0.029999999329447746, true], [0.05999999865889549, true], [0.07000000029802322, false]] as const) {
    const fighter = createReferenceFighter(Character.sylvanas, 0.0, 1);
    fighter.ground.action = GroundAction.turnRun;
    fighter.ground.actionFrame = 9;
    fighter.ground.turnRunEntryFacing = 1;
    fighter.ground.turnRunFacingCommandLatched = true;
    fighter.ground.dashFrame = INITIAL_DASH_FRAMES + 1;
    fighter.ground.dashDirection = 1;
    fighter.motion.vx = vx;
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.facing, turns ? -1 : 1);
    assertEquals(fighter.ground.actionFrame, 9);
  }
});

test("a retail run-brake ends at its clip or its maximum frame count [k4 reference melee]", () => {
  NTSC_RIGS.forEach((rules, rig) => {
    const fighter = groundActionFighter(0.0, 1, rules, GroundAction.runBrake, 0, 1, 0.4000000059604645);
    fighter.ground.runBrakeFramesRemaining = rules.runBrakeMaximumFrames;
    const input = controls({ direction: 1 });
    const clipEnd = rig === 2 ? 28 : 18;
    for (let frame = 1; frame <= clipEnd - 1; frame++) {
      advanceSolo(fighter, 0, input, 0.0);
      assertEquals(fighter.ground.action, GroundAction.runBrake);
      assertEquals(fighter.ground.runBrakeFramesRemaining, 30 - frame);
    }
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.ground.action, GroundAction.none);
    assertEquals(fighter.ground.runBrakeFramesRemaining, 0);
  });
  const capped = groundActionFighter(0.0, 1, { ...NTSC_FOX_GROUND_MOVEMENT_RULES, runBrakeAnimationEndFrame: 40 }, GroundAction.runBrake, 0, 1, 0.4000000059604645);
  capped.ground.runBrakeFramesRemaining = 30;
  const capInput = controls({ direction: 1 });
  for (let frame = 1; frame <= 29; frame++) {
    advanceSolo(capped, 0, capInput, 0.0);
    assertEquals(capped.ground.action, GroundAction.runBrake);
  }
  advanceSolo(capped, 0, capInput, 0.0);
  assertEquals(capped.ground.action, GroundAction.none);
  assertEquals(capped.ground.runBrakeFramesRemaining, 0);
});
