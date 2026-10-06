// Floor, wall and ceiling contacts share the surface-recovery fixture and
// executor; the same-frame transitions are checked together.
import { max } from "../../runtime/numbers";
import { TECH_WINDOW_FRAMES, TECH_REPEAT_MINIMUM_AGE_FRAMES } from "../physics/techInput";
// Solid stage surfaces, tumble rebounds, wall and ceiling techs, and the
// decoded common recovery values.
import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { roundToFloat32 } from "wisp/src/sim/binary32";
import { f32 } from "wisp/src/sim/f32";
import { Character, DownState, SurfaceContact } from "./codes";
import { WALL_TECH_STARTUP_FRAMES, canAttack, isIntangible } from "./conditions";
import { DOWN_DAMAGE_RESET_THRESHOLD, DOWN_WAIT_FRAMES } from "./down";
import { type Fighter, WALL_TECH_JUMP_INPUT_WINDOW_FRAMES, createFighter } from "./fighter";
import { beginAirDodge, beginJump } from "./jumpsAndDodges";
import { MAX_GROUNDED_KNOCKBACK_ON_LANDING } from "./knockback";
import {
  SOLID_DECK_TEST_STAGE,
  solidSurfaceCoordinate,
  solidSurfaceCount,
  solidSurfaceKind,
  solidSurfaceMaximum,
  solidSurfaceMinimum,
  solidSurfaceNormalZ,
  surfaceCount,
  surfaceLeft,
  surfacePass,
  surfaceRight,
  surfaceZ,
} from "./stage";
import {
  SURFACE_REFLECT_ATTENUATION,
  SURFACE_REFLECT_COOLDOWN_FRAMES,
  SURFACE_REFLECT_SPEED_THRESHOLD,
  SURFACE_TECH_WALL_COLLISION_GRACE_FRAMES,
} from "./surfaces";
import { advanceSolo, controls, seedTechWindow, withPhysics } from "./testWorld";
import { type SurfaceRecoveryPhysics, WORLD_UNITS_PER_MELEE_UNIT, melee } from "./tuning";

// Reference-only fighter values; playable profiles stay actor-authored.
const MELEE_CAPTAIN_FALCON_SURFACE_RECOVERY_PHYSICS: SurfaceRecoveryPhysics = {
  passiveWallSpeed: melee(0.5),
  wallJumpHorizontalSpeed: melee(1.399999976158142),
  wallJumpVerticalSpeed: melee(3.0999999046325684),
  passiveCeilingSpeed: melee(2.0),
  wallJumpMinimumApproach: melee(0.5),
  canWallJump: true,
};

