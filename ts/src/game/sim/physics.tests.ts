import { mutableProjectile } from "./fighterProjectiles";
// The large fixture set retains independent retail reference values across
// arithmetic, motion and contact; each group must survive changes to production.
// Retail physics references: NTSC 1.02 recordings and extracted parameters.
import { floorMod } from "wisp/src/sim/intMath";
import { assertEquals, assertFalse, assertGreaterThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { max } from "../../runtime/numbers";
import { addFloat32, divideFloat32 } from "wisp/src/sim/binary32";
import { f32 } from "wisp/src/sim/f32";
import { resolveAttacks } from "./attacks";
import { AttackStyle, Character, ContactKind, DownState, GrabAction, GroundAction, ProjectileKind, ShieldBreak } from "./codes";
import { SPOT_DODGE_FRAMES, GROUND_ROLL_FRAMES, canAttack, fighterPoseFacing, isForwardGroundRoll } from "./conditions";
import { beginDamageContacts, finishDamageContacts, queueDamageContact } from "./contacts";
import { type Fighter,  } from "./fighter";
import { createReferenceFighter } from "./referenceRig";
import { resolveGrabs } from "./grabs";
import { beginAirDodge, beginJump } from "./jumpsAndDodges";
import {
  damageLevelForKnockback,
  fixedHitKnockback,
  ordinaryHitKnockback,
  ordinaryHitstunFrames,
  victimHitlagFrames,
} from "./knockback";
import { attackStartupFrames, grabContactFrame } from "./moves";
import { projectileCount, updateProjectiles } from "./projectiles";
import type { Controls, Roster } from "./roster";
import { digitalShieldDamage, digitalShieldPushback, digitalShieldRecoil, digitalShieldstunDuration, digitalShieldstunFrames } from "./shield";
import { advanceFighter } from "./step";
import { respawnFighter } from "./stocks";
import { advanceSolo, controls, hitEffect, soloWorld, testBeginAttacks, testGrabFrame, testWorld, withPhysics } from "./testWorld";
import { heroBody } from "./heroes/heroBodies";
import { type FighterPhysics, INITIAL_DASH_FRAMES, authoredPhysics, melee } from "./tuning";

const TOLERANCE_4 = 0.00009999999747378752;
const TOLERANCE_6A = 0.0006000000284984708;
const TOLERANCE_6B = 0.00005999999848427251;

/** Whether two binary32 values differ by more than delta, computed as the test interpreter computes it. */
const differs = (actual: number, expected: number, delta: number) => Math.abs(f32(actual - expected)) > delta;

function retailCombatContact(world: Roster, knockback: number, dx: number, dz: number): void {
  beginDamageContacts();
  queueDamageContact(world, 0, 1, hitEffect(5.0, 0.0, knockback, dx, dz), 1, ContactKind.launch, false, undefined);
  finishDamageContacts(world);
}

test("retail combat stacking starts on the tenth moving frame and freezes in hitlag [reference]", () => {
  for (const age of [9, 10]) {
    const owner = createReferenceFighter(Character.sylvanas, -300.0, 1);
    const target = createReferenceFighter(Character.rifleman, -100.0, -1);
    const world = testWorld(owner, target);
    const input = controls();
    target.motion.grounded = false;
    target.motion.z = 300.0;
    retailCombatContact(world, 100.0, 1.0, 0.0);
    assertEquals(target.launch.knockbackAge, 0);
    assertNear(target.launch.knockbackX, f32(17.9999995977), f32(0.000001));
    for (let frozenFrame = 1; frozenFrame <= 3; frozenFrame++) {
      advanceFighter(world, 1, 0, input, 0.0);
      assertEquals(target.launch.knockbackAge, 0);
      assertEquals(target.motion.x, -100.0);
    }
    for (let movingFrame = 1; movingFrame <= age; movingFrame++) {
      advanceFighter(world, 1, 0, input, 0.0);
      assertEquals(target.launch.knockbackAge, movingFrame);
    }
    const residual = target.launch.knockbackX;
    retailCombatContact(world, 20.0, 1.0, 0.0);
    if (age === 9) assertNear(target.launch.knockbackX, f32(3.5999999195), f32(0.000001));
    else assertEquals(target.launch.knockbackX, residual);
    assertEquals(target.launch.knockbackAge, 0);
    assertEquals(target.launch.hitstun, 8);
  }
});

test("retail combat stacking merges each axis once after strongest contact selection [reference]", () => {
  const owner = createReferenceFighter(Character.sylvanas, 0.0, 1);
  const target = createReferenceFighter(Character.rifleman, 100.0, -1);
  const world = testWorld(owner, target);
  target.motion.grounded = false;
  target.motion.z = 300.0;
  target.launch.knockbackX = 18.0;
  target.launch.knockbackZ = -9.0;
  target.launch.knockbackAge = 10;
  beginDamageContacts();
  queueDamageContact(world, 0, 1, hitEffect(5.0, 0.0, 100.0, -0.6000000238418579, 0.800000011920929), 1, ContactKind.launch, false, undefined);
  queueDamageContact(world, 0, 1, hitEffect(5.0, 0.0, 20.0, 1.0, 0.0), 1, ContactKind.launch, false, undefined);
  finishDamageContacts(world);
  assertEquals(target.status.damage, 10.0);
  assertNear(target.launch.knockbackX, f32(7.2000002414), f32(0.000001));
  assertNear(target.launch.knockbackZ, f32(5.3999996781), f32(0.000001));
  assertEquals(target.launch.damageLevel, 3);
  assertEquals(target.launch.hitstun, 40);
  // A weaker same-direction axis is retained; an incoming zero cannot erase it.
  target.launch.knockbackAge = 10;
  retailCombatContact(world, 20.0, 0.0, 1.0);
  assertNear(target.launch.knockbackX, f32(7.2000002414), f32(0.000001));
  assertNear(target.launch.knockbackZ, f32(5.3999996781), f32(0.000001));
  target.launch.knockbackAge = 10;
  retailCombatContact(world, 100.0, -1.0, -1.0);
  assertNear(target.launch.knockbackX, -f32(10.7999993563), f32(0.000001));
  assertNear(target.launch.knockbackZ, -f32(12.5999999196), f32(0.000001));
});

test("retail combat ground tangent uses the new contact, then traction rather than air decay [reference]", () => {
  for (const facing of [-1, 1]) {
    const owner = createReferenceFighter(Character.sylvanas, -100.0, 1);
    const target = createReferenceFighter(Character.rifleman, 0.0, -1);
    const world = testWorld(owner, target);
    const input = controls();
    target.motion.surface = 0;
    target.launch.knockbackX = f32(facing * 30.0);
    target.launch.knockbackAge = 10;
    retailCombatContact(world, 20.0, f32(facing * 1.0), -1.0);
    assertTrue(target.motion.grounded);
    assertEquals(target.launch.knockbackX, f32(facing * 30.0));
    assertNear(target.launch.groundKnockbackX, facing * f32(3.5999999195), f32(0.000001));
    for (let frame = 1; frame <= 4; frame++) advanceFighter(world, 1, 0, input, 0.0);
    assertNear(target.motion.x, facing * f32(3.1199999195), f32(0.000001));
    assertNear(target.launch.knockbackX, facing * f32(3.1199999195), f32(0.000001));
    assertEquals(target.launch.knockbackZ, 0.0);
    assertEquals(target.launch.damageLevel, 0);
    for (let frame = 1; frame <= 7; frame++) advanceFighter(world, 1, 0, input, 0.0);
    assertEquals(target.launch.knockbackX, 0.0);
    assertEquals(target.launch.groundKnockbackX, 0.0);
  }
});

test("retail combat damage levels use all three unrounded scaled thresholds [reference]", () => {
  assertEquals(damageLevelForKnockback(24.999000549316406), 0);
  assertEquals(damageLevelForKnockback(25.0), 1);
  assertEquals(damageLevelForKnockback(52.499000549316406), 1);
  assertEquals(damageLevelForKnockback(52.5), 2);
  assertEquals(damageLevelForKnockback(79.9990005493164), 2);
  assertEquals(damageLevelForKnockback(80.0), 3);
  assertEquals(ordinaryHitstunFrames(24.999000549316406), 9);
  assertEquals(ordinaryHitstunFrames(25.0), 10);
  assertEquals(ordinaryHitstunFrames(52.5), 21);
  assertEquals(ordinaryHitstunFrames(80.0), 32);
});

test("retail combat ground bounce uses a ten-degree threshold and four-fifths vertical speed [reference]", () => {
  for (const grounded of [false, true]) {
    for (const steep of [false, true]) {
      const owner = createReferenceFighter(Character.sylvanas, 0.0, 1);
      const target = createReferenceFighter(Character.rifleman, 100.0, -1);
      const world = testWorld(owner, target);
      target.motion.grounded = grounded;
      target.motion.z = grounded ? 0.0 : 300.0;
      // Unit launch directions at nine and eleven degrees below horizontal.
      const dx = steep ? 0.9816271662712097 : 0.9876883625984192;
      const dz = steep ? -0.1908089965581894 : -0.15643446147441864;
      retailCombatContact(world, 100.0, dx, dz);
      assertFalse(target.motion.grounded);
      assertEquals(target.launch.damageLevel, 3);
      assertEquals(target.down.state, DownState.tumble);
      // Expected multiplication results include the test interpreter's float32 rounding.
      assertNear(target.launch.knockbackX, steep ? f32(17.6692886353) : f32(17.7783908844), f32(0.000001));
      const expectedZ = steep ? (grounded ? f32(2.7476495125) : -f32(3.43456184)) : -f32(2.8158203078);
      assertNear(target.launch.knockbackZ, expectedZ, f32(0.000001));
    }
  }
});

// Factual original-game inputs from smashcraft:docs/smash-melee-reference/physics-parameters.json.
// This fixture exercises the production engine without adding a roster character.
const FALCO_REFERENCE_PHYSICS: FighterPhysics = {
  weight: 80.0,
  gravity: melee(0.17000000178813934),
  terminalSpeed: melee(3.0999999046325684),
  fastFallSpeed: melee(3.5),
  airAcceleration: melee(f32(0.019999999552965164 + 0.05000000074505806)),
  airSpeed: melee(0.8299999833106995),
  airFriction: melee(0.019999999552965164),
  airCap: melee(4.0),
  traction: melee(0.07999999821186066),
  dashSpeed: melee(1.899999976158142),
  runSpeed: melee(1.5),
  walkSpeed: melee(1.399999976158142),
  jumpSquatFrames: 5,
  fullJumpSpeed: melee(4.099999904632568),
  shortJumpSpeed: melee(1.899999976158142),
  aerialJumpSpeed: f32(melee(4.099999904632568) * 0.9399999976158142),
  jumpMomentum: 1.0,
  jumpHorizontalSpeed: melee(0.699999988079071),
  jumpHorizontalCap: melee(1.7000000476837158),
  aerialJumpHorizontalSpeed: melee(0.9399999976158142),
  shieldBreakSpeed: melee(3.299999952316284),
  walkAccelerationMultiplier: 0.20000000298023224,
  walkAccelerationBase: 0.10000000149011612,
  groundAccelerationMultiplier: 0.10000000149011612,
  groundAccelerationBase: 0.019999999552965164,
  groundSpeedCap: melee(3.0),
};

function falcoRig(character: Character, x: number, facing: number): Fighter {
  const f = createReferenceFighter(character, x, facing);
  f.tuning.physics = FALCO_REFERENCE_PHYSICS;
  return f;
}

const RECORDED_FALCO_FALL = [
  9.872425079345703, 9.532424926757812, 9.022424697875977, 8.342424392700195, 7.492424488067627,
  6.472424507141113, 5.282424449920654, 3.922424554824829, 2.3924245834350586, 0.6924247741699219,
];

function recordedFalcoFallFirstDifference(hostCharacter: Character, initialVelocity: number): number {
  const f = falcoRig(hostCharacter, -360.0, 1);
  const input = controls();
  f.motion.grounded = false;
  f.motion.surface = undefined;
  f.motion.z = melee(10.042425155639648);
  f.motion.vz = initialVelocity;
  let firstDifference = 0;
  RECORDED_FALCO_FALL.forEach((position, sample) => {
    advanceSolo(f, 0, input, 0.0);
    if (firstDifference === 0 && (f.motion.grounded || differs(f.motion.z, melee(position), TOLERANCE_4) || f.motion.x !== -360)) {
      firstDifference = -59 + sample;
    }
  });
  return firstDifference;
}

test("a recorded NTSC Falco neutral fall matches ten independent positions [reference]", () => {
  for (const host of [Character.sylvanas, Character.rifleman]) assertEquals(recordedFalcoFallFirstDifference(host, 0.0), 0);
});

test("the recorded Falco fall detects a perturbed velocity at the first frame [invariant]", () => {
  assertEquals(recordedFalcoFallFirstDifference(Character.sylvanas, 0.05999999865889549), -59);
});

function recordedFalcoJumpFirstDifference(hostCharacter: Character, jumpInputFrame: number): number {
  const f = falcoRig(hostCharacter, melee(5.241994857788086), 1);
  const input = controls({ jumpHeld: true });
  let firstDifference = 0;
  for (let frame = 25; frame <= 30; frame++) {
    input.jumpPressed = frame === jumpInputFrame;
    advanceSolo(f, 0, input, 0.0);
    const grounded = frame < 30;
    const height = grounded ? 0.0 : melee(f32(4.100100040435791 - 0.00009999999747378752));
    const velocity = grounded ? 0.0 : melee(4.099999904632568);
    if (firstDifference === 0 && (f.motion.grounded !== grounded || f.jump.squat > 0 !== grounded
      || differs(f.motion.z, height, TOLERANCE_4) || differs(f.motion.vz, velocity, TOLERANCE_4))) {
      firstDifference = frame;
    }
  }
  return firstDifference;
}

const RECORDED_FALCO_DASH_POSITION = [36.60000228881836, 34.86000061035156, 33.20000076293945, 31.6200008392334, 30.1200008392334];
const RECORDED_FALCO_DASH_SPEED = [-1.8200000524520874, -1.7400000095367432, -1.659999966621399, -1.5799999237060547, -1.4999998807907104];

function recordedFalcoDashEntryMatches(hostCharacter: Character): boolean {
  const f = falcoRig(hostCharacter, melee(38.61000061035156), -1);
  f.motion.vx = melee(-0.1899999976158142);
  const input = controls({ direction: -1 });
  advanceSolo(f, 0, input, 0.0);
  const entryMatches = !differs(f.motion.x, melee(38.42000198364258), TOLERANCE_6A)
    && Math.abs(f32(f.motion.vx + melee(1.9000000953674316))) <= TOLERANCE_6B && f.ground.dashFrame === 1;
  advanceSolo(f, 0, input, 0.0);
  const nextFrameMatches = !differs(f.motion.x, melee(36.60000228881836), TOLERANCE_6A)
    && Math.abs(f32(f.motion.vx + melee(1.8200000524520874))) <= TOLERANCE_6B;
  return entryMatches && nextFrameMatches;
}

function recordedFalcoDashFirstDifference(hostCharacter: Character, initialSpeed: number): number {
  const f = falcoRig(hostCharacter, melee(38.42000198364258), -1);
  f.motion.vx = melee(initialSpeed);
  f.ground.dashFrame = 5;
  f.ground.dashDirection = -1;
  const input = controls({ direction: -1 });
  let firstDifference = 0;
  for (let sample = 0; sample <= 4; sample++) {
    advanceSolo(f, 0, input, 0.0);
    if (firstDifference === 0 && (differs(f.motion.x, melee(RECORDED_FALCO_DASH_POSITION[sample]!), TOLERANCE_6A)
      || differs(f.motion.vx, melee(RECORDED_FALCO_DASH_SPEED[sample]!), TOLERANCE_6B))) {
      firstDifference = -33 + sample;
    }
  }
  return firstDifference;
}

test("recorded Falco dash overspeed braking matches both original fighter hosts [reference]", () => {
  for (const host of [Character.sylvanas, Character.rifleman]) assertEquals(recordedFalcoDashFirstDifference(host, -1.9000000953674316), 0);
});

test("the recorded Falco dash detects a perturbed overspeed at its first frame [invariant]", () => {
  assertEquals(recordedFalcoDashFirstDifference(Character.sylvanas, -1.8400001525878906), -33);
});

test("recorded Falco dash entry uses the walk self velocity for entry displacement [reference]", () => {
  for (const host of [Character.sylvanas, Character.rifleman]) assertTrue(recordedFalcoDashEntryMatches(host));
});

// The test-only reference rig uses PlFc.dat movement values from the locally
// identified NTSC 1.02 extraction; it never changes playable fighter defaults.
test("retail walk uses character acceleration and the common taper [reference]", () => {
  for (const host of [Character.sylvanas, Character.rifleman]) {
    const f = falcoRig(host, 0.0, 1);
    const input = controls({ direction: 1, walking: true });
    for (const expected of [f32(1.8), f32(2.5071428), f32(3.1385202), f32(3.7022507)]) {
      advanceSolo(f, 0, input, 0.0);
      assertNear(f.motion.vx, expected, f32(0.00001));
    }
  }
});

test("retail run tapers below target and brakes overspeed by character friction [reference]", () => {
  const input = controls({ direction: 1 });
  const belowTarget = falcoRig(Character.sylvanas, 0.0, 1);
  belowTarget.motion.vx = melee(0.8999999761581421);
  belowTarget.ground.dashFrame = INITIAL_DASH_FRAMES + 1;
  belowTarget.ground.dashDirection = 1;
  belowTarget.ground.action = GroundAction.run;
  advanceSolo(belowTarget, 0, input, 0.0);
  assertNear(belowTarget.motion.vx, f32(5.5152), f32(0.00001));
  const overspeed = falcoRig(Character.sylvanas, 100.0, 1);
  overspeed.motion.vx = melee(1.899999976158142);
  overspeed.ground.dashFrame = INITIAL_DASH_FRAMES + 1;
  overspeed.ground.dashDirection = 1;
  overspeed.ground.action = GroundAction.run;
  advanceSolo(overspeed, 0, input, 0.0);
  assertNear(overspeed.motion.vx, f32(1.82) * 6, f32(0.00001));
});

test("a retail run turn preserves facing until ground velocity crosses [reference]", () => {
  const f = falcoRig(Character.sylvanas, 0.0, 1);
  f.motion.vx = melee(1.0);
  f.ground.dashFrame = INITIAL_DASH_FRAMES + 1;
  f.ground.dashDirection = 1;
  f.ground.action = GroundAction.turnRun;
  f.ground.turnRunEntryFacing = 1;
  const input = controls({ direction: -1 });
  for (let tick = 1; tick <= 9; tick++) advanceSolo(f, 0, input, 0.0);
  assertNear(f.motion.vx, -f32(0.48), f32(0.00001));
  assertEquals(f.facing, 1);
  advanceSolo(f, 0, input, 0.0);
  assertNear(f.motion.vx, -f32(1.2), f32(0.00001));
  assertEquals(f.facing, -1);
  assertEquals(f.ground.action, GroundAction.turnRun);
});

test("a recorded NTSC Falco jump has five grounded frames, then a raw takeoff [reference]", () => {
  for (const host of [Character.sylvanas, Character.rifleman]) assertEquals(recordedFalcoJumpFirstDifference(host, 25), 0);
});

test("the recorded Falco jump detects a delayed input on its original frame [invariant]", () => {
  assertEquals(recordedFalcoJumpFirstDifference(Character.sylvanas, 26), 25);
});

test("grounded knockback matches the recorded first released displacement [reference]", () => {
  for (const character of [Character.sylvanas, Character.rifleman]) {
    const f = createReferenceFighter(character, melee(-11.548782348632812), 1);
    // Captain Falcon observation: only the observed traction is required here.
    withPhysics(f, { traction: melee(0.07999999821186066) });
    const input = controls({ down: true, verticalDirection: -1 });
    f.launch.knockbackX = melee(0.7562744617462158);
    f.launch.hitstun = 10;
    advanceSolo(f, 0, input, 0.0);
    assertNear(f.launch.knockbackX, 0.6762744784355164 * 6, f32(0.00001));
    assertNear(f.motion.x, -10.87250804901123 * 6, f32(0.0001));
    assertEquals(f.launch.hitstun, 9);
    assertTrue(f.motion.grounded);
  }
});

test("grounded knockback traction clamps both directions without reversing [reference]", () => {
  for (const direction of [-1, 0, 1]) {
    const f = createReferenceFighter(Character.sylvanas, 0.0, 1);
    f.launch.knockbackX = melee(f32(direction * 0.03999999910593033));
    f.launch.hitstun = 10;
    advanceSolo(f, 0, controls(), 0.0);
    assertEquals(f.launch.knockbackX, 0.0);
    assertEquals(f.motion.x, 0.0);
    assertTrue(f.motion.grounded);
  }
});

const RECORDED_GROUNDED_DAMAGE_POSITION = [
  -10.87250804901123, -10.276233673095703, -9.75995922088623, -9.323684692382812, -8.96741008758545,
  -8.69113540649414, -8.494860649108887, -8.378585815429688, -8.342310905456543,
];
const RECORDED_GROUNDED_DAMAGE_VELOCITY = [
  0.6762744784355164, 0.5962744951248169, 0.5162745118141174, 0.43627455830574036, 0.3562745749950409,
  0.27627459168434143, 0.19627460837364197, 0.11627461761236191, 0.03627462312579155,
];

function recordedGroundedDamageFirstDifference(character: Character, velocityOffset: number): number {
  const f = createReferenceFighter(character, melee(-11.548782348632812), 1);
  // Shared grounded-damage rule with the observation's traction, not a full character rig.
  withPhysics(f, { traction: melee(0.07999999821186066) });
  const input = controls({ down: true, verticalDirection: -1 });
  f.launch.knockbackX = f32(melee(0.7562744617462158) + velocityOffset);
  f.launch.hitlag = 4;
  f.launch.hitstun = 10;
  f.status.damage = 11.0;
  let firstDifference = 0;
  for (let sample = 1; sample <= 13; sample++) {
    advanceSolo(f, 0, input, 0.0);
    const position = sample < 4 ? -11.548782348632812 : RECORDED_GROUNDED_DAMAGE_POSITION[min12(sample) - 4]!;
    const velocity = sample < 4 ? 0.7562744617462158 : sample <= 12 ? RECORDED_GROUNDED_DAMAGE_VELOCITY[sample - 4]! : 0.0;
    const hitlag = max(0, 4 - sample);
    const hitstun = sample < 4 ? 10 : 13 - sample;
    if (firstDifference === 0 && (differs(f.motion.x, melee(position), TOLERANCE_4)
      || differs(f.launch.knockbackX, melee(velocity), 0.000009999999747378752) || f.launch.hitlag !== hitlag
      || f.launch.hitstun !== hitstun || !f.motion.grounded || f.launch.knockbackZ !== 0 || f.motion.vx !== 0
      || f.status.damage !== 11 || canAttack(f) !== (sample === 13) || f.motion.crouching !== (sample === 13))) {
      firstDifference = 3432 + sample;
    }
  }
  return firstDifference;
}

/** Recorded positions end at sample 12. */
const min12 = (sample: number) => (sample < 12 ? sample : 12);

test("recorded NTSC grounded damage matches freeze release, traction and actionability [reference]", () => {
  for (const character of [Character.sylvanas, Character.rifleman]) assertEquals(recordedGroundedDamageFirstDifference(character, 0.0), 0);
});

test("recorded grounded damage detects a perturbed knockback on the first frame [invariant]", () => {
  assertEquals(recordedGroundedDamageFirstDifference(Character.sylvanas, 0.05999999865889549), 3433);
});

test("fast fall persists after release and aerial startup but clears on landing and jump [reference]", () => {
  for (const character of [Character.sylvanas, Character.rifleman]) {
    const f = createReferenceFighter(character, 0.0, 1);
    const other = createReferenceFighter(Character.rifleman, 1000.0, -1);
    const world = testWorld(f, other);
    const input = controls({ down: true });
    f.motion.grounded = false;
    f.motion.z = 300.0;
    f.motion.vz = -1.0;
    advanceFighter(world, 0, 0, input, 0.0);
    assertTrue(f.motion.fastFalling);
    input.down = false;
    input.direction = 1;
    advanceFighter(world, 0, 0, input, 0.0);
    const fastFallSpeed = character === Character.sylvanas ? -f32(20.40000057220459) : -21.0;
    assertNear(f.motion.vz, fastFallSpeed, f32(0.000001));
    testBeginAttacks(world, AttackStyle.neutralAir, undefined);
    advanceFighter(world, 0, 0, input, 0.0);
    assertTrue(f.motion.fastFalling);
    assertNear(f.motion.vz, fastFallSpeed, f32(0.000001));
    f.motion.z = 1.0;
    advanceFighter(world, 0, 0, input, 0.0);
    assertTrue(f.motion.grounded);
    assertFalse(f.motion.fastFalling);
    f.motion.grounded = false;
    f.motion.z = 200.0;
    f.motion.fastFalling = true;
    f.attack.cooldown = 0;
    f.landing.lag = 0;
    beginJump(f, 0);
    assertFalse(f.motion.fastFalling);
    assertGreaterThan(f.motion.vz, 0.0);
  }
});

test("fast fall requires descending self velocity, and an air dodge clears it [reference]", () => {
  const f = createReferenceFighter(Character.sylvanas, 0.0, 1);
  const input = controls({ down: true });
  f.motion.grounded = false;
  f.motion.z = 300.0;
  f.motion.vz = 1.0;
  f.launch.knockbackZ = -5.0;
  advanceSolo(f, 0, input, 0.0);
  assertFalse(f.motion.fastFalling);
  assertNear(f.motion.vz, -f32(0.38), f32(0.00001));
  advanceSolo(f, 0, input, 0.0);
  assertTrue(f.motion.fastFalling);
  beginAirDodge(f, 0, 0);
  assertFalse(f.motion.fastFalling);
});

/** Places a projectile just behind the target, flying into it. */
function contactProjectile(owner: Fighter, target: Fighter, index: number, kind: ProjectileKind): void {
  const projectile = mutableProjectile(owner, index)!;
  projectile.life = 3;
  projectile.kind = kind;
  projectile.x = f32(target.motion.x - 10);
  projectile.z = f32(target.motion.z + 45);
  projectile.velocityX = 20.0;
  projectile.direction = 1;
}

test("the combat ground contact threshold keeps low downward hits on the floor [reference]", () => {
  for (const airborne of [false, true]) {
    for (const aboveThreshold of [0, 1]) {
      const owner = createReferenceFighter(Character.sylvanas, 0.0, 1);
      const target = createReferenceFighter(Character.rifleman, 100.0, -1);
      const world = testWorld(owner, target);
      const input = controls();
      target.status.damage = 100.0 + aboveThreshold;
      target.motion.grounded = !airborne;
      target.motion.surface = airborne ? undefined : 0;
      target.motion.z = airborne ? 300.0 : 0.0;
      contactProjectile(owner, target, 0, ProjectileKind.recoil);
      updateProjectiles(world);
      assertEquals(target.status.damage, 105.0 + aboveThreshold);
      assertEquals(target.launch.hitlag, 4);
      assertEquals(target.launch.hitstun, 31 + aboveThreshold);
      assertNear(target.launch.knockbackX, aboveThreshold === 0 ? f32(11.5044) : f32(11.57104), f32(0.0001));
      assertEquals(target.motion.grounded, !airborne && aboveThreshold === 0);
      assertEquals(target.down.state, aboveThreshold === 0 ? DownState.none : DownState.tumble);
      if (!airborne && aboveThreshold === 0) {
        assertEquals(target.launch.knockbackZ, 0.0);
        input.verticalDirection = 1;
        for (let frame = 1; frame <= 3; frame++) {
          advanceFighter(world, 1, 0, input, 0.0);
          assertEquals(target.motion.x, 100.0);
          assertEquals(target.motion.z, 0.0);
          assertEquals(target.launch.hitstun, 31);
          assertNear(target.launch.knockbackX, f32(11.5044), f32(0.0001));
          assertTrue(target.motion.grounded);
        }
        assertEquals(target.launch.diSerial, 0);
        input.verticalDirection = 0;
        for (let frame = 1; frame <= 30; frame++) {
          advanceFighter(world, 1, 0, input, 0.0);
          assertFalse(canAttack(target));
        }
        advanceFighter(world, 1, 0, input, 0.0);
        assertTrue(canAttack(target));
        assertEquals(target.landing.lag, 0);
      } else {
        assertNear(target.launch.knockbackZ, aboveThreshold === 0 ? -f32(8.6283) : airborne ? -f32(8.67828) : f32(6.942624), f32(0.0001));
      }
    }
  }
});

test("combat DI uses the actual launch magnitude for authored non-unit directions [reference]", () => {
  const target = createReferenceFighter(Character.demonHunter, 0.0, 1);
  target.motion.grounded = false;
  target.motion.z = 300.0;
  target.launch.knockbackX = 8.0;
  target.launch.diLaunchSpeed = 10.0;
  target.launch.diPending = true;
  target.launch.hitlag = 1;
  advanceSolo(target, 0, controls({ verticalDirection: 1 }), 0.0);
  assertNear(target.launch.diAngleDegrees, 18.0, f32(0.0001));
  assertNear(target.launch.knockbackX, f32(7.31742804), f32(0.0001));
  assertNear(target.launch.knockbackZ, f32(2.37757675), f32(0.0001));
  assertFalse(target.launch.diPending);
});

test("combat shield damage uses integer power before the shieldstun calculation [reference]", () => {
  assertNear(digitalShieldstunDuration(4.0), f32(3.8), f32(0.0001));
  assertNear(digitalShieldstunDuration(4.989999771118164), f32(3.8), f32(0.0001));
  assertEquals(digitalShieldstunFrames(4.0), 3);
  assertEquals(digitalShieldstunFrames(4.989999771118164), 3);
  assertEquals(digitalShieldstunFrames(5.0), 4);
  assertEquals(digitalShieldstunFrames(8.989999771118164), 5);
  assertNear(digitalShieldDamage(4.0), f32(2.8), f32(0.0001));
  assertNear(digitalShieldPushback(4.0), 0.45600005984306335 * 6, f32(0.0001));
  assertNear(digitalShieldPushback(1000.0), 2 * 6, f32(0.0001));
  assertNear(digitalShieldRecoil(4.0), f32(0.3) * 6, f32(0.0001));
});

const RECORDED_SHIELD_ATTACKER_POSITION = [38.35230255126953, 38.228302001953125, 38.19230270385742];
const RECORDED_SHIELD_DEFENDER_POSITION = [45.83152389526367, 46.10752487182617, 46.29352569580078, 46.3895263671875, 46.39552688598633];

function recordedShieldAttackerPosition(frame: number): number {
  return frame < 4 ? 38.56430435180664 : RECORDED_SHIELD_ATTACKER_POSITION[frame < 6 ? frame - 4 : 2]!;
}

function recordedShieldDefenderPosition(frame: number): number {
  return frame < 4 ? 45.46552276611328 : RECORDED_SHIELD_DEFENDER_POSITION[frame < 8 ? frame - 4 : 4]!;
}

/** One frame for slots 0 and 1, in slot order. */
function advanceBoth(world: Roster, first: Readonly<Controls>, second: Readonly<Controls>): void {
  advanceFighter(world, 0, 0, first, 0.0);
  advanceFighter(world, 1, 0, second, 0.0);
}

test("a recorded NTSC digital shield contact matches paired pushback and grounded recoil [reference]", () => {
  for (const sourceCharacter of [Character.sylvanas, Character.rifleman]) {
    for (const targetCharacter of [Character.sylvanas, Character.rifleman]) {
      const source = createReferenceFighter(sourceCharacter, melee(38.56430435180664), 1);
      const target = createReferenceFighter(targetCharacter, melee(45.46552276611328), -1);
      const world = testWorld(source, target);
      const sourceInput = controls();
      const targetInput = controls({ shield: true });
      // Puff's published ground-friction attribute supplies the defender decay.
      withPhysics(target, { traction: melee(0.09000000357627869) });
      withPhysics(source, { traction: melee(0.07999999821186066) });
      target.shield.raised = true;
      target.shield.energy = 43.90003204345703;
      // The recorded held-shield drain happens on the contact tick before impact.
      advanceBoth(world, sourceInput, targetInput);
      beginDamageContacts();
      queueDamageContact(world, 0, 1, hitEffect(4.0, 0.0, 0.0, 0.0, 0.0), 1, ContactKind.flinch, true, undefined);
      finishDamageContacts(world);
      assertNear(target.shield.energy, 40.82003402709961, f32(0.0001));
      assertEquals(target.shield.stun, 3);
      assertEquals(target.launch.hitlag, 4);
      assertEquals(source.launch.hitlag, 4);
      assertNear(target.shield.pushbackX, 0.45600005984306335 * 6, f32(0.0001));
      assertNear(source.shield.recoilX, -f32(0.3) * 6, f32(0.0001));
      for (let frame = 1; frame <= 9; frame++) {
        advanceBoth(world, sourceInput, targetInput);
        assertNear(source.motion.x, recordedShieldAttackerPosition(frame) * 6, f32(0.001));
        assertNear(target.motion.x, recordedShieldDefenderPosition(frame) * 6, f32(0.001));
        assertEquals(target.launch.hitlag, max(0, 4 - frame));
        assertNear(target.shield.energy, frame <= 7 ? 40.82003402709961 : 40.82003402709961 - f32(0.28) * (frame - 7), f32(0.0001));
      }
    }
  }
});

test("detached and airborne contacts don't invent attacker ground recoil [reference]", () => {
  for (const direct of [false, true]) {
    const source = createReferenceFighter(Character.sylvanas, 0.0, 1);
    const target = createReferenceFighter(Character.rifleman, 10.0, -1);
    const world = testWorld(source, target);
    source.motion.grounded = !direct;
    target.shield.raised = true;
    beginDamageContacts();
    queueDamageContact(world, 0, 1, hitEffect(4.0, 0.0, 0.0, 0.0, 0.0), 1, ContactKind.flinch, direct, undefined);
    finishDamageContacts(world);
    assertEquals(source.shield.recoilX, 0.0);
  }
  for (const facing of [-1, 1]) {
    const source = createReferenceFighter(Character.sylvanas, 0.0, facing);
    const target = createReferenceFighter(Character.rifleman, 10.0, -facing);
    const world = testWorld(source, target);
    target.shield.raised = true;
    beginDamageContacts();
    queueDamageContact(world, 0, 1, hitEffect(4.0, 0.0, 0.0, 0.0, 0.0), facing, ContactKind.flinch, true, undefined);
    finishDamageContacts(world);
    assertNear(target.shield.pushbackX, facing * 0.45600005984306335 * 6, f32(0.0001));
    assertNear(source.shield.recoilX, -facing * f32(0.3) * 6, f32(0.0001));
  }
});

test("a later clean hit replaces the remaining shield recoil [reference]", () => {
  const attacker = createReferenceFighter(Character.sylvanas, 0.0, 1);
  const defender = createReferenceFighter(Character.rifleman, 10.0, -1);
  const world = testWorld(attacker, defender);
  defender.shield.raised = true;
  beginDamageContacts();
  queueDamageContact(world, 0, 1, hitEffect(4.0, 0.0, 0.0, 0.0, 0.0), 1, ContactKind.flinch, true, undefined);
  finishDamageContacts(world);
  assertNear(attacker.shield.recoilX, -f32(0.3) * 6, f32(0.0001));
  defender.shield.raised = false;
  beginDamageContacts();
  queueDamageContact(world, 1, 0, hitEffect(5.0, 0.0, 20.0, 1.0, 0.0), -1, ContactKind.launch, false, undefined);
  finishDamageContacts(world);
  assertEquals(attacker.shield.recoilX, 0.0);
  assertNear(attacker.launch.knockbackX, -f32(3.6), f32(0.0001));
});

test("the recorded shield contact detects a perturbed recoil on its first release frame [invariant]", () => {
  const source = createReferenceFighter(Character.sylvanas, melee(38.56430435180664), 1);
  const target = createReferenceFighter(Character.rifleman, melee(45.46552276611328), -1);
  const world = testWorld(source, target);
  const sourceInput = controls();
  const targetInput = controls({ shield: true });
  target.shield.raised = true;
  beginDamageContacts();
  queueDamageContact(world, 0, 1, hitEffect(4.0, 0.0, 0.0, 0.0, 0.0), 1, ContactKind.flinch, true, undefined);
  finishDamageContacts(world);
  source.shield.recoilX = f32(source.shield.recoilX + melee(0.05999999865889549));
  for (let frame = 1; frame <= 3; frame++) {
    advanceBoth(world, sourceInput, targetInput);
    assertNear(source.motion.x, 38.56430435180664 * 6, f32(0.001));
  }
  advanceBoth(world, sourceInput, targetInput);
  assertNear(source.motion.x - recordedShieldAttackerPosition(4) * 6, f32(0.06) * 6, f32(0.001));
});

test("airborne shield recoil decays as a separate vector without changing self velocity [reference]", () => {
  const withRecoil = createReferenceFighter(Character.sylvanas, 0.0, 1);
  const control = createReferenceFighter(Character.sylvanas, 0.0, 1);
  const input = controls();
  for (const f of [withRecoil, control]) {
    f.motion.grounded = false;
    f.motion.z = 20.0;
    f.motion.vz = 1.0;
    f.launch.hitstun = 10;
    f.launch.hitlag = 2;
  }
  withRecoil.shield.recoilX = -3.0;
  withRecoil.shield.recoilZ = 4.0;
  const step = () => {
    advanceSolo(withRecoil, 0, input, 0.0);
    advanceSolo(control, 0, input, 0.0);
  };
  step();
  assertNear(withRecoil.motion.x - control.motion.x, 0.0, f32(0.0001));
  assertNear(withRecoil.motion.z - control.motion.z, 0.0, f32(0.0001));
  assertEquals(withRecoil.shield.recoilX, -3.0);
  assertEquals(withRecoil.shield.recoilZ, 4.0);
  step();
  assertNear(withRecoil.motion.x - control.motion.x, -f32(2.82), f32(0.0001));
  assertNear(withRecoil.motion.z - control.motion.z, f32(3.76), f32(0.0001));
  assertNear(withRecoil.shield.recoilX, -f32(2.82), f32(0.0001));
  assertNear(withRecoil.shield.recoilZ, f32(3.76), f32(0.0001));
  assertNear(withRecoil.motion.vz, control.motion.vz, f32(0.0001));
  step();
  assertNear(withRecoil.motion.x - control.motion.x, -f32(5.46), f32(0.0001));
  assertNear(withRecoil.motion.z - control.motion.z, f32(7.28), f32(0.0001));
  assertNear(withRecoil.motion.vz, control.motion.vz, f32(0.0001));
});

function prepareAirborneShieldPair(attacker: Fighter, defender: Fighter): void {
  for (const f of [attacker, defender]) {
    f.motion.grounded = false;
    f.motion.surface = undefined;
    f.motion.z = 100.0;
    f.launch.hitstun = 20;
    withPhysics(f, { airFriction: 0.0 });
  }
  defender.shield.raised = true;
}

test("an airborne shield contact initializes stacked, weight-scaled relative recoil [reference]", () => {
  const attacker = createReferenceFighter(Character.sylvanas, 0.0, 1);
  const defender = createReferenceFighter(Character.rifleman, 100.0, -1);
  const world = testWorld(attacker, defender);
  prepareAirborneShieldPair(attacker, defender);
  withPhysics(defender, { gravity: attacker.tuning.physics.gravity, weight: 50.0 });
  withPhysics(attacker, { weight: 100.0 });
  attacker.motion.vx = 2.0;
  attacker.motion.vz = 0.0;
  defender.motion.vx = 3.0;
  defender.motion.vz = 0.0;
  advanceBoth(world, controls(), controls());
  assertNear(attacker.motion.deltaX, 2.0, f32(0.0001));
  assertNear(defender.motion.deltaX, 3.0, f32(0.0001));
  beginDamageContacts();
  queueDamageContact(world, 0, 1, hitEffect(4.0, 0.0, 0.0, 0.0, 0.0), 1, ContactKind.flinch, true, undefined);
  queueDamageContact(world, 0, 1, hitEffect(4.0, 0.0, 0.0, 0.0, 0.0), 1, ContactKind.flinch, true, undefined);
  finishDamageContacts(world);
  // Same-sign horizontal motion subtracts the attacker's step; sub-1 weight ratio is .5.
  // Two contacts stack additively before any subsequent-frame decay.
  assertNear(attacker.shield.recoilX, 2 * (3 - 2) * 0.125, f32(0.0001));
  assertNear(attacker.shield.recoilZ, 0.0, f32(0.0001));

  const oppositeAttacker = createReferenceFighter(Character.sylvanas, 0.0, 1);
  const oppositeDefender = createReferenceFighter(Character.rifleman, 100.0, -1);
  const opposite = testWorld(oppositeAttacker, oppositeDefender);
  prepareAirborneShieldPair(oppositeAttacker, oppositeDefender);
  withPhysics(oppositeAttacker, { gravity: oppositeDefender.tuning.physics.gravity, weight: 100.0 });
  withPhysics(oppositeDefender, { weight: 150.0 });
  oppositeAttacker.motion.vx = -2.0;
  oppositeDefender.motion.vx = 3.0;
  oppositeAttacker.motion.vz = 2.0;
  oppositeDefender.motion.vz = -1.0;
  advanceBoth(opposite, controls(), controls());
  assertNear(oppositeAttacker.motion.deltaX, -2.0, f32(0.0001));
  assertNear(oppositeDefender.motion.deltaX, 3.0, f32(0.0001));
  beginDamageContacts();
  queueDamageContact(opposite, 0, 1, hitEffect(4.0, 0.0, 0.0, 0.0, 0.0), 1, ContactKind.flinch, true, undefined);
  finishDamageContacts(opposite);
  // Opposite-sign motion uses only defender movement; heavier defender clamps ratio to 1.
  assertNear(oppositeAttacker.shield.recoilX, 3 * 0.25, f32(0.0001));
  assertNear(oppositeAttacker.shield.recoilZ, oppositeDefender.motion.deltaZ * 0.25, f32(0.0001));
});

test("shield recoil transitions from an air vector to a ground tangent and back [reference]", () => {
  const fighter = createReferenceFighter(Character.sylvanas, 0.0, 1);
  const input = controls();
  fighter.shield.recoilX = -2.0;
  fighter.shield.recoilZ = 1.0;
  fighter.motion.grounded = true;
  advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.shield.recoilZ, 0.0);
  assertNear(fighter.shield.recoilX, -2 + fighter.tuning.physics.traction * f32(1.1), f32(0.0001));
  fighter.motion.grounded = false;
  fighter.launch.hitstun = 10;
  const beforeX = fighter.shield.recoilX;
  fighter.shield.recoilZ = 1.0;
  advanceSolo(fighter, 0, input, 0.0);
  const recoilLength = Math.sqrt(fighter.shield.recoilX * fighter.shield.recoilX + fighter.shield.recoilZ * fighter.shield.recoilZ);
  const beforeLength = Math.sqrt(beforeX * beforeX + 1);
  assertNear(recoilLength - (beforeLength - f32(0.3)), 0.0, f32(0.0001));
});

