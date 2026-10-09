import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { createFrameControls } from "../match/controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "../match/frameInput";
import { createPacingAndPresentation } from "../match/pacingAndPresentation";
import { Phase, createMatchState } from "../match/rules";
import { stateChecksum } from "../replay/canonical";
import { firstPoseDifference, firstStateDifference } from "../replay/difference";
import { ReplayHistory } from "../replay/history";
import { type ReplayState, captureReplaySnapshot, copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { AttackStyle, Character, DownState, GrabAction } from "../sim/codes";
import { beginFighterAttack } from "../sim/attacks";
import type { HeroPose } from "../sim/heroes/hero";
import { DOWN_ROLL_FRAMES, TECH_IN_PLACE_FRAMES, TECH_ROLL_FRAMES } from "../sim/down";
import { beginDownState } from "../sim/transitions";
import { HERO_ROSTER, SELECTABLE_CHARACTERS } from "../sim/heroes/registry";
import { contactDamageClip } from "./damagePose";
import { createFighter } from "../sim/fighter";
import { f32 } from "wisp/src/sim/f32";
import { characterClips, clipFor, grabActionPoses } from "./fighterClips";
import { attackStartupFrames, grabActionDuration, grabContactFrame } from "../sim/moves";
import { fighterAt, neutralControls } from "../sim/roster";
import { soloWorld, testWorld } from "../sim/testWorld";
import * as dh from "./demonHunterAssetInfo";
import { FRAME_SECONDS, advanceFighterPose, createFighterPose } from "./fighterPose";
import { DRAWN_STRIDES } from "./drawnStrideInfo";
import { groundLocomotionClip } from "./fighterLocomotion";
import { IllidanLocomotion, TRANSITION_FRAMES } from "./illidanMotion";

test("Lich King's stock forward smash holds and releases the same sword pose in both facings [repro #309]", () => {
  for (const facing of [-1, 1]) {
    const f = createFighter(Character.lichKing, 0.0, facing);
    const world = soloWorld(f), input = neutralControls(), pose = createFighterPose();
    beginFighterAttack(world, 0, AttackStyle.forwardSmash, false);
    const startup = attackStartupFrames(AttackStyle.forwardSmash, f.tuning.moves);
    for (let frame = 0; frame < startup - 1; frame++) {
      f.attack.frame = frame;
      advanceFighterPose(pose, f, world, input, false, false, frame === 0, false);
    }
    const selected = pose.selectionSerial;
    f.attack.frame = startup - 1;
    f.attack.smashCharging = true;
    advanceFighterPose(pose, f, world, input, false, false, false, false);
    assertEquals(pose.clipIndex, clipFor(Character.lichKing, "forwardSmash").index);
    assertEquals(pose.selectionSerial, selected);
    const held = pose.clipTime;
    for (let frame = 1; frame < 40; frame++) {
      f.attack.smashChargeFrames = frame;
      advanceFighterPose(pose, f, world, input, false, false, false, false);
      assertEquals(pose.clipTime, held);
    }
    f.attack.smashCharging = false;
    f.attack.frame = startup;
    advanceFighterPose(pose, f, world, input, false, false, false, false);
    assertEquals(pose.selectionSerial, selected);
    assertEquals(pose.clipIndex, clipFor(Character.lichKing, "forwardSmash").index);
    assertEquals(pose.clipTime, held);
    advanceFighterPose(pose, f, world, input, false, false, false, false);
    assertGreaterThan(pose.clipTime, held);
  }
});

test("every fighter walks and runs with foot cadence following ground speed [spec #171]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    for (const walking of [true, false]) {
      for (const facing of [-1, 1]) {
        const f = createFighter(character, 0.0, facing);
        const input = neutralControls();
        input.direction = facing;
        input.walking = walking;
        f.motion.vx = f32(facing * (walking ? f.tuning.physics.walkSpeed : f.tuning.physics.runSpeed));
        const pose = createFighterPose();
        advanceFighterPose(pose, f, soloWorld(f), input, false, false, false, false);
        const motion = walking ? IllidanLocomotion.walk : IllidanLocomotion.run;
        const stride = DRAWN_STRIDES[character]?.[walking ? "walk" : "run"];
        assertEquals(stride !== undefined, true, `${character}: stride was not measured`);
        if (stride === undefined) continue;
        assertEquals(pose.clipIndex, groundLocomotionClip(character, motion)?.index);
        assertEquals(pose.clipIndex, stride.clip);
        assertEquals(Math.abs(f32(stride.speed * pose.rate) - f32(Math.abs(f.motion.vx) * 60.0)) < f32(0.01), true, `${character}: foot cadence does not follow travel`);
        const firstTime = pose.clipTime;
        advanceFighterPose(pose, f, soloWorld(f), input, false, false, false, false);
        assertGreaterThan(pose.clipTime, firstTime);
      }
    }
  }
});

