import { TECH_WINDOW_FRAMES, TECH_REPEAT_MINIMUM_AGE_FRAMES } from "../physics/techInput";

import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, DownState, SurfaceContact } from "./codes";
import { WALL_TECH_STARTUP_FRAMES, canAttack, isIntangible } from "./conditions";
import { DOWN_DAMAGE_RESET_THRESHOLD, DOWN_WAIT_FRAMES } from "./down";
import { type Fighter, WALL_JUMP_FLICK_FRAMES, WALL_TECH_JUMP_INPUT_WINDOW_FRAMES,  } from "./fighter";
import { createReferenceFighter } from "./referenceRig";
import { beginAirDodge, beginJump } from "./jumpsAndDodges";
import { MAX_GROUNDED_KNOCKBACK_ON_LANDING } from "./knockback";
import {
  MAIN_DECK_BODY_SURFACES,
  SOLID_DECK_TEST_STAGE,
  solidSurfaceAt,
  solidSurfaceCount,
  surfaceLeft,
  surfaceRight,
} from "./stage";
import {
  BODY_HALF_WIDTH,
  SURFACE_REFLECT_ATTENUATION,
  SURFACE_REFLECT_COOLDOWN_FRAMES,
  SURFACE_REFLECT_SPEED_THRESHOLD,
  SURFACE_TECH_WALL_COLLISION_GRACE_FRAMES,
  WALL_JUMP_INPUT_WINDOW_FRAMES,
  WALL_JUMP_REPEAT_RISE_SCALE,
  WALL_JUMP_STICK_X,
  bodyTop,
} from "./surfaces";
import { advanceSolo, controls, seedTechWindow, withPhysics } from "./testWorld";
import { type SurfaceRecoveryPhysics, WORLD_UNITS_PER_MELEE_UNIT, melee } from "./tuning";

const MELEE_CAPTAIN_FALCON_SURFACE_RECOVERY_PHYSICS: SurfaceRecoveryPhysics = {
  passiveWallSpeed: melee(0.5),
  wallJumpHorizontalSpeed: melee(1.399999976158142),
  wallJumpVerticalSpeed: melee(3.0999999046325684),
  passiveCeilingSpeed: melee(2.0),
  wallJumpMinimumApproach: melee(0.5),
  canWallJump: true,
};

const RAISED_WALL_CONTACT_X = f32(surfaceLeft(SOLID_DECK_TEST_STAGE, 1, 0) - melee(BODY_HALF_WIDTH));

const RAISED_UNDERSIDE_Z = solidSurfaceAt(SOLID_DECK_TEST_STAGE, MAIN_DECK_BODY_SURFACES + 2).startZ;

const RAISED_UNDERSIDE_CONTACT_Z = f32(RAISED_UNDERSIDE_Z - melee(bodyTop(Character.sylvanas)));

const CEILING_TUMBLER_Z = f32(RAISED_UNDERSIDE_CONTACT_Z - 5.699999809265137);

function surfaceTumbler(atCeiling: boolean): Fighter {
  const fighter = createReferenceFighter(Character.sylvanas, atCeiling ? -265.0 : f32(RAISED_WALL_CONTACT_X - 5.0), 1);
  fighter.motion.grounded = false;
  fighter.motion.z = atCeiling ? CEILING_TUMBLER_Z : 160.0;
  fighter.launch.hitstun = 8;
  fighter.down.state = DownState.tumble;
  return fighter;
}

function techingTumbler(atCeiling: boolean, launch: number): Fighter {
  const fighter = surfaceTumbler(atCeiling);
  seedTechWindow(fighter, 3);
  if (atCeiling) fighter.launch.knockbackZ = launch;
  else fighter.launch.knockbackX = launch;
  return fighter;
}

// GrNLa.dat coll_data scale 1: rightWall 9,10,7,8,6; ceiling 5,4,3; leftWall 15,14,12,13,11 (GALE01 revision 2).