test("a combat shield break uses the character's launch attribute after the contact freeze [reference]", () => {
  for (const character of [Character.sylvanas, Character.rifleman, Character.demonHunter]) {
    const owner = createReferenceFighter(Character.sylvanas, 0.0, 1);
    const target = createReferenceFighter(character, 85.0, -1);
    const world = testWorld(owner, target);
    owner.motion.grounded = true;
    target.shield.raised = true;
    target.shield.energy = 1.0;
    testBeginAttacks(world, AttackStyle.jab, undefined);
    owner.attack.frame = attackStartupFrames(AttackStyle.jab);
    resolveAttacks(world);
    assertEquals(target.shield.breakState, ShieldBreak.air);
    assertEquals(target.launch.hitlag, 4);
    const launch = character === Character.demonHunter ? 24.0 : f32(19.7999997139);
    assertNear(target.motion.vz, launch, f32(0.0001));
    for (let frame = 1; frame <= 3; frame++) {
      advanceFighter(world, 1, 0, controls(), 0.0);
      assertEquals(target.motion.z, 0.0);
    }
    advanceFighter(world, 1, 0, controls(), 0.0);
    assertNear(target.motion.z, launch - authoredPhysics(character).gravity, f32(0.0001));
  }
});

test("a contact batch collects all damage before choosing a launch, in either traversal [reference] [invariant]", () => {
  for (const reversed of [false, true]) {
    const owner = createReferenceFighter(Character.sylvanas, 0.0, 1);
    const target = createReferenceFighter(Character.rifleman, 100.0, -1);
    const world = testWorld(owner, target);
    target.status.damage = 10.899999618530273;
    target.motion.crouching = true;
    testBeginAttacks(world, AttackStyle.jab, undefined);
    owner.attack.frame = attackStartupFrames(AttackStyle.jab);
    contactProjectile(owner, target, 0, ProjectileKind.recoil);
    contactProjectile(owner, target, 2, ProjectileKind.blaster);
    beginDamageContacts();
    // Fixed detached damage keeps the batching reference independent of fighter balance.
    queueDamageContact(world, 0, 1, hitEffect(7.0, 0.0, 0.0, 0.0, 0.0), 1, ContactKind.damageOnly, false, undefined);
    if (reversed) {
      updateProjectiles(world);
      resolveAttacks(world);
    } else {
      resolveAttacks(world);
      updateProjectiles(world);
    }
    assertEquals(target.status.damage, 10.899999618530273);
    finishDamageContacts(world);
    assertNear(target.status.damage, f32(30.69), f32(0.0001));
    // floor(10.9)+19.79=29.79 percent, jab power 5, weight 80, crouch 2/3.
    // The later downward recoil and zero-launch laser cannot replace the jab.
    assertNear(target.launch.diLaunchSpeed, f32(6.50628), f32(0.0001));
    assertNear(target.launch.knockbackX, f32(6.50628) * f32(0.70710678), f32(0.0001));
    assertGreaterThan(target.launch.knockbackZ, 0.0);
    assertEquals(target.launch.hitstun, 14);
    assertEquals(target.launch.hitlag, 2);
    assertEquals(owner.launch.hitlag, 4);
    assertTrue(target.launch.diPending);
    assertTrue(target.launch.sdiWasGrounded);
    assertFalse(target.motion.crouching);
    assertEquals(projectileCount(owner), 0);
  }
});