/** A tumbling fighter against the left wall (x -420) of the solid-deck test stage's left raised deck, or below its underside. */
function surfaceTumbler(atCeiling: boolean): Fighter {
  const fighter = createFighter(Character.archer, atCeiling ? -265.0 : -425.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.z = atCeiling ? 140.0 : 160.0;
  fighter.launch.hitstun = 8;
  fighter.down.state = DownState.tumble;
  return fighter;
}

/** A tumbler with an open tech window, moving into the wall or ceiling. */
function techingTumbler(atCeiling: boolean, launch: number): Fighter {
  const fighter = surfaceTumbler(atCeiling);
  seedTechWindow(fighter, 3);
  if (atCeiling) fighter.launch.knockbackZ = launch;
  else fighter.launch.knockbackX = launch;
  return fighter;
}

/** The vertical velocity after a wall jump's first gravity frame. */
const wallJumpVerticalAfterGravity = (fighter: Fighter) =>
  f32(roundToFloat32(f32(roundToFloat32(f32(fighter.tuning.surface.wallJumpVerticalSpeed / 6)) - roundToFloat32(f32(fighter.tuning.physics.gravity / 6)))) * 6);

// Melee's pass-through platforms are floor lines flagged LINE_FLAG_PLATFORM
// (melee:src/melee/mp/forward.h). At revision 0296f009f, mpCheckFloor hits a
// level floor line only while the ECB bottom descends (`ay >= by`),
// mpCheckCeiling tests ceiling-kind lines only, and mpJointUpdateDynamics
// disables a platform line that is not floor-kind (melee:src/melee/mp/mplib.c).
test("the playable stages' only solid face is the main deck's underside", () => {
  for (const stage of [0, 1]) {
    assertEquals(solidSurfaceCount(stage), 1);
    assertEquals(solidSurfaceKind(stage, 0), SurfaceContact.ceiling);
    assertEquals(solidSurfaceCoordinate(stage, 0), -54.0);
    assertEquals(solidSurfaceMinimum(stage, 0), -528.0);
    assertEquals(solidSurfaceMaximum(stage, 0), 528.0);
    assertEquals(solidSurfaceNormalZ(stage, 0), -1.0);
  }
});

const PLAYABLE_FIGHTERS = [Character.archer, Character.rifleman, Character.demonHunter] as const;

/**
 * Jumps from the main deck beneath the deck's centre. A short hop tops out far
 * below the raised decks, so it adds its aerial jump on its first falling frame.
 */
function jumpBeneathDeck(character: Character, stage: number, deck: number, shortHop: boolean): { fighter: Fighter; apex: number } {
  const fighter = createFighter(character, f32(f32(surfaceLeft(stage, deck) + surfaceRight(stage, deck)) / 2), 1);
  const input = controls({ jumpPressed: true, jumpHeld: !shortHop });
  let apex = fighter.motion.z;
  let aerialJumped = !shortHop;
  for (let frame = 1; frame <= 150; frame++) {
    advanceSolo(fighter, stage, input, 0.0);
    input.jumpPressed = false;
    if (!aerialJumped && !fighter.motion.grounded && fighter.motion.vz <= 0) {
      input.jumpPressed = true;
      aerialJumped = true;
    }
    apex = max(apex, fighter.motion.z);
  }
  return { fighter, apex };
}

test("full and short hops rise through every pass deck and land on top", () => {
  for (const character of PLAYABLE_FIGHTERS) {
    for (let deck = 1; deck < surfaceCount(1); deck++) {
      assertTrue(surfacePass(1, deck));
      for (const shortHop of [false, true]) {
        const { fighter, apex } = jumpBeneathDeck(character, 1, deck, shortHop);
        assertEquals(fighter.surfaceRecovery.contactSerial, 0);
        assertGreaterThan(apex, surfaceZ(1, deck));
        assertTrue(fighter.motion.grounded);
        assertEquals(fighter.motion.surface, deck);
        assertEquals(fighter.motion.z, surfaceZ(1, deck));
      }
    }
  }
});

test("a jump under a solid surface still bumps its head", () => {
  for (const character of PLAYABLE_FIGHTERS) {
    const { fighter, apex } = jumpBeneathDeck(character, SOLID_DECK_TEST_STAGE, 1, false);
    assertEquals(fighter.surfaceRecovery.contactSerial, 1);
    assertEquals(fighter.surfaceRecovery.contactKind, SurfaceContact.ceiling);
    assertEquals(apex, solidSurfaceCoordinate(SOLID_DECK_TEST_STAGE, 3));
    assertEquals(fighter.motion.surface, 0);

    // The main deck's underside on the shipped stage, from an aerial jump below it.
    const below = createFighter(character, 0.0, 1);
    below.motion.grounded = false;
    below.motion.z = -150.0;
    below.jump.remaining = 1;
    const input = controls({ jumpPressed: true, jumpHeld: true });
    for (let frame = 1; frame <= 30 && below.surfaceRecovery.contactSerial === 0; frame++) {
      advanceSolo(below, 1, input, 0.0);
      input.jumpPressed = false;
    }
    assertEquals(below.surfaceRecovery.contactKind, SurfaceContact.ceiling);
    assertEquals(below.motion.z, solidSurfaceCoordinate(1, 0));
    assertTrue(below.motion.vz <= 0);
  }
});

test("a launch passes through a pass deck's sides", () => {
  for (const side of [-1, 1]) {
    const edgeX = side < 0 ? surfaceLeft(1, 1) : surfaceRight(1, 1);
    const fighter = createFighter(Character.archer, f32(edgeX + side * 5), -side);
    fighter.motion.grounded = false;
    fighter.motion.z = 160.0;
    fighter.launch.hitstun = 8;
    fighter.down.state = DownState.tumble;
    fighter.launch.knockbackX = f32(-side * 12.0);
    advanceSolo(fighter, 1, controls(), 0.0);
    assertEquals(fighter.surfaceRecovery.contactSerial, 0);
    assertLessThan(fighter.motion.x * side, edgeX * side);
  }
});

test("the playable main deck's edges remain open for runoffs", () => {
  const fighter = createFighter(Character.archer, 599.0, 1);
  fighter.motion.surface = 0;
  fighter.motion.grounded = true;
  fighter.motion.vx = 2.0;
  fighter.ground.dashFrame = 1;
  fighter.ground.dashDirection = 1;
  advanceSolo(fighter, 0, controls(), 0.0);
  assertGreaterThan(fighter.motion.x, 600.0);
  assertFalse(fighter.motion.grounded);
});

test("a surface rebound requires a tumbling launch", () => {
  for (const atCeiling of [false, true]) {
    for (let recovering = 0; recovering <= 2; recovering++) {
      const fighter = surfaceTumbler(atCeiling);
      fighter.motion.z = atCeiling ? 140.0 : 160.0;
      fighter.launch.knockbackX = atCeiling ? 0.0 : 12.0;
      fighter.launch.knockbackZ = atCeiling ? 12.0 : 0.0;
      fighter.launch.hitstun = recovering > 0 ? 8 : 0;
      fighter.down.state = recovering === 2 ? DownState.tumble : DownState.none;
      advanceSolo(fighter, SOLID_DECK_TEST_STAGE, controls(), 0.0);
      assertEquals(fighter.surfaceRecovery.contactSerial, 1);
      const normalLaunch = atCeiling ? fighter.launch.knockbackZ : fighter.launch.knockbackX;
      if (recovering === 2) {
        assertLessThan(normalLaunch, 0.0);
      } else {
        assertEquals(normalLaunch, 0.0);
        assertEquals(fighter.surfaceRecovery.reflectCooldown, 0);
      }
    }
  }
});

test("weak airborne damage can't wall or ceiling tech", () => {
  for (const atCeiling of [false, true]) {
    const fighter = surfaceTumbler(atCeiling);
    fighter.down.state = DownState.none;
    fighter.launch.knockbackX = atCeiling ? 0.0 : 12.0;
    fighter.launch.knockbackZ = atCeiling ? 12.0 : 0.0;
    fighter.launch.damageLevel = 2;
    seedTechWindow(fighter, 3);
    advanceSolo(fighter, SOLID_DECK_TEST_STAGE, controls(), 0.0);
    assertEquals(fighter.surfaceRecovery.contactSerial, 1);
    assertEquals(fighter.surfaceRecovery.state, SurfaceContact.none);
    assertEquals(fighter.launch.hitstun, 7);
    assertGreaterThan(fighter.tech.window, 0);
  }
});

test("the retail surface threshold reflects the combined velocity at the playable wall and reports the contact", () => {
  const fighter = surfaceTumbler(false);
  fighter.motion.vx = -2.0;
  fighter.launch.knockbackX = 12.0;
  advanceSolo(fighter, SOLID_DECK_TEST_STAGE, controls(), 0.0);
  assertEquals(fighter.motion.x, -420.0);
  assertEquals(fighter.surfaceRecovery.contactSerial, 1);
  assertEquals(fighter.surfaceRecovery.contactKind, SurfaceContact.wall);
  assertEquals(fighter.surfaceRecovery.contactX, -420.0);
  assertTrue(fighter.surfaceRecovery.contactZ < 160 && fighter.surfaceRecovery.contactZ > 159);
  assertEquals(fighter.surfaceRecovery.contactNormalX, -1.0);
  assertEquals(fighter.surfaceRecovery.contactNormalZ, 0.0);
  assertEquals(fighter.motion.vx, 0.0);
  assertTrue(fighter.launch.knockbackX < -7 && fighter.launch.knockbackX > -8);
  assertNear(fighter.launch.knockbackZ, -1.1039999723434448, 0.0010000000474974513);
  assertEquals(fighter.facing, -1);
});

test("a retail surface rebound uses a strict one-unit knockback gate", () => {
  const fighter = surfaceTumbler(false);
  fighter.launch.knockbackX = f32(SURFACE_REFLECT_SPEED_THRESHOLD + 0.3050000071525574);
  advanceSolo(fighter, SOLID_DECK_TEST_STAGE, controls(), 0.0);
  assertEquals(fighter.motion.x, -420.0);
  assertEquals(fighter.surfaceRecovery.contactSerial, 1);
  assertNear(fighter.launch.knockbackX, 0.0, 0.00009999999747378752);
});

test("a retail ceiling rebound reports the surface normal", () => {
  const fighter = surfaceTumbler(true);
  fighter.launch.knockbackZ = 12.0;
  advanceSolo(fighter, SOLID_DECK_TEST_STAGE, controls(), 0.0);
  assertNear(fighter.motion.z, 145.6999969482422, 0.0010000000474974513);
  assertEquals(fighter.surfaceRecovery.contactKind, SurfaceContact.ceiling);
  assertEquals(fighter.surfaceRecovery.contactX, -265.0);
  assertNear(fighter.surfaceRecovery.contactZ, 145.6999969482422, 0.0010000000474974513);
  assertEquals(fighter.surfaceRecovery.contactNormalX, 0.0);
  assertEquals(fighter.surfaceRecovery.contactNormalZ, -1.0);
  assertLessThan(fighter.launch.knockbackZ, 0.0);
});

test("a retail get-up's completion allows input on its animation end tick", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    for (let recovery = 0; recovery <= 2; recovery++) {
      const fighter = createFighter(character, 0.0, 1);
      fighter.down.state = DownState.wait;
      fighter.down.waitRemaining = 200;
      const input = controls({
        getupStandPressed: recovery === 0, getupDirectionPressed: recovery === 1, getupDirection: 1, getupAttackPressed: recovery === 2,
      });
      advanceSolo(fighter, 0, input, 0.0);
      const state = recovery === 0 ? DownState.stand : recovery === 1 ? DownState.roll : DownState.attack;
      const endTick = recovery === 0 ? 30 : recovery === 1 ? 35 : 49;
      assertEquals(fighter.down.state, state);
      input.getupStandPressed = false;
      input.getupDirectionPressed = false;
      input.getupAttackPressed = false;
      for (let frame = 1; frame <= endTick - 1; frame++) {
        advanceSolo(fighter, 0, input, 0.0);
        assertEquals(fighter.down.state, state);
      }
      input.jumpPressed = true;
      input.jumpHeld = true;
      advanceSolo(fighter, 0, input, 0.0);
      assertEquals(fighter.down.state, DownState.none);
      assertGreaterThan(fighter.jump.squat, 0);
    }
  }
});

