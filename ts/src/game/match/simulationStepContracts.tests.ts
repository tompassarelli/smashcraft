import { startAtGo } from "./testMatch";
import { assertEquals, assertFalse, assertGreaterThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { AttackPhase, AttackStyle, Character, GrabAction } from "../sim/codes";
import { createFighter, type Fighter } from "../sim/fighter";
import { createRoster, copyControls, neutralControls, type Controls } from "../sim/roster";
import { attackBuffer, queueAttack } from "../input/attackBuffer";
import { createFrameControls, type FrameControls } from "./controls";
import { Phase, createMatchState, setParticipants, recallCharacter, cpuSlot, selectCharacter, selectCpuCharacter, requestStageSelect } from "./rules";
import { floorMod } from "wisp/src/sim/intMath";
import { stepMatch } from "./step";
import { HERO_ROSTER } from "../sim/heroes/registry";
import { attackPhase, canAttack } from "../sim/conditions";
import { attackActiveFrames, attackDurationFrames, attackStartupFrames, GRAB_HOLD_FRAMES } from "../sim/moves";
import { projectileCount } from "../sim/projectiles";
import { totalVelocityX, totalVelocityZ } from "../sim/motion";
import { advanceFighter } from "../sim/step";

function testRoster(first: Fighter, second: Fighter) { return createRoster(3, [first, second]); }
function frameControls(first: Controls, second: Controls, firstCommands: ReturnType<typeof attackBuffer>, secondCommands: ReturnType<typeof attackBuffer>): FrameControls {
  const result = createFrameControls(); copyControls(result.inputs[0], first); copyControls(result.inputs[1], second);
  result.commands[0] = firstCommands; result.commands[1] = secondCommands; return result;
}
function testMatch() {
  const game = createMatchState(); setParticipants(game, 1, 2); recallCharacter(game, 0, 1);
  selectCharacter(game, 0, 0); selectCpuCharacter(game, 0, cpuSlot(game) ?? -1, 1);
  requestStageSelect(game, 0); startAtGo(game, 0); return game;
}
function runToAttackActive(game: ReturnType<typeof createMatchState>, first: Fighter, second: Fighter, firstInput: Controls, secondInput: Controls, firstCommands: ReturnType<typeof attackBuffer>, secondCommands: ReturnType<typeof attackBuffer>, style: number, startFrame: number): void {
  queueAttack(firstCommands, { style, facing: 0, frame: startFrame, mayCharge: false });
  for (let i = 0; i <= attackStartupFrames(style as AttackStyle); i++)
    stepMatch(game, testRoster(first, second), frameControls(firstInput, secondInput, firstCommands, secondCommands), startFrame + i);
}
test("blasterTravelsBeforeItDealsDamage", () => {
  const game = testMatch();
  const owner = createFighter(0, 0, 1);
  const target = createFighter(1, 400, -1);
  const ownerInput = neutralControls();
  const targetInput = neutralControls();
  const ownerCommands = attackBuffer(0);
  const targetCommands = attackBuffer(0);
  runToAttackActive(game, owner, target, ownerInput, targetInput, ownerCommands, targetCommands, 1, 1);
  assertEquals(target.status.damage, 0.0);
  assertEquals(projectileCount(owner), 1);
  for (let frame = attackStartupFrames(1) + 2; frame <= 11; frame++) {
    stepMatch(game, testRoster(owner, target), frameControls(ownerInput, targetInput, ownerCommands, targetCommands), frame);
  }
  assertEquals(target.status.damage, 0.0);
  stepMatch(game, testRoster(owner, target), frameControls(ownerInput, targetInput, ownerCommands, targetCommands), 12);
  assertEquals(target.status.damage, 3.0);
  assertEquals(projectileCount(owner), 0);

});

test("beingHitDuringAttackStartupCancelsBeforeItsActiveFrame", () => {
  const game = testMatch();
  const first = createFighter(0, 0, 1);
  const second = createFighter(1, 100, -1);
  const firstInput = neutralControls();
  const secondInput = neutralControls();
  const firstCommands = attackBuffer(0);
  const secondCommands = attackBuffer(0);
  queueAttack(firstCommands, { style: 0, facing: 0, frame: 1, mayCharge: false });
  for (let frame = 1; frame <= attackStartupFrames(0) - 1; frame++) {
    stepMatch(game, testRoster(first, second), frameControls(firstInput, secondInput, firstCommands, secondCommands), frame);
  }
  queueAttack(secondCommands, { style: 0, facing: 0, frame: attackStartupFrames(0), mayCharge: false });
  for (let frame = attackStartupFrames(0); frame <= attackStartupFrames(0) + 1; frame++) {
    stepMatch(game, testRoster(first, second), frameControls(firstInput, secondInput, firstCommands, secondCommands), frame);
  }
  assertEquals(first.status.damage, 0.0);
  assertEquals(second.status.damage, 5.0);
  assertEquals(second.attack.serial, 1);
  assertEquals(second.attack.style, undefined);
  assertEquals(second.attack.cooldown, 0);

});

test("aHitAddsDamageHitlagAndDamageScaledKnockback", () => {
  const game = testMatch();
  const attacker = createFighter(0, 0, 1);
  const target = createFighter(1, 100, -1);
  const attackerInput = neutralControls();
  const targetInput = neutralControls();
  const attackerCommands = attackBuffer(0);
  const targetCommands = attackBuffer(0);
  queueAttack(attackerCommands, { style: 0, facing: 0, frame: 1, mayCharge: false });
  stepMatch(game, testRoster(attacker, target), frameControls(attackerInput, targetInput, attackerCommands, targetCommands), 1);
  assertEquals(target.status.damage, 0.0);
  assertEquals(attacker.attack.serial, 1);
  assertTrue((attackPhase(attacker) === AttackPhase.startup));
  for (let tick = 2; tick <= attackStartupFrames(0) + 1; tick++) {
    stepMatch(game, testRoster(attacker, target), frameControls(attackerInput, targetInput, attackerCommands, targetCommands), tick);
  }
  assertEquals(target.status.damage, 5.0);
  assertEquals(target.motion.vx, 0.0);
  assertEquals(target.motion.vz, 0.0);
  assertNear(target.launch.knockbackX, 5.18310022354126, 0.009999999776482582);
  assertNear(target.launch.knockbackZ, 5.18310022354126, 0.009999999776482582);
  assertEquals(totalVelocityX(target), target.launch.knockbackX);
  assertEquals(totalVelocityZ(target), target.launch.knockbackZ);
  assertEquals(target.launch.hitstun, 16);
  assertEquals(target.launch.hitlag, 4);
  assertTrue(target.launch.diPending);
  assertGreaterThan(target.launch.diLaunchSpeed, 0.0);
  assertEquals(attacker.launch.hitlag, 4);
  let frame = attackStartupFrames(0) + 2;
  while (attacker.launch.hitlag > 0) {
    stepMatch(game, testRoster(attacker, target), frameControls(attackerInput, targetInput, attackerCommands, targetCommands), frame);
    frame++;
  }
  target.motion.x = 100;
  target.motion.z = 0;
  target.motion.vx = 0;
  target.motion.vz = 0;
  target.launch.knockbackX = 0;
  target.launch.knockbackZ = 0;
  target.launch.hitstun = 0;
  const damageAfterContact = target.status.damage;
  stepMatch(game, testRoster(attacker, target), frameControls(attackerInput, targetInput, attackerCommands, targetCommands), frame);
  assertEquals(target.status.damage, damageAfterContact);

});

test("shieldGrabStartsDirectlyFromActiveGuardAndCanCatchShieldingTarget", () => {
  const game = testMatch();
  const attacker = createFighter(0, 0, 1);
  const target = createFighter(1, 90, -1);
  const attackerInput = neutralControls();
  const targetInput = neutralControls();
  const attackerCommands = attackBuffer(0);
  const targetCommands = attackBuffer(0);
  attackerInput.shield = true;
  targetInput.shield = true;
  queueAttack(attackerCommands, { style: 5, facing: 0, frame: 1, mayCharge: false });
  stepMatch(game, testRoster(attacker, target), frameControls(attackerInput, targetInput, attackerCommands, targetCommands), 1);
  assertEquals(attacker.attack.style, 5);
  assertFalse(attacker.shield.raised);
  assertEquals(attacker.shield.releaseLag, 0);
  attackerInput.shield = false;
  for (let frame = 2; frame <= attackStartupFrames(5) + 1; frame++) {
    stepMatch(game, testRoster(attacker, target), frameControls(attackerInput, targetInput, attackerCommands, targetCommands), frame);
  }
  assertEquals(target.grab.grabbedFrames, GRAB_HOLD_FRAMES);
  assertFalse(target.shield.raised);
});

test("shieldstunKeepsTheFighterShieldingAndBlocksActions", () => {
  const game = testMatch();
  const attacker = createFighter(0, 0, 1);
  const target = createFighter(1, 100, -1);
  const attackerInput = neutralControls();
  const targetInput = neutralControls();
  targetInput.shield = true;
  const attackerCommands = attackBuffer(0);
  const targetCommands = attackBuffer(0);
  runToAttackActive(game, attacker, target, attackerInput, targetInput, attackerCommands, targetCommands, 0, 1);
  targetInput.shield = false;
  const stun = target.shield.stun;
  const input = neutralControls();
  input.shield = false;
  input.jumpPressed = true;
  input.direction = 1;
  advanceFighter(testRoster(target, attacker), 0, 0, input, -240);
  assertTrue(target.shield.raised);
  assertEquals(target.shield.stun, stun);
  assertEquals(target.jump.squat, 0);
  queueAttack(targetCommands, { style: 0, facing: 0, frame: attackStartupFrames(0) + 2, mayCharge: false });
  stepMatch(game, testRoster(target, attacker), frameControls(input, attackerInput, targetCommands, attackerCommands), attackStartupFrames(0) + 2);
  assertEquals(target.attack.style, undefined);
  assertEquals(attacker.status.damage, 0.0);

});

test("attacksCommitRecoveryOnWhiffAndBlockDuringLandingLag", () => {
  const game = testMatch();
  const attacker = createFighter(0, 0, 1);
  const target = createFighter(1, 400, -1);
  const attackerInput = neutralControls();
  const targetInput = neutralControls();
  const attackerCommands = attackBuffer(0);
  const targetCommands = attackBuffer(0);
  runToAttackActive(game, attacker, target, attackerInput, targetInput, attackerCommands, targetCommands, 0, 1);
  assertEquals(attacker.attack.cooldown, 17);
  assertTrue((attackPhase(attacker) === AttackPhase.active));
  target.motion.x = 100;
  stepMatch(game, testRoster(attacker, target), frameControls(attackerInput, targetInput, attackerCommands, targetCommands), attackStartupFrames(0) + 2);
  assertEquals(target.status.damage, 5.0);
  assertTrue(attacker.attack.hit);
  const damageAfterContact = target.status.damage;
  for (let frame = attackStartupFrames(0) + 3; frame <= attackStartupFrames(0) + attackActiveFrames(0) + 1; frame++) {
    stepMatch(game, testRoster(attacker, target), frameControls(attackerInput, targetInput, attackerCommands, targetCommands), frame);
  }
  assertEquals(target.status.damage, damageAfterContact);

});

test("simultaneousEligibleAttacksTradeInEitherOrder", () => {
  const gameA = testMatch();
  const leftA = createFighter(0, 0, 1);
  const rightA = createFighter(1, 100, -1);
  const leftInputA = neutralControls();
  const rightInputA = neutralControls();
  const leftCommandsA = attackBuffer(0);
  const rightCommandsA = attackBuffer(0);
  queueAttack(leftCommandsA, { style: 1, facing: 0, frame: 1, mayCharge: false });
  queueAttack(rightCommandsA, { style: 1, facing: 0, frame: 1, mayCharge: false });
  for (let frame = 1; frame <= attackStartupFrames(1) + 1; frame++) {
    stepMatch(gameA, testRoster(leftA, rightA), frameControls(leftInputA, rightInputA, leftCommandsA, rightCommandsA), frame);
  }
  assertEquals(leftA.attack.cooldown, 30);
  assertEquals(rightA.attack.cooldown, 30);
  for (let frame = attackStartupFrames(1) + 2; frame <= 40; frame++) {
    stepMatch(gameA, testRoster(leftA, rightA), frameControls(leftInputA, rightInputA, leftCommandsA, rightCommandsA), frame);
  }
  assertEquals(leftA.status.damage, 3.0);
  assertEquals(rightA.status.damage, 3.0);
  const gameB = testMatch();
  const leftB = createFighter(0, 0, 1);
  const rightB = createFighter(1, 100, -1);
  const leftInputB = neutralControls();
  const rightInputB = neutralControls();
  const leftCommandsB = attackBuffer(0);
  const rightCommandsB = attackBuffer(0);
  queueAttack(leftCommandsB, { style: 1, facing: 0, frame: 1, mayCharge: false });
  queueAttack(rightCommandsB, { style: 1, facing: 0, frame: 1, mayCharge: false });
  for (let frame = 1; frame <= attackStartupFrames(1) + 1; frame++) {
    stepMatch(gameB, testRoster(rightB, leftB), frameControls(rightInputB, leftInputB, rightCommandsB, leftCommandsB), frame);
  }
  for (let frame = attackStartupFrames(1) + 2; frame <= 40; frame++) {
    stepMatch(gameB, testRoster(rightB, leftB), frameControls(rightInputB, leftInputB, rightCommandsB, leftCommandsB), frame);
  }
  assertEquals(leftA.status.damage, 3.0);
  assertEquals(rightA.status.damage, 3.0);
  assertEquals(leftA.status.damage, rightA.status.damage);
  assertEquals(leftA.status.damage, leftB.status.damage);
  assertEquals(leftA.status.damage, rightB.status.damage);
  assertEquals(leftA.launch.hitstun, leftB.launch.hitstun);
  assertEquals(rightA.launch.hitstun, rightB.launch.hitstun);
  assertEquals(leftA.attack.cooldown, leftB.attack.cooldown);
  assertEquals(rightA.attack.cooldown, rightB.attack.cooldown);

});

test("aWhiffDoesNotFreezeTheShooterWhileTheOpponentsShotFreezesItsVictim", () => {
  const game = testMatch();
  const blaster = createFighter(0, 0, 1);
  const opponent = createFighter(1, 100, -1);
  const blasterInput = neutralControls();
  const opponentInput = neutralControls();
  const blasterCommands = attackBuffer(0);
  const opponentCommands = attackBuffer(0);
  blaster.facing = -1;
  queueAttack(blasterCommands, { style: 1, facing: 0, frame: 1, mayCharge: false });
  queueAttack(opponentCommands, { style: 1, facing: 0, frame: 1, mayCharge: false });
  for (let frame = 1; frame <= attackStartupFrames(1) + 2; frame++) {
    stepMatch(game, testRoster(blaster, opponent), frameControls(blasterInput, opponentInput, blasterCommands, opponentCommands), frame);
  }
  assertEquals(blaster.status.damage, 3.0);
  assertEquals(opponent.status.damage, 0.0);
  assertEquals(blaster.launch.hitlag, 4);
  assertEquals(opponent.launch.hitlag, 0);
  assertEquals(blaster.attack.cooldown, 0);
  assertEquals(opponent.attack.cooldown, attackDurationFrames(1) - attackStartupFrames(1) - 1);

});

test("successfulGrabHasPriorityOverSimultaneousStrikeInEitherOrder", () => {
  const gameA = testMatch();
  const grabberA = createFighter(0, 0, 1);
  const strikerA = createFighter(1, 90, -1);
  const grabberInputA = neutralControls();
  const strikerInputA = neutralControls();
  const grabberCommandsA = attackBuffer(0);
  const strikerCommandsA = attackBuffer(0);
  queueAttack(grabberCommandsA, { style: 5, facing: 0, frame: 1, mayCharge: false });
  for (let frame = 1; frame <= 3; frame++) {
    stepMatch(gameA, testRoster(grabberA, strikerA), frameControls(grabberInputA, strikerInputA, grabberCommandsA, strikerCommandsA), frame);
  }
  queueAttack(strikerCommandsA, { style: 1, facing: 0, frame: 4, mayCharge: false });
  for (let frame = 4; frame <= 6; frame++) {
    stepMatch(gameA, testRoster(grabberA, strikerA), frameControls(grabberInputA, strikerInputA, grabberCommandsA, strikerCommandsA), frame);
  }
  const gameB = testMatch();
  const grabberB = createFighter(0, 0, 1);
  const strikerB = createFighter(1, 90, -1);
  const grabberInputB = neutralControls();
  const strikerInputB = neutralControls();
  const grabberCommandsB = attackBuffer(0);
  const strikerCommandsB = attackBuffer(0);
  queueAttack(grabberCommandsB, { style: 5, facing: 0, frame: 1, mayCharge: false });
  for (let frame = 1; frame <= 3; frame++) {
    stepMatch(gameB, testRoster(grabberB, strikerB), frameControls(grabberInputB, strikerInputB, grabberCommandsB, strikerCommandsB), frame);
  }
  queueAttack(strikerCommandsB, { style: 1, facing: 0, frame: 4, mayCharge: false });
  for (let frame = 4; frame <= 6; frame++) {
    stepMatch(gameB, testRoster(strikerB, grabberB), frameControls(strikerInputB, grabberInputB, strikerCommandsB, grabberCommandsB), frame);
  }
  assertEquals(grabberA.status.damage, 0.0);
  assertEquals(strikerA.status.damage, 0.0);
  assertEquals(grabberB.status.damage, grabberA.status.damage);
  assertEquals(strikerB.status.damage, strikerA.status.damage);
  assertEquals(strikerA.grab.grabbedFrames, GRAB_HOLD_FRAMES);
  assertEquals(strikerB.grab.grabbedFrames, strikerA.grab.grabbedFrames);
  assertEquals(grabberA.attack.cooldown, 0);
  assertEquals(grabberA.grab.action, GrabAction.hold);
  assertFalse(canAttack(grabberA));
  assertEquals(strikerA.attack.cooldown, 0);
  assertEquals(grabberB.attack.cooldown, grabberA.attack.cooldown);
  assertEquals(strikerB.attack.cooldown, strikerA.attack.cooldown);

});

test("grabBreaksShieldButHasShortReachAndTimedRelease", () => {
  const game = testMatch();
  const attacker = createFighter(0, 0, 1);
  const target = createFighter(1, 90, -1);
  const attackerInput = neutralControls();
  const targetInput = neutralControls();
  targetInput.shield = true;
  const attackerCommands = attackBuffer(0);
  const targetCommands = attackBuffer(0);
  runToAttackActive(game, attacker, target, attackerInput, targetInput, attackerCommands, targetCommands, 5, 1);
  assertEquals(target.grab.grabbedFrames, GRAB_HOLD_FRAMES);
  assertFalse(target.shield.raised);
  for (let frame = attackStartupFrames(5) + 2; frame <= attackStartupFrames(5) + 1 + GRAB_HOLD_FRAMES; frame++) {
    // Keep slot identities stable; source Wurst rosters resolve grab links by fighter identity.
    stepMatch(game, testRoster(attacker, target), frameControls(attackerInput, targetInput, attackerCommands, targetCommands), frame);
  }
  assertEquals(target.grab.grabbedFrames, 0);
  assertEquals(target.launch.hitstun, 10);
  assertEquals(target.jump.squat, 0);
  const farTarget = createFighter(1, 150, -1);
  const farAttacker = createFighter(0, 0, 1);
  const farGame = testMatch();
  const farCommands = attackBuffer(0);
  const farTargetCommands = attackBuffer(0);
  runToAttackActive(farGame, farAttacker, farTarget, attackerInput, targetInput, farCommands, farTargetCommands, 5, 1);
  assertEquals(farTarget.grab.grabbedFrames, 0);
  const invincibleTarget = createFighter(1, 50, -1);
  invincibleTarget.status.invincible = 100;
  const invincibleAttacker = createFighter(0, 0, 1);
  const invincibleGame = testMatch();
  const invincibleCommands = attackBuffer(0);
  const invincibleTargetCommands = attackBuffer(0);
  runToAttackActive(invincibleGame, invincibleAttacker, invincibleTarget, attackerInput, targetInput, invincibleCommands, invincibleTargetCommands, 5, 1);
  assertEquals(invincibleTarget.grab.grabbedFrames, 0);
  const outTarget = createFighter(1, 50, -1);
  outTarget.status.out = true;
  const outAttacker = createFighter(0, 0, 1);
  const outGame = testMatch();
  const outCommands = attackBuffer(0);
  const outTargetCommands = attackBuffer(0);
  runToAttackActive(outGame, outAttacker, outTarget, attackerInput, targetInput, outCommands, outTargetCommands, 5, 1);
  assertEquals(outTarget.grab.grabbedFrames, 0);

});

test("a grab's release, by mashing or after the pummel, leaves the grabber no head start", () => {
  const characters = [Character.archer, Character.rifleman, Character.demonHunter, ...HERO_ROSTER.map((hero) => hero.character)];
  for (const character of characters) {
    for (const release of ["mash", "pummel"] as const) {
      const game = testMatch();
      const owner = createFighter(character, 0, 1);
      const target = createFighter(Character.rifleman, 50, -1);
      const ownerInput = neutralControls();
      const targetInput = neutralControls();
      const ownerCommands = attackBuffer(0);
      const targetCommands = attackBuffer(0);
      const step = (frame: number) => stepMatch(game, testRoster(owner, target), frameControls(ownerInput, targetInput, ownerCommands, targetCommands), frame);
      queueAttack(ownerCommands, { style: AttackStyle.grab, facing: 0, frame: 1, mayCharge: false });
      let frame = 1;
      for (; frame <= 30 && target.grab.owner === undefined; frame++) step(frame);
      const label = `${character} ${release}`;
      assertEquals(target.grab.owner, 0, label);
      for (let held = 1; held <= 120 && target.grab.owner !== undefined; held++, frame++) {
        ownerInput.attackPressed = release === "pummel" && held === 1;
        targetInput.grabMashPressed = release === "mash" && floorMod(held, 2) === 1;
        step(frame);
      }
      ownerInput.attackPressed = false;
      targetInput.grabMashPressed = false;
      assertEquals(target.grab.owner, undefined, label);
      let ownerFree: number | undefined;
      let targetFree: number | undefined;
      for (let after = 1; after <= 40 && (ownerFree === undefined || targetFree === undefined); after++, frame++) {
        if (ownerFree === undefined && canAttack(owner) && owner.grab.action === GrabAction.none) ownerFree = after;
        if (targetFree === undefined && canAttack(target)) targetFree = after;
        step(frame);
      }
      assertEquals(ownerFree !== undefined && targetFree !== undefined && ownerFree >= targetFree, true, `${label}: grabber acts after ${ownerFree}, victim after ${targetFree}`);
    }
  }
});
