import { mutableProjectile } from "../sim/fighterProjectiles";


import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { type AttackBuffer, attackBuffer, clearAttackBuffer, hasPendingAttack, queueAttack } from "../input/attackBuffer";
import type { FrameControls } from "../match/controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "../match/frameInput";
import { type PacingAndPresentation, createPacingAndPresentation } from "../match/pacingAndPresentation";
import { type MatchState, Phase, createMatchState } from "../match/rules";
import { stepMatch } from "../match/step";
import { resolveAttacks } from "../sim/attacks";
import { AttackStyle, Character, GroundAction, ProjectileKind, ShieldBreak } from "../sim/codes";
import { type Fighter, WALL_TECH_JUMP_INPUT_WINDOW_FRAMES, createFighter } from "../sim/fighter";
import { attackStartupFrames } from "../sim/moves";
import { spawnProjectileMotion, updateProjectiles } from "../sim/projectiles";
import { setMeleeKnockback, setMeleeRecoil } from "../sim/motion";
import { advanceFighter } from "../sim/step";
import { fighterAt, neutralControls } from "../sim/roster";
import { testWorld } from "../sim/testWorld";
import {
  AUTHORED_GROUND_MOVEMENT_RULES,
  AUTHORED_SHIELD_BREAK_TIMING,
  AUTHORED_TECH_TIMING,
  type FighterPhysics,
  NTSC_CAPTAIN_FALCON_DASH_GRAB_RULES,
  NTSC_CAPTAIN_FALCON_GROUND_MOVEMENT_RULES,
  NTSC_FOX_DASH_GRAB_RULES,
  authoredPhysics,
} from "../sim/tuning";
import { stateChecksum } from "./canonical";
import { firstStateDifference } from "./difference";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "./snapshot";

function frameControls(firstCommands: AttackBuffer, secondCommands: AttackBuffer, first = neutralControls(), second = neutralControls()): FrameControls {
  return { inputs: [first, second, neutralControls(), neutralControls()], commands: [firstCommands, secondCommands, attackBuffer(0), attackBuffer(0)] };
}


function liveState(first: Fighter, second: Fighter, match: MatchState, controls: FrameControls, runtime: PacingAndPresentation): ReplayState {
  return { world: testWorld(first, second), match, controls, runtime };
}

test("rollback retains original launch and recoil across world rounding [k1 scenario]", () => {
  const live = createReplaySnapshot();
  const snapshot = createReplaySnapshot();
  const after = createReplaySnapshot();
  const fighter = fighterAt(live.world, 0);
  fighter.motion.grounded = false;
  fighter.motion.z = 300.0;
  fighter.tuning.physics = { ...fighter.tuning.physics, gravity: 0.0 };
  fighter.launch.hitstun = 5;
  setMeleeKnockback(fighter, 0.050999965518713, 0.00005743650399381295);
  setMeleeRecoil(fighter, 0.049999967217445374, 0.00005676596629200503);
  const beforeChecksum = stateChecksum(live);
  copyReplayState(snapshot, live);

  advanceFighter(live.world, 0, 0, neutralControls(), 0.0);
  copyReplayState(after, live);
  copyReplayState(live, snapshot);
  assertEquals(stateChecksum(live), beforeChecksum);
  assertEquals(firstStateDifference(snapshot, live), undefined);
  advanceFighter(live.world, 0, 0, neutralControls(), 0.0);
  assertEquals(firstStateDifference(after, live), undefined);
  assertEquals(stateChecksum(live), stateChecksum(after));

  copyReplayState(live, snapshot);
  fighter.launch.meleeKnockbackZ.original = 0.000057436507631791756;
  assertEquals(firstStateDifference(snapshot, live), "fighter[0].motionKnockbackZ");
  assertTrue(stateChecksum(live) !== beforeChecksum);
  copyReplayState(live, snapshot);
  fighter.shield.meleeRecoilZ.original = 0.000056765962654026225;
  assertEquals(firstStateDifference(snapshot, live), "fighter[0].motionRecoilZ");
  assertTrue(stateChecksum(live) !== beforeChecksum);
});