test("a retail wall tech uses the separate original fighter surface profile", () => {
  const fighter = techingTumbler(false, 8.0);
  const input = controls();
  fighter.tuning.surface = MELEE_CAPTAIN_FALCON_SURFACE_RECOVERY_PHYSICS;
  fighter.motion.vx = 2.0;
  fighter.motion.vz = 3.0;
  fighter.launch.knockbackZ = -2.0;
  fighter.launch.groundKnockbackX = 4.0;
  fighter.shield.pushbackX = 2.0;
  fighter.shield.recoilX = 1.5;
  fighter.shield.recoilZ = 1.0;
  advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
  assertEquals(fighter.surfaceRecovery.state, SurfaceContact.techWall);
  assertEquals(fighter.surfaceRecovery.contactKind, SurfaceContact.techWall);
  assertEquals(fighter.launch.hitstun, 0);
  assertEquals(fighter.down.state, DownState.none);
  assertEquals(fighter.status.invincible, SURFACE_TECH_WALL_COLLISION_GRACE_FRAMES);
  assertEquals(fighter.surfaceRecovery.frame, 0);
  for (const value of [fighter.motion.vx, fighter.motion.vz, fighter.launch.knockbackX, fighter.launch.knockbackZ,
    fighter.launch.groundKnockbackX, fighter.shield.pushbackX, fighter.shield.recoilX, fighter.shield.recoilZ]) {
    assertEquals(value, 0.0);
  }
  for (let tick = 1; tick <= WALL_TECH_STARTUP_FRAMES; tick++) {
    assertFalse(canAttack(fighter));
    const jumpsBefore = fighter.jump.remaining;
    beginJump(fighter, 1);
    beginAirDodge(fighter, 1, 0);
    assertEquals(fighter.jump.remaining, jumpsBefore);
    assertFalse(fighter.dodge.airDodging);
    advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
  }
  assertTrue(canAttack(fighter));
  assertNear(fighter.motion.vx, -2.880000114440918, 0.0010000000474974513);
  assertLessThan(fighter.motion.x, -420.0);
  assertLessThan(fighter.status.invincible, SURFACE_TECH_WALL_COLLISION_GRACE_FRAMES);
  assertEquals(fighter.surfaceRecovery.state, SurfaceContact.techWall);
  assertEquals(fighter.surfaceRecovery.frame, WALL_TECH_STARTUP_FRAMES);
  assertTrue(fighter.surfaceRecovery.velocityApplied);
});

