// These cases share the same hitlag-to-launch timeline: pulses, automatic
// smash DI and continuous DI must be checked at their common frame boundaries.
// Smash DI, automatic smash DI, directional influence and launch decay.
import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "waygate/src/runtime/testing";
import { roundToFloat32 } from "waygate/src/sim/binary32";
import { f32 } from "waygate/src/sim/f32";
import { resolveAttacks } from "./attacks";
import { AttackStyle, Character, DownState } from "./codes";
import { createFighter } from "./fighter";
import { ordinaryHitKnockback, ordinaryHitlagFrames, ordinaryHitstunFrames } from "./knockback";
import { attackStartupFrames, grabHoldFrames } from "./moves";
import { totalVelocityX, totalVelocityZ } from "./motion";
import { updateProjectiles } from "./projectiles";
import { ASDI_DISTANCE, SDI_DISTANCE } from "./smashDirectionalInfluence";
import { respawnFighter } from "./stocks";
import { advanceSolo, controls, seedTechWindow, soloWorld, testBeginAttacks, testWorld } from "./testWorld";
import { authoredPhysics } from "./tuning";

const length = (x: number, z: number) => Math.sqrt(x * x + z * z);

test("smash DI pulses shift only on new axis components", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.z = 400.0;
  fighter.launch.hitlag = 8;
  fighter.launch.diPending = true;
  fighter.launch.diLaunchSpeed = 10.0;
  // The pulses a directional input produces holding right, adding up,
  // releasing up, then reversing; held and removed components don't pulse.
  const pulse = (sdiX: number, sdiZ: number) =>
    advanceSolo(fighter, 0, controls({ direction: sdiX, sdiPulse: sdiX !== 0 || sdiZ !== 0, sdiX, sdiZ }), -240.0);
  pulse(1, 0);
  assertEquals(fighter.motion.x, SDI_DISTANCE);
  assertEquals(fighter.launch.sdiSerial, 1);
  pulse(0, 0);
  assertEquals(fighter.motion.x, SDI_DISTANCE);
  assertEquals(fighter.launch.sdiSerial, 1);
  pulse(1, 1);
  assertNear(fighter.motion.x, SDI_DISTANCE + SDI_DISTANCE * 0.7071067690849304, 0.0010000000474974513);
  assertNear(fighter.motion.z, 400 + SDI_DISTANCE * 0.7071067690849304, 0.0010000000474974513);
  assertEquals(fighter.launch.sdiSerial, 2);
  pulse(0, 0);
  assertEquals(fighter.launch.sdiSerial, 2);
  pulse(-1, 0);
  assertNear(fighter.motion.x, SDI_DISTANCE * 0.7071067690849304, 0.0010000000474974513);
  assertEquals(fighter.launch.sdiSerial, 3);
});

test("a direction held before the hit creates no SDI pulse, and an attacker's freeze doesn't move it", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  const input = controls({ direction: 1 });
  advanceSolo(fighter, 0, input, -240.0);
  fighter.motion.x = 300.0;
  fighter.motion.z = 400.0;
  fighter.motion.grounded = false;
  fighter.motion.vx = 0.0;
  fighter.launch.hitlag = 3;
  fighter.launch.diPending = true;
  fighter.launch.diLaunchSpeed = 10.0;
  advanceSolo(fighter, 0, input, -240.0);
  assertEquals(fighter.motion.x, 300.0);
  assertEquals(fighter.launch.sdiSerial, 0);
  input.sdiPulse = true;
  input.sdiX = 1;
  const attacker = createFighter(Character.archer, 0.0, 1);
  attacker.motion.x = 250.0;
  attacker.motion.z = 400.0;
  attacker.motion.grounded = false;
  attacker.launch.hitlag = 3;
  advanceSolo(attacker, 0, input, -240.0);
  assertEquals(attacker.motion.x, 250.0);
  assertEquals(attacker.launch.sdiSerial, 0);
});

