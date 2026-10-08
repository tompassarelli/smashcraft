import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { copyFighterState } from "../../replay/fighterState";
import { firstFighterDifference } from "../../replay/difference";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, DownState, GrabAction, HitOrigin, SpecialAction } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { createFighter } from "../fighter";
import { advanceHeroStatus } from "../heroSpecialRules";
import { isAerialAttack } from "../moves";
import { sourcePassiveContact } from "../passives";
import { updateProjectiles } from "../projectiles";
import { type Roster, type Controls, fighterAt } from "../roster";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { advanceFighter } from "../step";
import { controls, testGrabFrame, testWorld } from "../testWorld";
import { beginAttack, beginDownState } from "../transitions";
import { THRALL_MOVES } from "./thrallMoves";

for (const style of [AttackStyle.jab, AttackStyle.jab2, AttackStyle.forwardTilt, AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown,
  AttackStyle.upTilt, AttackStyle.downTilt, AttackStyle.dashAttack, AttackStyle.forwardSmash, AttackStyle.upSmash, AttackStyle.downSmash,
  AttackStyle.neutralAir, AttackStyle.forwardAir, AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir, AttackStyle.getupAttack, AttackStyle.ledgeAttack]) {
  test(`Thrall normal ${style} hits once in both facings and misses outside its reach [spec docs/design/thrall.md]`, () => {
    const move = THRALL_MOVES.normals[style];
    assertTrue(move !== undefined);
    if (move === undefined) return;
    const region = move.regions[0];
    const strike = region?.hit.strike;
    assertTrue(region !== undefined && strike !== undefined);
    if (region === undefined || strike === undefined) return;
    for (const facing of [-1, 1]) for (const inRange of [true, false]) {
      const owner = createFighter(Character.thrall, 0.0, facing);
      owner.motion.grounded = !isAerialAttack(style);
      const target = createFighter(Character.archer, f32((inRange ? strike.x2 : 1000.0) * facing), -facing);
      target.motion.z = f32(strike.z2 - 60.0);
      const world = testWorld(owner, target);
      if (style === AttackStyle.getupAttack) beginDownState(owner, DownState.attack, 0);
      else if (style === AttackStyle.ledgeAttack) beginAttack(owner, style, false);
      else beginFighterAttack(world, 0, style, false);
      owner.attack.frame = region.firstFrame;
      resolveAttacks(world);
      const damage = target.status.damage;
      assertEquals(damage > 0.0, inRange);
      resolveAttacks(world);
      assertEquals(target.status.damage, damage);
    }
  });
}

for (const action of [GrabAction.throwForward, GrabAction.throwBack, GrabAction.throwUp, GrabAction.throwDown]) {
  test(`Thrall throw ${action} releases once in both facings [spec docs/design/thrall.md]`, () => {
    const spec = THRALL_MOVES.throws[action];
    assertTrue(spec !== undefined);
    if (spec === undefined) return;
    for (const facing of [-1, 1]) {
      const owner = createFighter(Character.thrall, 0.0, facing);
      const target = createFighter(Character.archer, f32(50.0 * facing), -facing);
      const world = testWorld(owner, target);
      beginFighterAttack(world, 0, AttackStyle.grab, false);
      owner.attack.frame = 7;
      resolveAttacks(world);
      assertEquals(owner.grab.target, 1);
      const input = controls({ grabThrowX: action === GrabAction.throwForward ? facing : action === GrabAction.throwBack ? -facing : 0, grabThrowZ: action === GrabAction.throwUp ? 1 : action === GrabAction.throwDown ? -1 : 0 });
      for (let frame = 1; frame <= spec.contactFrame; frame++) testGrabFrame(world, [input, controls()], false);
      assertEquals(target.grab.owner, undefined);
      const thrown = target.status.damage;
      assertGreaterThan(thrown, 0.0);
      assertTrue(target.launch.throwHitstun);
      testGrabFrame(world, [input, controls()], false);
      assertEquals(target.status.damage, thrown);
    }
  });
}

