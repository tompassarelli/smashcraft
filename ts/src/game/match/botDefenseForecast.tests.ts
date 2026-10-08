import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { at } from "wisp/src/runtime/lookup";
import { AttackStyle, Character, SpecialAction } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { neutralControls } from "../sim/roster";
import { chooseDefense } from "./botDefense";
import { cpuSkill } from "./cpuSkill";
import { HeroSpecialUse, heroSpecialUse, heroStanceLater, heroStanceSlot } from "./botHeroKit";
import { SpecialSlot } from "../sim/heroSpecials";
import { beginFighterAttack } from "../sim/attacks";
import { testWorld } from "../sim/testWorld";
import { cancelAttack } from "../sim/transitions";

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

test("Forsaken Paladin defends his approach to a delayed shot without treating Consecration as a guard", () => {
  const own = createFighter(Character.forsakenPaladin, 0.0, 1);
  const target = createFighter(Character.forsakenPaladin, 500.0, -1);
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
    assertFalse(input.specialPressed);
    if (input.shield || input.groundDodgePressed) guards++;
  }
  assertGreaterThan(guards, 0);
  assertEquals(projectile.x, 355.0);
  assertFalse(heroStanceLater(own, 20));
  assertFalse(heroStanceLater(own, 1));
});

test("Kaelthas uses Banish against the same shot only when its protection covers arrival and mana allows it", () => {
  const own = createFighter(Character.kaelthas, 0.0, 1);
  const target = createFighter(Character.archer, -500.0, 1);
  own.motion.grounded = true; target.motion.grounded = true;
  const shot = at(target.projectiles, 0);
  shot.life = 60; shot.direction = 1; shot.velocityX = 10.0; shot.z = 45.0;
  const skill = { ...cpuSkill("wren", "expert"), reactionFrames: 0, defendTenths: 10 };
  for (const mana of [14, 15]) for (const arrival of [3, 4, 7, 11, 12]) {
    own.mana.points = mana; shot.x = -arrival * 10.0;
    const fits = mana >= 15 && arrival >= 4 && arrival <= 11;
    assertEquals(heroStanceSlot(own, arrival), fits ? SpecialSlot.down : undefined);
    assertEquals(heroStanceLater(own, arrival), mana >= 15 && arrival > 11);
    let banishes = 0;
    for (let serial = 0; serial < 30; serial++) {
      shot.serial = serial;
      const input = neutralControls();
      chooseDefense(own, target, 0, input, skill);
      if (input.specialPressed) {
        banishes++;
        assertEquals(input.specialX, 0); assertEquals(input.specialZ, -1); assertFalse(input.shield);
      }
    }
    if (fits) assertGreaterThan(banishes, 0);
    else assertEquals(banishes, 0);
  }
  own.mana.points = 15; shot.x = -70.0;
  beginFighterAttack(testWorld(own, target), 0, AttackStyle.jab, false);
  assertEquals(own.attack.style, AttackStyle.jab);
  assertEquals(heroStanceSlot(own, 7), undefined); assertFalse(heroStanceLater(own, 12));
  assertFalse(chooseDefense(own, target, 0, neutralControls(), skill));
  cancelAttack(own);
  target.motion.x = 45.0;
  assertEquals(heroSpecialUse(own, target, 0, SpecialSlot.down), HeroSpecialUse.close);
});
