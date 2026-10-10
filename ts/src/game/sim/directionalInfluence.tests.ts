import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "./codes";
import { createReferenceFighter } from "./referenceRig";
import { ordinaryHitKnockback } from "./knockback";
import { totalVelocityX } from "./motion";
import { ASDI_DISTANCE } from "./smashDirectionalInfluence";
import { advanceSolo, controls } from "./testWorld";

const length = (x: number, z: number) => Math.sqrt(x * x + z * z);

test("ASDI uses the C-stick while DI still uses the left stick on the release frame [reference] [spec docs/physics.md]", () => {
  const fighter = createReferenceFighter(Character.sylvanas, 300.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.z = 400.0;
  fighter.launch.hitlag = 1;
  fighter.launch.diPending = true;
  fighter.launch.diLaunchSpeed = 10.0;
  fighter.launch.knockbackX = 10.0;
  advanceSolo(fighter, 0, controls({ verticalDirection: 1, cStickX: 1 }), -240.0);
  assertEquals(fighter.motion.x, f32(f32(300 + ASDI_DISTANCE) + totalVelocityX(fighter)));
  assertNear(fighter.launch.knockbackX, 9.219541549682617, 0.0010000000474974513);
  assertNear(fighter.launch.knockbackZ, 2.9956107139587402, 0.0010000000474974513);
  assertEquals(fighter.launch.asdiSerial, 1);
  assertEquals(fighter.launch.diSerial, 1);
  assertNear(fighter.launch.diAngleDegrees, 18.0, 0.0010000000474974513);
  assertEquals(fighter.launch.sdiSerial, 0);
});

test("knockback decays by vector magnitude and continues after hitstun [reference] [spec docs/physics.md]", () => {
  const fighter = createReferenceFighter(Character.sylvanas, 100.0, 1);
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
  assertNear(fighter.launch.knockbackX / fighter.launch.knockbackZ, 0.75, 0.0010000000474974513);
  const xAtStunEnd = fighter.motion.x;
  advanceSolo(fighter, 0, input, -240.0);
  assertTrue(fighter.motion.x > xAtStunEnd);
  assertNear(length(fighter.launch.knockbackX, fighter.launch.knockbackZ), 99.38800048828125, 0.0010000000474974513);
});

test("DI reads only the last hitlag frame and preserves launch speed [reference] [spec docs/physics.md]", () => {
  const fighter = createReferenceFighter(Character.sylvanas, 0.0, 1);
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

test("DI normalizes diagonal input and ignores parallel input [reference] [spec docs/physics.md]", () => {
  const diagonal = createReferenceFighter(Character.sylvanas, 0.0, 1);
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
  const parallel = createReferenceFighter(Character.sylvanas, 0.0, 1);
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

test("a held shield drains by the frame-rate amount [reference]", () => {
  const fighter = createReferenceFighter(Character.sylvanas, 0.0, 1);
  fighter.shield.energy = 0.5;
  const input = controls({ shield: true });
  advanceSolo(fighter, 0, input, -240.0);
  assertTrue(fighter.shield.raised);
  assertEquals(fighter.shield.energy, 0.5);
  advanceSolo(fighter, 0, input, -240.0);
  assertNear(fighter.shield.energy, 0.2199999988079071, 0.0010000000474974513);
});

test("the ordinary hit formula uses independent per-hit parameters [reference]", () => {
  assertNear(ordinaryHitKnockback(0.0, 12.0, 80.0, 100.0, 20.0, 1.0), 51.06666564941406, 0.00009999999747378752);
  assertNear(ordinaryHitKnockback(0.0, 12.0, 80.0, 150.0, 20.0, 1.0), 66.5999984741211, 0.00009999999747378752);
  assertNear(ordinaryHitKnockback(0.0, 12.0, 80.0, 100.0, 30.0, 1.0), 61.06666564941406, 0.00009999999747378752);
  assertNear(ordinaryHitKnockback(0.0, 12.0, 80.0, 100.0, 20.0, 1.2000000476837158), 61.279998779296875, 0.00009999999747378752);
  assertGreaterThan(ordinaryHitKnockback(0.0, 12.0, 75.0, 100.0, 20.0, 1.0), 51.06666564941406);
});

test("an ordinary hit separates fractional percent from integer attack power [reference]", () => {
  const baseline = ordinaryHitKnockback(9.0, 1.5, 80.0, 100.0, 20.0, 1.0);
  assertNear(ordinaryHitKnockback(9.99899959564209, 1.5, 80.0, 100.0, 20.0, 1.0), baseline, 0.00009999999747378752);
  assertNear(baseline, 40.45000076293945, 0.00009999999747378752);
  assertGreaterThan(ordinaryHitKnockback(10.0, 1.5, 80.0, 100.0, 20.0, 1.0), baseline);
});