const REFERENCE_LEDGE_X = 85.5656967163086;
const REFERENCE_BODY: readonly (readonly [SurfaceContact, number, number, number, number])[] = [
  [SurfaceContact.wall, 85.5656967163086, 0.0, 85.5656967163086, -10.5],
  [SurfaceContact.wall, 85.5656967163086, -10.5, 65.79930114746094, -20.453800201416016],
  [SurfaceContact.wall, 65.79930114746094, -20.453800201416016, 65.83740234375, -31.34429931640625],
  [SurfaceContact.wall, 65.83740234375, -31.34429931640625, 61.419498443603516, -47.36629867553711],
  [SurfaceContact.wall, 61.419498443603516, -47.36629867553711, 53.77360153198242, -54.258399963378906],
  [SurfaceContact.ceiling, 53.77360153198242, -54.258399963378906, 47.45600128173828, -55.38819885253906],
  [SurfaceContact.ceiling, 47.45600128173828, -55.38819885253906, -47.45600128173828, -55.38819885253906],
  [SurfaceContact.ceiling, -47.45600128173828, -55.38819885253906, -53.77360153198242, -54.258399963378906],
  [SurfaceContact.wall, -53.77360153198242, -54.258399963378906, -61.419498443603516, -47.36629867553711],
  [SurfaceContact.wall, -61.419498443603516, -47.36629867553711, -65.83740234375, -31.34429931640625],
  [SurfaceContact.wall, -65.83740234375, -31.34429931640625, -65.79930114746094, -20.453800201416016],
  [SurfaceContact.wall, -65.79930114746094, -20.453800201416016, -85.5656967163086, -10.5],
  [SurfaceContact.wall, -85.5656967163086, -10.5, -85.5656967163086, 0.0],
];

const FLAT_UNDERSIDE = 6;

function mainDeckWorldX(referenceX: number): number {
  return referenceX > 0
    ? f32(surfaceRight(0, 0, 0) + f32(f32(referenceX - REFERENCE_LEDGE_X) * WORLD_UNITS_PER_MELEE_UNIT))
    : f32(surfaceLeft(0, 0, 0) + f32(f32(referenceX + REFERENCE_LEDGE_X) * WORLD_UNITS_PER_MELEE_UNIT));
}

test("each shipped stage's main deck has Final Destination's side walls and underside below its ledges [k4 reference melee]", () => {
  for (const stage of [0, 1]) {
    assertEquals(solidSurfaceCount(stage), REFERENCE_BODY.length);
    assertEquals(MAIN_DECK_BODY_SURFACES, REFERENCE_BODY.length);
    REFERENCE_BODY.forEach(([kind, startX, startZ, endX, endZ], index) => {
      const surface = solidSurfaceAt(stage, index);
      assertEquals(surface.kind, kind);
      assertNear(surface.startX, mainDeckWorldX(startX), 0.0010000000474974513);
      assertNear(surface.startZ, f32(startZ * WORLD_UNITS_PER_MELEE_UNIT), 0.0010000000474974513);
      assertNear(surface.endX, mainDeckWorldX(endX), 0.0010000000474974513);
      assertNear(surface.endZ, f32(endZ * WORLD_UNITS_PER_MELEE_UNIT), 0.0010000000474974513);

      const { normalX, normalZ } = surface;
      assertNear(f32(f32(normalX * normalX) + f32(normalZ * normalZ)), 1.0, 9.999999974752427e-7);
      assertNear(f32(f32(normalX * f32(surface.endX - surface.startX)) + f32(normalZ * f32(surface.endZ - surface.startZ))), 0.0, 0.0010000000474974513);
      assertGreaterThan(f32(f32(normalX * f32(surface.startX + surface.endX)) + f32(normalZ * f32(f32(surface.startZ + surface.endZ) + 300.0))), 0.0);
    });
  }

  assertEquals(solidSurfaceAt(0, 0).startX, surfaceRight(0, 0, 0));
  assertEquals(solidSurfaceAt(0, MAIN_DECK_BODY_SURFACES - 1).endX, surfaceLeft(0, 0, 0));
  assertEquals(solidSurfaceAt(0, FLAT_UNDERSIDE).startZ, -332.3291931152344);
});