function projectile(fighter: Fighter, index: number) {
  const value = mutableProjectile(fighter, index);
  if (value === undefined) throw new Error(`no projectile ${index}`);
  return value;
}

test("captured projectiles survive expiry, slot reuse and rollback [k1 scenario]", () => {
  const live = createReplaySnapshot();
  const saved = createReplaySnapshot();
  const owner = fighterAt(live.world, 0);
  fighterAt(live.world, 1).motion.x = 2000.0;
  spawnProjectileMotion(owner, ProjectileKind.blaster, 8.0, 0.0, 1, 11);
  copyReplayState(saved, live);
  const savedChecksum = stateChecksum(saved);
  updateProjectiles(live.world);
  const expiredChecksum = stateChecksum(live);
  spawnProjectileMotion(owner, ProjectileKind.blaster, -12.0, 0.0, 20, 12);
  assertEquals(stateChecksum(saved), savedChecksum);
  copyReplayState(live, saved);
  updateProjectiles(live.world);
  assertEquals(stateChecksum(live), expiredChecksum);
  assertEquals(stateChecksum(saved), savedChecksum);
});

test("capture and restore include combat references, projectiles and queued input [k1 scenario]", () => {
  const first = createFighter(Character.rifleman, -90.0, 1);
  const second = createFighter(Character.rifleman, 90.0, -1);
  const match = createMatchState();
  const firstCommands = attackBuffer(4);
  const secondCommands = attackBuffer(4);
  const runtime = createPacingAndPresentation();
  const live = liveState(first, second, match, frameControls(firstCommands, secondCommands), runtime);
  const snapshot = createReplaySnapshot();
  const actual = createReplaySnapshot();
  let arrow = projectile(first, 3);

  first.motion.x = -123.5;
  first.motion.deltaX = 0.125;
  first.motion.deltaZ = -0.25;
  first.status.damage = 47.0;
  first.visuals.hit = 7;
  first.visuals.hitElectric = true;
  first.visuals.shield = 3;
  first.tuning.tech = { ceilingImpulseFrame: 11, ceilingAnimationEndFrame: 29, wallAnimationEndFrame: 27, wallJumpAnimationEndFrame: 41 };
  first.tuning.ground = NTSC_CAPTAIN_FALCON_GROUND_MOVEMENT_RULES;
  first.ground.action = GroundAction.turnRun;
  first.ground.actionFrame = 8;
  first.ground.runBrakeFramesRemaining = 12;
  first.ground.turnRunEntryFacing = 1;
  first.ground.turnRunFacingCommandLatched = true;
  first.ground.turnRunPausePending = true;
  first.ground.pivotEligible = true;
  first.ground.pivotGraceFrames = 3;
  first.ground.pivotDashFrame = 2;
  first.ground.pivotDashActionFrame = 2;
  first.launch.hitlag = 3;
  first.shield.breakState = ShieldBreak.dizzy;
  first.shield.breakRemaining = 389.75;
  first.tuning.shieldBreak = { landFrames: 26, standFrames: 31 };
  first.motion.crouching = true;
  first.motion.fastFalling = true;
  first.dodge.groundEntryFacing = -1;
  first.jump.dodgeQueued = true;
  first.jump.dodgeX = -1;
  first.jump.dodgeZ = 1;
  first.jump.inputAge = 7;
  first.surfaceRecovery.wallJumpQueued = true;
  first.tech.window = 11;
  first.tech.pressAge = 9;
  first.tech.previousPressAge = 43;
  first.tech.accumulatedPress = true;
  arrow.life = 27;
  arrow.x = -44.25;
  arrow.z = 81.5;
  arrow.direction = -1;
  first.shield.pushbackX = f32(2.73600035905838);
  first.shield.recoilX = f32(-1.8);
  first.shield.recoilZ = f32(2.4);
  first.shield.drainResumePending = true;
  first.hits.lastAttacker = 1;
  first.hits.lastAttackSerial = 19;
  first.hits.lastWindow = 2;
  match.phase = Phase.match;
  match.remainingFrames = 91;
  match.winner = 1;
  runtime.simulationFrame = 38;
  runtime.botAttackDelays[1] = f32(0.17);
  queueAttack(firstCommands, { style: 4, facing: -1, frame: 38, mayCharge: true });
  queueAttack(secondCommands, { style: 6, facing: 1, frame: 40, mayCharge: false });

  copyReplayState(snapshot, live);

  first.motion.x = 700.0;
  first.motion.deltaX = 0.0;
  first.motion.deltaZ = 0.0;
  first.status.damage = 0.0;
  first.launch.hitlag = 0;
  first.visuals.hit = 0;
  first.visuals.hitElectric = false;
  first.visuals.shield = 0;
  first.tuning.tech = AUTHORED_TECH_TIMING;
  first.tuning.ground = AUTHORED_GROUND_MOVEMENT_RULES;
  first.ground.action = GroundAction.none;
  first.ground.actionFrame = 0;
  first.ground.runBrakeFramesRemaining = 0;
  first.ground.turnRunEntryFacing = 0;
  first.ground.turnRunFacingCommandLatched = false;
  first.ground.turnRunPausePending = false;
  first.ground.pivotEligible = false;
  first.ground.pivotGraceFrames = 0;
  first.ground.pivotDashFrame = 0;
  first.ground.pivotDashActionFrame = 0;
  first.shield.breakState = ShieldBreak.none;
  first.shield.breakRemaining = 0.0;
  first.tuning.shieldBreak = AUTHORED_SHIELD_BREAK_TIMING;
  first.motion.crouching = false;
  first.motion.fastFalling = false;
  first.dodge.groundEntryFacing = 0;
  first.jump.dodgeQueued = false;
  first.jump.dodgeX = 0;
  first.jump.dodgeZ = 0;
  first.jump.inputAge = WALL_TECH_JUMP_INPUT_WINDOW_FRAMES;
  first.surfaceRecovery.wallJumpQueued = false;
  first.tech.window = 0;
  first.tech.pressAge = 255;
  first.tech.previousPressAge = 255;
  first.tech.accumulatedPress = false;
  arrow = projectile(first, 3);
  arrow.life = 0;
  arrow.x = 0.0;
  arrow.z = 0.0;
  arrow.direction = 0;
  first.shield.pushbackX = 0.0;
  first.shield.recoilX = 0.0;
  first.shield.recoilZ = 0.0;
  first.shield.drainResumePending = false;
  first.hits.lastAttacker = undefined;
  first.hits.lastAttackSerial = undefined;
  match.phase = Phase.result;
  match.remainingFrames = 0;
  match.winner = undefined;
  runtime.simulationFrame = 0;
  runtime.botAttackDelays[1] = 0.0;
  clearAttackBuffer(firstCommands);
  clearAttackBuffer(secondCommands);

  copyReplayState(live, snapshot);

  assertEquals(first.motion.x, -123.5);
  assertEquals(first.motion.deltaX, 0.125);
  assertEquals(first.motion.deltaZ, -0.25);
  assertEquals(first.status.damage, 47.0);
  assertEquals(first.launch.hitlag, 3);
  assertEquals(first.visuals.hit, 7);
  assertTrue(first.visuals.hitElectric);
  assertEquals(first.visuals.shield, 3);
  assertEquals(first.tuning.tech.ceilingImpulseFrame, 11);
  assertEquals(first.tuning.tech.ceilingAnimationEndFrame, 29);
  assertEquals(first.tuning.tech.wallAnimationEndFrame, 27);
  assertEquals(first.tuning.tech.wallJumpAnimationEndFrame, 41);
  assertEquals(first.tuning.ground.dashRunEnableFrame, 16);
  assertEquals(first.tuning.ground.turnRunFacingCommandFrame, 9);
  assertEquals(first.tuning.ground.turnRunAnimationEndFrame, 22);
  assertEquals(first.tuning.ground.runBrakeTurnCommandEndFrame, 15);
  assertEquals(first.tuning.ground.runBrakeAnimationEndFrame, 28);
  assertEquals(first.tuning.ground.runBrakeMaximumFrames, 30);
  assertEquals(first.ground.action, GroundAction.turnRun);
  assertEquals(first.ground.actionFrame, 8);
  assertEquals(first.ground.runBrakeFramesRemaining, 12);
  assertEquals(first.ground.turnRunEntryFacing, 1);
  assertTrue(first.ground.turnRunFacingCommandLatched);
  assertTrue(first.ground.turnRunPausePending);
  assertTrue(first.ground.pivotEligible);
  assertEquals(first.ground.pivotGraceFrames, 3);
  assertEquals(first.ground.pivotDashFrame, 2);
  assertEquals(first.ground.pivotDashActionFrame, 2);
  assertEquals(first.shield.breakState, ShieldBreak.dizzy);
  assertEquals(first.shield.breakRemaining, 389.75);
  assertEquals(first.tuning.shieldBreak.landFrames, 26);
  assertEquals(first.tuning.shieldBreak.standFrames, 31);
  assertTrue(first.motion.crouching);
  assertTrue(first.motion.fastFalling);
  assertEquals(first.dodge.groundEntryFacing, -1);
  assertTrue(first.jump.dodgeQueued);
  assertEquals(first.jump.dodgeX, -1);
  assertEquals(first.jump.dodgeZ, 1);
  assertEquals(first.jump.inputAge, 7);
  assertTrue(first.surfaceRecovery.wallJumpQueued);
  assertEquals(first.tech.pressAge, 9);
  assertEquals(first.tech.previousPressAge, 43);
  assertTrue(first.tech.accumulatedPress);
  const differenceAfter = (change: () => void, undo: () => void): string | undefined => {
    change();
    copyReplayState(actual, live);
    undo();
    return firstStateDifference(snapshot, actual);
  };
  copyReplayState(actual, live);
  assertEquals(firstStateDifference(snapshot, actual), undefined);
  assertEquals(differenceAfter(() => { first.tech.pressAge = 10; }, () => { first.tech.pressAge = 9; }), "fighter[0].techPressAge");
  assertEquals(differenceAfter(() => { first.tech.previousPressAge = 44; }, () => { first.tech.previousPressAge = 43; }), "fighter[0].techPreviousPressAge");
  assertEquals(differenceAfter(() => { first.tech.accumulatedPress = false; }, () => { first.tech.accumulatedPress = true; }), "fighter[0].techAccumulatedPress");
  assertEquals(differenceAfter(() => { first.surfaceRecovery.wallJumpQueued = false; }, () => { first.surfaceRecovery.wallJumpQueued = true; }), "fighter[0].surfaceWallJumpQueued");
  assertEquals(differenceAfter(() => { first.jump.inputAge = 8; }, () => { first.jump.inputAge = 7; }), "fighter[0].jumpInputAge");
  assertEquals(first.tech.window, 11);
  arrow = projectile(first, 3);
  assertEquals(arrow.life, 27);
  assertEquals(arrow.x, -44.25);
  assertEquals(arrow.z, 81.5);
  assertEquals(arrow.direction, -1);
  assertEquals(first.shield.pushbackX, f32(2.73600035905838));
  assertEquals(first.shield.recoilX, f32(-1.8));
  assertEquals(first.shield.recoilZ, f32(2.4));
  assertTrue(first.shield.drainResumePending);
  assertEquals(first.hits.lastAttacker, 1);
  assertEquals(first.hits.lastAttackSerial, 19);
  assertEquals(first.hits.lastWindow, 2);
  assertEquals(match.phase, Phase.match);
  assertEquals(match.remainingFrames, 91);
  assertEquals(match.winner, 1);
  assertEquals(runtime.simulationFrame, 38);
  assertEquals(runtime.botAttackDelays[1], f32(0.17));
  assertTrue(hasPendingAttack(firstCommands, 38));
  assertTrue(hasPendingAttack(secondCommands, 40));
});