test("a retail wall tech uses friction until an aerial action interrupts it", () => {
  const fighter = techingTumbler(false, 8.0);
  const input = controls();
  fighter.tuning.surface = MELEE_CAPTAIN_FALCON_SURFACE_RECOVERY_PHYSICS;
  advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
  for (let tick = 1; tick <= WALL_TECH_STARTUP_FRAMES; tick++) advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
  const velocityBefore = fighter.motion.vx;
  input.direction = 1;
  advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
  assertNear(fighter.motion.vx, velocityBefore + fighter.tuning.physics.airFriction, 0.00009999999747378752);
  assertEquals(fighter.surfaceRecovery.state, SurfaceContact.techWall);
  beginJump(fighter, 1);
  assertEquals(fighter.surfaceRecovery.state, SurfaceContact.none);
  const jumpVelocity = fighter.motion.vx;
  input.direction = -1;
  advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
  assertLessThan(fighter.motion.vx, jumpVelocity - fighter.tuning.physics.airFriction);
});

test("a retail wall tech completes after its paused startup and selected animation", () => {
  for (const jumpRig of [0, 1]) {
    const fighter = techingTumbler(false, 8.0);
    const input = controls({ verticalDirection: jumpRig });
    advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
    assertEquals(fighter.surfaceRecovery.state, SurfaceContact.techWall);
    for (let tick = 1; tick <= WALL_TECH_STARTUP_FRAMES; tick++) advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
    // Keep the animation-boundary case airborne, independent of landing.
    withPhysics(fighter, { gravity: 0.0 });
    fighter.motion.vz = 0.0;
    input.verticalDirection = 0;
    const animationEnd = jumpRig === 0 ? 26 : 40;
    for (let frame = 1; frame <= animationEnd - 1; frame++) {
      advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
      assertEquals(fighter.surfaceRecovery.state, SurfaceContact.techWall);
      assertEquals(fighter.surfaceRecovery.frame, WALL_TECH_STARTUP_FRAMES + frame);
    }
    advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
    assertEquals(fighter.surfaceRecovery.state, SurfaceContact.none);
  }
});

