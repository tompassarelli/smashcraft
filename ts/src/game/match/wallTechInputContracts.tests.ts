// Wall techs, wall jumps and ceiling techs through a controller's real input
// path (helperPads.ts): an Archer's forward air launches each fighter from
// below the right ledge into the main deck's side, at medium and high
// percent; each fighter drifts into the side and flicks away from it; and an
// Archer's up smash launches each fighter into a raised deck's underside.
import { max, min } from "../../runtime/numbers";
import { assertDefined, assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, SurfaceContact } from "../sim/codes";
import { WALL_TECH_STARTUP_FRAMES, canAttack, isIntangible, isTumbling } from "../sim/conditions";
import { type Fighter, createFighter } from "../sim/fighter";
import { MAIN_DECK_BODY_SURFACES, SOLID_DECK_TEST_STAGE, solidSurfaceAt, surfaceRight } from "../sim/stage";
import { bodyTop } from "../sim/surfaces";
import { WORLD_UNITS_PER_MELEE_UNIT, melee } from "../sim/tuning";
import { type Pad, type PadMatch, padMatch, playPads } from "./helperPads";
import { testMatch } from "./testMatch";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import { AttackStyle } from "../sim/codes";
import { resolveAttacks } from "../sim/attacks";
import { attackStartupFrames } from "../sim/moves";
import { SURFACE_TECH_WALL_COLLISION_GRACE_FRAMES } from "../sim/surfaces";

/**
 * Each fighter's Melee reference, in Melee units a frame: ftCo_DatAttrs
 * +0x100 push-off, +0x104/+0x108 wall jump and +0x10C ceiling impulse of Fox,
 * Falco and Captain Falcon, and the ceiling tech's impulse event frame
 * (retail-ceiling-tech-events.json).
 */