test("restore and replay reproduce movement and the match clock [k1 scenario]", () => {
  const first = createFighter(Character.rifleman, -30.0, 1);
  const second = createFighter(Character.rifleman, 30.0, -1);
  const match = createMatchState();
  const firstInput = neutralControls();
  const secondInput = neutralControls();
  const controls = frameControls(attackBuffer(0), attackBuffer(0), firstInput, secondInput);
  const live = liveState(first, second, match, controls, createPacingAndPresentation());
  const snapshot = createReplaySnapshot();
  match.phase = Phase.match;
  copyReplayState(snapshot, live);
  const run = () => {
    firstInput.direction = 1;
    secondInput.direction = -1;
    firstInput.jumpHeld = true;
    for (let frame = 0; frame <= 47; frame++) {
      firstInput.jumpPressed = frame === 0;
      stepMatch(match, live.world, controls, frame);
    }
  };
  run();
  const expected = createReplaySnapshot();
  copyReplayState(expected, live);
  copyReplayState(live, snapshot);
  run();
  const replayed = createReplaySnapshot();
  copyReplayState(replayed, live);
  assertGreaterThan(first.motion.x, -30.0);
  assertEquals(firstStateDifference(expected, replayed), undefined);
});

test("restoring into other fighters keeps the contact registry by slot [k1 scenario]", () => {
  const first = createFighter(Character.rifleman, 0.0, 1);
  const second = createFighter(Character.rifleman, 100.0, -1);
  const match = createMatchState();
  const commands = attackBuffer(0);
  const controls = frameControls(commands, attackBuffer(0));
  const runtime = createPacingAndPresentation();
  const snapshot = createReplaySnapshot();
  match.phase = Phase.match;
  queueAttack(commands, { style: AttackStyle.jab, facing: 0, frame: 1, mayCharge: false });
  for (let frame = 1; frame <= attackStartupFrames(AttackStyle.jab) + 1; frame++) stepMatch(match, testWorld(first, second), controls, frame);
  assertGreaterThan(second.status.damage, 0.0);
  assertEquals(second.hits.lastAttacker, 0);
  copyReplayState(snapshot, liveState(first, second, match, controls, runtime));
  const replayFirst = createFighter(Character.rifleman, 0.0, 1);
  const replaySecond = createFighter(Character.rifleman, 0.0, -1);
  const replay = liveState(replayFirst, replaySecond, match, controls, runtime);
  copyReplayState(replay, snapshot);
  assertEquals(replaySecond.hits.lastAttacker, 0);
  const damage = replaySecond.status.damage;

  resolveAttacks(replay.world);
  assertEquals(replaySecond.status.damage, damage);
  first.status.damage = 999.0;
  projectile(second, 0).life = 999;
  copyReplayState(replay, snapshot);
  assertEquals(replayFirst.status.damage, 0.0);
  assertEquals(projectile(replaySecond, 0).life, 0);
});