test("ASDI uses the C-stick while DI still uses the left stick on the release frame", () => {
  const fighter = createFighter(Character.archer, 300.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.z = 400.0;
  fighter.launch.hitlag = 1;
  fighter.launch.diPending = true;
  fighter.launch.diLaunchSpeed = 10.0;
  fighter.launch.knockbackX = 10.0;
  advanceSolo(fighter, 0, controls({ verticalDirection: 1, cStickX: 1 }), -240.0);
  assertEquals(fighter.motion.x, f32(f32(300 + ASDI_DISTANCE) + totalVelocityX(fighter)));
  const afterSelf = roundToFloat32(f32(roundToFloat32(f32(400.0 / 6)) + roundToFloat32(f32(fighter.motion.vz / 6))));
  const afterLaunch = roundToFloat32(f32(afterSelf + roundToFloat32(f32(fighter.launch.knockbackZ / 6))));
  assertEquals(fighter.motion.z, f32(afterLaunch * 6));
  assertNear(fighter.launch.knockbackX, 9.219541549682617, 0.0010000000474974513);
  assertNear(fighter.launch.knockbackZ, 2.9956107139587402, 0.0010000000474974513);
  assertEquals(fighter.launch.asdiSerial, 1);
  assertEquals(fighter.launch.diSerial, 1);
  assertNear(fighter.launch.diAngleDegrees, 18.0, 0.0010000000474974513);
  assertEquals(fighter.launch.sdiSerial, 0);
});

test("one frame of hitlag allows ASDI but can't produce SDI", () => {
  const fighter = createFighter(Character.archer, 300.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.z = 400.0;
  fighter.launch.hitlag = 1;
  fighter.launch.diPending = true;
  fighter.launch.diLaunchSpeed = 10.0;
  fighter.launch.knockbackX = 10.0;
  advanceSolo(fighter, 0, controls({ direction: 1, sdiPulse: true, sdiX: 1 }), -240.0);
  assertEquals(fighter.motion.x, f32(f32(300 + ASDI_DISTANCE) + totalVelocityX(fighter)));
  assertEquals(fighter.launch.sdiSerial, 0);
  assertEquals(fighter.launch.asdiSerial, 1);
});

test("an ASDI shift into the blast zone costs exactly one stock", () => {
  const fighter = createFighter(Character.archer, 910.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.z = 400.0;
  fighter.launch.hitlag = 1;
  fighter.launch.diPending = true;
  fighter.launch.diLaunchSpeed = 10.0;
  fighter.launch.knockbackX = 10.0;
  advanceSolo(fighter, 0, controls({ direction: 1 }), -240.0);
  assertTrue(fighter.status.out);
  assertEquals(fighter.status.stocks, 2);
  assertEquals(fighter.launch.asdiSerial, 1);
});

test("a forbidden down SDI doesn't land, but ASDI down sweeps onto a platform and cancels non-tumble hitstun", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.z = 10.0;
  fighter.launch.hitstun = 20;
  fighter.launch.hitlag = 2;
  fighter.launch.diPending = true;
  fighter.launch.diLaunchSpeed = 10.0;
  const input = controls({ verticalDirection: -1, sdiPulse: true, sdiZ: -1 });
  advanceSolo(fighter, 0, input, -240.0);
  assertEquals(fighter.motion.z, 10.0);
  assertFalse(fighter.motion.grounded);
  assertEquals(fighter.launch.sdiSerial, 0);
  input.sdiPulse = false;
  advanceSolo(fighter, 0, input, -240.0);
  assertTrue(fighter.motion.grounded);
  assertEquals(fighter.motion.z, 0.0);
  assertEquals(fighter.motion.surface, 0);
  assertEquals(fighter.launch.hitstun, 0);
  assertEquals(fighter.launch.asdiSerial, 1);
  assertEquals(fighter.launch.sdiSerial, 0);
  const airborne = createFighter(Character.archer, 0.0, 1);
  airborne.motion.grounded = false;
  airborne.motion.z = 400.0;
  airborne.launch.hitlag = 3;
  airborne.launch.diPending = true;
  airborne.launch.diLaunchSpeed = 10.0;
  advanceSolo(airborne, 0, controls({ verticalDirection: -1, sdiPulse: true, sdiZ: -1 }), -240.0);
  assertEquals(airborne.motion.z, f32(400 - SDI_DISTANCE));
  assertEquals(airborne.launch.sdiSerial, 1);
  const grounded = createFighter(Character.archer, 0.0, 1);
  grounded.motion.z = 0.0;
  grounded.launch.hitlag = 3;
  grounded.launch.diPending = true;
  grounded.launch.diLaunchSpeed = 10.0;
  grounded.launch.sdiWasGrounded = true;
  advanceSolo(grounded, 0, controls({ direction: 1, verticalDirection: 1, sdiPulse: true, sdiX: 1, sdiZ: 1 }), -240.0);
  assertNear(grounded.motion.x, SDI_DISTANCE * 0.7071067690849304, 0.0010000000474974513);
  assertEquals(grounded.motion.z, 0.0);
  assertEquals(grounded.launch.sdiSerial, 1);
});

test("an ASDI down landing uses the existing tumble tech window", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.z = 10.0;
  fighter.down.state = DownState.tumble;
  fighter.launch.hitstun = 100;
  seedTechWindow(fighter, 20);
  fighter.launch.hitlag = 1;
  fighter.launch.diPending = true;
  fighter.launch.diLaunchSpeed = 10.0;
  fighter.launch.knockbackX = 10.0;
  advanceSolo(fighter, 0, controls({ direction: 1, verticalDirection: 1, cStickZ: -1 }), -240.0);
  assertEquals(fighter.down.state, DownState.techRoll);
  assertTrue(fighter.motion.grounded);
  // Nine-degree DI followed by grounded traction on the ASDI release tick.
  assertNear(fighter.launch.knockbackX, 9.396883010864258, 0.000009999999747378752);
  assertNear(fighter.launch.groundKnockbackX, 9.396883010864258, 0.000009999999747378752);
  assertEquals(fighter.launch.knockbackZ, 0.0);
  assertEquals(fighter.launch.asdiSerial, 1);
});

test("knockback decays by vector magnitude and continues after hitstun", () => {
  const fighter = createFighter(Character.archer, 100.0, 1);
  const input = controls();
  fighter.motion.grounded = false;
  fighter.motion.z = 300.0;
  fighter.launch.hitstun = 1;
  fighter.launch.knockbackX = 60.0;
  fighter.launch.knockbackZ = 80.0;
  advanceSolo(fighter, 0, input, -240.0);
  assertEquals(fighter.launch.hitstun, 0);
  assertNear(length(fighter.launch.knockbackX, fighter.launch.knockbackZ), 99.69400024414062, 0.0010000000474974513);
  assertNear(fighter.motion.x, 159.81640625, 0.00009999999747378752);
  assertNear(fighter.motion.z, 378.3752136230469, 0.00009999999747378752);
  assertNear(fighter.launch.knockbackX / fighter.launch.knockbackZ, 0.75, 0.0010000000474974513);
  const xAtStunEnd = fighter.motion.x;
  advanceSolo(fighter, 0, input, -240.0);
  assertTrue(fighter.motion.x > xAtStunEnd);
  assertNear(length(fighter.launch.knockbackX, fighter.launch.knockbackZ), 99.38800048828125, 0.0010000000474974513);
});

test("a downward launch exceeds the terminal fall cap, and fast fall uses self descent", () => {
  const falling = createFighter(Character.archer, 0.0, 1);
  const physics = authoredPhysics(Character.archer);
  const input = controls({ down: true });
  falling.motion.grounded = false;
  falling.motion.z = 500.0;
  falling.launch.hitstun = 10;
  falling.launch.knockbackZ = -20.0;
  advanceSolo(falling, 0, input, -240.0);
  assertLessThan(totalVelocityZ(falling), -physics.terminalSpeed);
  assertNear(falling.motion.vz, -physics.gravity, 0.0010000000474974513);
  const rising = createFighter(Character.archer, 0.0, 1);
  rising.motion.grounded = false;
  rising.motion.z = 500.0;
  rising.launch.knockbackZ = 40.0;
  rising.launch.hitstun = 10;
  advanceSolo(rising, 0, input, -240.0);
  assertNear(rising.motion.vz, -physics.gravity, 0.0010000000474974513);
  assertGreaterThan(totalVelocityZ(rising), 0.0);
  rising.launch.hitstun = 0;
  advanceSolo(rising, 0, input, -240.0);
  assertNear(rising.motion.vz, -20.400001525878906, 9.999999974752427e-7);
  assertTrue(rising.motion.fastFalling);
  assertGreaterThan(totalVelocityZ(rising), 0.0);
});

test("hitlag freezes the launch vector, then release resumes self velocity and decay", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.x = 25.0;
  fighter.motion.z = 300.0;
  fighter.motion.vx = 2.0;
  fighter.motion.vz = 1.0;
  fighter.launch.knockbackX = 10.0;
  fighter.launch.knockbackZ = 0.0;
  fighter.launch.diLaunchSpeed = 10.0;
  fighter.launch.diPending = true;
  fighter.launch.hitlag = 3;
  const input = controls({ verticalDirection: -1 });
  advanceSolo(fighter, 0, input, -240.0);
  assertEquals(fighter.motion.x, 25.0);
  assertEquals(fighter.motion.z, 300.0);
  assertEquals(fighter.launch.knockbackX, 10.0);
  assertEquals(fighter.launch.knockbackZ, 0.0);
  advanceSolo(fighter, 0, input, -240.0);
  assertEquals(fighter.launch.knockbackX, 10.0);
  input.verticalDirection = 1;
  advanceSolo(fighter, 0, input, -240.0);
  assertEquals(fighter.launch.diSerial, 1);
  assertNear(fighter.launch.diAngleDegrees, 18.0, 0.0010000000474974513);
  assertEquals(fighter.motion.vx, f32(2 - f32(0.019999999552965164 * 6)));
  assertEquals(fighter.motion.vz, f32(1 - authoredPhysics(Character.archer).gravity));
  assertNear(length(fighter.launch.knockbackX, fighter.launch.knockbackZ), 9.694000244140625, 0.0010000000474974513);
});