test("a contact-batch shield break blocks every collected contact [reference]", () => {
  const owner = createReferenceFighter(Character.sylvanas, 0.0, 1);
  const target = createReferenceFighter(Character.rifleman, 85.0, -1);
  const world = testWorld(owner, target);
  owner.motion.grounded = true;
  target.shield.raised = true;
  target.shield.energy = 1.0;
  testBeginAttacks(world, AttackStyle.jab, undefined);
  owner.attack.frame = attackStartupFrames(AttackStyle.jab);
  contactProjectile(owner, target, 0, ProjectileKind.recoil);
  contactProjectile(owner, target, 1, ProjectileKind.blaster);
  beginDamageContacts();
  resolveAttacks(world);
  updateProjectiles(world);
  finishDamageContacts(world);
  assertEquals(target.status.damage, 0.0);
  assertEquals(target.shield.energy, 30.0);
  assertEquals(target.shield.breakState, ShieldBreak.air);
  assertEquals(owner.launch.hitlag, 4);
  assertEquals(projectileCount(owner), 0);
});

/** Links slot 0 holding slot 1, one frame before the action's contact. */
function holdBeforeContact(world: Roster, owner: Fighter, target: Fighter, action: GrabAction): void {
  owner.grab.target = 1;
  target.grab.owner = 0;
  target.grab.grabbedFrames = 100;
  owner.grab.action = action;
  owner.grab.frame = grabContactFrame(action) - 1;
  resolveGrabs(world);
}