function referenceWall(character: Character): {
  readonly pushOff: number;
  readonly jumpX: number;
  readonly jumpZ: number;
  readonly ceiling: number;
  readonly ceilingFrame: number;
} {
  switch (character) {
    default:
    case Character.archer:
      return { pushOff: 0.5, jumpX: 1.399999976158142, jumpZ: 3.299999952316284, ceiling: 0.699999988079071, ceilingFrame: 14 };
    case Character.rifleman:
      return { pushOff: 0.5, jumpX: 1.2999999523162842, jumpZ: 3.5999999046325684, ceiling: 0.699999988079071, ceilingFrame: 14 };
    case Character.demonHunter:
      return { pushOff: 0.5, jumpX: 1.399999976158142, jumpZ: 3.0999999046325684, ceiling: 2.0, ceilingFrame: 11 };
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
  // Final Destination's reference walls, which these contracts measure against.
  match.game.stageChoice = 0;
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
  /** The first frame after the hit's hitlag, and the frame the victim met a solid surface. */
  readonly free: number;
  readonly contact: number;
}

/** Plays the strike and the victim's pads until the victim meets a solid surface. */
function launch(run: Run, victimPadAt: (frame: number) => Pad, strike: Pad = STRIKE): Launch {
  let free: number | undefined;
  for (let frame = 1; frame <= 40; frame++) {
    playPads(run, frame === 1 ? strike : {}, victimPadAt(frame));
    const { victim } = run;
    if (free === undefined && isTumbling(victim) && victim.launch.hitlag === 0) free = frame;
    if (victim.surfaceRecovery.contactSerial > 0) return { free: assertDefined(free, "launch"), contact: frame };
  }
  throw new Error("the victim never met a solid surface");
}

/** Every selectable fighter; heroes take Archer's reference (Fox) wall values (sim/tuning.ts). */
const VICTIMS = SELECTABLE_CHARACTERS;
const NEUTRAL = (): Pad => ({});

function assertMetSide(victim: Fighter): void {
  const { contactX, contactNormalX } = victim.surfaceRecovery;
  assertGreaterThan(contactNormalX, 0.0);
  assertLessThan(contactX, surfaceRight(0, 0, 0));
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
  match.game.stageChoice = 0;
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

/** On the solid-deck test stage, the Archer facing right below its left raised deck and the victim beside it, at 120%. */
function startUnderDeck(victimCharacter: Character): Run {
  const match = testMatch(3, Character.archer);
  match.game.stageChoice = SOLID_DECK_TEST_STAGE;
  const victim = createFighter(victimCharacter, -380.0, -1);
  victim.status.damage = 120.0;
  match.world.fighters[0] = createFighter(Character.archer, -420.0, 1);
  match.world.fighters[1] = victim;
  return { ...padMatch(match, "ceiling-tech"), victim };
}

/** The left raised deck's underside on the solid-deck test stage. */
const RAISED_UNDERSIDE_Z = solidSurfaceAt(SOLID_DECK_TEST_STAGE, MAIN_DECK_BODY_SURFACES + 2).startZ;

/** Where the fighter stands when its Melee ECB top (Fox's, Falco's or Captain Falcon's) meets that underside. */
const underUnderside = (character: Character) => f32(RAISED_UNDERSIDE_Z - melee(bodyTop(character)));

test("a launch into a raised deck's underside meets it with the fighter's ECB top and rebounds from there", () => {
  for (const character of VICTIMS) {
    // The up smash (C-stick up) launches the victim into the deck's underside.
    const run = startUnderDeck(character);
    launch(run, NEUTRAL, { cy: 1.0 });
    const { victim } = run;
    assertEquals(victim.surfaceRecovery.contactKind, SurfaceContact.ceiling);
    assertEquals(victim.surfaceRecovery.contactZ, RAISED_UNDERSIDE_Z);
    assertEquals(victim.motion.z, underUnderside(character));
    assertLessThan(victim.launch.knockbackZ, 0.0);
  }
});

test("a ceiling tech starts at the ECB top's contact and moves each fighter sideways by its reference's impulse on its event frame", () => {
  for (const character of VICTIMS) {
    // The up smash launches the victim into the deck's underside; it techs on its first free frame.
    const missed = launch(startUnderDeck(character), NEUTRAL, { cy: 1.0 });
    const run = startUnderDeck(character);
    launch(run, (frame) => ({ trigger: frame === missed.free }), { cy: 1.0 });
    const { victim } = run;
    assertEquals(victim.surfaceRecovery.contactKind, SurfaceContact.techCeiling);
    assertEquals(victim.surfaceRecovery.contactZ, RAISED_UNDERSIDE_Z);
    assertEquals(victim.motion.z, underUnderside(character));
    // Held airborne from here: the floor below this deck is nearer than the fall to the impulse frame.
    victim.tuning = { ...victim.tuning, physics: { ...victim.tuning.physics, gravity: 0.0 } };
    const reference = referenceWall(character);
    for (let frame = 1; frame < reference.ceilingFrame; frame++) {
      playPads(run, {}, {});
      assertEquals(victim.motion.vx, 0.0);
      assertTrue(isIntangible(victim));
    }
    // On the event, the stick fully left sets speed to -passiveceil_vel_x, then a frame of air drift acts on it (ftCo_PassiveCeil_Anim, ft_80084DB0).
    playPads(run, {}, { x: -1.0 });
    assertFalse(victim.motion.grounded);
    assertTrue(victim.surfaceRecovery.velocityApplied);
    assertFalse(isIntangible(victim));
    // Melee's drift: below the air speed it adds the acceleration, above it (Illidan's 2.0) it loses the air friction.
    const { airAcceleration, airFriction, airSpeed } = victim.tuning.physics;
    const impulse = melee(reference.ceiling);
    const expected = -(impulse > airSpeed ? max(airSpeed, f32(impulse - airFriction)) : min(airSpeed, f32(impulse + airAcceleration)));
    assertEquals(victim.motion.vx, expected);
  }
});

/**
 * Puts the Archer in slot 0 over the victim with a fresh, active neutral air and
 * resolves it: true when it struck the victim's body.
 */
function strikeOverlapping(run: Run): boolean {
  const attacker = assertDefined(run.match.world.fighters[0], "attacker");
  const { victim } = run;
  const damage = victim.status.damage;
  attacker.motion.x = victim.motion.x;
  attacker.motion.z = victim.motion.z;
  attacker.motion.grounded = false;
  attacker.launch.hitlag = 0;
  attacker.attack.style = AttackStyle.neutralAir;
  attacker.attack.frame = attackStartupFrames(AttackStyle.neutralAir);
  attacker.attack.duration = attacker.attack.frame + 10;
  attacker.attack.serial++;
  attacker.attack.hit = false;
  resolveAttacks(run.match.world);
  return victim.status.damage > damage;
}

/**
 * From the frame the victim enters the wall recovery, counts the frames an
 * overlapping strike passes through before one first connects.
 */
function passThroughFrames(run: Run): number {
  const { victim } = run;
  assertEquals(victim.surfaceRecovery.state, SurfaceContact.techWall);
  for (let frames = 0; frames < 40; frames++) {
    if (strikeOverlapping(run)) return frames;
    assertTrue(isIntangible(victim));
    playPads(run, {}, {});
  }
  throw new Error("the victim was never struck");
}

// Melee enters the wall tech, the wall tech's jump and the plain wall jump through
// ftCo_800C1E64 (melee:src/melee/ft/kinds/ftCommon/ftCo_PassiveWall.c, called
// from ftCo_800C1D38 and melee:src/melee/ft/ftwalljump.c ftWallJump_8008169C),
// which ends with ftColl_8007B760(gobj, PlCo +0x764 = 14): each is intangible
// for 14 frames from wall contact, the frame it enters included.
test("a wall tech, its jump and a plain wall jump are each intangible for Melee's 14 frames, then hittable", () => {
  assertEquals(SURFACE_TECH_WALL_COLLISION_GRACE_FRAMES, 14);
  for (const character of VICTIMS) {
    const name = fighterName(character);
    const missed = launch(startRun(character, 120.0), NEUTRAL);
    const tech = startRun(character, 120.0);
    launch(tech, (frame) => ({ trigger: frame === missed.free }));
    assertFalse(tech.victim.surfaceRecovery.wallJumpQueued);
    assertEquals(passThroughFrames(tech), 14, `${name} wall tech`);
    const techJump = startRun(character, 120.0);
    launch(techJump, (frame) => ({ trigger: frame === missed.free, y: frame === missed.contact ? 1.0 : 0.0 }));
    assertTrue(techJump.victim.surfaceRecovery.wallJumpQueued);
    assertEquals(passThroughFrames(techJump), 14, `${name} wall tech jump`);
    const wallJump = startDrift(character);
    flickOffSide(wallJump);
    assertTrue(wallJump.victim.surfaceRecovery.wallJumpQueued);
    assertEquals(passThroughFrames(wallJump), 14, `${name} wall jump`);
  }
});
