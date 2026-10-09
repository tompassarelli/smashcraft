import { TECH_WINDOW_FRAMES, TECH_PRESS_AGE_LIMIT } from "../physics/techInput";

import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, DownState } from "./codes";
import { TECH_INTANGIBLE_FRAMES, isFloorTeching } from "./conditions";
import { type Fighter,  } from "./fighter";
import { createReferenceFighter } from "./referenceRig";
import { updateProjectiles } from "./projectiles";
import type { Controls } from "./roster";
import { surfaceLeft, surfaceRight, surfaceZ } from "./stage";
import { advanceSolo, controls, resolveStartedAttack, testWorld } from "./testWorld";

function techTestTumbler(): Fighter {
  const fighter = createReferenceFighter(Character.sylvanas, 0.0, 1);
  fighter.motion.grounded = false;
  fighter.down.state = DownState.tumble;
  fighter.launch.hitstun = 100;
  fighter.motion.z = 300.0;
  return fighter;
}

function advanceTechAirTick(fighter: Fighter, input: Readonly<Controls>): void {
  fighter.motion.z = 300.0;
  fighter.motion.vz = 0.0;
  advanceSolo(fighter, 0, input, 0.0);
}

function landTechTest(fighter: Fighter, stage: number, surface: number, input: Readonly<Controls>): void {
  fighter.motion.z = f32(surfaceZ(stage, surface, 0) + 1);
  fighter.motion.vz = -2.0;
  advanceSolo(fighter, stage, input, 0.0);
}

test("the tech window includes the press and the twentieth contact but not the twenty-first [reference]", () => {
  for (let contact = 1; contact <= TECH_WINDOW_FRAMES + 1; contact++) {
    const fighter = techTestTumbler();
    const input = controls({ techPressed: true, airDodgePressed: true });
    for (let tick = 1; tick <= contact - 1; tick++) {
      advanceTechAirTick(fighter, input);
      input.techPressed = false;
      input.airDodgePressed = false;
    }
    landTechTest(fighter, 0, 0, input);
    assertEquals(fighter.down.state, contact <= TECH_WINDOW_FRAMES ? DownState.tech : DownState.bound);
    assertFalse(fighter.dodge.airDodging);
    assertEquals(fighter.tech.window, 0);
    assertEquals(fighter.launch.hitstun, 0);
    assertEquals(fighter.motion.vx, 0.0);
    assertEquals(fighter.motion.vz, 0.0);
  }
});

test("the tech repeat boundary uses the original prior press age [reference]", () => {
  for (const gap of [40, 41]) {
    const fighter = techTestTumbler();
    const input = controls({ techPressed: true });
    advanceTechAirTick(fighter, input);
    input.techPressed = false;
    for (let elapsed = 1; elapsed <= gap - 1; elapsed++) advanceTechAirTick(fighter, input);
    assertEquals(fighter.tech.pressAge, gap - 1);
    input.techPressed = true;
    advanceTechAirTick(fighter, input);
    assertEquals(fighter.tech.previousPressAge, gap - 1);
    assertEquals(fighter.tech.window, gap === 41 ? TECH_WINDOW_FRAMES : 0);
  }
});

test("a grounded shield edge counts, but only a tumble contact can tech [reference]", () => {
  const input = controls({ shield: true });
  const held = techTestTumbler();
  landTechTest(held, 0, 0, input);
  assertEquals(held.down.state, DownState.bound);
  const grounded = createReferenceFighter(Character.sylvanas, 0.0, 1);
  input.techPressed = true;
  advanceSolo(grounded, 0, input, 0.0);
  assertEquals(grounded.tech.window, TECH_WINDOW_FRAMES);
  assertEquals(grounded.tech.previousPressAge, TECH_PRESS_AGE_LIMIT);
  grounded.motion.grounded = false;
  grounded.down.state = DownState.tumble;
  grounded.launch.hitstun = 50;
  landTechTest(grounded, 0, 0, input);
  assertEquals(grounded.down.state, DownState.bound);
  assertEquals(grounded.tech.window, 0);
  const ordinary = createReferenceFighter(Character.sylvanas, 0.0, 1);
  ordinary.motion.grounded = false;
  landTechTest(ordinary, 0, 0, input);
  assertEquals(ordinary.down.state, DownState.none);
  assertTrue(ordinary.motion.grounded);
  assertEquals(ordinary.landing.lag, 4);
});