test("landing and floor techs preserve horizontal knockback while respawning clears both components", () => {
  const landed = createFighter(Character.archer, 0.0, 1);
  const input = controls();
  landed.motion.grounded = false;
  landed.motion.z = 5.0;
  landed.launch.hitstun = 20;
  landed.launch.knockbackX = 3.0;
  landed.launch.knockbackZ = -10.0;
  advanceSolo(landed, 0, input, -240.0);
  assertTrue(landed.motion.grounded);
  assertEquals(landed.motion.z, 0.0);
  assertEquals(landed.launch.knockbackZ, 0.0);
  assertGreaterThan(landed.launch.knockbackX, 0.0);
  respawnFighter(soloWorld(landed), 0, 0.0);
  assertEquals(landed.launch.knockbackX, 0.0);
  assertEquals(landed.launch.knockbackZ, 0.0);
  const teched = createFighter(Character.archer, 0.0, 1);
  teched.motion.grounded = false;
  teched.motion.z = 1.0;
  teched.down.state = DownState.tumble;
  teched.launch.hitstun = 100;
  seedTechWindow(teched, 20);
  teched.launch.knockbackX = 3.0;
  teched.launch.knockbackZ = -2.0;
  input.direction = 1;
  advanceSolo(teched, 0, input, -240.0);
  assertEquals(teched.down.state, DownState.techRoll);
  // Airborne vector decay occurs before the landing clears the vertical component.
  assertNear(teched.launch.knockbackX, 2.7453925609588623, 0.000009999999747378752);
  assertEquals(teched.launch.knockbackZ, 0.0);
});

