import { assertDefined, assertEquals, assertFalse, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../input/actions";
import { adaptInput } from "../input/adapter";
import { attackBuffer } from "../input/attackBuffer";
import { inputRow } from "../input/inputRow";
import { projectedShield } from "../presentation/shieldPose";
import { copyFighterState } from "../replay/fighterState";
import { Character } from "./codes";
import { createFighter } from "./fighter";
import { neutralControls } from "./roster";
import { shieldCircleIntersects } from "./shield";
import { shieldCenterX, shieldCenterZ } from "./shieldTilt";
import { SHIELD_TILT_STICK_CAP } from "./stick";
import { advanceSolo } from "./testWorld";

const CARDINALS = [
  { name: "left", action: Action.moveLeft, x: -127, z: 0, centerX: f32(-18.928207), centerZ: 45.0 },
  { name: "right", action: Action.moveRight, x: 127, z: 0, centerX: f32(15.773506), centerZ: 45.0 },
  { name: "up", action: Action.moveUp, x: 0, z: 127, centerX: 0.0, centerZ: f32(70.237844) },
  { name: "down", action: Action.moveDown, x: 0, z: -127, centerX: 0.0, centerZ: f32(24.180436) },
] as const;

function guarding() {
  const fighter = createFighter(Character.rifleman, 0.0, 1);
  const controls = neutralControls();
  const attacks = attackBuffer(0);
  const row = assertDefined(inputRow({ held: maskOf(Action.rightTrigger), triggerRight: 255 }));
  for (let frame = 0; frame < 8; frame++) {
    adaptInput(row, fighter, frame, controls, attacks);
    advanceSolo(fighter, 0, controls, 0.0);
  }
  assertTrue(fighter.shield.raised);
  return { fighter, controls, attacks };
}

for (const cardinal of CARDINALS) {
  test(`Tilt plus shield gives capped ${cardinal.name} reach without a roll, dodge or jump [reference]`, () => {
    const { fighter, controls, attacks } = guarding();
    const row = assertDefined(inputRow({
      held: maskOf(Action.rightTrigger, Action.walk, cardinal.action), pressed: maskOf(cardinal.action),
      triggerRight: 255, axisX: cardinal.x, axisZ: cardinal.z,
    }));
    adaptInput(row, fighter, 8, controls, attacks);
    assertFalse(controls.groundDodgePressed);
    assertFalse(controls.jumpPressed);
    assertEquals(controls.diStickX, cardinal.x === 0 ? 0.0 : cardinal.x < 0 ? -SHIELD_TILT_STICK_CAP : SHIELD_TILT_STICK_CAP);
    assertEquals(controls.diStickZ, cardinal.z === 0 ? 0.0 : cardinal.z < 0 ? -SHIELD_TILT_STICK_CAP : SHIELD_TILT_STICK_CAP);
    advanceSolo(fighter, 0, controls, 0.0);
    assertTrue(fighter.shield.raised);
    assertTrue(fighter.motion.grounded);
    assertEquals(fighter.jump.squat, 0);
    assertEquals(fighter.dodge.groundFrame, 0);
    assertNear(shieldCenterX(fighter), cardinal.centerX, f32(0.001));
    assertNear(shieldCenterZ(fighter), cardinal.centerZ, f32(0.001));
    const pose = projectedShield(fighter, true);
    assertEquals(pose.x, shieldCenterX(fighter));
    assertEquals(pose.z, shieldCenterZ(fighter));
    const restored = createFighter(Character.rifleman, 100.0, -1);
    copyFighterState(restored, fighter, 1);
    assertEquals(projectedShield(restored, true).x, pose.x);
    assertEquals(projectedShield(restored, true).z, pose.z);
  });
}

test("shield tilt moves its projectile contact circle with its drawn bubble [spec docs/smash-melee-reference/shield-tilt-cardinals.md]", () => {
  const { fighter, controls, attacks } = guarding();
  assertFalse(shieldCircleIntersects(fighter, -1.0, 95.0, 1.0, 95.0, 1.0));
  const row = assertDefined(inputRow({ held: maskOf(Action.rightTrigger, Action.walk, Action.moveUp), triggerRight: 255, axisZ: 127 }));
  adaptInput(row, fighter, 8, controls, attacks);
  advanceSolo(fighter, 0, controls, 0.0);
  assertTrue(shieldCircleIntersects(fighter, -1.0, 95.0, 1.0, 95.0, 1.0));
});