test("a contact batch's throws and pummels include detached damage [reference]", () => {
  for (const pummel of [false, true]) {
    const owner = createReferenceFighter(Character.sylvanas, 0.0, 1);
    const target = createReferenceFighter(Character.rifleman, 50.0, -1);
    const world = testWorld(owner, target);
    const input = controls();
    holdBeforeContact(world, owner, target, pummel ? GrabAction.pummel : GrabAction.throwForward);
    beginDamageContacts();
    queueDamageContact(world, 0, 1, hitEffect(7.0, 0.0, 0.0, 0.0, 0.0), 1, ContactKind.damageOnly, false, undefined);
    testGrabFrame(world, [input, input], false);
    updateProjectiles(world);
    finishDamageContacts(world);
    assertEquals(target.status.damage, pummel ? 10.0 : 14.0);
    if (pummel) {
      assertEquals(target.grab.owner, 0);
      assertEquals(target.launch.hitlag, 4);
    } else {
      assertEquals(target.grab.owner, undefined);
      assertNear(target.launch.knockbackX, f32(11.6028) * f32(0.866025), f32(0.0001));
      assertNear(target.launch.knockbackZ, f32(11.6028) * 0.5, f32(0.0001));
      assertFalse(target.launch.diPending);
      assertEquals(target.launch.hitstun, 25);
      assertEquals(target.launch.hitlag, 0);
    }
  }
});