test("DI reads only the last hitlag frame and preserves launch speed", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.z = 300.0;
  fighter.launch.knockbackX = 10.0;
  fighter.launch.knockbackZ = 0.0;
  fighter.launch.diLaunchSpeed = 10.0;
  fighter.launch.diPending = true;
  fighter.launch.hitlag = 3;
  const input = controls({ verticalDirection: -1 });
  advanceSolo(fighter, 0, input, -240.0);
  assertEquals(fighter.launch.diSerial, 0);
  advanceSolo(fighter, 0, input, -240.0);
  assertEquals(fighter.launch.diSerial, 0);
  input.verticalDirection = 1;
  advanceSolo(fighter, 0, input, -240.0);
  assertEquals(fighter.launch.diSerial, 1);
  assertNear(fighter.launch.diAngleDegrees, 18.0, 0.0010000000474974513);
  assertNear(length(fighter.launch.knockbackX, fighter.launch.knockbackZ), 9.694000244140625, 0.0010000000474974513);
  advanceSolo(fighter, 0, input, -240.0);
  assertEquals(fighter.launch.diSerial, 1);
});

test("DI normalizes diagonal input and ignores parallel input", () => {
  const diagonal = createFighter(Character.archer, 0.0, 1);
  diagonal.motion.grounded = false;
  diagonal.motion.z = 300.0;
  diagonal.launch.knockbackX = 10.0;
  diagonal.launch.diLaunchSpeed = 10.0;
  diagonal.launch.diPending = true;
  diagonal.launch.hitlag = 1;
  advanceSolo(diagonal, 0, controls({ direction: 1, verticalDirection: 1 }), -240.0);
  assertEquals(diagonal.launch.diSerial, 1);
  assertGreaterThan(diagonal.launch.diAngleDegrees, 8.0);
  assertLessThan(diagonal.launch.diAngleDegrees, 10.0);
  assertNear(length(diagonal.launch.knockbackX, diagonal.launch.knockbackZ), 9.694000244140625, 0.0010000000474974513);
  const parallel = createFighter(Character.archer, 0.0, 1);
  parallel.motion.grounded = false;
  parallel.motion.z = 300.0;
  parallel.launch.knockbackX = 10.0;
  parallel.launch.diLaunchSpeed = 10.0;
  parallel.launch.diPending = true;
  parallel.launch.hitlag = 1;
  advanceSolo(parallel, 0, controls({ direction: 1 }), -240.0);
  assertEquals(parallel.launch.diSerial, 0);
  assertFalse(parallel.launch.diPending);
  assertEquals(parallel.launch.knockbackX, f32(10 - f32(0.050999999046325684 * 6)));
  assertEquals(parallel.launch.knockbackZ, 0.0);
});

