// Wall techs and wall jumps off the main deck's side through a controller's
// real input path (helperPads.ts): an Archer's forward air launches each
// fighter from below the right ledge into the side, at medium and high
// percent, and each fighter drifts into the side and flicks away from it.
import { assertDefined, assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, SurfaceContact } from "../sim/codes";
import { WALL_TECH_STARTUP_FRAMES, canAttack, isTumbling } from "../sim/conditions";
import { type Fighter, createFighter } from "../sim/fighter";
import { surfaceRight } from "../sim/stage";
import { WORLD_UNITS_PER_MELEE_UNIT, melee } from "../sim/tuning";
import { type Pad, type PadMatch, padMatch, playPads } from "./helperPads";
import { testMatch } from "./testMatch";

/** Each fighter's Melee reference, in Melee units a frame: ftCo_DatAttrs +0x100 push-off and +0x104/+0x108 wall jump of Fox, Falco and Captain Falcon. */
function referenceWall(character: Character): { readonly pushOff: number; readonly jumpX: number; readonly jumpZ: number } {
  switch (character) {
    case Character.archer:
      return { pushOff: 0.5, jumpX: 1.399999976158142, jumpZ: 3.299999952316284 };
    case Character.rifleman:
      return { pushOff: 0.5, jumpX: 1.2999999523162842, jumpZ: 3.5999999046325684 };
    case Character.demonHunter:
      return { pushOff: 0.5, jumpX: 1.399999976158142, jumpZ: 3.0999999046325684 };
  }
}

/**
 * The frame a wall recovery's five-frame hang ends (ftCo_PassiveWall_Anim,
 * ftCo_PassiveWall_Phys): the fighter leaves the wall at `speedX` away from
 * it and `speedZ` up, in Melee units, less a frame of air friction and gravity.
 */
function assertLeavesWall(fighter: Fighter, speedX: number, speedZ: number): void {
  const gravity = f32(fighter.tuning.physics.gravity / WORLD_UNITS_PER_MELEE_UNIT);
  assertEquals(fighter.motion.vx, f32(melee(speedX) - fighter.tuning.physics.airFriction));
  assertNear(f32(fighter.motion.vz / WORLD_UNITS_PER_MELEE_UNIT), f32(speedZ - gravity), 0.00009999999747378752);
  assertGreaterThan(fighter.motion.deltaX, 0.0);
}

interface Run extends PadMatch {
  readonly victim: Fighter;
}

/** Both airborne beside the right side, below the ledge's catch boxes; the victim faces the Archer outside it. */
function startRun(victimCharacter: Character, percent: number): Run {
  const match = testMatch(3, Character.archer);
  const attacker = createFighter(Character.archer, 560.0, -1);
  const victim = createFighter(victimCharacter, 530.0, 1);
  victim.status.damage = percent;
  for (const fighter of [attacker, victim]) {
    fighter.motion.grounded = false;
    fighter.motion.surface = undefined;
    fighter.motion.z = -150.0;
  }
  match.world.fighters[0] = attacker;
  match.world.fighters[1] = victim;
  return { ...padMatch(match, "wall-tech"), victim };
}

/** The C-stick toward the stage: a forward air from an Archer facing it. */
const STRIKE: Pad = { cx: -1.0 };

interface Launch {
  /** The first frame after the hit's hitlag, and the frame the victim met the side. */
  readonly free: number;
  readonly contact: number;
}

/** Plays the strike and the victim's pads until the victim meets a solid surface. */
function launch(run: Run, victimPadAt: (frame: number) => Pad): Launch {
  let free: number | undefined;
  for (let frame = 1; frame <= 40; frame++) {
    playPads(run, frame === 1 ? STRIKE : {}, victimPadAt(frame));
    const { victim } = run;
    if (free === undefined && isTumbling(victim) && victim.launch.hitlag === 0) free = frame;
    if (victim.surfaceRecovery.contactSerial > 0) return { free: assertDefined(free, "launch"), contact: frame };
  }
  throw new Error("the victim never met the side");
}

const VICTIMS = [Character.archer, Character.rifleman, Character.demonHunter] as const;
const NEUTRAL = (): Pad => ({});

function assertMetSide(victim: Fighter): void {
  const { contactX, contactNormalX } = victim.surfaceRecovery;
  assertGreaterThan(contactNormalX, 0.0);
  assertLessThan(contactX, surfaceRight(0, 0));
}

test("a launch into the main deck's side bounces off it without a press", () => {
  for (const character of VICTIMS) {
    for (const percent of [60.0, 120.0]) {
      const run = startRun(character, percent);
      launch(run, NEUTRAL);
      const { victim } = run;
      assertMetSide(victim);
      assertEquals(victim.surfaceRecovery.contactKind, SurfaceContact.wall);
      assertTrue(isTumbling(victim));
      assertGreaterThan(victim.launch.knockbackX, 0.0);
    }
  }
});