test("the retail surface threshold reflects the combined velocity at the playable wall and reports the contact [k4 reference melee]", () => {
  const fighter = surfaceTumbler(false);
  fighter.motion.vx = -2.0;
  fighter.launch.knockbackX = 12.0;
  advanceSolo(fighter, SOLID_DECK_TEST_STAGE, controls(), 0.0);
  assertEquals(fighter.motion.x, RAISED_WALL_CONTACT_X);
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

test("a retail surface rebound uses a strict one-unit knockback gate [k4 reference melee]", () => {
  const fighter = surfaceTumbler(false);
  fighter.launch.knockbackX = f32(SURFACE_REFLECT_SPEED_THRESHOLD + 0.3050000071525574);
  advanceSolo(fighter, SOLID_DECK_TEST_STAGE, controls(), 0.0);
  assertEquals(fighter.motion.x, RAISED_WALL_CONTACT_X);
  assertEquals(fighter.surfaceRecovery.contactSerial, 1);
  assertNear(fighter.launch.knockbackX, 0.0, 0.00009999999747378752);
});

test("a retail get-up's completion allows input on its animation end tick [k4 reference melee]", () => {
  for (const character of [Character.sylvanas, Character.rifleman]) {
    for (let recovery = 0; recovery <= 2; recovery++) {
      const fighter = createReferenceFighter(character, 0.0, 1);
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

test("a retail wall tech uses the separate original fighter surface profile [k4 reference melee]", () => {
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
  assertLessThan(fighter.motion.x, RAISED_WALL_CONTACT_X);
  assertLessThan(fighter.status.invincible, SURFACE_TECH_WALL_COLLISION_GRACE_FRAMES);
  assertEquals(fighter.surfaceRecovery.state, SurfaceContact.techWall);
  assertEquals(fighter.surfaceRecovery.frame, WALL_TECH_STARTUP_FRAMES);
  assertTrue(fighter.surfaceRecovery.velocityApplied);
});

test("a retail wall tech's jump input age expires at the twenty-frame boundary [k4 reference melee]", () => {
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

test("each earlier wall jump since landing lowers a wall jump's rise, and landing resets the count [k4 reference melee]", () => {
  for (const earlier of [0, 2]) {
    const fighter = createReferenceFighter(Character.sylvanas, f32(RAISED_WALL_CONTACT_X - 4.0), 1);
    fighter.motion.grounded = false;
    fighter.motion.z = 160.0;
    fighter.motion.vx = fighter.tuning.physics.airSpeed;
    fighter.surfaceRecovery.wallJumpsUsed = earlier;
    advanceSolo(fighter, SOLID_DECK_TEST_STAGE, controls({ direction: 1 }), 0.0);
    assertEquals(fighter.surfaceRecovery.wallJumpAge, 0);
    advanceSolo(fighter, SOLID_DECK_TEST_STAGE, controls({ direction: -1 }), 0.0);
    assertEquals(fighter.surfaceRecovery.state, SurfaceContact.techWall);
    assertEquals(fighter.surfaceRecovery.wallJumpsUsed, earlier + 1);
    for (let tick = 1; tick <= WALL_TECH_STARTUP_FRAMES; tick++) advanceSolo(fighter, SOLID_DECK_TEST_STAGE, controls(), 0.0);
    assertTrue(fighter.surfaceRecovery.velocityApplied);
    // Fox's +0x108 = 3.3 times powf(PlCo +0x778 = 0.975, earlier), less a frame of gravity (ftCo_PassiveWall_Anim).
    const scale = earlier === 0 ? 1.0 : f32(0.9750000238418579 * 0.9750000238418579);
    const gravity = f32(fighter.tuning.physics.gravity / WORLD_UNITS_PER_MELEE_UNIT);
    assertNear(f32(fighter.motion.vz / WORLD_UNITS_PER_MELEE_UNIT), f32(f32(3.299999952316284 * scale) - gravity), 0.00009999999747378752);
    for (let tick = 1; tick <= 200 && !fighter.motion.grounded; tick++) advanceSolo(fighter, SOLID_DECK_TEST_STAGE, controls(), 0.0);
    assertTrue(fighter.motion.grounded);
    assertEquals(fighter.surfaceRecovery.wallJumpsUsed, 0);
  }
});

test("a retail landing caps ground knockback at the decoded common value [k4 reference melee]", () => {
  const fighter = createReferenceFighter(Character.sylvanas, 0.0, 1);
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

test("a retail ceiling tech protects until its one-shot actor impulse [k4 reference melee]", () => {
  for (const impulseFrame of [14, 11]) {
    const fighter = techingTumbler(true, 8.0);
    fighter.tuning.surface = MELEE_CAPTAIN_FALCON_SURFACE_RECOVERY_PHYSICS;
    fighter.tuning.tech = { ...fighter.tuning.tech, ceilingImpulseFrame: impulseFrame };

    withPhysics(fighter, { airAcceleration: 0.0, airFriction: 0.0, gravity: 0.0 });
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

test("shared recovery values match the decoded common table [k4 reference melee]", () => {
  assertEquals(TECH_WINDOW_FRAMES, 20);
  assertEquals(TECH_REPEAT_MINIMUM_AGE_FRAMES, 40);
  assertEquals(DOWN_WAIT_FRAMES, 220);
  assertEquals(DOWN_DAMAGE_RESET_THRESHOLD, 7.0);
  assertEquals(SURFACE_REFLECT_SPEED_THRESHOLD, 6.0);
  assertEquals(SURFACE_REFLECT_ATTENUATION, 0.800000011920929);
  assertEquals(SURFACE_REFLECT_COOLDOWN_FRAMES, 3);
  assertEquals(WALL_TECH_STARTUP_FRAMES, 5);
  assertEquals(SURFACE_TECH_WALL_COLLISION_GRACE_FRAMES, 14);
  assertEquals(WALL_JUMP_INPUT_WINDOW_FRAMES, 130);
  assertEquals(WALL_JUMP_STICK_X, 0.800000011920929);
  assertEquals(WALL_JUMP_FLICK_FRAMES, 3);
  assertEquals(WALL_JUMP_REPEAT_RISE_SCALE, 0.9750000238418579);
});