test("recorded rows replay an attack against a shield from independently restored fighters [k1 scenario]", () => {
  const game = createMatchState();
  game.phase = Phase.match;
  const first = createFighter(Character.rifleman, 0.0, 1);
  const second = createFighter(Character.rifleman, 100.0, -1);
  const firstInput = neutralControls();
  const secondInput = neutralControls();
  const firstRequests = attackBuffer(0);
  const secondRequests = attackBuffer(0);
  const produced = frameControls(firstRequests, secondRequests, firstInput, secondInput);
  const live = liveState(first, second, game, frameControls(attackBuffer(0), attackBuffer(0)), createPacingAndPresentation());
  const before = createReplaySnapshot();
  const rows = Array.from({ length: 16 }, () => createMatchFrameInput());
  copyReplayState(before, live);
  const rowAt = (frame: number) => {
    const row = rows[frame - 1];
    if (row === undefined) throw new Error(`no row for frame ${frame}`);
    return row;
  };
  const execute = (state: ReplayState, frame: number) => {
    assertTrue(executeMatchFrame(rowAt(frame), state.match, state.world, state.controls, state.runtime, frame));
  };

  secondInput.shield = true;
  let maximumShieldStun = 0;
  for (let frame = 1; frame <= 16; frame++) {
    const row = rowAt(frame);
    if (frame === 1) queueAttack(firstRequests, { style: AttackStyle.jab, facing: 0, frame: 1, mayCharge: false });
    assertTrue(captureFrame(row, frame, 3, produced, live.runtime));
    clearAttackBuffer(firstRequests);
    clearAttackBuffer(secondRequests);
    if (frame === 1) {

      firstInput.shield = true;
      assertFalse(captureFrame(row, frame, 3, produced, live.runtime));
      firstInput.shield = false;
    }
    execute(live, frame);
    maximumShieldStun = Math.max(maximumShieldStun, second.shield.stun);
  }
  assertEquals(first.attack.serial, 1);
  assertEquals(second.status.damage, 0.0);
  assertGreaterThan(maximumShieldStun, 0);
  assertLessThan(second.shield.energy, 60.0);

  const recoveredGame = createMatchState();
  recoveredGame.phase = Phase.result;
  const recoveredFirst = createFighter(Character.rifleman, 800.0, 1);
  const recoveredSecond = createFighter(Character.rifleman, -800.0, -1);
  const recovered = liveState(recoveredFirst, recoveredSecond, recoveredGame, frameControls(attackBuffer(3), attackBuffer(3)), createPacingAndPresentation());
  copyReplayState(recovered, before);
  let replayMaximumShieldStun = 0;
  for (let frame = 1; frame <= 16; frame++) {
    execute(recovered, frame);
    replayMaximumShieldStun = Math.max(replayMaximumShieldStun, recoveredSecond.shield.stun);
  }
  assertEquals(recoveredFirst.attack.serial, 1);
  assertEquals(recoveredSecond.status.damage, 0.0);
  assertEquals(replayMaximumShieldStun, maximumShieldStun);
  assertEquals(recoveredSecond.shield.energy, second.shield.energy);
  assertEquals(recoveredFirst.attack.frame, first.attack.frame);
  assertEquals(recoveredFirst.motion.x, first.motion.x);
  assertEquals(recoveredSecond.motion.x, second.motion.x);
  assertEquals(recoveredGame.remainingFrames, game.remainingFrames);
});