test("a trigger pressed after the hit's hitlag wall techs off the main deck's side", () => {
  for (const character of VICTIMS) {
    for (const percent of [60.0, 120.0]) {
      const missed = launch(startRun(character, percent), NEUTRAL);
      // Inside the 20-frame window (common +0x250; ftCo_PassiveWall.c ftCo_800C1D38 uses the floor's gate).
      assertLessThan(missed.contact - missed.free, 20);
      const run = startRun(character, percent);
      const teched = launch(run, (frame) => ({ trigger: frame === missed.free }));
      assertEquals(teched.contact, missed.contact);
      const { victim } = run;
      assertMetSide(victim);
      assertEquals(victim.surfaceRecovery.contactKind, SurfaceContact.techWall);
      assertEquals(victim.surfaceRecovery.state, SurfaceContact.techWall);
      assertEquals(victim.launch.hitstun, 0);
      assertFalse(isTumbling(victim));
      // Five frames on the wall with movement and gravity suspended, protected for 14 (common +0x760, +0x764).
      const { x, z } = victim.motion;
      for (let frame = 1; frame < WALL_TECH_STARTUP_FRAMES; frame++) {
        playPads(run, {}, {});
        assertEquals(victim.motion.x, x);
        assertEquals(victim.motion.z, z);
        assertGreaterThan(victim.status.invincible, 0);
      }
      // Then it pushes off the wall at its reference's passivewall_vel_x and can act: a jump ends the recovery.
      playPads(run, {}, {});
      assertLeavesWall(victim, referenceWall(character).pushOff, 0.0);
      assertLessThan(victim.motion.z, z);
      assertTrue(canAttack(victim));
      playPads(run, {}, { y: 1.0 });
      assertEquals(victim.surfaceRecovery.state, SurfaceContact.none);
      assertGreaterThan(victim.motion.deltaZ, 0.0);
      assertFalse(victim.status.out);
    }
  }
});

test("up on the stick at a wall tech launches each fighter with its reference's wall jump", () => {
  for (const character of VICTIMS) {
    const missed = launch(startRun(character, 120.0), NEUTRAL);
    const run = startRun(character, 120.0);
    // Up at contact selects the jump (ftCo_800C1E0C: the stick at least at the tap-jump threshold).
    launch(run, (frame) => ({ trigger: frame === missed.free, y: frame === missed.contact ? 1.0 : 0.0 }));
    const { victim } = run;
    assertEquals(victim.surfaceRecovery.state, SurfaceContact.techWall);
    assertTrue(victim.surfaceRecovery.wallJumpQueued);
    const serial = victim.jump.serial;
    for (let frame = 1; frame < WALL_TECH_STARTUP_FRAMES; frame++) playPads(run, {}, {});
    assertEquals(victim.motion.deltaZ, 0.0);
    playPads(run, {}, {});
    const reference = referenceWall(character);
    assertLeavesWall(victim, reference.jumpX, reference.jumpZ);
    assertGreaterThan(victim.motion.deltaZ, 0.0);
    assertEquals(victim.jump.serial, serial + 1);
  }
});

/** Below the right ledge, outside the side and facing away from it, drifting toward it at full air speed; the Archer stands on the stage. */
function startDrift(character: Character): Run {
  const match = testMatch(3, Character.archer);
  const victim = createFighter(character, 520.0, 1);
  victim.motion.grounded = false;
  victim.motion.surface = undefined;
  victim.motion.z = -125.0;
  victim.motion.vx = -victim.tuning.physics.airSpeed;
  match.world.fighters[1] = victim;
  return { ...padMatch(match, "wall-jump"), victim };
}

/** Holds the stick toward the side until the fighter meets it, then flicks it away. */
function flickOffSide(run: Run): void {
  const { victim } = run;
  for (let frame = 1; victim.surfaceRecovery.contactSerial === 0; frame++) {
    assertLessThan(frame, 20);
    playPads(run, {}, { x: -1.0 });
  }
  assertMetSide(victim);
  playPads(run, {}, { x: 1.0 });
}

test("a flick away from the main deck's side wall jumps each fighter off it with its reference's wall jump", () => {
  for (const character of VICTIMS) {
    const run = startDrift(character);
    const { victim } = run;
    assertTrue(victim.tuning.surface.canWallJump);
    flickOffSide(run);
    // ftWallJump_8008169C: met at more than +0x148 = 0.5 a frame, then the stick at least +0x76C = 0.8 away within +0x770 = 3 frames of leaving the deadzone.
    assertEquals(victim.surfaceRecovery.state, SurfaceContact.techWall);
    assertTrue(victim.surfaceRecovery.wallJumpQueued);
    assertEquals(victim.facing, 1);
    assertEquals(victim.surfaceRecovery.wallJumpsUsed, 1);
    const { x, z } = victim.motion;
    const serial = victim.jump.serial;
    // The same five-frame hang as a wall tech (PlCo +0x774 = 5).
    for (let frame = 1; frame < WALL_TECH_STARTUP_FRAMES; frame++) {
      playPads(run, {}, {});
      assertEquals(victim.motion.x, x);
      assertEquals(victim.motion.z, z);
    }
    playPads(run, {}, {});
    const reference = referenceWall(character);
    assertLeavesWall(victim, reference.jumpX, reference.jumpZ);
    assertGreaterThan(victim.motion.deltaZ, 0.0);
    assertEquals(victim.jump.serial, serial + 1);
  }
});

test("a fighter without Melee's wall jump trait doesn't wall jump", () => {
  const run = startDrift(Character.archer);
  const { victim } = run;
  victim.tuning = { ...victim.tuning, surface: { ...victim.tuning.surface, canWallJump: false } };
  flickOffSide(run);
  assertEquals(victim.surfaceRecovery.state, SurfaceContact.none);
  assertEquals(victim.surfaceRecovery.wallJumpsUsed, 0);
  assertLessThan(victim.motion.deltaZ, 0.0);
});