const OBSERVED_ROLL_TOTALS: readonly (readonly [number, number])[] = [
  [f32(201.6000022884), f32(230.9999999994)],
  [f32(201.5999794008), f32(231.0000228876)],
  [f32(201.5902462016), f32(230.9888775942)],
  [f32(200.7657279972), f32(230.044052124)],
  [f32(201.5999822604), f32(230.9999313354)],
  [f32(201.6276168816), f32(231.031665801)],
  [f32(233.4956817624), f32(245.5145874036)],
  [f32(223.503147126), f32(255.9339351672)],
];

function observedRollTotal(character: Character, profile: number): number {
  return f32(OBSERVED_ROLL_TOTALS[profile]![character === Character.sylvanas ? 0 : 1] * (heroBody(character)?.run ?? 1.0));
}

/** Starts a roll of a profile: 0-1 ground roll, 2-5 getup roll from face up or down, 6-7 tech roll. */
function startObservedRoll(f: Fighter, input: Controls, profile: number, direction: number): void {
  f.motion.surface = 0;
  if (profile < 2) {
    input.shield = true;
    input.groundDodgePressed = true;
    input.groundDodgeDirection = direction;
  } else if (profile < 6) {
    f.down.state = DownState.wait;
    f.down.waitRemaining = 100;
    f.down.faceUp = profile < 4;
    input.getupDirectionPressed = true;
    input.getupDirection = direction;
  } else {
    f.motion.grounded = false;
    f.down.state = DownState.tumble;
    f.launch.hitstun = 20;
    f.motion.z = 1.0;
    f.motion.vz = -2.0;
    input.techPressed = true;
    input.direction = direction;
  }
  advanceSolo(f, 0, input, 0.0);
  input.shield = false;
  input.groundDodgePressed = false;
  input.getupDirectionPressed = false;
  input.techPressed = false;
  input.direction = 0;
}

