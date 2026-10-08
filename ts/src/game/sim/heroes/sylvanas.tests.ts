import { assertEquals, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { attackBuffer } from "../../input/attackBuffer";
import { firstFighterDifference } from "../../replay/difference";
import { copyFighterState } from "../../replay/fighterState";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, GrabAction, HeroStatusKind, SpecialAction } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { createFighter } from "../fighter";
import { advanceHeroStatus } from "../heroSpecialRules";
import { maskHeroStatusControls } from "../heroStatus";
import { attackStartupFrames, grabContactFrame, isAerialAttack } from "../moves";
import { updateProjectiles } from "../projectiles";
import { type Controls, type Roster, fighterAt } from "../roster";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { advanceFighter } from "../step";
import { controls, testGrabFrame, testWorld } from "../testWorld";
import { SYLVANAS_MOVES } from "./sylvanasMoves";

function frame(world: Roster, press: Readonly<Controls> = controls(), response: Readonly<Controls> = controls()): void {
  const inputs = [{ ...press }, { ...response }];
  for (let slot = 0; slot < 2; slot++) {
    const input = inputs[slot]!;
    maskHeroStatusControls(fighterAt(world, slot), input, attackBuffer(0));
    advanceFighter(world, slot, 0, input, slot === 0 ? -240.0 : 240.0);
  }
  beginDamageContacts();
  for (let slot = 0; slot < 2; slot++) startFighterSpecial(fighterAt(world, slot), 0, 0, inputs[slot]!);
  resolveAttacks(world);
  advanceSpecials(world, 0, 0, inputs);
  updateProjectiles(world);
  finishDamageContacts(world);
  for (let slot = 0; slot < 2; slot++) advanceHeroStatus(fighterAt(world, slot));
}
function pair(gap = 100.0, facing = 1) {
  const owner = createFighter(Character.sylvanas, f32(-gap * 0.5 * facing), facing);
  owner.mana.points = 100;
  const target = createFighter(Character.archer, f32(gap * 0.5 * facing), -facing);
  const world = testWorld(owner, target);
  for (let i = 0; i < 3; i++) frame(world);
  return { world, owner, target };
}

test("Sylvanas has Pit's weight, run and air speed in world units [reference] [spec docs/design/sylvanas.md]", () => {
  const { owner } = pair();
  assertNear(owner.tuning.physics.weight, 96.0, f32(0.00002));
  assertNear(owner.tuning.physics.runSpeed, f32(10.968), f32(0.00002));
  assertNear(owner.tuning.physics.airSpeed, f32(5.61), f32(0.00002));
});

const contacts = [
  [AttackStyle.jab, 42.0, 0.0, 3.0], [AttackStyle.jab2, 46.0, 0.0, 3.0], [AttackStyle.jab3, 52.0, 0.0, 5.0],
  [AttackStyle.forwardTilt, 95.0, 0.0, 9.0], [AttackStyle.forwardTiltUp, 95.0, 30.0, 9.0], [AttackStyle.forwardTiltDown, 90.0, 0.0, 9.0],
  [AttackStyle.upTilt, 12.0, 90.0, 7.0], [AttackStyle.downTilt, 80.0, 0.0, 7.0], [AttackStyle.dashAttack, 100.0, 0.0, 10.0],
  [AttackStyle.forwardSmash, 130.0, 0.0, 16.5], [AttackStyle.upSmash, 0.0, 120.0, 13.0], [AttackStyle.downSmash, 95.0, 0.0, 12.0],
  [AttackStyle.neutralAir, 70.0, 0.0, 7.0], [AttackStyle.forwardAir, 110.0, 0.0, 10.0], [AttackStyle.backAir, -95.0, 0.0, 11.0],
  [AttackStyle.upAir, 0.0, 85.0, 8.0], [AttackStyle.downAir, 8.0, -100.0, 11.0],
] as const;
for (const [style, x, z, damage] of contacts) test(`Sylvanas normal ${style} connects once in either facing and misses beyond its reach [spec docs/design/sylvanas.md]`, () => {
  for (const facing of [-1, 1]) for (const distant of [false, true]) {
    const { world, owner, target } = pair();
    owner.motion.x = 0.0;
    owner.facing = facing;
    owner.motion.grounded = !isAerialAttack(style);
    target.motion.x = f32((distant ? x + 500.0 : x) * facing);
    target.motion.z = z;
    target.motion.grounded = z === 0.0;
    beginFighterAttack(world, 0, style, false);
    owner.attack.frame = attackStartupFrames(style, SYLVANAS_MOVES);
    resolveAttacks(world);
    assertEquals(target.status.damage, distant ? 0.0 : damage);
    owner.launch.hitlag = 0;
    owner.attack.frame++;
    resolveAttacks(world);
    assertEquals(target.status.damage, distant ? 0.0 : damage);
  }
});

