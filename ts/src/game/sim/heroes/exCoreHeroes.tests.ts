import { assertEquals, assertGreaterThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, SpecialAction } from "../codes";
import { createFighter, type Fighter } from "../fighter";
import { SpecialForm, SpecialSlot } from "../heroSpecials";
import { advanceHeroSpecial, enterHeroSpecial, runningHeroSpecial } from "../heroSpecialRules";
import { updateProjectiles } from "../projectiles";
import { createRoster } from "../roster";
import { startFighterSpecial } from "../specials";
import { controls } from "../testWorld";

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

test("Wind Cutter, Storm Bolt, Shadow Strike and Death and Decay actually deal 25% more projectile damage [k3 measure #329]", () => {
  for (const [hero, slot] of [[Character.blademaster, SpecialSlot.neutral], [Character.mountainKing, SpecialSlot.neutral], [Character.warden, SpecialSlot.neutral], [Character.lich, SpecialSlot.side]] as const) {
    assertNear(projectileDamage(hero, slot, true), f32(projectileDamage(hero, slot, false) * 1.25), f32(0.001));
  }
});

test("all four EX recoveries execute 25% farther including steering and airborne forms [k3 measure #329]", () => {
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

