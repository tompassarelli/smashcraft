import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { at } from "wisp/src/runtime/lookup";
import { Character, SpecialAction } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { neutralControls } from "../sim/roster";
import { chooseDefense } from "./botDefense";
import { cpuSkill } from "./cpuSkill";
import { heroStanceLater } from "./botHeroKit";

test("Mountain King defends the observed Carrion Swarm windup before its bats enter delayed vision", () => {
  const own = createFighter(Character.mountainKing, 0.0, 1);
  const target = createFighter(Character.dreadlord, 110.0, -1);
  const skill = { ...cpuSkill("wren", "expert"), reactionFrames: 0, defendTenths: 10 };
  assertFalse(chooseDefense(own, target, 0, neutralControls(), skill, 12));
  target.special.action = SpecialAction.heroNeutral;
  target.special.frame = 1;
  target.special.duration = 45;
  const input = neutralControls();
  assertTrue(chooseDefense(own, target, 0, input, skill, 12));
  assertTrue(input.shield);
  assertEquals(target.special.frame, 1);
  assertTrue(target.projectiles.every(projectile => projectile.life === 0));
});

test("Dreadlord recognizes a blaster launched during the observation delay from its visible windup", () => {
  const own = createFighter(Character.dreadlord, 358.0, -1);
  const target = createFighter(Character.rifleman, -209.0, 1);
  const skill = { ...cpuSkill("wren", "expert"), reactionFrames: 0, defendTenths: 10 };
  target.special.action = SpecialAction.riflemanBlaster;
  target.special.frame = 1;
  target.special.duration = 38;
  const input = neutralControls();
  assertTrue(chooseDefense(own, target, 0, input, skill, 12));
  assertTrue(input.shield || input.jumpPressed);
  target.facing = -1;
  assertFalse(chooseDefense(own, target, 0, neutralControls(), skill, 12));
  target.facing = 1;
  target.motion.z = 300.0;
  assertFalse(chooseDefense(own, target, 0, neutralControls(), skill, 12));
  target.motion.z = 0.0;
  target.special.frame = 20;
  assertFalse(chooseDefense(own, target, 0, neutralControls(), skill, 12));
});

test("a falling projectile windup that lands before firing does not cause a false defense", () => {
  const own = createFighter(Character.mountainKing, -591.0, 1);
  const target = createFighter(Character.dreadlord, -515.0, -1);
  const skill = { ...cpuSkill("wren", "expert"), reactionFrames: 0, defendTenths: 10 };
  target.motion.grounded = false;
  target.motion.z = 26.5;
  target.motion.vz = -9.5;
  target.motion.deltaZ = -9.5;
  target.special.action = SpecialAction.heroDown;
  target.special.form = 1;
  target.special.frame = 13;
  target.special.duration = 58;
  assertFalse(chooseDefense(own, target, 0, neutralControls(), skill, 12));
});

test("a delayed visible shot is defended at its predicted position without seeing a newer sample", () => {
  const own = createFighter(Character.archer, 0.0, 1);
  const target = createFighter(Character.rifleman, 700.0, -1);
  own.motion.grounded = true;
  target.motion.grounded = true;
  const projectile = at(target.projectiles, 0);
  projectile.life = 60;
  projectile.serial = 6;
  projectile.direction = -1;
  projectile.velocityX = -36.0;
  projectile.velocityZ = 0.0;
  projectile.x = 500.0;
  projectile.z = 75.0;
  const skill = { ...cpuSkill("wren", "expert"), reactionFrames: 0 };
  assertFalse(chooseDefense(own, target, 0, neutralControls(), skill));
  const predicted = neutralControls();
  assertTrue(chooseDefense(own, target, 0, predicted, skill, 12));
  assertTrue(predicted.shield);
  assertTrue(predicted.groundDodgePressed);
  assertEquals(projectile.x, 500.0);
  assertEquals(projectile.life, 60);
  projectile.x = 68.0;
  const current = neutralControls();
  assertTrue(chooseDefense(own, target, 0, current, skill));
  assertEquals(predicted.shield, current.shield);
  assertEquals(predicted.groundDodgePressed, current.groundDodgePressed);
  assertEquals(predicted.groundDodgeDirection, current.groundDodgeDirection);
});

test("a visible shot expected to have expired or passed does not keep the computer defending", () => {
  const own = createFighter(Character.archer, 0.0, 1);
  const target = createFighter(Character.rifleman, 700.0, -1);
  own.motion.grounded = true;
  target.motion.grounded = true;
  const projectile = at(target.projectiles, 0);
  projectile.serial = 6;
  projectile.direction = -1;
  projectile.velocityX = -36.0;
  projectile.velocityZ = 0.0;
  projectile.z = 75.0;
  const skill = { ...cpuSkill("wren", "expert"), reactionFrames: 0 };
  projectile.x = 500.0;
  projectile.life = 12;
  assertFalse(chooseDefense(own, target, 0, neutralControls(), skill, 12));
  projectile.life = 60;
  projectile.x = 400.0;
  assertFalse(chooseDefense(own, target, 0, neutralControls(), skill, 12));
});

test("Uther times his guard for his own approach to a delayed shot and waits only for later arrivals", () => {
  const own = createFighter(Character.uther, 0.0, 1);
  const target = createFighter(Character.uther, 500.0, -1);
  own.motion.vx = 10.0;
  const projectile = at(target.projectiles, 0);
  projectile.life = 60;
  projectile.direction = -1;
  projectile.velocityX = -15.0;
  projectile.x = 355.0;
  projectile.z = 62.0;
  const skill = { ...cpuSkill("wren", "expert"), reactionFrames: 0 };
  let guards = 0;
  for (let serial = 0; serial < 30; serial++) {
    projectile.serial = serial;
    const input = neutralControls();
    chooseDefense(own, target, 0, input, skill, 12);
    if (input.specialPressed && input.specialZ === -1) guards++;
  }
  assertGreaterThan(guards, 0);
  assertEquals(projectile.x, 355.0);
  assertTrue(heroStanceLater(own, 20));
  assertFalse(heroStanceLater(own, 1));
});
