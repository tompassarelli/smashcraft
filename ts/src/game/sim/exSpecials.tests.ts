import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character, ContactKind, SpecialAction } from "./codes";
import { createFighter } from "./fighter";
import { HERO_ROSTER } from "./heroes/registry";
import { EX_ARMOR_FRAMES, exArmorActive, exSpecialAffordable } from "./exSpecials";
import { startFighterSpecial } from "./specials";
import { advanceFighterMotion } from "./step";
import { collectDamageContact } from "./contacts";
import { contactBatch, controls, hitEffect, testWorld } from "./testWorld";
import { copyFighterState } from "../replay/fighterState";
import { firstFighterDifference } from "../replay/difference";
import { grantParry } from "./shield";
import { dealtManaGain } from "./mana";
import { resetSpecialOnStock } from "./heroSpecialRules";
import { clearSpecialOnStock } from "./transitions";

const roster: readonly Character[] = [Character.rifleman, Character.demonHunter, ...HERO_ROSTER.map(hero => hero.character)];

function special(character: Character, side: boolean, mana: number, ex: boolean) {
  const f = createFighter(character, 0.0, 1);
  const world = testWorld(f, createFighter(Character.rifleman, 900.0, -1));
  f.motion.grounded = true;
  f.mana.points = mana;
  const input = controls({ specialPressed: true, specialX: side ? 1 : 0, shield: ex, shieldPressed: ex, airDodgePressed: ex, groundDodgePressed: ex });
  advanceFighterMotion(world, 0, 0, 0, input, 0.0);
  const started = startFighterSpecial(f, 0, 0, input, world);
  return { f, world, started };
}

test("every fighter's neutral and side EX spend one 33-point segment, arm one light hit, and keep ordinary duration [spec #335]", () => {
  for (const character of roster) for (const side of [false, true]) {
    const normal = special(character, side, 100, false);
    const ex = special(character, side, 100, true);
    assertTrue(normal.started);
    assertTrue(ex.started);
    assertEquals(ex.f.special.action, normal.f.special.action);
    assertEquals(ex.f.special.duration, normal.f.special.duration);
    assertEquals(ex.f.mana.points, 67);
    assertTrue(ex.f.special.ex);
    assertTrue(exArmorActive(ex.f));
    assertFalse(ex.f.shield.raised);
    assertFalse(ex.f.dodge.airDodging);
    assertEquals(ex.f.dodge.groundFrame, 0);
    ex.f.special.frame = EX_ARMOR_FRAMES + 1;
    assertFalse(exArmorActive(ex.f));
  }
});

test("every fighter's unaffordable EX falls back to a free ordinary special [spec #335]", () => {
  for (const character of roster) for (const side of [false, true]) {
    const price = 32;
    const attempt = special(character, side, price, true);
    assertTrue(attempt.started);
    assertFalse(attempt.f.special.ex);
    assertEquals(attempt.f.mana.points, 32);
    assertEquals(attempt.f.visuals.manaDenied, 0);
  }
});

test("EX takes one light hit's damage and freeze without interruption; a second, heavy, late hit or throw interrupts [spec #335]", () => {
  for (const kind of ["second", "heavy", "late", "throw"] as const) {
    const { f, world } = special(Character.rifleman, false, 100, true);
    const hit = (damage: number, contact: ContactKind = ContactKind.launch) => contactBatch(world, () => collectDamageContact(world, 1, 0, hitEffect(damage, 90.0, 20.0, 1.0, 0.0), 1, contact, true, undefined, false));
    if (kind === "second") {
      hit(5.0);
      assertEquals(f.status.damage, 5.0);
      assertTrue(f.launch.hitlag > 0);
      assertEquals(f.launch.hitstun, 0);
      assertTrue(f.special.action !== SpecialAction.none);
      assertTrue(f.special.exArmorUsed);
      hit(5.0);
    } else if (kind === "heavy") hit(9.0);
    else if (kind === "late") { f.special.frame = 7; hit(5.0); }
    else hit(5.0, ContactKind.throw);
    assertEquals(f.special.action, SpecialAction.none);
    assertTrue(f.launch.hitstun > 0);
  }
});

test("parrying earns no meter without body damage [spec #335]", () => {
  for (const character of roster) {
    const f = createFighter(character, 0.0, 1);
    const target = createFighter(Character.rifleman, 30.0, -1);
    const world = testWorld(f, target);
    f.mana.points = 50;
    target.mana.points = 50;
    f.attack.style = AttackStyle.jab;
    contactBatch(world, () => collectDamageContact(world, 0, 1, hitEffect(10.0, 0.0, 0.0, 1.0, 0.0), 1, ContactKind.launch, true, undefined, false));
    const earned = 50 + dealtManaGain(target.status.damage);
    f.shield.perfectFrames = 1;
    grantParry(f);
    assertEquals(f.mana.points, earned);
    grantParry(f);
    assertEquals(f.mana.points, earned);
    f.mana.points = 99;
    f.shield.reflectFrames = 1;
    grantParry(f);
    assertEquals(f.mana.points, 99);
  }
});

test("EX state and spent armor restore exactly, reset on a stock while spent meter carries and up/down can use EX [invariant] [spec #335]", () => {
  for (const character of roster) {
    const { f } = special(character, false, 100, true);
    f.special.exArmorUsed = true;
    const copy = createFighter(character, 0.0, 1);
    copyFighterState(copy, f, 3);
    assertEquals(firstFighterDifference(copy, f, 3, 3), undefined);
    assertTrue(copy.special.ex);
    assertTrue(copy.special.exArmorUsed);
    clearSpecialOnStock(copy);
    resetSpecialOnStock(copy);
    assertFalse(copy.special.ex);
    assertEquals(copy.mana.points, 67);
    for (const direction of [-1, 1]) {
      const upDown = createFighter(character, 0.0, 1);
      upDown.motion.grounded = true;
      upDown.motion.surface = 0;
      upDown.mana.points = 100;
      testWorld(upDown, createFighter(Character.rifleman, 900.0, -1));
      startFighterSpecial(upDown, 0, 0, controls({ specialPressed: true, specialZ: direction, shield: true }));
      assertTrue(upDown.special.ex);
      assertEquals(upDown.mana.points, 67);
    }
  }
});

test("one 33-point segment buys EX [spec #382]", () => {
  const f = createFighter(Character.rifleman, 0.0, 1);
  for (const points of [0, 28, 32, 33, 99, 100]) {
    f.mana.points = points;
    assertEquals(exSpecialAffordable(f), points >= 33);
  }
});