test("table fighters play authored transitions and distinct floor recovery clips for the complete action [spec #171]", () => {
  const recoveries: readonly [DownState, number, HeroPose, number][] = [
    [DownState.tech, 0, "tech", TECH_IN_PLACE_FRAMES],
    [DownState.techRoll, 1, "techForward", TECH_ROLL_FRAMES],
    [DownState.techRoll, -1, "techBackward", TECH_ROLL_FRAMES],
    [DownState.roll, 1, "getUpRollForward", DOWN_ROLL_FRAMES],
    [DownState.roll, -1, "getUpRollBackward", DOWN_ROLL_FRAMES],
  ];
  for (const character of SELECTABLE_CHARACTERS) {
    if (character === Character.demonHunter) continue;
    const table = characterClips(character);
    for (const [state, direction, key, frames] of recoveries) {
      const clip = table[key];
      assertEquals(clip !== undefined, true, `${character}/${key}: missing recovery clip`);
      if (clip === undefined) continue;
      const f = createFighter(character, 0.0, 1);
      beginDownState(f, state, direction);
      const pose = createFighterPose();
      advanceFighterPose(pose, f, soloWorld(f), neutralControls(), false, false, false, false);
      assertEquals(pose.clipIndex, clip.index);
      assertEquals(pose.rate, f32(clip.seconds / f32(frames * FRAME_SECONDS)));
    }
    const f = createFighter(character, 0.0, 1);
    f.jump.squat = f.tuning.physics.jumpSquatFrames;
    const pose = createFighterPose();
    advanceFighterPose(pose, f, soloWorld(f), neutralControls(), false, false, false, false);
    assertEquals(pose.clipIndex, table.jumpSquat?.index);
    assertEquals(table.jumpSquat !== undefined, true, `${character}: missing jump squat`);
    f.jump.squat = 0;
    for (const [motion, key] of [[IllidanLocomotion.turn, "turn"], [IllidanLocomotion.stop, "stop"]] as const) {
      pose.motion.motion = motion;
      pose.motion.transitionRemaining = TRANSITION_FRAMES;
      pose.motion.previousFacing = 1;
      advanceFighterPose(pose, f, soloWorld(f), neutralControls(), false, false, false, false);
      assertEquals(pose.clipIndex, table[key]?.index);
      assertEquals(table[key] !== undefined, true, `${character}: missing ${key}`);
    }
  }
});

test("replaying rows from a restored frame reproduces each pose's selection and clock [invariant]", () => {
  for (const character of [Character.rifleman, Character.demonHunter]) {
    const game = createMatchState();
    game.phase = Phase.match;
    game.timeLimitMinutes = 0;
    const live: ReplayState = {
      world: testWorld(createFighter(character, -200.0, 1), createFighter(Character.rifleman, 200.0, -1)),
      match: game, controls: createFrameControls(), runtime: createPacingAndPresentation(),
    };
    const captured = createFrameControls();
    const row = createMatchFrameInput();
    const history = new ReplayHistory();
    const expected = createReplaySnapshot();
    const actual = createReplaySnapshot();
    assertTrue(history.beginEpoch(1, 1));
    for (let frame = 1; frame <= 24; frame++) {
      const input = captured.inputs[0];
      input.direction = frame < 12 ? 1 : -1;
      input.jumpPressed = frame === 4 || frame === 15;
      input.jumpHeld = frame < 10;
      assertTrue(captureFrame(row, frame, 3, captured, live.runtime));
      assertTrue(history.save(1, row, live));
      assertTrue(executeMatchFrame(row, game, live.world, live.controls, live.runtime, frame));
    }
    copyReplayState(expected, live);
    assertTrue(history.replay(1, 8, 24, live));
    copyReplayState(actual, live);
    assertEquals(firstStateDifference(expected, actual), undefined);
    assertEquals(firstPoseDifference(expected, actual), undefined);
    const gameplayChecksum = stateChecksum(actual);
    actual.runtime.poses[0].clipTime += 1.0;
    assertEquals(firstPoseDifference(expected, actual), "pose[0].clipTime");
    assertEquals(stateChecksum(actual), gameplayChecksum);
  }
});

