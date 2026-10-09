


import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { queueAttack } from "../input/attackBuffer";
import { AttackStyle, Character, SpecialAction } from "./codes";
import { canAttack } from "./conditions";
import type { Controls } from "./roster";
import {
  CHAOS_STRIKE_FORM, FEL_RUSH_BRANCH_FIRST, FEL_RUSH_BRANCH_LAST, FEL_RUSH_FRAMES, FEL_RUSH_SPEED, FEL_RUSH_TELL_LAST,
  VENGEFUL_RETREAT_FORM, VENGEFUL_RETREAT_FRAMES,
} from "./specials";
import { type Duel, duel } from "./testDuel";
import { controls } from "./testWorld";

const RUSH = FEL_RUSH_SPEED * 10;


function actsOnTheNextFrame(d: Duel, facing: number): void {
  const last = d.step();
  assertEquals(d.illidan.special.action, SpecialAction.none);
  assertEquals(d.illidan.attack.style, undefined);
  queueAttack(d.commands[0], { style: AttackStyle.jab, facing: facing < 0 ? -1 : 1, frame: last + 1, mayCharge: false });
  d.step();
  assertTrue(d.illidan.attack.style !== undefined);
}

const sideB = (side: number) => controls({ specialPressed: true, specialX: side, direction: side });
const SHIELD = controls({ shield: true, shieldStrength: 1.0 });


function rushTo(d: Duel, frame: number, side = 1, second: Readonly<Controls> = controls()): void {
  d.step(sideB(side), second);
  d.run(frame - 1, controls(), second);
}

test("Fel Rush: still through the tell, 200 units on frames 6-15 the way the stick points, acting again on frame 30 [spec docs/design/illidan.md]", () => {
  for (const side of [-1, 1]) {
    const d = duel(420.0);
    const start = d.illidan.motion.x;
    rushTo(d, FEL_RUSH_TELL_LAST, side);
    assertEquals(d.illidan.special.action, SpecialAction.demonHunterFelRush);
    assertEquals(d.illidan.facing, side);
    assertEquals(d.illidan.motion.x, start);
    d.run(15 - FEL_RUSH_TELL_LAST);
    assertTrue(Math.abs(f32(f32(d.illidan.motion.x - start) - side * RUSH)) < 1.0);
    const end = d.illidan.motion.x;
    d.run(FEL_RUSH_FRAMES - 15 - 1);
    assertTrue(Math.abs(f32(d.illidan.motion.x - end)) < 1.0);
    actsOnTheNextFrame(d, side);
  }
});

test("Fel Rush in the air: level through the rush, once per airtime, never helpless [spec docs/design/illidan.md]", () => {
  const d = duel(420.0);
  d.step(controls({ jumpPressed: true, jumpHeld: true }));
  d.run(14, controls({ jumpHeld: true }));
  assertFalse(d.illidan.motion.grounded);
  d.step(sideB(1));
  const height = d.illidan.motion.z;
  d.run(14);
  assertTrue(Math.abs(f32(d.illidan.motion.z - height)) < f32(0.01));
  d.run(FEL_RUSH_FRAMES - 15 + 1 + 40);
  assertFalse(d.illidan.special.fall);
  if (!d.illidan.motion.grounded) {
    d.step(sideB(1));
    assertEquals(d.illidan.special.action, SpecialAction.none);
  }
  d.run(120);
  assertTrue(d.illidan.motion.grounded);
  d.step(sideB(1));
  assertEquals(d.illidan.special.action, SpecialAction.demonHunterFelRush);
});

test("Fel Rush passes through a body, popping it up for 6 and draining 4 mana [spec docs/design/illidan.md]", () => {
  const d = duel(120.0);
  d.target.mana.points = 50;
  d.step(sideB(1));

  for (let i = 0; i < 40 && d.illidan.special.frame < 15; i++) d.step();
  assertEquals(d.target.status.damage, 6.0);
  assertEquals(d.drained, 4);
  assertGreaterThan(d.illidan.motion.x, d.target.motion.x);
  assertFalse(d.target.motion.grounded);
  assertTrue(d.illidan.special.hit);
});