test("a retail wall tech jump latches buffered input without an ordinary trait or speed gate", () => {
  const fighter = techingTumbler(false, 2.5);
  fighter.motion.x = -420.5;
  fighter.tuning.surface = { ...MELEE_CAPTAIN_FALCON_SURFACE_RECOVERY_PHYSICS, canWallJump: false };
  fighter.jump.remaining = 0;
  const input = controls();
  advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
  assertEquals(fighter.surfaceRecovery.state, SurfaceContact.techWall);
  assertLessThan(fighter.surfaceRecovery.contactApproachSpeed, fighter.tuning.surface.wallJumpMinimumApproach);
  input.jumpPressed = true;
  input.direction = 1;
  advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
  input.jumpPressed = false;
  input.direction = 0;
  assertEquals(fighter.surfaceRecovery.frame, 1);
  assertTrue(fighter.surfaceRecovery.wallJumpQueued);
  for (let tick = 2; tick <= WALL_TECH_STARTUP_FRAMES - 1; tick++) advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
  assertFalse(fighter.surfaceRecovery.velocityApplied);
  assertTrue(fighter.motion.vx === 0 && fighter.motion.vz === 0);
  advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
  assertEquals(fighter.surfaceRecovery.frame, WALL_TECH_STARTUP_FRAMES);
  assertTrue(fighter.surfaceRecovery.velocityApplied);
  assertEquals(fighter.motion.vx, f32(-fighter.tuning.surface.wallJumpHorizontalSpeed + fighter.tuning.physics.airFriction));
  assertEquals(fighter.motion.vz, wallJumpVerticalAfterGravity(fighter));
  assertEquals(fighter.jump.serial, 1);
  assertEquals(fighter.facing, -1);
});