test("Sylvanas catches through the ordinary grab and releases each throw once in both facings [spec docs/design/sylvanas.md]", () => {
  for (const facing of [-1, 1]) for (const [action, damage, direction, vertical] of [
    [GrabAction.throwForward, 7.0, 1, 0], [GrabAction.throwBack, 8.0, -1, 0], [GrabAction.throwUp, 6.0, 0, 1], [GrabAction.throwDown, 6.0, 0, -1],
  ] as const) {
    const { world, owner, target } = pair(48.0, facing);
    beginFighterAttack(world, 0, AttackStyle.grab, false);
    owner.attack.frame = attackStartupFrames(AttackStyle.grab, SYLVANAS_MOVES);
    resolveAttacks(world);
    assertEquals(owner.grab.target, 1);
    testGrabFrame(world, [controls({ grabThrowX: direction * facing, grabThrowZ: vertical }), controls()], false);
    assertEquals(owner.grab.action, action);
    for (let i = 2; i <= grabContactFrame(action, SYLVANAS_MOVES); i++) testGrabFrame(world, [controls(), controls()], false);
    assertEquals(target.status.damage, damage);
    assertEquals(target.grab.owner, undefined);
    assertGreaterThan(target.launch.knockbackZ, 0.0);
    if (direction !== 0) assertGreaterThan(target.launch.knockbackX * direction * facing, 0.0);
  }
});

test("Sylvanas pummel is one slow Life Drain squeeze and never repeats in one hold [spec docs/design/sylvanas.md]", () => {
  const { world, owner, target } = pair(48.0);
  beginFighterAttack(world, 0, AttackStyle.grab, false);
  owner.attack.frame = attackStartupFrames(AttackStyle.grab, SYLVANAS_MOVES);
  resolveAttacks(world);
  testGrabFrame(world, [controls({ attackPressed: true }), controls()], false);
  for (let i = 2; i <= 60; i++) testGrabFrame(world, [controls(), controls()], false);
  assertEquals(target.status.damage, 3.0);
  for (let i = 0; i < 80; i++) testGrabFrame(world, [controls({ attackPressed: true }), controls()], false);
  assertEquals(target.status.damage, 3.0);
});

test("Sylvanas regular specials preserve the super meter and finish their whiffs on the designed frame [spec #335]", () => {
  for (const [x, z, action, mana, end] of [[0, 0, SpecialAction.heroNeutral, 8, 40], [1, 0, SpecialAction.heroSide, 20, 48], [0, 1, SpecialAction.heroUp, 15, 31], [0, -1, SpecialAction.heroDown, 20, 52]] as const) {
    const { world, owner } = pair(900.0);
    frame(world, controls({ specialPressed: true, specialX: x, specialZ: z }));
    assertEquals(owner.special.action, action);
    assertEquals(owner.mana.points, 100);
    for (let i = 2; i <= end; i++) frame(world);
    assertEquals(owner.special.action, SpecialAction.none);
    assertEquals(owner.mana.points, 100);
  }
});

