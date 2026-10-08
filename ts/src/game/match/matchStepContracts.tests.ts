import { mutableProjectile } from "../sim/fighterProjectiles";
import { startAtGo } from "./testMatch";
// These contracts exercise ordering in the complete match executor: input,
// shield, contact, landing, stocks and timeout can interact on one frame.
import { assertEquals, assertFalse, assertGreaterThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { createFighter } from "../sim/fighter";
import { AttackPhase, AttackStyle, Character, DownState, GrabAction, GroundAction, LedgeState, ProjectileKind, ShieldBreak, SurfaceContact } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { beginFighterAttack } from "../sim/attacks";
import { attackPhase } from "../sim/conditions";
import { attackBuffer, hasPendingAttack, queueAttack } from "../input/attackBuffer";
import type { Direction } from "../input/inputRow";
import { copyControls, neutralControls, type Controls, createRoster } from "../sim/roster";
import { createFrameControls, type FrameControls } from "./controls";
import { Phase, createMatchState, setParticipants, recallCharacter, cpuSlot, requestStageSelect, selectCharacter, selectCpuCharacter, setHumanCount } from "./rules";
import { stepMatch } from "./step";
import { SHIELD_MIN_HOLD_FRAMES, SHIELD_RELEASE_LAG_FRAMES, digitalShieldDamage } from "../sim/shield";
import { ATTACK_BUFFER_FRAMES } from "../input/attackBuffer";
import { DASH_GUARD_EARLY_FRAMES } from "../sim/groundMovement";
import { attackDamage, attackDurationFramesForGrounding, attackStartupFrames } from "../sim/moves";
import { authoredTuning, INITIAL_DASH_FRAMES, NTSC_FOX_DASH_GRAB_RULES, NTSC_FOX_GROUND_MOVEMENT_RULES } from "../sim/tuning";

function testRoster(first: Fighter, second: Fighter) {
  return createRoster(3, [first, second]);
}
function testFrameControls(first: Controls, second: Controls, firstCommands: ReturnType<typeof attackBuffer>, secondCommands: ReturnType<typeof attackBuffer>): FrameControls {
  const frame = createFrameControls();
  copyControls(frame.inputs[0], first); copyControls(frame.inputs[1], second);
  frame.commands[0] = firstCommands; frame.commands[1] = secondCommands;
  return frame;
}
function testBeginAttacks(world: ReturnType<typeof createRoster>, firstStyle: number, secondStyle: number, firstCharge: boolean, secondCharge: boolean): void {
  beginFighterAttack(world, 0, firstStyle < 0 ? undefined : firstStyle as AttackStyle, firstCharge);
  beginFighterAttack(world, 1, secondStyle < 0 ? undefined : secondStyle as AttackStyle, secondCharge);
}
function testSoloMatch() {
  const game = createMatchState(); setParticipants(game, 1, 2); recallCharacter(game, 0, 1); return game;
}

test("heldShieldOrderDepletionPrecedesEveryGuardExit [reference]", () => {
  for (let boundary = 0; boundary <= 1; boundary++) {
    for (let action = 0; action <= 3; action++) {
      const game = createMatchState();
      game.phase = Phase.match;
      const first = createFighter(1, 0, 1);
      const second = createFighter(1, 500, -1);
      const firstInput = neutralControls();
      const secondInput = neutralControls();
      const firstCommands = attackBuffer(0);
      const secondCommands = attackBuffer(0);
      first.shield.raised = true;
      first.shield.heldFrames = SHIELD_MIN_HOLD_FRAMES;
      first.shield.energy = boundary === 0 ? 0.10000000149011612 : f32(0.14000000059604645 * 2);
      firstInput.shield = action !== 2;
      firstInput.jumpPressed = action === 0;
      firstInput.jumpHeld = action === 0;
      firstInput.groundDodgePressed = action === 1;
      firstInput.groundDodgeDirection = 1;
      if (action === 3) {
        queueAttack(firstCommands, { style: 5, facing: 0, frame: 1, mayCharge: false });
      }
      stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 1);
      assertFalse(first.shield.raised);
      assertNear(first.shield.energy, 0.07000000029802322, 0.00009999999747378752);
      if (boundary === 0) {
        assertEquals(first.shield.breakState, ShieldBreak.air);
        assertEquals(first.jump.squat, 0);
        assertEquals(first.dodge.groundFrame, 0);
        assertEquals(first.shield.releaseLag, 0);
        assertEquals(first.attack.style, undefined);
      }
      else {
        assertEquals(first.shield.breakState, ShieldBreak.none);
        if (action === 0) {
          assertGreaterThan(first.jump.squat, 0);
        }
        else if (action === 1) {
          assertEquals(first.dodge.groundFrame, 1);
        }
        else if (action === 2) {
          assertEquals(first.shield.releaseLag, SHIELD_RELEASE_LAG_FRAMES);
        }
        else {
          assertEquals(first.attack.style, 5);
        }
      }
    }
  }
});
test("heldShieldOrderEntryDoesNotDrainUntilNextAnimationTick [reference]", () => {
  const game = createMatchState();
  game.phase = Phase.match;
  const first = createFighter(1, 0, 1);
  const second = createFighter(1, 500, -1);
  const firstInput = neutralControls();
  const secondInput = neutralControls();
  const firstCommands = attackBuffer(0);
  const secondCommands = attackBuffer(0);
  first.shield.energy = 0.10000000149011612;
  second.shield.raised = true;
  second.shield.energy = 20;
  firstInput.shield = true;
  secondInput.shield = true;
  stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 1);
  assertTrue(first.shield.raised);
  assertNear(first.shield.energy, 0.10000000149011612, 0.00009999999747378752);
  assertNear(second.shield.energy, 19.719999313354492, 0.00009999999747378752);
  firstInput.jumpPressed = true;
  stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 2);
  assertEquals(first.shield.breakState, ShieldBreak.air);
  assertEquals(first.jump.squat, 0);
  assertNear(first.shield.energy, 0.07000000029802322, 0.00009999999747378752);
  assertNear(second.shield.energy, 19.440000534057617, 0.00009999999747378752);
});
test("heldShieldOrderHitlagAndShieldstunResumeBeforeActionInputs [reference]", () => {
  for (let action = 0; action <= 1; action++) {
    const game = createMatchState();
    game.phase = Phase.match;
    const first = createFighter(1, 0, 1);
    const second = createFighter(1, 500, -1);
    const firstInput = neutralControls();
    const secondInput = neutralControls();
    const firstCommands = attackBuffer(0);
    const secondCommands = attackBuffer(0);
    first.shield.raised = true;
    second.shield.raised = true;
    first.shield.energy = 20;
    second.shield.energy = 20;
    first.shield.stun = 2;
    second.shield.stun = 2;
    first.shield.drainResumePending = true;
    second.shield.drainResumePending = true;
    first.launch.hitlag = 3;
    second.launch.hitlag = 3;
    firstInput.shield = true;
    secondInput.shield = true;
    firstInput.jumpPressed = action === 0;
    for (let frame = 1; frame <= 4; frame++) {
      if (action === 1) {
        queueAttack(firstCommands, { style: 5, facing: 0, frame: frame, mayCharge: false });
      }
      stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), frame);
      assertTrue(first.shield.raised);
      assertEquals(first.jump.squat, 0);
      assertEquals(first.attack.style, undefined);
      assertEquals(first.shield.energy, 20.0);
      assertEquals(second.shield.energy, 20.0);
    }
    assertTrue(first.shield.drainResumePending);
    if (action === 1) {
      queueAttack(firstCommands, { style: 5, facing: 0, frame: 5, mayCharge: false });
    }
    stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 5);
    assertFalse(first.shield.raised);
    assertFalse(first.shield.drainResumePending);
    assertNear(first.shield.energy, 20.06999969482422, 0.00009999999747378752);
    assertFalse(second.shield.drainResumePending);
    assertEquals(second.shield.energy, 20.0);
    if (action === 0) {
      assertGreaterThan(first.jump.squat, 0);
    }
    else {
      assertEquals(first.attack.style, 5);
    }
    firstInput.jumpPressed = false;
    stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 6);
    assertNear(second.shield.energy, 19.719999313354492, 0.00009999999747378752);
  }
});
test("shieldBreakBoundaryDrainRequiresStrictlyNegativeHealth [reference]", () => {
  const game = createMatchState();
  game.phase = Phase.match;
  const first = createFighter(1, 0, 1);
  const second = createFighter(1, 500, -1);
  const firstInput = neutralControls();
  const secondInput = neutralControls();
  const firstCommands = attackBuffer(0);
  const secondCommands = attackBuffer(0);
  first.shield.raised = true;
  first.shield.energy = f32(0.14000000059604645 * 2);
  firstInput.shield = true;
  stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 1);
  assertEquals(first.shield.energy, 0.0);
  assertTrue(first.shield.raised);
  assertEquals(first.shield.breakState, ShieldBreak.none);
  stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 2);
  assertEquals(first.shield.breakState, ShieldBreak.air);
  assertFalse(first.shield.raised);
  assertNear(first.shield.energy, 0.07000000029802322, 0.00009999999747378752);
});
test("shieldBreakBoundaryDamageAtZeroStillGuardsThenRestoresThirty [reference]", () => {
  const game = createMatchState();
  game.phase = Phase.match;
  const first = createFighter(1, 0, 1);
  const second = createFighter(1, 100, -1);
  const firstInput = neutralControls();
  const secondInput = neutralControls();
  const firstCommands = attackBuffer(0);
  const secondCommands = attackBuffer(0);
  mutableProjectile(first, 0)!.life = 2;
  mutableProjectile(first, 0)!.x = 90;
  mutableProjectile(first, 0)!.z = 45;
  mutableProjectile(first, 0)!.velocityX = 20;
  mutableProjectile(first, 0)!.direction = 1;
  mutableProjectile(first, 0)!.kind = ProjectileKind.blaster;
  second.shield.raised = true;
  second.shield.energy = digitalShieldDamage(attackDamage(AttackStyle.shot));
  second.launch.hitlag = 4;
  secondInput.shield = true;
  stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 1);
  assertEquals(second.shield.energy, 0.0);
  assertTrue(second.shield.raised);
  assertEquals(second.shield.breakState, ShieldBreak.none);
  assertEquals(second.status.damage, 0.0);
  mutableProjectile(first, 0)!.life = 2;
  mutableProjectile(first, 0)!.x = 90;
  mutableProjectile(first, 0)!.z = 45;
  mutableProjectile(first, 0)!.velocityX = 20;
  mutableProjectile(first, 0)!.direction = 1;
  stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 2);
  assertFalse(second.shield.raised);
  assertEquals(second.shield.breakState, ShieldBreak.air);
  assertEquals(second.shield.energy, 30.0);
  assertEquals(second.status.damage, 0.0);
  stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 3);
  assertNear(second.shield.energy, 30.06999969482422, 0.00009999999747378752);
});
test("shieldRegenMatchContinuesDuringStoppedActions [reference]", () => {
  for (let state = 0; state <= 5; state++) {
    const game = createMatchState();
    game.phase = Phase.match;
    const first = createFighter(1, 0, 1);
    const second = createFighter(1, 500, -1);
    const firstInput = neutralControls();
    const secondInput = neutralControls();
    const firstCommands = attackBuffer(0);
    const secondCommands = attackBuffer(0);
    first.shield.energy = 20;
    if (state === 0) {
      first.launch.hitlag = 4;
    }
    else if (state === 1) {
      first.ledge.state = LedgeState.hang;
      first.ledge.side = -1;
      first.launch.hitlag = 4;
    }
    else if (state === 2) {
      first.grab.target = 1;
      second.grab.owner = 0;
      first.grab.action = GrabAction.hold;
      second.grab.grabbedFrames = 20;
      first.launch.hitlag = 4;
      second.launch.hitlag = 4;
      second.shield.energy = 20;
    }
    else if (state === 3) {
      first.surfaceRecovery.state = SurfaceContact.techWall;
      first.surfaceRecovery.frame = 0;
    }
    else if (state === 4) {
      first.status.frozenFrames = 4;
    }
    else {
      first.down.state = DownState.wait;
      first.down.waitRemaining = 20;
    }
    stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 1);
    assertNear(first.shield.energy, 20.06999969482422, 0.00009999999747378752);
    if (state === 2) {
      assertNear(second.shield.energy, 20.06999969482422, 0.00009999999747378752);
      assertTrue((first.grab.target === 1));
    }
    first.shield.energy = 59.97999954223633;
    stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 2);
    assertEquals(first.shield.energy, 60.0);
    stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 3);
    assertEquals(first.shield.energy, 60.0);
  }
});
test("shieldRegenMatchUsesGuardStateAfterGrabInput [reference]", () => {
  const game = createMatchState();
  game.phase = Phase.match;
  const first = createFighter(1, 0, 1);
  const second = createFighter(1, 500, -1);
  const firstInput = neutralControls();
  const secondInput = neutralControls();
  const firstCommands = attackBuffer(0);
  const secondCommands = attackBuffer(0);
  first.shield.raised = true;
  second.shield.raised = true;
  first.shield.energy = 20;
  second.shield.energy = 20;
  firstInput.shield = true;
  secondInput.shield = true;
  queueAttack(firstCommands, { style: 5, facing: 0, frame: 1, mayCharge: false });
  stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 1);
  assertEquals(first.attack.style, 5);
  assertFalse(first.shield.raised);
  assertNear(first.shield.energy, 19.790000915527344, 0.00009999999747378752);
  assertTrue(second.shield.raised);
  assertNear(second.shield.energy, 19.719999313354492, 0.00009999999747378752);
  first.launch.hitlag = 3;
  second.launch.hitlag = 3;
  stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 2);
  assertNear(first.shield.energy, 19.860000610351562, 0.00009999999747378752);
  assertNear(second.shield.energy, 19.719999313354492, 0.00009999999747378752);
});
test("shieldRegenMatchFollowsDizzyRestoreExactlyOnce [reference]", () => {
  const game = createMatchState();
  game.phase = Phase.match;
  const first = createFighter(1, 0, 1);
  const second = createFighter(1, 500, -1);
  const firstInput = neutralControls();
  const secondInput = neutralControls();
  const firstCommands = attackBuffer(0);
  const secondCommands = attackBuffer(0);
  first.shield.energy = 10;
  first.shield.breakState = ShieldBreak.stand;
  first.shield.breakFrame = first.tuning.shieldBreak.standFrames - 1;
  stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 1);
  assertEquals(first.shield.breakState, ShieldBreak.dizzy);
  assertNear(first.shield.energy, 30.06999969482422, 0.00009999999747378752);
  stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 2);
  assertNear(first.shield.energy, 30.06999969482422, 0.00009999999747378752);
  first.shield.breakRemaining = 1;
  stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 3);
  assertEquals(first.shield.breakState, ShieldBreak.none);
  assertNear(first.shield.energy, 30.06999969482422, 0.00009999999747378752);
  stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 4);
  assertNear(first.shield.energy, 30.139999389648438, 0.00009999999747378752);
  first.status.out = true;
  first.status.respawn = 10;
  stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 5);
  assertNear(first.shield.energy, 30.139999389648438, 0.00009999999747378752);
});
test("shieldRegenMatchSeesGuardClearedByCapture [reference]", () => {
  const game = createMatchState();
  game.phase = Phase.match;
  const first = createFighter(1, 0, 1);
  const second = createFighter(1, 90, -1);
  const firstInput = neutralControls();
  const secondInput = neutralControls();
  const firstCommands = attackBuffer(0);
  const secondCommands = attackBuffer(0);
  first.motion.surface = 0;
  second.motion.surface = 0;
  second.shield.raised = true;
  second.shield.energy = 20;
  secondInput.shield = true;
  testBeginAttacks(testRoster(first, second), 5, -1, false, false);
  first.attack.frame = attackStartupFrames(5) - 1;
  stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 1);
  assertTrue((second.grab.owner === 0));
  assertFalse(second.shield.raised);
  assertNear(second.shield.energy, 19.790000915527344, 0.00009999999747378752);
});
test("humanDirectAttacksReachBothSlotsOnTheNextStep [invariant]", () => {
  for (let style = 1; style <= 5; style++) {
    const game = testSoloMatch();
    setHumanCount(game, 2);
    selectCharacter(game, 0, 1);
    selectCharacter(game, 1, 1);
    requestStageSelect(game, 0);
    startAtGo(game, 0);
    const first = createFighter(1, -240, 1);
    const second = createFighter(1, 240, -1);
    const firstInput = neutralControls();
    const secondInput = neutralControls();
    const firstCommands = attackBuffer(0);
    const secondCommands = attackBuffer(0);
    stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 10);
    queueAttack(firstCommands, { style, facing: 1, frame: 11, mayCharge: false });
    queueAttack(secondCommands, { style, facing: -1, frame: 11, mayCharge: false });
    assertEquals(first.attack.serial, 0);
    assertEquals(second.attack.serial, 0);
    stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 11);
    assertEquals(first.attack.serial, 1);
    assertEquals(second.attack.serial, 1);
    assertEquals(first.attack.style, style);
    assertEquals(second.attack.style, style);
    assertEquals(first.attack.frame, second.attack.frame);
    stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 12);
    assertEquals(first.attack.serial, 1);
    assertEquals(second.attack.serial, 1);
  }
});
test("activeShieldConsumesGrabButRejectsOrdinaryAttackCommand [spec docs/design/melee/defense.md]", () => {
  const game = testSoloMatch();
  selectCharacter(game, 0, 1);
  selectCpuCharacter(game, 0, (cpuSlot(game) ?? -1), 1);
  requestStageSelect(game, 0);
  startAtGo(game, 0);
  const first = createFighter(1, 0, 1);
  const second = createFighter(1, 350, -1);
  const firstInput = neutralControls();
  const secondInput = neutralControls();
  const firstCommands = attackBuffer(0);
  const secondCommands = attackBuffer(0);
  firstInput.shield = true;
  queueAttack(firstCommands, { style: 0, facing: 0, frame: 1, mayCharge: false });
  stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 1);
  assertTrue(first.shield.raised);
  assertEquals(first.attack.style, undefined);
  assertTrue(hasPendingAttack(firstCommands, 1));
  firstCommands.pending = undefined;
  queueAttack(firstCommands, { style: 5, facing: 0, frame: 2, mayCharge: false });
  stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 2);
  assertEquals(first.attack.style, 5);
  assertFalse(first.shield.raised);
  assertEquals(first.shield.releaseLag, 0);
});
test("jumpSquatBuffersBackAirUntilFirstAirborneFrame [spec docs/design/melee/aerials-on-shield.md]", () => {
  for (const character of [1, 2] as const) {
    for (let facing = -1; facing <= 1; facing++) {
      if (facing !== 0) {
        for (let squatRemaining = 1; squatRemaining <= authoredTuning(character as Character).physics.jumpSquatFrames; squatRemaining++) {
          const game = testSoloMatch();
          game.phase = Phase.match;
          const fighter = createFighter(character as Character, 0, facing);
          const target = createFighter((1 - character) as Character, 350, -facing);
          const input = neutralControls();
          const otherInput = neutralControls();
          const commands = attackBuffer(ATTACK_BUFFER_FRAMES);
          const otherCommands = attackBuffer(ATTACK_BUFFER_FRAMES);
          fighter.jump.squat = squatRemaining;
          fighter.jump.held = true;
          input.jumpHeld = true;
          queueAttack(commands, { style: 4, facing: (-facing) as Direction, frame: 1, mayCharge: false });
          for (let frame = 1; frame <= squatRemaining; frame++) {
            stepMatch(game, testRoster(fighter, target), testFrameControls(input, otherInput, commands, otherCommands), frame);
            assertEquals(fighter.facing, facing);
            if (frame < squatRemaining) {
              assertTrue(fighter.motion.grounded);
              assertEquals(fighter.attack.style, undefined);
            }
            else {
              assertFalse(fighter.motion.grounded);
              assertEquals(fighter.attack.style, AttackStyle.backAir);
              assertEquals(fighter.attack.frame, 0);
              assertEquals(fighter.attack.serial, 1);
            }
          }
          assertFalse(hasPendingAttack(commands, squatRemaining + 1));
        }
      }
    }
  }
});
test("dashGrabUsesTestActorTimingAndWindowIsReplayable [reference]", () => {
  const game = createMatchState();
  game.phase = Phase.match;
  const first = createFighter(1, 0, 1);
  const second = createFighter(1, 80, -1);
  const firstInput = neutralControls();
  const secondInput = neutralControls();
  const firstCommands = attackBuffer(0);
  const secondCommands = attackBuffer(0);
  first.tuning.dashGrab = NTSC_FOX_DASH_GRAB_RULES;
  first.tuning.ground = NTSC_FOX_GROUND_MOVEMENT_RULES;
  first.ground.dashFrame = 5;
  first.ground.dashDirection = 1;
  first.ground.action = GroundAction.dash;
  first.ground.actionFrame = 5;
  firstInput.direction = 1;
  queueAttack(firstCommands, { style: 5, facing: 0, frame: 1, mayCharge: false });
  stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 1);
  assertEquals(first.attack.style, 5);
  assertTrue(first.attack.dashGrab);
  assertEquals(first.attack.duration, 40);
  assertEquals(first.tuning.dashGrab.startupFrames, 10);
  firstInput.attackPressed = false;
  for (let frame = 2; frame <= 10; frame++) {
    stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), frame);
    assertEquals(second.grab.grabbedFrames, 0);
  }
  assertEquals(first.attack.frame, 9);
  assertEquals(attackPhase(first), AttackPhase.startup);
  stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 11);
  assertGreaterThan(second.grab.grabbedFrames, 0);
});
test("ordinaryDashAttackStaysAnAttackWhileGrabIntentStartsDashGrab [spec docs/design/tilts.md]", () => {
  const game = createMatchState();
  game.phase = Phase.match;
  const first = createFighter(1, -240, 1);
  const second = createFighter(1, 240, -1);
  const firstInput = neutralControls();
  const secondInput = neutralControls();
  const firstCommands = attackBuffer(0);
  const secondCommands = attackBuffer(0);
  first.ground.dashFrame = INITIAL_DASH_FRAMES + 1;
  first.ground.dashDirection = 1;
  first.ground.action = GroundAction.dash;
  first.ground.actionFrame = 5;
  second.ground.dashFrame = INITIAL_DASH_FRAMES + 1;
  second.ground.dashDirection = -1;
  second.ground.action = GroundAction.dash;
  second.ground.actionFrame = 5;
  firstInput.direction = 1;
  firstInput.attackPressed = true;
  secondInput.direction = -1;
  queueAttack(firstCommands, { style: 0, facing: 0, frame: 1, mayCharge: false });
  queueAttack(secondCommands, { style: 5, facing: 0, frame: 1, mayCharge: false });
  stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 1);
  // Rifleman's dashing jab is his dash attack (smashcraft:docs/design/tilts.md).
  assertEquals(first.attack.style, AttackStyle.dashAttack);
  assertFalse(first.attack.dashGrab);
  assertEquals(second.attack.style, 5);
  assertTrue(second.attack.dashGrab);
  assertEquals(second.attack.duration, attackDurationFramesForGrounding(5, true));
});
test("lateDashGrabGuardEntryOpensCatchDashAndEarlyEntryDoesNot [reference]", () => {
  const game = createMatchState();
  game.phase = Phase.match;
  const first = createFighter(1, 0, 1);
  const second = createFighter(1, 500, -1);
  const firstInput = neutralControls();
  const secondInput = neutralControls();
  const firstCommands = attackBuffer(0);
  const secondCommands = attackBuffer(0);
  first.tuning.dashGrab = NTSC_FOX_DASH_GRAB_RULES;
  first.tuning.ground = NTSC_FOX_GROUND_MOVEMENT_RULES;
  first.ground.dashFrame = INITIAL_DASH_FRAMES + 1;
  first.ground.action = GroundAction.run;
  first.ground.actionFrame = 1;
  firstInput.shield = true;
  stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 1);
  assertEquals(first.ground.dashGrabWindow, 3);
  firstInput.attackPressed = true;
  queueAttack(firstCommands, { style: 5, facing: 0, frame: 2, mayCharge: false });
  stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 2);
  assertTrue(first.attack.dashGrab);
  assertEquals(first.ground.dashGrabWindow, 0);
  assertEquals(first.attack.duration, 40);
  const expiryGame = createMatchState();
  expiryGame.phase = Phase.match;
  const expiry = createFighter(1, 0, 1);
  const expiryOther = createFighter(1, 500, -1);
  const expiryInput = neutralControls();
  const expiryOtherInput = neutralControls();
  const expiryCommands = attackBuffer(0);
  const expiryOtherCommands = attackBuffer(0);
  expiry.tuning.dashGrab = NTSC_FOX_DASH_GRAB_RULES;
  expiry.shield.raised = true;
  expiry.ground.dashGrabWindow = 3;
  expiry.launch.hitlag = 2;
  expiryInput.shield = true;
  stepMatch(expiryGame, testRoster(expiry, expiryOther), testFrameControls(expiryInput, expiryOtherInput, expiryCommands, expiryOtherCommands), 1);
  assertEquals(expiry.ground.dashGrabWindow, 3);
  stepMatch(expiryGame, testRoster(expiry, expiryOther), testFrameControls(expiryInput, expiryOtherInput, expiryCommands, expiryOtherCommands), 2);
  assertEquals(expiry.ground.dashGrabWindow, 2);
  for (let frame = 3; frame <= 4; frame++) {
    stepMatch(expiryGame, testRoster(expiry, expiryOther), testFrameControls(expiryInput, expiryOtherInput, expiryCommands, expiryOtherCommands), frame);
  }
  assertEquals(expiry.ground.dashGrabWindow, 0);
  const earlyGame = createMatchState();
  earlyGame.phase = Phase.match;
  const early = createFighter(1, 0, 1);
  const earlyOther = createFighter(1, 500, -1);
  const earlyInput = neutralControls();
  const earlyOtherInput = neutralControls();
  const earlyCommands = attackBuffer(0);
  const earlyOtherCommands = attackBuffer(0);
  early.ground.dashFrame = INITIAL_DASH_FRAMES + 1;
  early.ground.action = GroundAction.dash;
  early.ground.actionFrame = DASH_GUARD_EARLY_FRAMES;
  earlyInput.shield = true;
  stepMatch(earlyGame, testRoster(early, earlyOther), testFrameControls(earlyInput, earlyOtherInput, earlyCommands, earlyOtherCommands), 1);
  assertEquals(early.ground.dashGrabWindow, 0);
  const dashLateGame = createMatchState();
  dashLateGame.phase = Phase.match;
  const dashLate = createFighter(1, 0, 1);
  const dashLateOther = createFighter(1, 500, -1);
  const dashLateInput = neutralControls();
  const dashLateOtherInput = neutralControls();
  const dashLateCommands = attackBuffer(0);
  const dashLateOtherCommands = attackBuffer(0);
  dashLate.tuning.dashGrab = NTSC_FOX_DASH_GRAB_RULES;
  dashLate.ground.dashFrame = INITIAL_DASH_FRAMES + 1;
  dashLate.ground.action = GroundAction.dash;
  dashLate.ground.actionFrame = DASH_GUARD_EARLY_FRAMES + 1;
  dashLateInput.shield = true;
  stepMatch(dashLateGame, testRoster(dashLate, dashLateOther), testFrameControls(dashLateInput, dashLateOtherInput, dashLateCommands, dashLateOtherCommands), 1);
  assertEquals(dashLate.ground.dashGrabWindow, 3);
});
test("dashGrabWhiffEndsAfterFortySubsequentTicks [reference]", () => {
  const game = createMatchState();
  game.phase = Phase.match;
  const first = createFighter(1, -240, 1);
  const second = createFighter(1, -500, -1);
  const firstInput = neutralControls();
  const secondInput = neutralControls();
  const firstCommands = attackBuffer(0);
  const secondCommands = attackBuffer(0);
  first.tuning.dashGrab = NTSC_FOX_DASH_GRAB_RULES;
  first.ground.dashFrame = 5;
  first.ground.dashDirection = 1;
  first.ground.action = GroundAction.dash;
  first.ground.actionFrame = 5;
  firstInput.direction = 1;
  queueAttack(firstCommands, { style: 5, facing: 0, frame: 1, mayCharge: false });
  stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 1);
  assertEquals(first.attack.frame, 0);
  assertTrue(first.attack.dashGrab);
  firstInput.direction = 0;
  for (let frame = 2; frame <= 40; frame++) {
    stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), frame);
    assertFalse(first.status.out);
    assertEquals(second.grab.grabbedFrames, 0);
  }
  assertEquals(first.attack.frame, 39);
  assertEquals(first.attack.style, 5);
  assertEquals(first.attack.cooldown, 1);
  firstInput.jumpPressed = true;
  firstInput.jumpHeld = true;
  stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 41);
  assertEquals(first.attack.style, undefined);
  assertEquals(first.attack.cooldown, 0);
  assertGreaterThan(first.jump.squat, 0);
  assertEquals(second.grab.grabbedFrames, 0);
});
test("dashGrabSecondActiveTickCapturesButFollowingTickDoesNot [reference]", () => {
  for (let lateByOne = 0; lateByOne <= 1; lateByOne++) {
    const game = createMatchState();
    game.phase = Phase.match;
    const first = createFighter(1, 0, 1);
    const second = createFighter(1, 80, -1);
    const firstInput = neutralControls();
    const secondInput = neutralControls();
    const firstCommands = attackBuffer(0);
    const secondCommands = attackBuffer(0);
    first.tuning.dashGrab = NTSC_FOX_DASH_GRAB_RULES;
    first.ground.dashFrame = 5;
    first.ground.dashDirection = 1;
    first.ground.action = GroundAction.dash;
    first.ground.actionFrame = 5;
    firstInput.direction = 1;
    second.status.invincible = 12 + lateByOne;
    queueAttack(firstCommands, { style: 5, facing: 0, frame: 1, mayCharge: false });
    for (let frame = 1; frame <= 11; frame++) {
      stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), frame);
      assertEquals(second.grab.grabbedFrames, 0);
    }
    assertEquals(first.attack.frame, 10);
    assertEquals(attackPhase(first), AttackPhase.active);
    stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 12);
    if (lateByOne === 0) {
      assertGreaterThan(second.grab.grabbedFrames, 0);
    }
    else {
      assertEquals(second.grab.grabbedFrames, 0);
      stepMatch(game, testRoster(first, second), testFrameControls(firstInput, secondInput, firstCommands, secondCommands), 13);
      assertEquals(second.status.invincible, 0);
      assertEquals(first.attack.frame, 12);
      assertEquals(attackPhase(first), AttackPhase.recovery);
      assertEquals(second.grab.grabbedFrames, 0);
    }
  }
});