test("backward rolls and spot dodges keep their orientation [spec docs/physics.md]", () => {
  for (const character of [Character.sylvanas, Character.rifleman, Character.demonHunter]) {
    for (const entryFacing of [-1, 1]) {
      for (const spot of [false, true]) {
        const f = createReferenceFighter(character, 0.0, entryFacing);
        const input = controls();
        startObservedRoll(f, input, 1, spot ? 0 : -entryFacing);
        const duration = spot ? SPOT_DODGE_FRAMES : GROUND_ROLL_FRAMES;
        for (let frame = 2; frame <= duration; frame++) {
          advanceSolo(f, 0, input, 0.0);
          assertEquals(f.facing, entryFacing);
          assertEquals(fighterPoseFacing(f), entryFacing);
          assertFalse(isForwardGroundRoll(f));
        }
        const travel = character === Character.demonHunter ? 128.0 : observedRollTotal(character, 1);
        assertNear(f.motion.x, spot ? 0.0 : -entryFacing * travel, f32(0.0001));
        advanceSolo(f, 0, input, 0.0);
        assertEquals(f.facing, entryFacing);
        assertEquals(f.dodge.groundEntryFacing, 0);
      }
    }
  }
});

test("knockback caps before motion modifiers, and fixed power ignores percent [reference]", () => {
  const twoThirds = f32(2.0 / 3.0);
  assertEquals(ordinaryHitKnockback(999.0, 100.0, 80.0, 1000.0, 500.0, 1.0), 2500.0);
  assertEquals(ordinaryHitKnockback(999.0, 100.0, 80.0, 1000.0, 500.0, twoThirds), f32(2500.0 * twoThirds));
  assertEquals(ordinaryHitKnockback(999.0, 100.0, 80.0, 1000.0, 500.0, 1.2000000476837158), 3000.0);
  assertNear(fixedHitKnockback(20, 80.0, 100.0, 20.0, 1.0), f32(55.1111111), f32(0.0001));
  assertNear(fixedHitKnockback(20, 75.0, 100.0, 20.0, 1.0), f32(55.6), f32(0.0001));
  assertEquals(fixedHitKnockback(1000, 80.0, 1000.0, 500.0, 1.2000000476837158), 3000.0);
  assertEquals(victimHitlagFrames(8.989999771118164, true, true), 4);
  assertEquals(victimHitlagFrames(8.989999771118164, true, false), 7);
  assertEquals(victimHitlagFrames(8.989999771118164, false, true), 3);
  assertEquals(victimHitlagFrames(100.0, true, true), 20);
  assertEquals(ordinaryHitstunFrames(0.0), 1);
});

test("crouch and charge are sampled before a hit interrupts the action [reference]", () => {
  for (const context of [0, 1, 2]) {
    const attacker = createReferenceFighter(Character.sylvanas, 0.0, 1);
    const victim = createReferenceFighter(Character.rifleman, 100.0, -1);
    const world = testWorld(attacker, victim);
    advanceFighter(world, 1, 0, controls({ down: context === 1 }), 0.0);
    assertEquals(victim.motion.crouching, context === 1);
    if (context === 2) {
      testBeginAttacks(testWorld(victim, attacker), AttackStyle.upSmash, undefined, true, false);
      victim.attack.smashCharging = true;
    }
    testBeginAttacks(world, AttackStyle.jab, undefined);
    attacker.attack.frame = attackStartupFrames(AttackStyle.jab);
    resolveAttacks(world);
    assertEquals(victim.status.damage, 5.0);
    assertNear(victim.launch.diLaunchSpeed, f32(7.33) * (context === 1 ? 2.0 / 3.0 : context === 2 ? f32(1.2) : 1.0), f32(0.0001));
    assertEquals(victim.launch.hitlag, context === 1 ? 2 : 4);
    assertEquals(attacker.launch.hitlag, 4);
    assertFalse(victim.motion.crouching);
    assertFalse(victim.attack.smashCharging);
  }
});

test("air drift preserves opposed overspeed and brakes in the same direction [reference]", () => {
  for (const character of [Character.sylvanas, Character.rifleman]) {
    for (const direction of [-1, 1]) {
      const f = createReferenceFighter(character, 0.0, -direction);
      const input = controls({ direction: -direction });
      f.motion.grounded = false;
      f.motion.z = 200.0;
      f.motion.vx = f32(12.0 * direction);
      advanceSolo(f, 0, input, 0.0);
      assertNear(f.motion.vx, (character === Character.sylvanas ? f32(11.52) : f32(11.58)) * direction, f32(0.0001));
      assertNear(f.motion.x, f.motion.vx, f32(0.0001));
      input.direction = direction;
      advanceSolo(f, 0, input, 0.0);
      assertNear(f.motion.vx, (character === Character.sylvanas ? f32(11.4) : f32(11.46)) * direction, f32(0.0001));
      f.motion.vx = f32(40.0 * direction);
      advanceSolo(f, 0, input, 0.0);
      assertEquals(f.motion.vx, f32((character === Character.sylvanas ? 18.0 : 24.0) * direction));
    }
  }
});

test("a ground jump uses its takeoff input, and an air jump replaces horizontal momentum [reference]", () => {
  for (const character of [Character.sylvanas, Character.rifleman]) {
    for (const direction of [-1, 0, 1]) {
      const f = createReferenceFighter(character, 0.0, 1);
      beginJump(f, -direction);
      f.jump.squat = 1;
      f.motion.vx = 4.0;
      advanceSolo(f, 0, controls({ direction, jumpHeld: true }), 0.0);
      const entry = (character === Character.sylvanas ? f32(3.32) : 4.0) + direction * (character === Character.sylvanas ? f32(4.32) : f32(4.2));
      assertNear(f.motion.vx, entry, f32(0.0001));
      assertNear(f.motion.x, entry, f32(0.0001));
      f.motion.vx = 13.0;
      beginJump(f, direction);
      assertNear(f.motion.vx, direction * (character === Character.sylvanas ? f32(5.4) : f32(5.64)), f32(0.0001));
    }
  }
  const capped = createReferenceFighter(Character.sylvanas, 0.0, 1);
  beginJump(capped, 1);
  capped.jump.squat = 1;
  capped.motion.vx = 30.0;
  advanceSolo(capped, 0, controls({ direction: 1 }), 0.0);
  assertNear(capped.motion.vx, f32(10.2), f32(0.0001));
  const illidan = createReferenceFighter(Character.demonHunter, 0.0, 1);
  illidan.motion.grounded = false;
  illidan.motion.vx = 13.0;
  beginJump(illidan, -1);
  assertEquals(illidan.motion.vx, 13.0);
});

test("sampled roll paths clamp at both stage edges without discarding reversals [spec docs/physics.md]", () => {
  for (const character of [Character.sylvanas, Character.rifleman]) {
    for (let profile = 0; profile <= 7; profile++) {
      for (const direction of [-1, 1]) {
        const f = createReferenceFighter(character, f32(590.0 * direction), floorMod(profile, 2) === 0 ? direction : -direction);
        const input = controls();
        startObservedRoll(f, input, profile, direction);
        let touchedEdge = Math.abs(f.motion.x) === 600;
        const duration = profile < 2 ? 31 : profile < 6 ? 35 : 40;
        for (let frame = 2; frame <= duration; frame++) {
          advanceSolo(f, 0, input, 0.0);
          assertTrue(f.motion.x >= -600 && f.motion.x <= 600);
          assertTrue(f.motion.grounded);
          touchedEdge = touchedEdge || Math.abs(f.motion.x) === 600;
        }
        assertTrue(touchedEdge);
        if (profile === 0) assertTrue(Math.abs(f.motion.x) < 600);
      }
    }
  }
});

test("a ground jump's entry preserves its launch, then applies gravity and drift [reference]", () => {
  for (const character of [Character.sylvanas, Character.rifleman]) {
    for (const full of [false, true]) {
      const f = createReferenceFighter(character, 0.0, 1);
      const input = controls({ jumpPressed: true, jumpHeld: full, direction: 1 });
      const squat = character === Character.sylvanas ? 3 : 5;
      for (let frame = 1; frame <= squat; frame++) {
        advanceSolo(f, 0, input, 0.0);
        input.jumpPressed = false;
        assertTrue(f.motion.grounded);
        assertEquals(f.motion.z, 0.0);
        assertEquals(f.jump.serial, 0);
      }
      advanceSolo(f, 0, input, 0.0);
      const launch = character === Character.sylvanas ? (full ? f32(22.08) : f32(12.6)) : full ? f32(24.6) : f32(11.4);
      const horizontal = character === Character.sylvanas ? f32(4.32) : f32(4.2);
      assertFalse(f.motion.grounded);
      assertEquals(f.jump.serial, 1);
      assertNear(f.motion.vz, launch, f32(0.00001));
      assertNear(f.motion.z, launch, f32(0.00001));
      assertNear(f.motion.vx, horizontal, f32(0.00001));
      assertNear(f.motion.x, horizontal, f32(0.00001));
      advanceSolo(f, 0, input, 0.0);
      const gravity = character === Character.sylvanas ? f32(1.38) : f32(1.02);
      assertNear(f.motion.vz, launch - gravity, f32(0.00001));
      assertNear(f.motion.z, 2 * launch - gravity, f32(0.00001));
      assertNear(f.motion.vx, character === Character.sylvanas ? f32(4.8) : f32(4.62), f32(0.00001));
    }
  }
});