test("the DI opportunity clears on respawn, stock loss and hits without knockback", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  const world = soloWorld(fighter);
  fighter.launch.diPending = true;
  fighter.launch.diLaunchSpeed = 10.0;
  fighter.launch.diSerial = 2;
  fighter.launch.diAngleDegrees = 9.0;
  respawnFighter(world, 0, 0.0);
  assertFalse(fighter.launch.diPending);
  assertEquals(fighter.launch.diLaunchSpeed, 0.0);
  assertEquals(fighter.launch.diSerial, 0);
  assertEquals(fighter.launch.diAngleDegrees, 0.0);
  fighter.launch.diPending = true;
  fighter.motion.x = 920.0009765625;
  advanceSolo(fighter, 0, controls({ shield: true }), 0.0);
  assertFalse(fighter.launch.diPending);
  assertEquals(fighter.launch.diLaunchSpeed, 0.0);
  const grabber = createFighter(Character.archer, 0.0, 1);
  const grabbed = createFighter(Character.rifleman, 100.0, -1);
  const grabWorld = testWorld(grabber, grabbed);
  grabbed.launch.diPending = true;
  grabbed.launch.diLaunchSpeed = 10.0;
  testBeginAttacks(grabWorld, AttackStyle.grab, undefined);
  grabber.attack.frame = attackStartupFrames(AttackStyle.grab);
  resolveAttacks(grabWorld);
  assertEquals(grabbed.grab.grabbedFrames, grabHoldFrames(grabbed.status.damage));
  assertFalse(grabbed.launch.diPending);
  const shooter = createFighter(Character.archer, 0.0, 1);
  const shotTarget = createFighter(Character.archer, 30.0, -1);
  shotTarget.launch.diPending = true;
  shotTarget.launch.diLaunchSpeed = 10.0;
  shotTarget.launch.knockbackX = 10.0;
  shotTarget.launch.hitlag = 1;
  const shot = shooter.projectiles[0]!;
  shot.life = 1;
  shot.direction = 1;
  shot.x = 0.0;
  shot.z = 45.0;
  updateProjectiles(testWorld(shooter, shotTarget));
  assertEquals(shotTarget.status.damage, 3.0);
  assertEquals(shotTarget.launch.hitstun, 11);
  assertFalse(shotTarget.launch.diPending);
  assertEquals(shotTarget.launch.diLaunchSpeed, 0.0);
  assertEquals(shotTarget.launch.diSerial, 0);
  advanceSolo(shotTarget, 0, controls({ verticalDirection: 1 }), -240.0);
  assertFalse(shotTarget.launch.diPending);
  assertEquals(shotTarget.launch.diSerial, 0);
  assertNear(shotTarget.launch.diAngleDegrees, 0.0, 0.0010000000474974513);
  const blockedTarget = createFighter(Character.rifleman, 30.0, -1);
  blockedTarget.shield.raised = true;
  blockedTarget.launch.diPending = true;
  blockedTarget.launch.diLaunchSpeed = 10.0;
  shot.life = 1;
  shot.x = 0.0;
  shot.z = 45.0;
  updateProjectiles(testWorld(shooter, blockedTarget));
  assertTrue(blockedTarget.launch.diPending);
  assertEquals(blockedTarget.launch.diLaunchSpeed, 10.0);
});