test("Fel Rush counterplay: a raised shield stops it short, takes no drain, and the rush with no branch is punished [spec docs/design/illidan.md]", () => {
  const d = duel(170.0);
  d.target.mana.points = 50;
  d.run(4, controls(), SHIELD);
  assertTrue(d.target.shield.raised);
  rushTo(d, 15, 1, SHIELD);
  assertLessThan(d.illidan.motion.x, d.target.motion.x);
  assertEquals(d.target.status.damage, 0.0);
  assertEquals(d.target.mana.points, 50);
  assertGreaterThan(d.target.visuals.shield, 0);

  let frame = d.step();
  while (!canAttack(d.target) && frame < 60) frame = d.step();
  queueAttack(d.commands[1], { style: AttackStyle.jab, facing: -1, frame: frame + 1, mayCharge: false });
  d.run(8);
  assertGreaterThan(d.illidan.status.damage, 0.0);
});

test("Fel Rush counterplay: a hit during the tell stops it before it moves [spec docs/design/illidan.md]", () => {
  const d = duel(60.0);
  const start = d.illidan.motion.x;
  const frame = d.step(sideB(1));
  queueAttack(d.commands[1], { style: AttackStyle.jab, facing: -1, frame, mayCharge: false });
  d.run(FEL_RUSH_TELL_LAST);
  assertGreaterThan(d.illidan.status.damage, 0.0);
  assertEquals(d.illidan.special.action, SpecialAction.none);
  d.run(15);
  assertLessThan(Math.abs(f32(d.illidan.motion.x - start)), 60.0);
});

test("Vengeful Retreat: a special press in frames 10-24 vaults back, acting on its frame 17; outside the window nothing [spec docs/design/illidan.md]", () => {
  for (const press of [FEL_RUSH_BRANCH_FIRST - 1, FEL_RUSH_BRANCH_FIRST, FEL_RUSH_BRANCH_LAST, FEL_RUSH_BRANCH_LAST + 1]) {
    const d = duel(420.0);
    rushTo(d, press - 1);
    const at = d.illidan.motion.x;
    d.step(sideB(1));
    const branched = press >= FEL_RUSH_BRANCH_FIRST && press <= FEL_RUSH_BRANCH_LAST;
    assertEquals(d.illidan.special.form, branched ? VENGEFUL_RETREAT_FORM : 0);
    if (!branched) continue;
    d.run(VENGEFUL_RETREAT_FRAMES - 2);
    assertLessThan(d.illidan.motion.x, f32(at - 100.0));
    assertFalse(d.illidan.special.fall);
    actsOnTheNextFrame(d, 1);
  }
});

test("Vengeful Retreat counterplay: no intangibility, so a chasing hit lands during the vault [spec docs/design/illidan.md]", () => {
  const d = duel(420.0);
  rushTo(d, 11);
  d.step(sideB(1));
  assertEquals(d.illidan.special.form, VENGEFUL_RETREAT_FORM);
  for (let frame = 1; frame <= 10; frame++) {
    assertFalse(d.illidan.status.invincible > 0);
    d.step();
  }
});

test("Chaos Strike: an attack press slashes toward the held stick for 10 and drains 10; the other side misses [spec docs/design/illidan.md]", () => {
  for (const back of [false, true]) for (const held of [1, -1]) {
    const d = duel(420.0);
    d.target.mana.points = 50;
    rushTo(d, 15);
    d.target.motion.x = f32(d.illidan.motion.x + (back ? -80.0 : 80.0));
    d.step(controls({ attackPressed: true, direction: held }));
    assertEquals(d.illidan.special.form, CHAOS_STRIKE_FORM);
    d.run(8);
    const faces = held < 0 ? -1 : 1;
    const hits = (back && faces < 0) || (!back && faces > 0);
    assertEquals(d.target.status.damage, hits ? 10.0 : 0.0);
    assertEquals(d.drained, hits ? 10 : 0);
  }
});