test("an aerial jump's entry applies gravity immediately [reference]", () => {
  for (const character of [Character.sylvanas, Character.rifleman]) {
    const f = createReferenceFighter(character, 0.0, 1);
    f.motion.grounded = false;
    f.motion.z = 100.0;
    f.motion.vz = -10.0;
    f.jump.remaining = 1;
    advanceSolo(f, 0, controls({ jumpPressed: true, direction: 1 }), 0.0);
    assertNear(f.motion.vz, character === Character.sylvanas ? f32(25.116) : f32(22.104), f32(0.00001));
    assertNear(f.motion.z, character === Character.sylvanas ? 125.11599731445312 : 122.10399627685547, f32(0.00001));
    assertNear(f.motion.vx, character === Character.sylvanas ? f32(5.28) : f32(5.52), f32(0.00001));
    assertEquals(f.jump.remaining, 0);
    assertTrue(f.jump.isDouble);
  }
});

test("releasing jump on the takeoff frame keeps a full jump, and hitlag doesn't latch a release [reference]", () => {
  for (const character of [Character.sylvanas, Character.rifleman]) {
    const f = createReferenceFighter(character, 0.0, 1);
    const input = controls({ jumpPressed: true, jumpHeld: true });
    advanceSolo(f, 0, input, 0.0);
    input.jumpPressed = false;
    input.jumpHeld = false;
    f.launch.hitlag = 2;
    advanceSolo(f, 0, input, 0.0);
    assertTrue(f.jump.held);
    input.jumpHeld = true;
    for (let frame = 2; frame <= authoredPhysics(character).jumpSquatFrames; frame++) {
      advanceSolo(f, 0, input, 0.0);
      assertTrue(f.motion.grounded);
    }
    input.jumpHeld = false;
    advanceSolo(f, 0, input, 0.0);
    assertNear(f.motion.vz, character === Character.sylvanas ? f32(22.08) : f32(24.6), f32(0.00001));
  }
});

test("an electric contact preserves the attacker's and victim's pause boundaries [reference]", () => {
  for (const electric of [false, true]) {
    for (const crouching of [false, true]) {
      for (const direct of [false, true]) {
        const owner = createReferenceFighter(Character.sylvanas, 0.0, 1);
        const target = createReferenceFighter(Character.rifleman, 100.0, -1);
        const world = testWorld(owner, target);
        const input = controls();
        target.motion.crouching = crouching;
        beginDamageContacts();
        queueDamageContact(world, 0, 1, hitEffect(8.989999771118164, 0.0, 50.0, 1.0, 0.0, electric), 1, ContactKind.launch, direct, undefined);
        assertEquals(target.status.damage, 0.0);
        assertEquals(target.launch.hitlag, 0);
        finishDamageContacts(world);
        const pause = electric ? (crouching ? 4 : 7) : crouching ? 3 : 5;
        const stun = crouching ? 13 : 20;
        assertNear(target.status.damage, f32(8.99), f32(0.00001));
        assertEquals(target.launch.hitlag, pause);
        assertEquals(target.launch.hitstun, stun);
        assertFalse(target.motion.crouching);
        assertEquals(owner.launch.hitlag, direct ? 5 : 0);
        assertEquals(canAttack(owner), !direct);
        for (let frame = 1; frame <= pause - 1; frame++) {
          advanceFighter(world, 1, 0, input, 0.0);
          assertEquals(target.launch.hitlag, pause - frame);
          assertEquals(target.launch.hitstun, stun);
          assertEquals(target.motion.x, 100.0);
          assertFalse(canAttack(target));
        }
        for (let frame = 1; frame <= stun - 1; frame++) {
          advanceFighter(world, 1, 0, input, 0.0);
          assertFalse(canAttack(target));
        }
        advanceFighter(world, 1, 0, input, 0.0);
        assertTrue(canAttack(target));
        for (let frame = 1; frame <= 5; frame++) {
          advanceFighter(world, 0, 0, input, 0.0);
          assertEquals(canAttack(owner), !direct || frame === 5);
        }
      }
    }
  }
});

test("an electric contact on a shield uses the ordinary freeze before shieldstun [reference]", () => {
  for (const direct of [false, true]) {
    const owner = createReferenceFighter(Character.sylvanas, 0.0, 1);
    const target = createReferenceFighter(Character.rifleman, 100.0, -1);
    const world = testWorld(owner, target);
    const input = controls({ shield: true });
    target.shield.raised = true;
    beginDamageContacts();
    queueDamageContact(world, 0, 1, hitEffect(8.989999771118164, 0.0, 50.0, 1.0, 0.0, true), 1, ContactKind.launch, direct, undefined);
    finishDamageContacts(world);
    assertEquals(target.status.damage, 0.0);
    assertEquals(target.launch.hitlag, 5);
    assertEquals(target.shield.stun, 5);
    assertEquals(owner.launch.hitlag, direct ? 5 : 0);
    for (let frame = 1; frame <= 4; frame++) {
      advanceFighter(world, 1, 0, input, 0.0);
      assertEquals(target.shield.stun, 5);
    }
    advanceFighter(world, 1, 0, input, 0.0);
    assertEquals(target.shield.stun, 4);
  }
});

test("an electric contact batch uses the strongest launch's effect and the largest damage [reference]", () => {
  for (const electricWinner of [false, true]) {
    for (const reversed of [0, 1]) {
      const owner = createReferenceFighter(Character.sylvanas, 0.0, 1);
      const target = createReferenceFighter(Character.rifleman, 100.0, -1);
      const world = testWorld(owner, target);
      beginDamageContacts();
      for (let entry = 0; entry <= 1; entry++) {
        const strongest = entry === reversed;
        queueDamageContact(world, 0, 1, hitEffect(strongest ? 3.0 : 12.0, 0.0, strongest ? 60.0 : 20.0, 1.0, 0.0, strongest === electricWinner),
          strongest ? 1 : -1, ContactKind.launch, true, undefined);
      }
      finishDamageContacts(world);
      assertEquals(target.status.damage, 15.0);
      assertNear(target.launch.knockbackX, f32(10.8), f32(0.00001));
      assertEquals(target.launch.hitlag, electricWinner ? 10 : 7);
      assertEquals(owner.launch.hitlag, 7);
    }
  }
});

test("an electric contact batch with tied launches keeps the first effect [reference]", () => {
  for (const electricFirst of [false, true]) {
    const owner = createReferenceFighter(Character.sylvanas, 0.0, 1);
    const target = createReferenceFighter(Character.rifleman, 100.0, -1);
    const world = testWorld(owner, target);
    beginDamageContacts();
    queueDamageContact(world, 0, 1, hitEffect(3.0, 0.0, 50.0, 1.0, 0.0, electricFirst), 1, ContactKind.launch, false, undefined);
    queueDamageContact(world, 0, 1, hitEffect(12.0, 0.0, 50.0, 1.0, 0.0, !electricFirst), -1, ContactKind.launch, false, undefined);
    finishDamageContacts(world);
    assertEquals(target.launch.knockbackX, 9.0);
    assertEquals(target.launch.hitlag, electricFirst ? 10 : 7);
    assertEquals(owner.launch.hitlag, 0);
  }
});

test("the same character uses its assigned weight for an actual damage contact [reference]", () => {
  for (const weight of [50.0, 150.0]) {
    const owner = createReferenceFighter(Character.sylvanas, 0.0, 1);
    const target = createReferenceFighter(Character.sylvanas, 100.0, -1);
    const world = testWorld(owner, target);
    withPhysics(target, { weight });
    testBeginAttacks(world, AttackStyle.jab, undefined);
    owner.attack.frame = attackStartupFrames(AttackStyle.jab);
    resolveAttacks(world);
    assertEquals(target.status.damage, 5.0);
    // Jab at 5 percent: ((5/10 + 5*5/20)*200/(weight+100)*1.4+18)+20.
    assertNear(target.launch.diLaunchSpeed, weight === 50.0 ? f32(7.428) : f32(7.1928), f32(0.00001));
  }
});

function airborneFalco(): Fighter {
  const f = falcoRig(Character.rifleman, 0.0, 1);
  f.motion.grounded = false;
  f.motion.z = 300.0;
  return f;
}

test("a retail aerial fast fall requires down at most three frames before descent [reference]", () => {
  for (let lead = 0; lead <= 5; lead++) {
    const f = airborneFalco();
    f.motion.vz = f32(f32(lead - 0.5) * f.tuning.physics.gravity);
    const input = controls({ down: true });
    for (let frame = 0; frame <= lead; frame++) advanceSolo(f, 0, input, 0.0);
    assertEquals(f.motion.fastFalling, lead < 4);
    if (lead >= 4) {
      input.down = false;
      advanceSolo(f, 0, input, 0.0);
      input.down = true;
      advanceSolo(f, 0, input, 0.0);
      assertTrue(f.motion.fastFalling);
    }
    assertEquals(f.motion.vz, -21.0);
  }
});

test("a retail aerial fast-fall input ages during hitlag through its expiry frame [reference]", () => {
  for (const freeze of [4, 5]) {
    const f = airborneFalco();
    f.motion.vz = -1.0;
    f.launch.hitlag = freeze;
    const input = controls({ down: true });
    for (let frame = 1; frame <= freeze - 1; frame++) {
      advanceSolo(f, 0, input, 0.0);
      assertEquals(f.motion.z, 300.0);
      assertFalse(f.motion.fastFalling);
    }
    advanceSolo(f, 0, input, 0.0);
    assertEquals(f.motion.fastFalling, freeze === 4);
    assertNear(f.motion.vz, freeze === 4 ? -21.0 : -f32(2.020000010728836), f32(0.000001));
  }
});

test("the retail aerial fast-fall diagonal restriction doesn't refresh a held down [reference]", () => {
  for (const diagonalFrames of [3, 4]) {
    const f = airborneFalco();
    f.motion.vz = -1.0;
    const input = controls({ down: true, direction: 1 });
    for (let frame = 1; frame <= diagonalFrames; frame++) {
      advanceSolo(f, 0, input, 0.0);
      assertFalse(f.motion.fastFalling);
    }
    input.direction = 0;
    advanceSolo(f, 0, input, 0.0);
    assertEquals(f.motion.fastFalling, diagonalFrames === 3);
  }
});