test("a retail wall tech selects a jump from a recent input age at contact", () => {
  const fighter = techingTumbler(false, 2.5);
  fighter.motion.x = -420.5;
  fighter.tuning.surface = { ...MELEE_CAPTAIN_FALCON_SURFACE_RECOVERY_PHYSICS, canWallJump: false, wallJumpMinimumApproach: 100.0 };
  fighter.jump.remaining = 0;
  fighter.jump.inputAge = WALL_TECH_JUMP_INPUT_WINDOW_FRAMES - 2;
  const input = controls();
  advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
  assertEquals(fighter.surfaceRecovery.state, SurfaceContact.techWall);
  assertTrue(fighter.surfaceRecovery.wallJumpQueued);
  for (let tick = 1; tick <= WALL_TECH_STARTUP_FRAMES - 1; tick++) advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
  assertFalse(fighter.surfaceRecovery.velocityApplied);
  advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
  assertTrue(fighter.surfaceRecovery.velocityApplied);
  assertEquals(fighter.motion.vx, f32(-fighter.tuning.surface.wallJumpHorizontalSpeed + fighter.tuning.physics.airFriction));
  assertEquals(fighter.motion.vz, wallJumpVerticalAfterGravity(fighter));
  assertEquals(fighter.jump.serial, 1);
});

test("a retail wall tech selects a jump from up on the stick at contact", () => {
  const fighter = techingTumbler(false, 8.0);
  fighter.tuning.surface = MELEE_CAPTAIN_FALCON_SURFACE_RECOVERY_PHYSICS;
  fighter.jump.inputAge = WALL_TECH_JUMP_INPUT_WINDOW_FRAMES;
  advanceSolo(fighter, SOLID_DECK_TEST_STAGE, controls({ verticalDirection: 1 }), 0.0);
  assertEquals(fighter.surfaceRecovery.state, SurfaceContact.techWall);
  assertTrue(fighter.surfaceRecovery.wallJumpQueued);
});