test("Black Arrow deals nine damage in both facings [spec #259]", () => {
  for (const facing of [-1, 1]) {
    const { world, target } = pair(300.0, facing);
    frame(world, controls({ specialPressed: true }));
    for (let i = 0; i < 70; i++) frame(world);
    assertEquals(target.status.damage, 9.0);
  }
});

test("Silence leaves movement, normals and recovery available, never passes a shield [spec docs/design/sylvanas.md]", () => {
  for (const facing of [-1, 1]) for (const blocked of [false, true]) {
    const { world, target } = pair(130.0, facing);
    frame(world, controls({ specialPressed: true, specialX: facing }), controls({ shield: blocked }));
    for (let i = 0; i < 30; i++) frame(world, controls(), controls({ shield: blocked }));
    assertEquals(target.status.condition, blocked ? HeroStatusKind.none : HeroStatusKind.silence);
    assertEquals(target.status.damage, blocked ? 0.0 : 4.0);
    if (blocked) continue;
    const offensive = controls({ specialPressed: true, specialX: 1, direction: 1, attackPressed: true, jumpPressed: true, shield: true });
    maskHeroStatusControls(target, offensive, attackBuffer(0));
    assertEquals(offensive.specialPressed, false);
    assertEquals(offensive.attackPressed, true);
    assertEquals(offensive.jumpPressed, true);
    assertEquals(offensive.direction, 1);
    assertEquals(offensive.shield, true);
    const recover = controls({ specialPressed: true, specialZ: 1 });
    maskHeroStatusControls(target, recover, attackBuffer(0));
    assertEquals(recover.specialPressed, true);
  }
});

test("Life Drain catches a shield, heals at most nine per stock and refuses an airborne cast [spec docs/design/sylvanas.md]", () => {
  for (const facing of [-1, 1]) {
    const { world, owner, target } = pair(65.0, facing);
    owner.status.damage = 40.0;
    frame(world, controls({ specialPressed: true, specialZ: -1 }), controls({ shield: true }));
    for (let i = 0; i < 85; i++) frame(world, controls(), controls({ shield: true }));
    assertEquals(target.status.damage, 9.0);
    assertEquals(owner.status.damage, 39.0);
    assertEquals(owner.grab.target, undefined);
    owner.motion.grounded = false;
    owner.motion.surface = undefined;
    owner.motion.z = 300.0;
    frame(world, controls({ specialPressed: true, specialZ: -1 }));
    assertEquals(owner.special.action, SpecialAction.none);
    assertEquals(owner.mana.points, 100);
  }
});

test("Banshee Flight steers in both directions, spends her jump and keeps full recovery at zero meter [spec #335]", () => {
  for (const direction of [-1, 1]) {
    let fullRise = 0.0;
    for (const mana of [100, 0]) {
      const { world, owner } = pair(900.0);
      owner.motion.grounded = false;
      owner.motion.surface = undefined;
      owner.motion.z = 300.0;
      owner.mana.points = mana;
      const x = owner.motion.x;
      frame(world, controls({ specialPressed: true, specialZ: 1, direction }));
      for (let i = 1; i < 31; i++) frame(world, controls({ direction }));
      assertGreaterThan((owner.motion.x - x) * direction, 45.0);
      assertEquals(owner.jump.remaining, 0);
      assertTrue(owner.special.fall);
      if (mana > 0) fullRise = owner.motion.z;
      else assertEquals(owner.motion.z, fullRise);
    }
  }
});

test("Sylvanas projectile and charge replay state restores exactly [invariant]", () => {
  const { world, owner } = pair(300.0);
  frame(world, controls({ specialPressed: true }));
  for (let i = 0; i < 19; i++) frame(world);
  const restored = createFighter(Character.sylvanas, 0.0, 1);
  copyFighterState(restored, owner, 3);
  assertEquals(firstFighterDifference(owner, restored, 3, 3), undefined);
});
