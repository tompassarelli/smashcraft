import { assertEquals, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, GrabAction, HitOrigin, SpecialAction } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { createFighter } from "../fighter";
import { advanceHeroStatus } from "../heroSpecialRules";
import { attackStartupFrames, isAerialAttack } from "../moves";
import { advancePassive, enduranceGroundSpeed, resetPassive, sourcePassiveContact } from "../passives";
import { updateProjectiles } from "../projectiles";
import { createRoster, fighterAt, type Controls, type Roster } from "../roster";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { advanceFighter } from "../step";
import { checkBlastZone } from "../stocks";
import { controls, testGrabFrame, testWorld } from "../testWorld";
import { authoredPhysics, melee } from "../tuning";
import { copyFighterState } from "../../replay/fighterState";
import { firstFighterDifference } from "../../replay/difference";
import { CAIRNE_MOVES } from "./cairneMoves";
import { heroBody } from "./heroBodies";

function frame(world: Roster, input: Readonly<Controls> = controls(), attack?: AttackStyle, defender: Readonly<Controls> = controls()): void {
  advanceFighter(world, 0, 0, input, -240.0);
  advanceFighter(world, 1, 0, defender, 240.0);
  beginDamageContacts();
  startFighterSpecial(fighterAt(world, 0), 0, 0, input);
  beginFighterAttack(world, 1, attack, false);
  resolveAttacks(world);
  advanceSpecials(world, 0, 0);
  updateProjectiles(world);
  finishDamageContacts(world);
  advanceHeroStatus(fighterAt(world, 0));
  advanceHeroStatus(fighterAt(world, 1));
}
function pair(gap: number, facing = 1) {
  const owner = createFighter(Character.cairne, f32(-gap * 0.5 * facing), facing);
  owner.mana.points = 100;
  const target = createFighter(Character.forsakenPaladin, f32(gap * 0.5 * facing), -facing);
  const world = createRoster(3, [owner, target]);
  for (let i = 0; i < 3; i++) frame(world);
  owner.mana.points = 100;
  return { owner, target, world };
}

test("Cairne takes King K. Rool's weight and speeds and has a larger body than Pit Lord [reference] [spec docs/design/cairne.md]", () => {
  const physics = authoredPhysics(Character.cairne);
  assertNear(physics.weight, 133.0, f32(0.0001));
  assertNear(physics.runSpeed, melee(f32(1.485)), f32(0.0001));
  assertNear(physics.airSpeed, melee(f32(0.945)), f32(0.0001));
  assertGreaterThan(heroBody(Character.cairne)?.width ?? 0, heroBody(Character.pitLord)?.width ?? 0);
  assertGreaterThan(heroBody(Character.cairne)?.height ?? 0, heroBody(Character.pitLord)?.height ?? 0);
});

const NORMAL_CONTACTS = [
  [AttackStyle.jab, 70.0, 0.0], [AttackStyle.jab2, 85.0, 0.0],
  [AttackStyle.forwardTilt, 130.0, 65.0], [AttackStyle.forwardTiltUp, 130.0, 65.0], [AttackStyle.forwardTiltDown, 130.0, 65.0],
  [AttackStyle.upTilt, 60.0, 85.0], [AttackStyle.downTilt, 110.0, 0.0], [AttackStyle.dashAttack, 80.0, 0.0],
  [AttackStyle.forwardSmash, 160.0, 100.0], [AttackStyle.upSmash, 0.0, 130.0], [AttackStyle.downSmash, 110.0, 0.0],
  [AttackStyle.neutralAir, 110.0, 30.0], [AttackStyle.forwardAir, 135.0, 65.0], [AttackStyle.backAir, -110.0, 40.0],
  [AttackStyle.upAir, 0.0, 115.0], [AttackStyle.downAir, 0.0, -100.0],
] as const;
for (const [style, x, z] of NORMAL_CONTACTS) test(`Cairne normal ${style} hits once in both facings and has no startup contact [spec docs/design/cairne.md]`, () => {
  for (const facing of [1, -1]) {
    const owner = createFighter(Character.cairne, 0.0, facing);
  owner.mana.points = 100;
    owner.motion.grounded = !isAerialAttack(style);
    const target = createFighter(Character.forsakenPaladin, x * facing, -facing);
    target.motion.z = z;
    const world = testWorld(owner, target);
    beginFighterAttack(world, 0, style, false);
    assertEquals(owner.attack.style, style);
    owner.attack.frame = attackStartupFrames(style, CAIRNE_MOVES) - 1;
    resolveAttacks(world);
    assertEquals(target.status.damage, 0.0);
    owner.attack.frame++;
    resolveAttacks(world);
    const damage = target.status.damage;
    assertGreaterThan(damage, 0.0);
    owner.launch.hitlag = 0;
    resolveAttacks(world);
    assertEquals(target.status.damage, damage);
  }
});