test("a retail wall tech's jump input age expires at the twenty-frame boundary", () => {
  const fighter = techingTumbler(false, 8.0);
  fighter.tuning.surface = MELEE_CAPTAIN_FALCON_SURFACE_RECOVERY_PHYSICS;
  fighter.jump.inputAge = WALL_TECH_JUMP_INPUT_WINDOW_FRAMES - 1;
  const input = controls();
  advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
  assertEquals(fighter.surfaceRecovery.state, SurfaceContact.techWall);
  assertFalse(fighter.surfaceRecovery.wallJumpQueued);
  for (let tick = 1; tick <= WALL_TECH_STARTUP_FRAMES; tick++) advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
  assertEquals(fighter.jump.serial, 0);
  assertNear(fighter.motion.vx, -2.880000114440918, 0.0010000000474974513);
});

test("a retail landing caps ground knockback at the decoded common value", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.z = 10.0;
  fighter.launch.knockbackX = 100.0;
  fighter.launch.knockbackZ = -20.0;
  advanceSolo(fighter, 0, controls(), 0.0);
  assertTrue(fighter.motion.grounded);
  assertEquals(fighter.motion.surface, 0);
  assertEquals(fighter.launch.groundKnockbackX, MAX_GROUNDED_KNOCKBACK_ON_LANDING);
  assertEquals(fighter.launch.knockbackX, MAX_GROUNDED_KNOCKBACK_ON_LANDING);
  assertNear(MAX_GROUNDED_KNOCKBACK_ON_LANDING, 49.80000305175781, 0.000009999999747378752);
});

test("a retail ASDI landing uses the same ground knockback cap", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.z = 10.0;
  fighter.launch.hitlag = 1;
  fighter.launch.diPending = true;
  fighter.launch.diLaunchSpeed = 10.0;
  fighter.launch.knockbackX = 100.0;
  advanceSolo(fighter, 0, controls({ cStickZ: -1 }), 0.0);
  assertTrue(fighter.motion.grounded);
  assertEquals(fighter.launch.asdiSerial, 1);
  assertEquals(fighter.launch.groundKnockbackX, f32(8.220000267028809 * WORLD_UNITS_PER_MELEE_UNIT));
  assertEquals(fighter.launch.knockbackX, fighter.launch.groundKnockbackX);
});

test("a retail ceiling tech transitions through the production advance", () => {
  const fighter = techingTumbler(true, 8.0);
  fighter.tuning.surface = MELEE_CAPTAIN_FALCON_SURFACE_RECOVERY_PHYSICS;
  const input = controls({ direction: 1 });
  advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
  assertEquals(fighter.surfaceRecovery.state, SurfaceContact.techCeiling);
  assertEquals(fighter.surfaceRecovery.contactKind, SurfaceContact.techCeiling);
  assertEquals(fighter.launch.hitstun, 0);
  assertEquals(fighter.down.state, DownState.none);
  assertEquals(fighter.surfaceRecovery.frame, 0);
  const contactZ = fighter.motion.z;
  advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
  assertEquals(fighter.surfaceRecovery.frame, 1);
  assertLessThan(fighter.motion.z, contactZ);
});

