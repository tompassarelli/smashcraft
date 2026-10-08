import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { copyFighterState } from "../../replay/fighterState";
import { firstFighterDifference } from "../../replay/difference";
import { resolveAttacks } from "../attacks";
import { Character, HeroStatusKind, SpecialAction } from "../codes";
import { chillScaled } from "../chill";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { createFighter } from "../fighter";
import { advanceHeroStatus } from "../heroSpecialRules";
import { updateProjectiles } from "../projectiles";
import { type Controls, type Roster, createRoster } from "../roster";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { advanceFighter } from "../step";
import { controls } from "../testWorld";
import { FOLLOW_UP_FORM } from "../heroSpecials";

function frame(world: Roster, input: Readonly<Controls> = controls(), defender: Readonly<Controls> = controls()): void {
  const inputs = [input, defender];
  for (let slot = 0; slot < 2; slot++) advanceFighter(world, slot, 0, inputs[slot] ?? controls(), slot === 0 ? -240.0 : 240.0);
  beginDamageContacts();
  for (let slot = 0; slot < 2; slot++) startFighterSpecial(world.fighters[slot]!, 0, 0, inputs[slot] ?? controls());
  resolveAttacks(world); advanceSpecials(world, 0, 0); updateProjectiles(world, 0, 0); finishDamageContacts(world);
  for (let slot = 0; slot < 2; slot++) advanceHeroStatus(world.fighters[slot]!);
}
function pair(gap: number, facing = 1) {
  const owner = createFighter(Character.chen, 0.0, facing);
  owner.mana.points = 100;
  const target = createFighter(Character.rifleman, gap * facing, -facing);
  const world = createRoster(3, [owner, target]);
  for (let i = 0; i < 3; i++) frame(world);
  return { world, owner, target };
}
const neutral = controls({ specialPressed: true });
const side = controls({ specialPressed: true, specialX: 1 });
const up = controls({ specialPressed: true, specialZ: 1 });
const down = controls({ specialPressed: true, specialZ: -1 });

test("Chen preserves the super meter on each regular special, recovers on its last frame and snapshots every running action [spec #335][invariant]", () => {
  for (const [input, action, end] of [[neutral, SpecialAction.heroNeutral, 42], [side, SpecialAction.heroSide, 38], [up, SpecialAction.heroUp, 40], [down, SpecialAction.heroDown, 33]] as const) {
    const { world, owner } = pair(600.0);
    frame(world, input);
    assertEquals(owner.special.action, action); assertEquals(owner.mana.points, 100);
    const restored = createFighter(Character.chen, 0.0, 1);
    copyFighterState(restored, owner, 3); assertEquals(firstFighterDifference(restored, owner, 3, 3), undefined);
    for (let tick = 2; tick <= end; tick++) frame(world);
    assertEquals(owner.special.action, SpecialAction.none); assertEquals(owner.mana.points, 100);
  }
});

test("Breath of Fire hits once facing either way and a shield stops body damage [spec docs/design/chen.md]", () => {
  for (const facing of [-1, 1]) for (const shielding of [false, true]) {
    const { world, owner, target } = pair(110.0, facing);
    for (let tick = 1; tick <= 65; tick++) frame(world, tick === 1 ? neutral : controls(), controls({ shield: shielding, shieldStrength: 1.0 }));
    assertEquals(target.status.damage, shielding ? 0.0 : 12.5);
    assertEquals(owner.special.action, SpecialAction.none);
  }
});

test("Drunken Haze reaches a distant body, slows its movement and respects shield [spec docs/design/chen.md]", () => {
  for (const shielding of [false, true]) {
    const { world, target } = pair(240.0);
    for (let tick = 1; tick <= 42; tick++) frame(world, tick === 1 ? side : controls(), controls({ shield: shielding, shieldStrength: 1.0 }));
    assertEquals(target.status.damage, shielding ? 0.0 : 3.75);
    assertEquals(target.status.condition, shielding ? HeroStatusKind.none : HeroStatusKind.chill);
    assertEquals(chillScaled(target, 10.0), shielding ? 10.0 : 6.0);
  }
});

test("Storm Rise travels higher with mana, spends the jump and ends helpless in both forms [spec docs/design/chen.md]", () => {
  let paidHeight = 0.0;
  for (const mana of [100, 0]) {
    const { world, owner } = pair(600.0);
    owner.motion.grounded = false; owner.motion.surface = undefined; owner.motion.z = 500.0; owner.mana.points = mana;
    frame(world, up);
    for (let tick = 2; tick <= 30; tick++) frame(world);
    assertGreaterThan(owner.motion.z, 650.0);
    if (mana > 0) paidHeight = owner.motion.z; else assertEquals(owner.motion.z, paidHeight);
    for (let tick = 31; tick <= 40; tick++) frame(world);
    assertTrue(owner.special.fall); assertEquals(owner.jump.remaining, 0);
  }
});

test("Earth braces and fresh attack or special chooses the Fire or Storm branch [spec docs/design/chen.md]", () => {
  for (const attack of [true, false]) {
    const { world, owner, target } = pair(80.0);
    frame(world, down);
    for (let tick = 2; tick <= 9; tick++) frame(world);
    assertGreaterThan(owner.status.armorFrames, 0);
    frame(world, controls({ attackPressed: attack, specialPressed: !attack }));
    assertEquals(owner.special.form, FOLLOW_UP_FORM * (attack ? 1 : 2));
    for (let tick = 0; tick < 55; tick++) frame(world);
    assertEquals(target.status.damage, attack ? 13.75 : 8.75);
    assertEquals(owner.mana.points, 100);
  }
});