test("Cairne's four throws release once toward their chosen direction after a normal grab [spec docs/design/cairne.md]", () => {
  for (const facing of [1, -1]) for (const action of [GrabAction.throwForward, GrabAction.throwBack, GrabAction.throwUp, GrabAction.throwDown]) {
    const { owner, target, world } = pair(50.0, facing);
    beginFighterAttack(world, 0, AttackStyle.grab, false);
    owner.attack.frame = attackStartupFrames(AttackStyle.grab, CAIRNE_MOVES);
    resolveAttacks(world);
    assertEquals(owner.grab.target, 1);
    const authored = CAIRNE_MOVES.throws[action];
    assertTrue(authored !== undefined);
    if (authored === undefined) return;
    const input = controls({ grabThrowX: action === GrabAction.throwForward ? facing : action === GrabAction.throwBack ? -facing : 0,
      grabThrowZ: action === GrabAction.throwUp ? 1 : action === GrabAction.throwDown ? -1 : 0 });
    for (let tick = 1; tick <= authored.contactFrame; tick++) testGrabFrame(world, [input, controls()], false);
    assertEquals(owner.grab.target, undefined);
    assertGreaterThan(target.status.damage, 0.0);
    assertGreaterThan(target.launch.knockbackZ, 0.0);
    if (action === GrabAction.throwBack) assertLessThan(target.launch.knockbackX * facing, 0.0);
    else assertGreaterThan(target.launch.knockbackX * facing, 0.0);
  }
});

test("Cairne Shockwave and War Stomp hit once, respect shields and preserve the super meter [spec #335]", () => {
  for (const facing of [1, -1]) for (const shield of [false, true]) for (const side of [false, true]) {
    const { owner, target, world } = pair(side ? 160.0 : 330.0, facing);
    const defended = controls({ shield });
    frame(world, controls({ specialPressed: true, specialX: side ? facing : 0 }), undefined, defended);
    assertEquals(owner.mana.points, 100);
    for (let i = 0; i < 100; i++) frame(world, controls(), undefined, defended);
    assertEquals(target.status.damage, shield ? 0.0 : side ? 13.0 : 10.0);
    assertEquals(owner.special.action, SpecialAction.none);
  }
});

test("Cairne Spirit Lift rises, spends his aerial jump and ends helpless even without mana [spec docs/design/cairne.md]", () => {
  for (const mana of [0, 100]) {
    const { owner, world } = pair(1000.0);
    owner.motion.grounded = false; owner.motion.surface = undefined; owner.motion.x = -950.0; owner.motion.z = 400.0;
    owner.jump.remaining = 1; owner.mana.points = mana;
    frame(world, controls({ specialPressed: true, specialZ: 1 }));
    assertEquals(owner.special.action, SpecialAction.heroUp);
    let highest = owner.motion.z;
    for (let i = 0; i < 40; i++) { frame(world); highest = Math.max(highest, owner.motion.z); }
    assertGreaterThan(highest, 460.0);
    assertTrue(owner.special.fall);
    assertEquals(owner.jump.remaining, 0);
    assertEquals(owner.mana.points, mana);
  }
});

test("Cairne Spirit Lift's totem strikes above him at every meter level [spec #335]", () => {
  for (const facing of [1, -1]) for (const mana of [0, 100]) {
    const { owner, target, world } = pair(0.0, facing);
    owner.motion.grounded = false; owner.motion.surface = undefined; owner.motion.z = 300.0;
    target.motion.grounded = false; target.motion.surface = undefined; target.motion.z = 450.0;
    owner.mana.points = mana;
    frame(world, controls({ specialPressed: true, specialZ: 1 }));
    for (let i = 0; i < 50; i++) frame(world);
    assertEquals(target.status.damage, 9.0);
  }
});

