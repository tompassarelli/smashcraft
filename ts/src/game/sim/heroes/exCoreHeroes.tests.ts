import { assertEquals, assertGreaterThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, ProjectileKind, SpecialAction } from "../codes";
import { createFighter, type Fighter } from "../fighter";
import { FOLLOW_UP_FORM, SpecialForm, SpecialSlot } from "../heroSpecials";
import { advanceHeroSpecial, enterHeroSpecial, heroSpecialContact, runningHeroSpecial } from "../heroSpecialRules";
import { updateProjectiles } from "../projectiles";
import { createRoster } from "../roster";
import { startFighterSpecial } from "../specials";
import { controls } from "../testWorld";
import { WARDEN_SPECIALS } from "./wardenSpecials";

const heroes = [Character.blademaster, Character.mountainKing, Character.warden, Character.lich];

function cast(character: Character, slot: SpecialSlot, form: SpecialForm, ex: boolean): Fighter {
  const fighter = createFighter(character, 0.0, 1);
  fighter.motion.grounded = true;
  fighter.mana.points = 100;
  const input = controls({ specialPressed: true, shield: ex, specialX: slot === SpecialSlot.side ? 1 : 0,
    specialZ: slot === SpecialSlot.up ? 1 : slot === SpecialSlot.down ? -1 : 0 });
  assertTrue(startFighterSpecial(fighter, 0, 0, input));
  assertEquals(fighter.special.action, SpecialAction.heroNeutral + slot);
  assertEquals(fighter.special.ex, ex);
  if (fighter.special.form !== form) enterHeroSpecial(fighter, { slot, form }, input);
  return fighter;
}

function advance(fighter: Fighter, frame: number): void {
  fighter.special.frame = frame;
  advanceHeroSpecial(fighter, 0, controls({ direction: 1 }));
}

function projectileDamage(character: Character, slot: SpecialSlot, ex: boolean): number {
  const owner = cast(character, slot, SpecialForm.ground, ex);
  const target = createFighter(Character.rifleman, 250.0, -1);
  const world = createRoster(3, [owner, target]);
  for (let frame = 1; frame <= 60 && target.status.damage === 0.0; frame++) {
    advance(owner, frame);
    updateProjectiles(world);
  }
  assertGreaterThan(target.status.damage, 0.0);
  return target.status.damage;
}

test("Wind Cutter, Storm Bolt, Shadow Strike and Death and Decay actually deal 25% more projectile damage [spec #329]", () => {
  for (const [hero, slot] of [[Character.blademaster, SpecialSlot.neutral], [Character.mountainKing, SpecialSlot.neutral], [Character.warden, SpecialSlot.neutral], [Character.lich, SpecialSlot.side]] as const) {
    assertNear(projectileDamage(hero, slot, true), f32(projectileDamage(hero, slot, false) * 1.25), f32(0.001));
  }
});

test("EX Backstab, Image Swap, Storm Rush, Hammerfall and marked or air Pursuit keep their damage upgrade at contact [spec #329]", () => {
  for (const [hero, slot, form, frame] of [
    [Character.blademaster, SpecialSlot.side, FOLLOW_UP_FORM, 6],
    [Character.blademaster, SpecialSlot.down, SpecialForm.recall, 8],
    [Character.mountainKing, SpecialSlot.side, SpecialForm.ground, 13],
    [Character.mountainKing, SpecialSlot.side, SpecialForm.air, 13],
    [Character.mountainKing, SpecialSlot.up, FOLLOW_UP_FORM, 4],
    [Character.warden, SpecialSlot.side, SpecialForm.ground, 11],
    [Character.warden, SpecialSlot.side, SpecialForm.air, 11],
    [Character.warden, SpecialSlot.side, SpecialForm.marked, 18],
  ] as const) {
    const target = createFighter(Character.rifleman, 20.0, -1);
    const contact = (ex: boolean) => {
      const fighter = cast(hero, slot, SpecialForm.ground, ex);
      fighter.special.form = form;
      fighter.special.frame = frame;
      return heroSpecialContact(fighter, target, false);
    };
    const base = contact(false);
    const ex = contact(true);
    assertGreaterThan(base.effect.damage, 0.0);
    assertNear(ex.effect.damage, f32(base.effect.damage * 1.25), f32(0.001));
    if (base.groundedEffect !== undefined) assertNear(ex.groundedEffect?.damage ?? 0.0, f32(base.groundedEffect.damage * 1.25), f32(0.001));
    assertEquals(ex.effect.base, base.effect.base);
    assertEquals(ex.effect.growth, base.effect.growth);
  }
});

test("all four EX recoveries execute 25% farther including steering and airborne forms [spec #329]", () => {
  for (const hero of heroes) for (const form of [SpecialForm.ground, SpecialForm.air]) {
    const travel = (ex: boolean) => {
      const fighter = cast(hero, SpecialSlot.up, form, ex);
      fighter.motion.z = 300.0;
      fighter.motion.grounded = false;
      fighter.motion.surface = undefined;
      let x = 0.0;
      let z = 0.0;
      const duration = runningHeroSpecial(fighter)?.endFrame ?? 0;
      for (let frame = 1; frame <= duration; frame++) {
        advance(fighter, frame);
        x = f32(x + fighter.motion.vx);
        z = f32(z + fighter.motion.vz);
      }
      assertTrue(fighter.special.fall);
      return { x, z };
    };
    const base = travel(false);
    const ex = travel(true);
    assertGreaterThan(base.z, 0.0);
    assertNear(ex.z, f32(base.z * 1.25), f32(0.02));
    assertNear(ex.x, f32(base.x * 1.25), f32(0.02));
  }
});