test("a tech roll clamps at both ends of the current platform [spec docs/physics.md]", () => {
  for (const direction of [-1, 1]) {
    const fighter = techTestTumbler();
    fighter.motion.x = direction < 0 ? f32(surfaceLeft(1, 1, 0) + 3) : f32(surfaceRight(1, 1, 0) - 3);
    const input = controls({ techPressed: true, direction });
    landTechTest(fighter, 1, 1, input);
    input.techPressed = false;
    for (let frame = 2; frame <= 19; frame++) advanceSolo(fighter, 1, input, 0.0);
    assertEquals(fighter.motion.x, direction < 0 ? surfaceLeft(1, 1, 0) : surfaceRight(1, 1, 0));
    assertEquals(fighter.motion.z, surfaceZ(1, 1, 0));
    assertEquals(fighter.motion.surface, 1);
    assertTrue(fighter.motion.grounded);
  }
});

test("original tech-input hitlag aging and accumulation reach the production state [reference]", () => {
  const early = techTestTumbler();
  const input = controls({ techPressed: true });
  early.launch.hitlag = 4;
  advanceTechAirTick(early, input);
  assertEquals(early.tech.pressAge, 0);
  assertEquals(early.tech.previousPressAge, TECH_PRESS_AGE_LIMIT);
  assertTrue(early.tech.accumulatedPress);
  input.techPressed = false;
  for (let tick = 1; tick <= 2; tick++) {
    advanceTechAirTick(early, input);
    assertEquals(early.tech.pressAge, 0);
    assertEquals(early.tech.previousPressAge, 0);
    assertEquals(early.tech.window, 0);
  }
  advanceTechAirTick(early, input);
  assertEquals(early.launch.hitlag, 0);
  assertEquals(early.tech.pressAge, 1);
  assertEquals(early.tech.previousPressAge, 0);
  assertFalse(early.tech.accumulatedPress);
  assertEquals(early.tech.window, 0);
  const last = techTestTumbler();
  last.launch.hitlag = 4;
  for (let tick = 1; tick <= 2; tick++) advanceTechAirTick(last, input);
  assertEquals(last.launch.hitlag, 2);
  input.techPressed = true;
  advanceTechAirTick(last, input);
  assertEquals(last.launch.hitlag, 1);
  assertEquals(last.tech.window, TECH_WINDOW_FRAMES);
  input.techPressed = false;
  advanceTechAirTick(last, input);
  assertEquals(last.launch.hitlag, 0);
  assertEquals(last.tech.pressAge, 1);
  assertEquals(last.tech.window, TECH_WINDOW_FRAMES - 1);
  landTechTest(last, 0, 0, input);
  assertEquals(last.down.state, DownState.tech);
  const releaseFrame = techTestTumbler();
  releaseFrame.launch.hitlag = 1;
  input.techPressed = true;
  advanceTechAirTick(releaseFrame, input);
  assertEquals(releaseFrame.launch.hitlag, 0);
  assertEquals(releaseFrame.tech.window, TECH_WINDOW_FRAMES);
});

test("a tech's vulnerable recovery can be interrupted by melee or the rifleman's shot [reference]", () => {
  for (const style of [AttackStyle.jab, AttackStyle.shot]) {
    const fighter = techTestTumbler();
    fighter.motion.x = 100.0;
    landTechTest(fighter, 0, 0, controls({ techPressed: true }));
    const early = testWorld(createReferenceFighter(Character.rifleman, 0.0, 1), fighter);
    resolveStartedAttack(early, style);
    updateProjectiles(early);
    assertEquals(fighter.status.damage, 0.0);
    fighter.down.frame = TECH_INTANGIBLE_FRAMES + 1;
    const late = testWorld(createReferenceFighter(Character.rifleman, 0.0, 1), fighter);
    resolveStartedAttack(late, style);
    updateProjectiles(late);
    assertGreaterThan(fighter.status.damage, 0.0);
    assertFalse(isFloorTeching(fighter));
    assertGreaterThan(fighter.launch.hitstun, 0);
  }
});

test("a grabbed fighter still tracks digital tech presses and their lockout [reference]", () => {
  const fighter = createReferenceFighter(Character.sylvanas, 0.0, 1);
  const input = controls({ techPressed: true });
  fighter.grab.grabbedFrames = 10;
  advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.tech.window, TECH_WINDOW_FRAMES);
  input.techPressed = false;
  for (let tick = 1; tick <= 4; tick++) advanceSolo(fighter, 0, input, 0.0);
  input.techPressed = true;
  advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.tech.window, 0);
});