test("a retail ceiling tech protects until its one-shot actor impulse", () => {
  for (const impulseFrame of [14, 11]) {
    const fighter = techingTumbler(true, 8.0);
    fighter.tuning.surface = MELEE_CAPTAIN_FALCON_SURFACE_RECOVERY_PHYSICS;
    fighter.tuning.tech = { ...fighter.tuning.tech, ceilingImpulseFrame: impulseFrame };
    withPhysics(fighter, { airAcceleration: 0.0, airFriction: 0.0 });
    const input = controls();
    advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
    assertEquals(fighter.surfaceRecovery.state, SurfaceContact.techCeiling);
    assertTrue(isIntangible(fighter));
    for (let frame = 1; frame <= impulseFrame - 1; frame++) {
      advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
      assertEquals(fighter.motion.vx, 0.0);
      assertFalse(fighter.surfaceRecovery.velocityApplied);
      assertTrue(isIntangible(fighter));
    }
    fighter.launch.hitlag = 2;
    advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
    assertEquals(fighter.surfaceRecovery.frame, impulseFrame - 1);
    assertTrue(isIntangible(fighter));
    input.direction = -1;
    advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
    assertEquals(fighter.motion.vx, -12.0);
    assertTrue(fighter.surfaceRecovery.velocityApplied);
    assertFalse(isIntangible(fighter));
    input.direction = 0;
    advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
    assertEquals(fighter.motion.vx, -12.0);
  }
});

test("a retail ceiling tech locks actions until its animation completes", () => {
  const fighter = techingTumbler(true, 8.0);
  const input = controls();
  advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
  assertEquals(fighter.surfaceRecovery.state, SurfaceContact.techCeiling);
  // Keep this action-boundary case airborne; landing is a separate exit.
  withPhysics(fighter, { gravity: 0.0 });
  fighter.motion.vz = 0.0;
  const jumps = fighter.jump.remaining;
  for (let frame = 1; frame <= 25; frame++) {
    assertFalse(canAttack(fighter));
    beginJump(fighter, 0);
    beginAirDodge(fighter, 0, -1);
    assertEquals(fighter.jump.remaining, jumps);
    assertFalse(fighter.dodge.airDodging);
    advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
    assertEquals(fighter.surfaceRecovery.state, SurfaceContact.techCeiling);
    assertEquals(fighter.surfaceRecovery.frame, frame);
  }
  advanceSolo(fighter, SOLID_DECK_TEST_STAGE, input, 0.0);
  assertEquals(fighter.surfaceRecovery.state, SurfaceContact.none);
  assertTrue(canAttack(fighter));
  beginAirDodge(fighter, 0, -1);
  assertTrue(fighter.dodge.airDodging);
});

test("shared recovery values match the decoded common table", () => {
  assertEquals(TECH_WINDOW_FRAMES, 20);
  assertEquals(TECH_REPEAT_MINIMUM_AGE_FRAMES, 40);
  assertEquals(DOWN_WAIT_FRAMES, 220);
  assertEquals(DOWN_DAMAGE_RESET_THRESHOLD, 7.0);
  assertEquals(SURFACE_REFLECT_SPEED_THRESHOLD, 6.0);
  assertEquals(SURFACE_REFLECT_ATTENUATION, 0.800000011920929);
  assertEquals(SURFACE_REFLECT_COOLDOWN_FRAMES, 3);
  assertEquals(WALL_TECH_STARTUP_FRAMES, 5);
  assertEquals(SURFACE_TECH_WALL_COLLISION_GRACE_FRAMES, 14);
});

test("solid raised deck walls reject incoming launches from both exterior sides", () => {
  for (const side of [-1, 1]) {
    const wallX = side < 0 ? surfaceLeft(SOLID_DECK_TEST_STAGE, 1) : surfaceRight(SOLID_DECK_TEST_STAGE, 1);
    const fighter = createFighter(Character.archer, f32(wallX + side * 5), -side);
    fighter.motion.grounded = false;
    fighter.motion.z = 160.0;
    fighter.launch.hitstun = 8;
    fighter.down.state = DownState.tumble;
    fighter.launch.knockbackX = f32(-side * 12.0);
    advanceSolo(fighter, SOLID_DECK_TEST_STAGE, controls(), 0.0);
    assertEquals(fighter.motion.x, wallX);
    assertEquals(fighter.surfaceRecovery.contactNormalX, f32(side * 1.0));
    assertGreaterThan(fighter.launch.knockbackX * side, 0.0);
  }
});
