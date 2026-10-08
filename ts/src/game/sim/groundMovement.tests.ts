// Keep the recorded movement timelines together so entry, reversal and exit
// use the same NTSC parameter fixtures and frame-count conventions.
// Dash, run, turn-run and run-brake against the authored and NTSC timelines.
import { assertEquals, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { max, min } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GroundAction } from "./codes";
import { type Fighter,  } from "./fighter";
import { createReferenceContactFighter, createReferenceFighter } from "./referenceRig";
import { advanceFighter } from "./step";
import { respawnFighter } from "./stocks";
import { stageBounds } from "./stageBounds";
import { advanceSolo, controls, testBeginAttacks, testWorld, withPhysics } from "./testWorld";
import {
  GROUND_TRACTION,
  type GroundMovementRules,
  INITIAL_DASH_FRAMES,
  INITIAL_DASH_SPEED,
  NTSC_CAPTAIN_FALCON_GROUND_MOVEMENT_RULES,
  NTSC_FALCO_GROUND_MOVEMENT_RULES,
  NTSC_FOX_GROUND_MOVEMENT_RULES,
  melee,
} from "./tuning";

const NTSC_RIGS: readonly GroundMovementRules[] = [NTSC_FOX_GROUND_MOVEMENT_RULES, NTSC_FALCO_GROUND_MOVEMENT_RULES, NTSC_CAPTAIN_FALCON_GROUND_MOVEMENT_RULES];

/** A fighter already in a ground action after its dash, with the given rules and speed. */
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

test("an initial dash's entry transitions toward the actor's run speed [spec docs/physics.md]", () => {
  for (const character of [Character.sylvanas, Character.rifleman]) {
    for (const direction of [-1, 1]) {
      const fighter = createReferenceFighter(character, 0.0, -direction);
      const input = controls({ direction });
      advanceSolo(fighter, 0, input, 0.0);
      assertNear(fighter.motion.vx, f32(11.4) * direction, f32(0.001));
      let expectedSpeed = f32(11.4);
      for (let tick = 2; tick <= INITIAL_DASH_FRAMES; tick++) {
        advanceSolo(fighter, 0, input, 0.0);
        expectedSpeed = character === Character.sylvanas ? min(f32(13.2), expectedSpeed + f32(0.72)) : max(9.0, expectedSpeed - GROUND_TRACTION);
        assertNear(fighter.motion.vx, expectedSpeed * direction, f32(0.001));
        assertEquals(fighter.facing, direction);
      }
      advanceSolo(fighter, 0, input, 0.0);
      assertNear(fighter.motion.vx, (character === Character.sylvanas ? f32(13.2) : 9.0) * direction, f32(0.001));
      assertEquals(fighter.ground.dashFrame, INITIAL_DASH_FRAMES + 1);
    }
  }
});