test("every physics parameter survives capture and restore and participates in equality [k2 property]", () => {
  const first = createFighter(Character.rifleman, 0.0, 1);
  const second = createFighter(Character.rifleman, 100.0, -1);
  const live = liveState(first, second, createMatchState(), frameControls(attackBuffer(0), attackBuffer(0)), createPacingAndPresentation());
  const expected = createReplaySnapshot();
  const actual = createReplaySnapshot();

  const assigned: FighterPhysics = {
    weight: 101.0, gravity: 2.0, terminalSpeed: 17.0, fastFallSpeed: 23.0, airAcceleration: f32(0.7), airSpeed: 6.0,
    airFriction: f32(0.3), airCap: 25.0, traction: f32(0.9), dashSpeed: 13.0, runSpeed: 15.0, walkSpeed: 8.0, jumpSquatFrames: 7,
    fullJumpSpeed: 26.0, shortJumpSpeed: 14.0, aerialJumpSpeed: 29.0, jumpMomentum: f32(0.6), jumpHorizontalSpeed: 5.0,
    jumpHorizontalCap: 12.0, aerialJumpHorizontalSpeed: 7.0, shieldBreakSpeed: 21.0, walkAccelerationMultiplier: f32(0.17),
    walkAccelerationBase: f32(0.08), groundAccelerationMultiplier: f32(0.11), groundAccelerationBase: f32(0.03), groundSpeedCap: 28.0,
  };
  first.tuning.physics = assigned;
  copyReplayState(expected, live);
  first.tuning.physics = authoredPhysics(Character.demonHunter);
  copyReplayState(live, expected);
  const keys = Object.keys(assigned) as (keyof FighterPhysics)[];
  assertEquals(keys.length, 26);
  for (const key of keys) assertEquals(first.tuning.physics[key], assigned[key], key);
  copyReplayState(actual, live);
  assertEquals(firstStateDifference(expected, actual), undefined);
  const fighter = fighterAt(actual.world, 0);
  for (const key of keys) {
    fighter.tuning.physics = { ...assigned, [key]: assigned[key] + 1 };
    assertEquals(firstStateDifference(expected, actual), "fighter[0].physics", key);
  }
  fighter.tuning.physics = assigned;
  assertEquals(firstStateDifference(expected, actual), undefined);
});