test("hitstun holds the contact pose and a repeated hit restarts it [spec #181]", () => {
  for (const character of [Character.rifleman, Character.demonHunter]) {
    const f = createFighter(character, 0.0, 1);
    const world = soloWorld(f);
    const input = neutralControls();
    const pose = createFighterPose();
    f.launch.hitstun = 20;
    f.launch.hitlag = 5;
    advanceFighterPose(pose, f, world, input, false, false, false, true);
    const selected = pose.selectionSerial;
    assertEquals(pose.clipTime, 0.0);
    assertEquals(pose.rate, 0.0);
    for (let frame = 1; frame <= 4; frame++) {
      advanceFighterPose(pose, f, world, input, false, false, false, false);
      assertEquals(pose.selectionSerial, selected);
      assertEquals(pose.clipTime, 0.0);
    }
    f.launch.hitlag = 0;
    advanceFighterPose(pose, f, world, input, false, false, false, false);
    assertEquals(pose.selectionSerial, selected);
    advanceFighterPose(pose, f, world, input, false, false, false, false);
    assertEquals(pose.clipTime, 0.0);
    f.launch.hitlag = 3;
    advanceFighterPose(pose, f, world, input, false, false, false, true);
    assertEquals(pose.selectionSerial, selected + 1);
    assertEquals(pose.clipTime, 0.0);
    f.status.frozenFrames = 10;
    advanceFighterPose(pose, f, world, input, false, false, false, false);
    assertEquals(pose.clipTime, 0.0);
    assertEquals(pose.rate, 0.0);
  }
});

test("contact reactions interrupt an attack, hold through airborne hitstun and recover after release [spec #181]", () => {
  for (const character of SELECTABLE_CHARACTERS) for (const facing of [-1, 1]) {
    for (let height = 0; height < 3; height++) for (let strength = 0; strength < 3; strength++) {
      const f = createFighter(character, 0.0, facing);
      const world = soloWorld(f), input = neutralControls(), pose = createFighterPose();
      beginFighterAttack(world, 0, AttackStyle.forwardTilt, false);
      f.attack.frame = 3;
      advanceFighterPose(pose, f, world, input, false, false, true, false);
      const interrupted = pose.clipIndex;
      f.attack.style = undefined;
      f.visuals.hitHeight = height;
      f.visuals.hitStrength = strength;
      f.launch.hitstun = 40;
      f.launch.hitlag = 7;
      f.launch.sdiWasGrounded = true;
      f.down.state = DownState.tumble;
      advanceFighterPose(pose, f, world, input, false, false, false, true);
      assertEquals(pose.clipIndex, contactDamageClip(f).index);
      assertTrue(pose.clipIndex !== interrupted);
      assertEquals(pose.clipTime, 0.0);
      const serial = pose.selectionSerial;
      for (let held = 0; held < 7; held++) {
        advanceFighterPose(pose, f, world, input, false, false, false, false);
        assertEquals(pose.clipTime, 0.0);
        assertEquals(pose.selectionSerial, serial);
      }
      f.launch.hitlag = 0;
      f.motion.grounded = false;
      advanceFighterPose(pose, f, world, input, false, false, false, false);
      assertEquals(pose.clipIndex, contactDamageClip(f).index);
      assertEquals(pose.clipTime, 0.0);
      assertEquals(pose.rate, 0.0);
      for (let held = 0; held < 40; held++) {
        advanceFighterPose(pose, f, world, input, false, false, false, false);
        assertEquals(pose.clipIndex, contactDamageClip(f).index);
        assertEquals(pose.clipTime, 0.0);
      }
      assertEquals(f.launch.hitstun, 40);
      f.launch.hitstun = 0;
      advanceFighterPose(pose, f, world, input, false, false, false, false);
      assertTrue(pose.clipIndex !== contactDamageClip(f).index);
    }
  }
});