test("the retail dash-to-run command uses the actor's encoded enable frame [reference] [spec docs/physics.md]", () => {
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

test("a turn-run waits for the retail facing command boundary [reference] [spec docs/physics.md]", () => {
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
    // The frame-9 command freezes TurnRun while momentum still follows the
    // old facing. Crossing zero needs a later animation update to flip.
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

test("a run-brake turn input closes at the actor's frame-fifteen command [reference] [spec docs/physics.md]", () => {
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

test("a turn-run entered past its command pauses before its facing flip [spec docs/physics.md]", () => {
  const fighter = groundActionFighter(0.0, 1, NTSC_FOX_GROUND_MOVEMENT_RULES, GroundAction.runBrake, 13, 1, 0.10000000149011612);
  const input = controls({ direction: -1 });
  advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.ground.action, GroundAction.turnRun);
  assertEquals(fighter.ground.actionFrame, 14);
  assertEquals(fighter.facing, 1);
  advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.ground.actionFrame, 15);
  assertEquals(fighter.facing, 1);
  advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.ground.actionFrame, 15);
  assertEquals(fighter.facing, -1);
});

test("a run-brake's forward input doesn't skip to a run [spec docs/physics.md]", () => {
  const fighter = groundActionFighter(0.0, 1, NTSC_FOX_GROUND_MOVEMENT_RULES, GroundAction.runBrake, 0, 1, 9.0);
  advanceSolo(fighter, 0, controls({ direction: 1 }), 0.0);
  assertEquals(fighter.ground.action, GroundAction.runBrake);
  assertEquals(fighter.ground.actionFrame, 1);
  assertEquals(fighter.facing, 1);
});

test("a turn-run uses the retail velocity threshold in world units [reference] [spec docs/physics.md]", () => {
  const input = controls({ direction: -1 });
  // 0.03 world units is greater than the old 0.01 comparison but less than
  // 0.01 Melee units converted at six world units per Melee unit.
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

test("a turn-run completes to wait unless forward is held [spec docs/physics.md]", () => {
  for (const direction of [0, 1]) {
    const fighter = groundActionFighter(0.0, -1, NTSC_FOX_GROUND_MOVEMENT_RULES, GroundAction.turnRun, 19, -1, -3.0);
    fighter.ground.turnRunEntryFacing = 1;
    fighter.ground.turnRunFacingCommandLatched = true;
    advanceSolo(fighter, 0, controls({ direction }), 0.0);
    assertEquals(fighter.ground.action, GroundAction.none);
    assertEquals(fighter.ground.actionFrame, 0);
  }
});

test("a retail run-brake ends at its clip or its maximum frame count [reference] [spec docs/physics.md]", () => {
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

test("an initial dash reversal restarts the window, including across neutral [spec docs/gameplay-design.md]", () => {
  for (const character of [Character.sylvanas, Character.rifleman]) {
    const fighter = createReferenceFighter(character, 0.0, 1);
    const input = controls({ direction: 1 });
    for (let tick = 1; tick <= 8; tick++) advanceSolo(fighter, 0, input, 0.0);
    input.direction = 0;
    advanceSolo(fighter, 0, input, 0.0);
    assertNear(fighter.motion.vx, (character === Character.sylvanas ? f32(13.2) : 9.0) - GROUND_TRACTION, f32(0.001));
    assertEquals(fighter.ground.dashFrame, 9);
    input.direction = -1;
    advanceSolo(fighter, 0, input, 0.0);
    assertNear(fighter.motion.vx, -f32(11.4), f32(0.001));
    assertEquals(fighter.facing, -1);
    assertEquals(fighter.ground.dashFrame, 1);
    for (let tick = 1; tick <= 6; tick++) {
      input.direction = -input.direction;
      advanceSolo(fighter, 0, input, 0.0);
      assertNear(fighter.motion.vx, f32(11.4) * input.direction, f32(0.001));
      assertEquals(fighter.ground.dashFrame, 1);
    }
  }
});

test("a run turn uses the character's dash acceleration before changing facing [spec docs/physics.md]", () => {
  for (const character of [Character.sylvanas, Character.rifleman]) {
    for (const firstDirection of [-1, 1]) {
      const fighter = createReferenceFighter(character, 0.0, firstDirection);
      const input = controls({ direction: firstDirection });
      for (let tick = 1; tick <= fighter.tuning.ground.dashRunEnableFrame; tick++) advanceSolo(fighter, 0, input, 0.0);
      input.direction = -firstDirection;
      const speed = character === Character.sylvanas ? f32(13.2) : 9.0;
      for (let tick = 1; tick <= 4; tick++) {
        advanceSolo(fighter, 0, input, 0.0);
        assertNear(fighter.motion.vx, firstDirection * (speed - f32(0.72) * tick), f32(0.001));
        assertEquals(fighter.facing, firstDirection);
      }
      for (let tick = 5; tick <= 19; tick++) advanceSolo(fighter, 0, input, 0.0);
      advanceSolo(fighter, 0, input, 0.0);
      assertLessThan(fighter.motion.vx * firstDirection, 0.0);
      assertEquals(fighter.facing, -firstDirection);
      assertEquals(fighter.ground.dashFrame, INITIAL_DASH_FRAMES + 1);
    }
  }
});

test("an initial dash's expiration prevents a late instant reversal [spec docs/gameplay-design.md]", () => {
  for (const character of [Character.sylvanas, Character.rifleman]) {
    const fighter = createReferenceFighter(character, 0.0, 1);
    const input = controls({ direction: 1 });
    for (let tick = 1; tick <= fighter.tuning.ground.dashRunEnableFrame; tick++) advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.ground.action, GroundAction.run);
    input.direction = -1;
    advanceSolo(fighter, 0, input, 0.0);
    assertNear(fighter.motion.vx, character === Character.sylvanas ? f32(12.48) : f32(8.28), f32(0.001));
    assertEquals(fighter.facing, 1);
  }
});

test("under-target ground velocity uses the actor's acceleration and run cap [spec docs/physics.md]", () => {
  const fighter = createReferenceFighter(Character.sylvanas, 0.0, 1);
  // Keep this velocity fixture's run-entry timing independent of the roster's
  // dash-dance window; its expected numbers include three tapered run ticks.
  fighter.tuning.ground = { ...fighter.tuning.ground, dashRunEnableFrame: 11 };
  const input = controls({ direction: 1 });
  fighter.motion.vx = 6.0;
  fighter.ground.dashFrame = 1;
  fighter.ground.dashDirection = 1;
  fighter.ground.action = GroundAction.dash;
  fighter.ground.actionFrame = 1;
  withPhysics(fighter, { runSpeed: melee(2.5) });
  advanceSolo(fighter, 0, input, 0.0);
  assertNear(fighter.motion.vx, f32(1.12) * 6, f32(0.0001));
  for (let tick = 1; tick <= 12; tick++) advanceSolo(fighter, 0, input, 0.0);
  assertNear(fighter.motion.vx, f32(12.668), f32(0.0001));
  withPhysics(fighter, { runSpeed: melee(4.0) });
  fighter.motion.vx = f32(melee(3.0) + 0.20000000298023224);
  advanceSolo(fighter, 0, input, 0.0);
  assertNear(fighter.motion.vx, 3.0 * 6, f32(0.0001));
});

test("a neutral stop after an initial dash allows a fresh dash [spec docs/gameplay-design.md]", () => {
  const fighter = createReferenceFighter(Character.sylvanas, 0.0, 1);
  const input = controls({ direction: 1 });
  advanceSolo(fighter, 0, input, 0.0);
  input.direction = 0;
  for (let tick = 1; tick <= 24; tick++) advanceSolo(fighter, 0, input, 0.0);
  assertNear(fighter.motion.vx, 0.0, f32(0.001));
  assertEquals(fighter.ground.dashFrame, 0);
  input.direction = 1;
  advanceSolo(fighter, 0, input, 0.0);
  assertNear(fighter.motion.vx, f32(11.4), f32(0.001));
  assertEquals(fighter.ground.dashFrame, 1);
});

test("hitlag freezes an initial dash, then a reversal resumes [spec docs/physics.md]", () => {
  const fighter = createReferenceFighter(Character.sylvanas, 100.0, 1);
  const input = controls({ direction: 1 });
  advanceSolo(fighter, 0, input, 0.0);
  fighter.launch.hitlag = 2;
  input.direction = -1;
  advanceSolo(fighter, 0, input, 0.0);
  assertNear(fighter.motion.x, 100.0, f32(0.001));
  assertEquals(fighter.ground.dashFrame, 1);
  assertEquals(fighter.ground.action, GroundAction.dash);
  assertEquals(fighter.ground.actionFrame, 1);
  advanceSolo(fighter, 0, input, 0.0);
  assertNear(fighter.motion.vx, -f32(11.4), f32(0.001));
  assertEquals(fighter.ground.dashFrame, 1);
  fighter.launch.hitstun = 3;
  advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.ground.dashFrame, 0);
});

test("an initial dash clears on a jump, shield, attack and respawn [spec docs/physics.md]", () => {
  for (let interruption = 0; interruption <= 3; interruption++) {
    const fighter = createReferenceContactFighter(0.0, 1);
    const world = testWorld(fighter, createReferenceFighter(Character.rifleman, 300.0, -1));
    const input = controls({ direction: 1 });
    advanceFighter(world, 0, 0, input, 0.0);
    if (interruption === 0) {
      input.jumpPressed = true;
      input.jumpHeld = true;
      advanceFighter(world, 0, 0, input, 0.0);
      assertEquals(fighter.jump.squat, 3);
    } else if (interruption === 1) {
      input.shield = true;
      advanceFighter(world, 0, 0, input, 0.0);
      assertTrue(fighter.shield.raised);
    } else if (interruption === 2) {
      // A dashing jab is the dash attack.
      testBeginAttacks(world, AttackStyle.jab, undefined);
      assertEquals(fighter.attack.style, AttackStyle.dashAttack);
    } else {
      fighter.motion.x = f32(stageBounds(0).blast.right + 10.0);
      advanceFighter(world, 0, 0, input, 0.0);
      assertTrue(fighter.status.out);
      assertEquals(fighter.ground.dashFrame, 0);
      respawnFighter(world, 0, 0.0);
    }
    assertEquals(fighter.ground.dashFrame, 0);
    assertEquals(fighter.ground.dashDirection, 0);
  }
});

test("hitlag freezes position until it expires [spec docs/physics.md]", () => {
  const fighter = createReferenceFighter(Character.sylvanas, 0.0, 1);
  fighter.motion.x = 25.0;
  fighter.launch.hitlag = 3;
  const input = controls({ direction: 1 });
  advanceSolo(fighter, 0, input, -240.0);
  assertEquals(fighter.motion.x, 25.0);
  advanceSolo(fighter, 0, input, -240.0);
  assertEquals(fighter.motion.x, 25.0);
  advanceSolo(fighter, 0, input, -240.0);
  assertEquals(fighter.launch.hitlag, 0);
  assertEquals(fighter.motion.x, 25.0);
  assertNear(fighter.motion.vx, INITIAL_DASH_SPEED, f32(0.001));
  advanceSolo(fighter, 0, input, -240.0);
  assertTrue(fighter.motion.x > 25.0);
});