function frame(world: Roster, input: Readonly<Controls> = controls()): void {
  for (let slot = 0; slot < 2; slot++) advanceFighter(world, slot, 0, slot === 0 ? input : controls(), slot === 0 ? -240.0 : 240.0);
  beginDamageContacts();
  startFighterSpecial(fighterAt(world, 0), 0, 0, input);
  resolveAttacks(world);
  advanceSpecials(world, 0, 0);
  updateProjectiles(world);
  finishDamageContacts(world);
  for (let slot = 0; slot < 2; slot++) advanceHeroStatus(fighterAt(world, slot));
}
function pair(gap: number, facing = 1) {
  const owner = createFighter(Character.thrall, 0.0, facing);
  const target = createFighter(Character.archer, f32(gap * facing), -facing);
  const world = testWorld(owner, target);
  for (let i = 0; i < 3; i++) frame(world);
  return { owner, target, world };
}
const neutral = controls({ specialPressed: true });
const side = controls({ specialPressed: true, specialX: 1 });
const up = controls({ specialPressed: true, specialZ: 1 });
const down = controls({ specialPressed: true, specialZ: -1 });

for (const [name, input, action, cost, end] of [
  ["lightning", neutral, SpecialAction.heroNeutral, 10, 44], ["wolves", side, SpecialAction.heroSide, 18, 44],
  ["sight", up, SpecialAction.heroUp, 12, 40], ["earthquake", down, SpecialAction.heroDown, 20, 50],
] as const) test(`Thrall ${name} spends once and ends on its authored frame [spec docs/design/thrall.md]`, () => {
  const { world, owner } = pair(600.0);
  frame(world, input);
  assertEquals(owner.special.action, action);
  assertEquals(owner.mana.points, 100 - cost);
  for (let i = 2; i <= end; i++) frame(world);
  assertEquals(owner.special.action, SpecialAction.none);
  assertEquals(owner.mana.points, 100 - cost);
});

test("Thrall lightning and both wolves damage an opponent through ordinary projectile contacts [spec docs/design/thrall.md]", () => {
  for (const input of [neutral, side]) for (const facing of [-1, 1]) {
    const { owner, target, world } = pair(170.0, facing);
    frame(world, { ...input, specialX: input.specialX * facing });
    for (let i = 0; i < 90; i++) frame(world);
    assertGreaterThan(target.status.damage, 0.0);
    assertEquals(owner.status.damage, 0.0);
  }
});

test("Thrall Earthquake launches a grounded body but leaves a high jumper clear [spec docs/design/thrall.md]", () => {
  for (const airborne of [false, true]) {
    const { target, world } = pair(100.0);
    if (airborne) { target.motion.grounded = false; target.motion.z = 700.0; }
    frame(world, down);
    for (let i = 0; i < 35; i++) frame(world);
    assertEquals(target.status.damage, airborne ? 0.0 : 11.0);
  }
});

test("Thrall Far Sight has a free recovery, spends his jump and ends helpless [spec docs/design/thrall.md]", () => {
  for (const mana of [100, 0]) {
    const { owner, world } = pair(600.0);
    owner.mana.points = mana;
    owner.motion.grounded = false;
    owner.motion.z = 500.0;
    const start = owner.motion.z;
    frame(world, up);
    let top = start;
    for (let i = 0; i < 40; i++) { frame(world); top = Math.max(top, owner.motion.z); }
    assertGreaterThan(top - start, mana === 0 ? 150.0 : 220.0);
    assertEquals(owner.jump.remaining, 0);
    assertTrue(owner.special.fall);
  }
});

test("Thrall Windfury counts two hammer hits, spends on shield and survives snapshot replay [spec docs/design/thrall.md] [invariant]", () => {
  const owner = createFighter(Character.thrall, 0.0, 1);
  for (let key = 1; key <= 2; key++) sourcePassiveContact(owner, 1, HitOrigin.melee, true, false, key, { damage: 10.0 });
  const saved = createFighter(Character.thrall, 0.0, 1);
  copyFighterState(saved, owner, 3);
  const effect = { damage: 10.0 };
  sourcePassiveContact(owner, 1, HitOrigin.melee, true, false, 3, effect);
  assertEquals(effect.damage, 15.0);
  copyFighterState(owner, saved, 3);
  assertEquals(firstFighterDifference(owner, saved, 3, 3), undefined);
  const blocked = { damage: 10.0 };
  sourcePassiveContact(owner, 1, HitOrigin.melee, true, true, 3, blocked);
  assertEquals(blocked.damage, 10.0);
  assertEquals(owner.passive.stacks, 0);
});
