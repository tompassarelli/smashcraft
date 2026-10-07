import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { createFrameControls } from "../match/controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "../match/frameInput";
import { createPacingAndPresentation } from "../match/pacingAndPresentation";
import { Phase, createMatchState } from "../match/rules";
import { stateChecksum } from "../replay/canonical";
import { firstPoseDifference, firstStateDifference } from "../replay/difference";
import { ReplayHistory } from "../replay/history";
import { type ReplayState, captureReplaySnapshot, copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { AttackStyle, Character, DownState, GrabAction, PlatformMove, SpecialAction, SurfaceContact } from "../sim/codes";
import { beginFighterAttack } from "../sim/attacks";
import type { HeroPose } from "../sim/heroes/hero";
import { DOWN_ROLL_FRAMES, TECH_IN_PLACE_FRAMES, TECH_ROLL_FRAMES } from "../sim/down";
import { beginDownState } from "../sim/transitions";
import { HERO_ROSTER, SELECTABLE_CHARACTERS } from "../sim/heroes/registry";
import { contactDamageClip } from "./damagePose";
import { FOLLOW_UP_FORM, SpecialForm } from "../sim/heroSpecials";
import { type Fighter, createFighter } from "../sim/fighter";
import { surfaceLeft, surfaceRight, surfaceZ } from "../sim/stage";
import { advanceFighter } from "../sim/step";
import { bodyTop } from "../sim/surfaces";
import { melee } from "../sim/tuning";
import { f32 } from "wisp/src/sim/f32";
import * as assets from "./fighterAssetInfo";
import { characterClips, platformClip, specialClip } from "./fighterClips";
import { attackDurationFramesForGrounding } from "../sim/moves";
import { type Controls, fighterAt, neutralControls } from "../sim/roster";
import { soloWorld, testWorld } from "../sim/testWorld";
import * as dh from "./demonHunterAssetInfo";
import { FRAME_SECONDS, advanceFighterPose, createFighterPose } from "./fighterPose";
import { DRAWN_STRIDES } from "./drawnStrideInfo";
import { groundLocomotionClip } from "./fighterLocomotion";
import { IllidanLocomotion, TRANSITION_FRAMES } from "./illidanMotion";

test("every fighter walks and runs with foot cadence following ground speed", () => {
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

test("table fighters play authored transitions and distinct floor recovery clips for the complete action", () => {
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

test("replaying rows from a restored frame reproduces each pose's selection and clock", () => {
  for (const character of [Character.archer, Character.rifleman, Character.demonHunter]) {
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

test("hitlag freezes the reaction clip and a repeated hit restarts it", () => {
  for (const character of [Character.archer, Character.rifleman, Character.demonHunter]) {
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
    assertGreaterThan(pose.clipTime, 0.0);
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

test("all 117 contact reactions interrupt the current attack on contact and hold throughout hitlag", () => {
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
      assertEquals(pose.animation, "damage3");
      assertTrue(pose.clipIndex !== contactDamageClip(f).index);
      assertEquals(f.launch.hitstun, 40);
    }
  }
});

test("a double jump restarts the jump clip and a landing keeps its entry rate", () => {
  const f = createFighter(Character.demonHunter, 0.0, 1);
  const world = soloWorld(f);
  const input = neutralControls();
  const pose = createFighterPose();
  f.motion.grounded = false;
  f.motion.vz = 5.0;
  advanceFighterPose(pose, f, world, input, false, true, false, false);
  assertEquals(pose.clipIndex, dh.DEMON_HUNTER_JUMP_INDEX);
  advanceFighterPose(pose, f, world, input, false, false, false, false);
  assertGreaterThan(pose.clipTime, 0.0);
  const selected = pose.selectionSerial;
  f.jump.isDouble = true;
  advanceFighterPose(pose, f, world, input, false, true, false, false);
  assertEquals(pose.clipIndex, dh.DEMON_HUNTER_DOUBLE_JUMP_INDEX);
  assertEquals(pose.selectionSerial, selected + 1);
  assertEquals(pose.clipTime, 0.0);
  f.special.fall = true;
  advanceFighterPose(pose, f, world, input, false, false, false, false);
  f.special.fall = false;
  f.motion.grounded = true;
  f.landing.lag = 12;
  advanceFighterPose(pose, f, world, input, false, false, false, false);
  assertEquals(pose.clipIndex, dh.DEMON_HUNTER_LAND_SPECIAL_INDEX);
  const rate = pose.rate;
  const landing = pose.selectionSerial;
  f.landing.lag = 11;
  advanceFighterPose(pose, f, world, input, false, false, false, false);
  assertEquals(pose.rate, rate);
  assertEquals(pose.selectionSerial, landing);
});

test("a snapshot's pose escapes from its own copy of the previous holder", () => {
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
  // Changing the live holder must not reach detached presentation history.
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

test("an attack restart and a smash release keep their authored clips", () => {
  const f = createFighter(Character.demonHunter, 0.0, 1);
  const world = soloWorld(f);
  const input = neutralControls();
  const pose = createFighterPose();
  f.attack.style = AttackStyle.upSmash;
  f.attack.frame = 1;
  f.attack.duration = attackDurationFramesForGrounding(AttackStyle.upSmash, true);
  advanceFighterPose(pose, f, world, input, false, false, true, false);
  assertEquals(pose.clipIndex, dh.DEMON_HUNTER_UP_SMASH_INDEX);
  f.attack.smashCharging = true;
  advanceFighterPose(pose, f, world, input, false, false, false, false);
  assertEquals(pose.clipIndex, dh.DEMON_HUNTER_UP_SMASH_CHARGE_INDEX);
  assertEquals(pose.rate, 0.0);
  f.attack.smashCharging = false;
  advanceFighterPose(pose, f, world, input, false, false, false, false);
  assertEquals(pose.clipIndex, dh.DEMON_HUNTER_UP_SMASH_RELEASE_INDEX);
  assertEquals(pose.clipTime, 0.0);
  assertGreaterThan(pose.rate, 0.0);
  advanceFighterPose(pose, f, world, input, false, false, false, false);
  assertGreaterThan(pose.clipTime, 0.0);
  advanceFighterPose(pose, f, world, input, false, false, true, false);
  assertEquals(pose.clipIndex, dh.DEMON_HUNTER_UP_SMASH_INDEX);
  assertEquals(pose.clipTime, 0.0);
});

test("platform ascent, descent and wraps play each fighter's platform clip over the move", () => {
  const fighters = [Character.archer, Character.rifleman, Character.demonHunter, ...HERO_ROSTER.map((hero) => hero.character)];
  const deckZ = surfaceZ(1, 1, 0);
  const centre = f32(f32(surfaceLeft(1, 1, 0) + surfaceRight(1, 1, 0)) / 2);
  for (const character of fighters) {
    const rising = createFighter(character, centre, 1);
    rising.motion.grounded = false;
    rising.motion.z = f32(f32(deckZ - melee(bodyTop(character))) - 0.5);
    rising.motion.vz = 12.0;
    const standing = createFighter(character, centre, 1);
    standing.motion.surface = 1;
    standing.motion.z = deckZ;
    const wrapping = createFighter(character, centre, 1);
    wrapping.motion.grounded = false;
    wrapping.motion.z = rising.motion.z;
    wrapping.motion.vz = 12.0;
    const runs: readonly [Fighter, readonly Controls[]][] = [
      [rising, []],
      [standing, [{ ...neutralControls(), down: true, verticalDirection: -1 }]],
      [wrapping, [neutralControls(), { ...neutralControls(), direction: -1 }, { ...neutralControls(), down: true, verticalDirection: -1 }, { ...neutralControls(), direction: 1 }]],
    ];
    for (const [f, inputs] of runs) {
      const world = soloWorld(f);
      const pose = createFighterPose();
      const seen = new Set<number>();
      for (let frame = 0; frame < 16; frame++) {
        advanceFighter(world, 0, 1, inputs[frame] ?? neutralControls(), 0.0);
        advanceFighterPose(pose, f, world, neutralControls(), false, false, false, false);
        if (f.platform.move === PlatformMove.none) continue;
        seen.add(f.platform.move);
        const clip = platformClip(character, f.platform.move);
        assertEquals(pose.clipIndex, clip.index);
        // The whole clip plays over the move's jump squat.
        assertEquals(pose.rate, f32(clip.seconds / f32(f.platform.duration * FRAME_SECONDS)));
      }
      assertGreaterThan(seen.size, 0);
    }
  }
  // Each original fighter's platform clips are its packaged ledge climb, hang and roll.
  assertEquals(platformClip(Character.archer, PlatformMove.ascent).index, assets.ARCHER_LEDGE_CLIMB_INDEX);
  assertEquals(platformClip(Character.rifleman, PlatformMove.descent).index, assets.RIFLEMAN_LEDGE_HANG_INDEX);
  assertEquals(platformClip(Character.demonHunter, PlatformMove.wrapOver).index, dh.DEMON_HUNTER_LEDGE_ROLL_INDEX);
});

test("a hero special's follow-up plays its own follow-up clip, or the special's, from the start", () => {
  for (const hero of HERO_ROSTER) {
    const f = createFighter(hero.character, 0.0, 1);
    const world = soloWorld(f);
    const input = neutralControls();
    const pose = createFighterPose();
    f.special.action = SpecialAction.heroDown;
    f.special.form = SpecialForm.ground;
    f.special.frame = 8;
    f.special.duration = 24;
    advanceFighterPose(pose, f, world, input, false, false, false, false);
    const base = specialClip(hero.character, SpecialAction.heroDown, true, false);
    assertEquals(pose.clipIndex, base.index);
    const selected = pose.selectionSerial;
    f.special.form = SpecialForm.ground + FOLLOW_UP_FORM;
    f.special.frame = 1;
    f.special.duration = 37;
    advanceFighterPose(pose, f, world, input, false, false, false, false);
    assertEquals(pose.selectionSerial, selected + 1);
    assertEquals(pose.clipTime, 0.0);
    assertEquals(pose.clipIndex, (hero.presentation.clips.downSpecialFollowUp ?? base).index);
  }
});

test("every selectable fighter plays its own wall jump and wall tech clip, never the fallback", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const table = characterClips(character);
    const jump = table.wallJump;
    const tech = table.wallTech;
    assertEquals(jump !== undefined && tech !== undefined, true, `fighter ${character} maps wall clips`);
    if (jump === undefined || tech === undefined) continue;
    assertEquals(jump.index !== tech.index, true, `fighter ${character} wall jump and wall tech differ`);
    const f = createFighter(character, 0.0, -1);
    const world = soloWorld(f);
    const input = neutralControls();
    const pose = createFighterPose();
    f.motion.grounded = false;
    f.surfaceRecovery.state = SurfaceContact.techWall;
    f.surfaceRecovery.wallJumpQueued = true;
    advanceFighterPose(pose, f, world, input, false, false, false, false);
    assertEquals(pose.clipIndex, jump.index);
    assertGreaterThan(pose.rate, 0.0);
    f.surfaceRecovery.wallJumpQueued = false;
    advanceFighterPose(pose, f, world, input, false, false, false, false);
    assertEquals(pose.clipIndex, tech.index);
  }
});