test("EX Mirror Image is placed with twice the durability in ground and air casts [spec #329]", () => {
  for (const form of [SpecialForm.ground, SpecialForm.air]) {
    const base = cast(Character.blademaster, SpecialSlot.down, form, false);
    const ex = cast(Character.blademaster, SpecialSlot.down, form, true);
    advance(base, 8);
    advance(ex, 8);
    assertGreaterThan(base.placed.life, 0);
    assertEquals(ex.placed.durability, f32(base.placed.durability * 2.0));
    assertEquals(ex.placed.life, base.placed.life);
  }
});

test("EX Thunder Clap and both charged branches contact beyond ordinary reach without extra damage [spec #329]", () => {
  for (const [form, frame] of [[SpecialForm.ground, 53], [FOLLOW_UP_FORM, 4], [FOLLOW_UP_FORM * 2, 4], [SpecialForm.air, 18]] as const) {
    const base = cast(Character.mountainKing, SpecialSlot.down, SpecialForm.ground, false);
    const ex = cast(Character.mountainKing, SpecialSlot.down, SpecialForm.ground, true);
    base.special.form = form;
    ex.special.form = form;
    base.special.frame = frame;
    ex.special.frame = frame;
    const baseRegions = runningHeroSpecial(base)?.regions;
    const reach = baseRegions?.[0]?.hit.maxX ?? 0.0;
    const target = createFighter(Character.rifleman, f32(f32(reach * f32(1.12)) + 24.0), -1);
    assertEquals(heroSpecialContact(base, target, false).effect.damage, 0.0);
    assertGreaterThan(heroSpecialContact(ex, target, false).effect.damage, 0.0);
  }
});

test("EX Fan of Knives expands sideways and upward around its chest center in ground and air casts [spec #329]", () => {
  for (const form of [SpecialForm.ground, SpecialForm.air]) for (const vertical of [false, true]) {
    const base = cast(Character.warden, SpecialSlot.down, form, false);
    const ex = cast(Character.warden, SpecialSlot.down, form, true);
    base.special.frame = 9;
    ex.special.frame = 9;
    const target = createFighter(Character.rifleman, vertical ? 0.0 : 220.0, -1);
    if (vertical) { target.motion.z = 245.0; target.motion.grounded = false; target.motion.surface = undefined; }
    assertEquals(heroSpecialContact(base, target, false).effect.damage, 0.0);
    assertEquals(heroSpecialContact(ex, target, false).effect.damage, WARDEN_SPECIALS.down.ground.regions?.[0]?.hit.effect.damage);
  }
});

test("EX Frost Armor arms its heavier hit threshold and Dark Ritual protects four entry frames [spec #329]", () => {
  const base = cast(Character.lich, SpecialSlot.down, SpecialForm.ground, false);
  const ex = cast(Character.lich, SpecialSlot.down, SpecialForm.ground, true);
  advance(base, 21);
  advance(ex, 21);
  assertEquals(ex.status.armorMaxDamage, f32(base.status.armorMaxDamage * 1.25));
  const ritual = cast(Character.lich, SpecialSlot.down, SpecialForm.recall, true);
  for (let frame = 0; frame <= 3; frame++) {
    if (frame > 0) advance(ritual, frame);
    assertGreaterThan(ritual.status.invincible, 0);
    ritual.status.invincible = 0;
  }
  advance(ritual, 5);
  assertEquals(ritual.status.invincible, 0);
});

test("Frost Nova ordinary recall preserves an EX orb and EX recall upgrades an ordinary orb [spec #329]", () => {
  for (const [orbEx, recallEx] of [[true, false], [false, true], [false, false]] as const) {
    const lich = cast(Character.lich, SpecialSlot.neutral, SpecialForm.ground, orbEx);
    advance(lich, 18);
    const orb = lich.projectiles.find(projectile => projectile.kind === ProjectileKind.hero && projectile.life > 0);
    assertTrue(orb !== undefined);
    advance(lich, 39);
    lich.special.lockFrames = 0;
    lich.attack.cooldown = 0;
    lich.mana.points = 100;
    assertTrue(startFighterSpecial(lich, 0, 0, controls({ specialPressed: true, shield: recallEx })));
    assertEquals(lich.special.form, SpecialForm.recall);
    advance(lich, 4);
    assertEquals(orb?.velocityX, 0.0);
    const baseBurst = lich.tuning.specials?.neutral.recall?.burst?.into;
    assertEquals(orb?.life, baseBurst?.life);
    assertNear(orb?.spec?.radius ?? 0.0, f32((baseBurst?.radius ?? 0.0) * (orbEx || recallEx ? 1.25 : 1.0)), f32(0.001));
    assertEquals(orb?.spec?.effect.damage, baseBurst?.effect.damage);
  }
});