test("a stronger aerial dodge keeps retail decay for every digital direction [spec #347] [reference]", () => {
  for (const horizontal of [-1, 0, 1]) {
    for (const vertical of [-1, 0, 1]) {
      const f = airborneFalco();
      const input = controls();
      beginAirDodge(f, horizontal, vertical);
      const launchX = horizontal * (vertical === 0 ? f32(19.401552200317383) : f32(14.424978256225586));
      const launchZ = horizontal === 0 ? vertical * f32(20.399999618530273) : vertical === 0 ? -f32(6.303946495056152) : vertical * f32(14.424978256225586);
      assertNear(f.motion.vx, launchX, f32(0.00001));
      assertNear(f.motion.vz, launchZ, f32(0.00001));
      // The launch check above permits approximate native trig; the decay
      // and position checks start from that actual launch velocity.
      let expectedX = f.motion.vx;
      let expectedZ = f.motion.vz;
      let positionX = 0.0;
      let positionZ = 50.0;
      for (let frame = 1; frame <= 3; frame++) {
        expectedX = f32(expectedX * 0.8999999761581421);
        expectedZ = f32(expectedZ * 0.8999999761581421);
        positionX = addFloat32(positionX, divideFloat32(expectedX, 6.0));
        positionZ = addFloat32(positionZ, divideFloat32(expectedZ, 6.0));
        advanceSolo(f, 0, input, 0.0);
        assertNear(f.motion.vx, expectedX, f32(0.00001));
        assertNear(f.motion.vz, expectedZ, f32(0.00001));
        assertNear(f.motion.x, melee(positionX), f32(0.00001));
        assertNear(f.motion.z, melee(positionZ), f32(0.00001));
      }
      f.launch.hitlag = 3;
      for (let frame = 1; frame <= 2; frame++) {
        advanceSolo(f, 0, input, 0.0);
        assertEquals(f.dodge.airFrame, 3);
        assertNear(f.motion.x, melee(positionX), f32(0.00001));
        assertNear(f.motion.z, melee(positionZ), f32(0.00001));
      }
      advanceSolo(f, 0, input, 0.0);
      assertEquals(f.dodge.airFrame, 4);
      assertNear(f.motion.vx, expectedX * 0.8999999761581421, f32(0.00001));
      assertNear(f.motion.vz, expectedZ * 0.8999999761581421, f32(0.00001));
    }
  }
});

test("a stronger aerial dodge resumes gravity and drift on tick thirty [spec #347] [reference]", () => {
  for (const mode of [0, 1, 2]) {
    for (const steer of [-1, 0, 1]) {
      const f = airborneFalco();
      const input = controls({ airDodgePressed: true, dodgeX: mode === 0 ? 0 : 1, dodgeZ: mode === 0 ? 0 : mode === 1 ? 1 : -1, direction: steer });
      for (let frame = 1; frame <= 29; frame++) {
        advanceSolo(f, 0, input, 0.0);
        input.airDodgePressed = false;
        assertEquals(f.dodge.airFrame, frame);
      }
      const directionZ = mode === 1 ? 1 : -1;
      // Positions accumulate in original units; only assertions project to world units.
      const beforeX = mode === 0 ? 0.0 : 20.618309020996094;
      const beforeZ = mode === 0 ? 50.0 : mode === 1 ? 70.61831665039062 : 29.381690979003906;
      const beforeVX = mode === 0 ? 0.0 : 0.6794346570968628;
      const beforeVZ = mode === 0 ? 0.0 : f32(directionZ * 0.6794346570968628);
      assertNear(f.motion.x, melee(beforeX), f32(0.00001));
      assertNear(f.motion.z, melee(beforeZ), f32(0.00001));
      assertNear(f.motion.vx, beforeVX, f32(0.00001));
      assertNear(f.motion.vz, beforeVZ, f32(0.00001));
      assertEquals(f.dodge.airMotionFrames, 0);
      advanceSolo(f, 0, input, 0.0);
      const nextVX = steer === 0 ? max(0.0, f32(beforeVX - 0.11999999731779099)) : f32(beforeVX + f32(steer * 0.42000001668930054));
      const nextVZ = f32(beforeVZ - 1.0199999809265137);
      assertEquals(f.dodge.airFrame, 30);
      assertNear(f.motion.vx, nextVX, f32(0.00001));
      assertNear(f.motion.vz, nextVZ, f32(0.00001));
      assertNear(f.motion.x, melee(addFloat32(beforeX, divideFloat32(nextVX, 6.0))), f32(0.00001));
      assertNear(f.motion.z, melee(addFloat32(beforeZ, divideFloat32(nextVZ, 6.0))), f32(0.00001));
      assertTrue(f.dodge.airDodging);
      assertFalse(canAttack(f));
    }
  }
});

test("a retail aerial dodge's switch boundary freezes in hitlag [reference]", () => {
  const f = falcoRig(Character.sylvanas, 0.0, 1);
  f.motion.grounded = false;
  f.motion.z = 300.0;
  const input = controls({ airDodgePressed: true });
  for (let frame = 1; frame <= 29; frame++) {
    advanceSolo(f, 0, input, 0.0);
    input.airDodgePressed = false;
  }
  assertEquals(f.dodge.airFrame, 29);
  assertEquals(f.motion.z, 300.0);
  f.launch.hitlag = 3;
  input.direction = 1;
  for (let frame = 1; frame <= 2; frame++) {
    advanceSolo(f, 0, input, 0.0);
    assertEquals(f.dodge.airFrame, 29);
    assertEquals(f.motion.x, 0.0);
    assertEquals(f.motion.z, 300.0);
  }
  advanceSolo(f, 0, input, 0.0);
  assertEquals(f.dodge.airFrame, 30);
  assertNear(f.motion.x, f32(0.4200000018), f32(0.00001));
  assertNear(f.motion.z, 298.9800109863281, f32(0.00001));
});

test("Rifleman turns on roll frame 20 and other fighters at recovery while keeping their entry pose and travel [spec docs/physics.md]", () => {
  for (const character of [Character.sylvanas, Character.rifleman, Character.demonHunter]) {
    for (const entryFacing of [-1, 1]) {
      const f = createReferenceFighter(character, 0.0, entryFacing);
      const world = soloWorld(f);
      const input = controls();
      startObservedRoll(f, input, 0, entryFacing);
      for (let frame = 2; frame <= 19; frame++) advanceFighter(world, 0, 0, input, 0.0);
      assertEquals(f.facing, entryFacing);
      assertEquals(f.dodge.groundEntryFacing, entryFacing);
      assertEquals(fighterPoseFacing(f), entryFacing);
      assertTrue(isForwardGroundRoll(f));
      f.launch.hitlag = 2;
      advanceFighter(world, 0, 0, input, 0.0);
      assertEquals(f.launch.hitlag, 1);
      assertEquals(f.dodge.groundFrame, 19);
      assertEquals(f.facing, entryFacing);
      const before = f.motion.x;
      advanceFighter(world, 0, 0, input, 0.0);
      assertEquals(f.dodge.groundFrame, 20);
      assertEquals(f.facing, character === Character.rifleman ? -entryFacing : entryFacing);
      assertEquals(fighterPoseFacing(f), entryFacing);
      assertTrue(isForwardGroundRoll(f));
      const travel20 = character === Character.sylvanas ? f32(f32(9.6163101198) * (heroBody(character)?.run ?? 1.0)) : character === Character.rifleman ? f32(11.0186805726) : 0.0;
      assertNear(f.motion.x - before, entryFacing * travel20, f32(0.0001));
      for (let frame = 21; frame <= 31; frame++) {
        advanceFighter(world, 0, 0, input, 0.0);
        assertEquals(fighterPoseFacing(f), entryFacing);
        assertTrue(isForwardGroundRoll(f));
      }
      const total = character === Character.demonHunter ? 128.0 : observedRollTotal(character, 0);
      assertNear(f.motion.x, entryFacing * total, f32(0.0001));
      assertFalse(canAttack(f));
      advanceFighter(world, 0, 0, input, 0.0);
      assertEquals(f.facing, -entryFacing);
      assertEquals(fighterPoseFacing(f), -entryFacing);
      assertEquals(f.dodge.groundEntryFacing, 0);
      assertTrue(canAttack(f));
      startObservedRoll(f, input, 0, -entryFacing);
      respawnFighter(world, 0, 0.0);
      assertEquals(f.dodge.groundEntryFacing, 0);
    }
  }
});

test("sampled rolls move through their actual entry, a freeze and recovery [reference]", () => {
  for (const character of [Character.sylvanas, Character.rifleman]) {
    for (let profile = 0; profile <= 7; profile++) {
      for (const facing of [-1, 1]) {
        const f = createReferenceFighter(character, 0.0, facing);
        const input = controls();
        const direction = floorMod(profile, 2) === 0 ? facing : -facing;
        const duration = profile < 2 ? 31 : profile < 6 ? 35 : 40;
        startObservedRoll(f, input, profile, direction);
        if (profile < 2) assertEquals(f.motion.x, 0.0);
        else assertTrue(f.motion.x * direction > 0);
        for (let frame = 2; frame <= 10; frame++) {
          advanceSolo(f, 0, input, 0.0);
          if (profile < 2 && frame === 6) assertEquals(f.motion.x, 0.0);
          if (profile < 2 && frame === 9) {
            const ninth = profile === 0 ? (character === Character.sylvanas ? f32(69.12) : f32(79.2)) : character === Character.sylvanas ? f32(23.04) : f32(26.4);
            assertNear(f.motion.x, direction * f32(ninth * (heroBody(character)?.run ?? 1.0)), f32(0.0001));
          }
        }
        const frozenX = f.motion.x;
        f.launch.hitlag = 2;
        advanceSolo(f, 0, input, 0.0);
        assertEquals(f.launch.hitlag, 1);
        assertEquals(f.motion.x, frozenX);
        assertEquals(profile < 2 ? f.dodge.groundFrame : f.down.frame, 10);
        for (let frame = 11; frame <= duration; frame++) {
          const before = f.motion.x;
          advanceSolo(f, 0, input, 0.0);
          if (profile >= 6 && frame === 40) assertEquals(f.motion.x, before);
        }
        assertNear(f.motion.x, direction * observedRollTotal(character, profile), f32(0.0001));
        assertFalse(canAttack(f));
        advanceSolo(f, 0, input, 0.0);
        assertTrue(canAttack(f));
        assertEquals(f.facing, profile === 0 ? -facing : facing);
      }
    }
  }
});