test("Cairne Reincarnation heals only a read, caps each stock at 24 and never adds a stock [spec docs/design/cairne.md]", () => {
  const { owner, world } = pair(60.0);
  owner.status.damage = 80.0;
  const stocks = owner.status.stocks;
  for (let cast = 0; cast < 3; cast++) {
    owner.mana.points = 100;
    frame(world, controls({ specialPressed: true, specialZ: -1 }));
    for (let f = 2; f <= 60; f++) frame(world, controls(), f === 3 ? AttackStyle.jab : undefined);
    assertEquals(owner.status.damage, 80.0 - Math.min(24.0, 12.0 * (cast + 1)));
    assertEquals(owner.status.stocks, stocks);
  }
  const whiff = pair(1000.0);
  whiff.owner.status.damage = 80.0;
  frame(whiff.world, controls({ specialPressed: true, specialZ: -1 }));
  for (let i = 0; i < 50; i++) frame(whiff.world);
  assertEquals(whiff.owner.status.damage, 80.0);
  const grabbed = pair(60.0);
  frame(grabbed.world, controls({ specialPressed: true, specialZ: -1 }));
  for (let f = 2; f <= 16; f++) frame(grabbed.world, controls(), f === 4 ? AttackStyle.grab : undefined);
  assertEquals(grabbed.owner.grab.owner, 1);
});

test("Cairne Endurance Aura needs two distinct body hits, survives replay and expires after 120 frames [spec docs/design/cairne.md] [invariant]", () => {
  const { owner } = pair(1000.0);
  const effect = { damage: 5.0 };
  sourcePassiveContact(owner, 1, HitOrigin.melee, true, true, 1, effect);
  assertEquals(owner.passive.stacks, 0);
  sourcePassiveContact(owner, 1, HitOrigin.melee, true, false, 2, effect);
  sourcePassiveContact(owner, 1, HitOrigin.melee, true, false, 2, effect);
  sourcePassiveContact(owner, 2, HitOrigin.melee, true, false, 2, effect);
  assertEquals(owner.passive.stacks, 1);
  sourcePassiveContact(owner, 1, HitOrigin.melee, true, false, 3, effect);
  assertNear(enduranceGroundSpeed(owner, 10.0), 11.0, f32(0.0001));
  const restored = createFighter(Character.cairne, 0.0, 1);
  copyFighterState(restored, owner, 3);
  assertEquals(firstFighterDifference(owner, restored, 3, 3), undefined);
  for (let i = 0; i < 120; i++) advancePassive(owner);
  assertEquals(enduranceGroundSpeed(owner, 10.0), 10.0);
  resetPassive(restored);
  assertEquals(enduranceGroundSpeed(restored, 10.0), 10.0);
});

test("Cairne air specials keep finite commitment and an airborne Reincarnation press spends nothing [spec #335]", () => {
  for (const slot of [0, 1, -1]) {
    const { owner, world } = pair(1000.0);
    owner.motion.grounded = false; owner.motion.surface = undefined; owner.motion.z = 800.0;
    frame(world, controls({ specialPressed: true, specialX: slot === 1 ? 1 : 0, specialZ: slot === -1 ? -1 : 0 }));
    if (slot === -1) {
      assertEquals(owner.special.action, SpecialAction.none);
      assertEquals(owner.mana.points, 100);
    } else {
      assertEquals(owner.special.action, slot === 0 ? SpecialAction.heroNeutral : SpecialAction.heroSide);
      assertEquals(owner.mana.points, 100);
      for (let i = 0; i < 100; i++) frame(world);
      assertEquals(owner.special.action, SpecialAction.none);
    }
  }
});

test("Cairne stock loss clears earned Endurance Aura and Reincarnation healing, never reviving him [spec docs/design/cairne.md]", () => {
  const { owner, world } = pair(1000.0);
  owner.passive.stacks = 2; owner.passive.used = true; owner.passive.window = 120;
  owner.status.guardHealed = 24.0;
  const before = owner.status.stocks;
  owner.motion.x = 10000.0;
  checkBlastZone(world, 0, 0);
  assertEquals(owner.status.stocks, before - 1);
  for (let i = 0; i < 60; i++) frame(world);
  assertEquals(owner.status.stocks, before - 1);
  assertEquals(owner.passive.stacks, 0);
  assertEquals(owner.passive.used, false);
  assertEquals(owner.status.guardHealed, 0.0);
});