test("a snapshot's pose escapes from its own copy of the previous holder [invariant]", () => {
  const first = createFighter(Character.demonHunter, 0.0, 1);
  const second = createFighter(Character.rifleman, 50.0, -1);
  const world = testWorld(first, second);
  const game = createMatchState();
  const controls = createFrameControls();
  const runtime = createPacingAndPresentation();
  const input = neutralControls();
  const snapshot = createReplaySnapshot();
  first.grab.owner = 1;
  advanceFighterPose(runtime.poses[0], first, world, input, false, false, false, false);
  captureReplaySnapshot(snapshot, world, game, controls, runtime);

  second.grab.action = GrabAction.throwForward;
  const victim = fighterAt(snapshot.world, 0);
  victim.grab.owner = undefined;
  victim.launch.hitstun = 10;
  fighterAt(snapshot.world, 1).grab.action = GrabAction.escape;
  const pose = snapshot.runtime.poses[0];
  advanceFighterPose(pose, victim, snapshot.world, input, false, false, false, false);
  assertEquals(pose.clipIndex, dh.DEMON_HUNTER_GRAB_ESCAPE_INDEX);
  assertEquals(pose.motion.escapeRemaining, 10);
});

test("paired hero throws reach contact on the actual holder's frame across every roster pairing [spec docs/design/animation-reference.md]", () => {
  for (const character of SELECTABLE_CHARACTERS) for (const hero of HERO_ROSTER) for (const facing of [-1, 1]) {
    const owner = createFighter(character, 0.0, facing);
    const victim = createFighter(hero.character, 50.0, -facing);
    const world = testWorld(owner, victim);
    owner.grab.target = 1;
    victim.grab.owner = 0;
    victim.grab.grabbedFrames = 120;
    for (const action of [GrabAction.pummel, GrabAction.throwForward, GrabAction.throwBack, GrabAction.throwUp, GrabAction.throwDown]) {
      owner.grab.action = action;
      owner.grab.serial++;
      const poses = grabActionPoses(action);
      assertTrue(poses !== undefined);
      if (poses === undefined) continue;
      const clip = clipFor(hero.character, poses.victim);
      assertEquals(clip.contact, f32(0.5));
      const pose = createFighterPose();
      owner.grab.frame = grabContactFrame(action, owner.tuning.moves) - 1;
      advanceFighterPose(pose, victim, world, neutralControls(), false, false, false, false);
      assertTrue(pose.clipTime < f32(0.5));
      owner.grab.frame++;
      advanceFighterPose(pose, victim, world, neutralControls(), false, false, false, false);
      assertEquals(pose.clipIndex, clip.index);
      assertEquals(pose.clipTime, f32(0.5));

      owner.launch.hitlag = 3;
      advanceFighterPose(pose, victim, world, neutralControls(), false, false, false, false);
      assertEquals(pose.rate, 0.0);
      assertEquals(pose.clipTime, f32(0.5));
      owner.launch.hitlag = 0;
      owner.grab.frame = grabActionDuration(action, owner.tuning.moves);
      advanceFighterPose(pose, victim, world, neutralControls(), false, false, false, false);
      assertTrue(Math.abs(pose.clipTime - clip.seconds) < f32(0.00001));
    }
  }
});

test("a hero holder's contact gesture also freezes when only the held fighter stops [spec docs/design/animation-reference.md]", () => {
  const owner = createFighter(Character.forsakenPaladin, 0.0, 1), victim = createFighter(Character.mountainKing, 50.0, -1);
  const world = testWorld(owner, victim), pose = createFighterPose();
  owner.grab.target = 1;
  owner.grab.action = GrabAction.throwUp;
  owner.grab.frame = grabContactFrame(owner.grab.action, owner.tuning.moves);
  victim.grab.owner = 0;
  victim.grab.grabbedFrames = 120;
  victim.launch.hitlag = 4;
  advanceFighterPose(pose, owner, world, neutralControls(), false, false, false, false);
  assertEquals(pose.clipTime, clipFor(Character.forsakenPaladin, "throwUp").contact);
  assertEquals(pose.rate, 0.0);
});