test("a held shield drains by the frame-rate amount", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  fighter.shield.energy = 0.5;
  const input = controls({ shield: true });
  advanceSolo(fighter, 0, input, -240.0);
  assertTrue(fighter.shield.raised);
  assertEquals(fighter.shield.energy, 0.5);
  advanceSolo(fighter, 0, input, -240.0);
  assertNear(fighter.shield.energy, 0.2199999988079071, 0.0010000000474974513);
});

test("the ordinary hit formula uses independent per-hit parameters", () => {
  assertNear(ordinaryHitKnockback(0.0, 12.0, 80.0, 100.0, 20.0, 1.0), 51.06666564941406, 0.00009999999747378752);
  assertNear(ordinaryHitKnockback(0.0, 12.0, 80.0, 150.0, 20.0, 1.0), 66.5999984741211, 0.00009999999747378752);
  assertNear(ordinaryHitKnockback(0.0, 12.0, 80.0, 100.0, 30.0, 1.0), 61.06666564941406, 0.00009999999747378752);
  assertNear(ordinaryHitKnockback(0.0, 12.0, 80.0, 100.0, 20.0, 1.2000000476837158), 61.279998779296875, 0.00009999999747378752);
  assertGreaterThan(ordinaryHitKnockback(0.0, 12.0, 75.0, 100.0, 20.0, 1.0), 51.06666564941406);
});

test("an ordinary hit separates fractional percent from integer attack power", () => {
  const baseline = ordinaryHitKnockback(9.0, 1.5, 80.0, 100.0, 20.0, 1.0);
  assertNear(ordinaryHitKnockback(9.99899959564209, 1.5, 80.0, 100.0, 20.0, 1.0), baseline, 0.00009999999747378752);
  assertNear(baseline, 40.45000076293945, 0.00009999999747378752);
  assertGreaterThan(ordinaryHitKnockback(10.0, 1.5, 80.0, 100.0, 20.0, 1.0), baseline);
});

test("ordinary hitlag and hitstun round at frame boundaries", () => {
  assertEquals(ordinaryHitlagFrames(2.999000072479248), 3);
  assertEquals(ordinaryHitlagFrames(3.0), 4);
  assertEquals(ordinaryHitlagFrames(5.999000072479248), 4);
  assertEquals(ordinaryHitlagFrames(6.0), 5);
  assertEquals(ordinaryHitlagFrames(15.0), 8);
  assertEquals(ordinaryHitstunFrames(2.499000072479248), 1);
  assertEquals(ordinaryHitstunFrames(2.5), 1);
  assertEquals(ordinaryHitstunFrames(51.06666564941406), 20);
});
