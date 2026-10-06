// Pit Lord's four specials through the production special, projectile,
// contact, status and resource path, against smashcraft:docs/design/roster.md.
import { assertEquals, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, HeroStatusKind, ProjectileKind, SpecialAction } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { type Fighter, createFighter } from "../fighter";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { advanceHeroStatus } from "../heroSpecialRules";
import { regenerateMana } from "../mana";
import { updateProjectiles } from "../projectiles";
import { type Controls, type Roster, createRoster } from "../roster";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { advanceFighter } from "../step";
import { controls } from "../testWorld";
import { copyFighterState } from "../../replay/fighterState";
import { firstFighterDifference } from "../../replay/difference";
import { PIT_LORD_HERO } from "./pitLordHero";

const H = HERO_REFERENCE_HEIGHT;
const neutral = controls({ specialPressed: true });
const side = controls({ specialPressed: true, specialX: 1 });
const up = controls({ specialPressed: true, specialZ: 1 });
const down = controls({ specialPressed: true, specialZ: -1 });

function pitLord(x: number, facing: number): Fighter {
  const f = createFighter(Character.pitLord, x, facing);
  f.mana.points = 100;
  return f;
}

/** One match-ordered frame: motion, special starts, contacts, specials, projectiles, resources. */
function frame(world: Roster, first: Readonly<Controls> = controls(), second: Readonly<Controls> = controls()): void {
  const inputs = [first, second];
  for (let slot = 0; slot < 2; slot++) advanceFighter(world, slot, 0, inputs[slot] ?? controls(), slot === 0 ? -240.0 : 240.0);
  beginDamageContacts();
  for (let slot = 0; slot < 2; slot++) startFighterSpecial(world.fighters[slot]!, 0, 0, inputs[slot] ?? controls());
  resolveAttacks(world);
  advanceSpecials(world, 0, 0);
  updateProjectiles(world);
  finishDamageContacts(world);
  for (let slot = 0; slot < 2; slot++) {
    regenerateMana(world.fighters[slot]!);
    advanceHeroStatus(world.fighters[slot]!);
  }
}

function pair(gap: number, facing = 1, opponent: Character = Character.archer): { world: Roster; owner: Fighter; target: Fighter } {
  const owner = pitLord(f32(-gap * 0.5 * facing), facing);
  const target = createFighter(opponent, f32(gap * 0.5 * facing), -facing);
  const world = createRoster(3, [owner, target]);
  for (let i = 0; i < 3; i++) frame(world);
  return { world, owner, target };
}

function actionLength(world: Roster, owner: Fighter, press: Readonly<Controls>): number {
  frame(world, press);
  let length = 1;
  while (owner.special.action !== SpecialAction.none && length < 200) {
    frame(world);
    length++;
  }
  return length;
}

test("Pit Lord's specials spend their roster costs once and end on their roster frames", () => {
  assertTrue(PIT_LORD_HERO.specials !== undefined);
  for (const [press, cost, end] of [[neutral, 5, 57], [side, 22, 64], [down, 20, 60]] as const) {
    const { world, owner } = pair(1000.0);
    assertEquals(actionLength(world, owner, press), end);
    assertEquals(owner.mana.points, 100 - cost);
  }
  const { world, owner } = pair(1000.0);
  frame(world, up);
  assertEquals(owner.special.action, SpecialAction.heroUp);
  assertEquals(owner.mana.points, 85);
});

test("Fel Spit arcs: it leaves rising at 0.04H, falls 0.003H faster each frame, one at a time, and hits for 8", () => {
  for (const facing of [1, -1]) {
    const { world, owner, target } = pair(f32(H * f32(2.6)), facing);
    frame(world, neutral);
    for (let f = 2; f <= 25; f++) frame(world);
    const spit = owner.projectiles.find(p => p.life > 0 && p.kind === ProjectileKind.hero);
    assertTrue(spit !== undefined);
    if (spit === undefined) return;
    const vz = spit.velocityZ;
    frame(world);
    assertNear(f32(vz - spit.velocityZ), f32(H * f32(0.003)), f32(0.0001));
    assertNear(f32(spit.velocityX * facing), f32(H * f32(0.10)), f32(0.001));
    let fell = false;
    for (let f = 0; f < 40 && target.status.damage === 0.0; f++) {
      frame(world);
      if (spit.velocityZ < 0.0) fell = true;
    }
    assertTrue(fell);
    assertEquals(target.status.damage, 8.0);
    assertGreaterThan(target.launch.knockbackX * facing, 0.0);
  }
  // A second press while the first is in flight starts nothing and spends nothing.
  const { world, owner } = pair(1000.0);
  for (let f = 1; f <= 57; f++) frame(world, f === 1 ? neutral : controls());
  const before = owner.mana.points;
  assertTrue(owner.projectiles.some(p => p.life > 0));
  frame(world, neutral);
  assertEquals(owner.special.action, SpecialAction.none);
  assertEquals(owner.mana.points, before);
});

test("Ruin Charge travels 1.5H, armors one small hit on f19-24 only, and the air form goes 0.8H then helpless", () => {
  const { world, owner } = pair(1000.0);
  const start = owner.motion.x;
  for (let f = 1; f <= 64; f++) {
    frame(world, f === 1 ? side : controls());
    // Protection set at the end of a frame covers the next one, which resolves first.
    assertEquals(owner.status.armorFrames > 0, f >= 18 && f <= 23);
  }
  assertNear(f32(owner.motion.x - start), f32(H * f32(1.5)), 1.0);

  const air = pair(1000.0);
  air.owner.motion.grounded = false;
  air.owner.motion.z = 900.0;
  air.owner.motion.surface = undefined;
  const airStart = air.owner.motion.x;
  let helpless = false;
  for (let f = 1; f <= 70 && !air.owner.motion.grounded; f++) {
    frame(air.world, f === 1 ? side : controls());
    if (f >= 19 && f <= 24) assertEquals(air.owner.status.armorFrames, 0);
    if (air.owner.special.fall) helpless = true;
  }
  assertLessThan(f32(air.owner.motion.x - airStart), f32(H * f32(1.0)));
  assertTrue(helpless);
});

test("an Archer jab that meets Ruin Charge's armor deals its damage without a reaction, and the charge still lands", () => {
  // The Archer jabs on each frame the charge could meet it; some start trades into the armor.
  let trades = 0;
  for (let start = 15; start <= 24; start++) {
    const { world, owner, target } = pair(f32(H * f32(1.47)));
    let reacted = false;
    for (let f = 1; f <= 64; f++) {
      frame(world, f === 1 ? side : controls());
      if (f === start) beginFighterAttack(world, 1, AttackStyle.jab, false);
      if (owner.launch.hitstun > 0) reacted = true;
    }
    if (owner.status.damage > 0.0 && target.status.damage === 15.0) {
      assertTrue(!reacted);
      trades++;
    }
  }
  assertGreaterThan(trades, 0);
});

test("Abyssal Leap peaks near 1.7H; on less than 15 mana the free leap peaks near 1.2H with no hit", () => {
  for (const [mana, rise] of [[100, f32(1.7)], [10, f32(1.2)]] as const) {
    const { world, owner } = pair(1000.0);
    owner.mana.points = mana;
    const ground = owner.motion.z;
    let peak = ground;
    frame(world, up);
    // The full leap spends 15 on entry; the free one spends nothing.
    assertEquals(owner.mana.points, mana === 100 ? 85 : 10);
    for (let f = 2; f <= 60; f++) {
      frame(world);
      peak = Math.max(peak, owner.motion.z);
    }
    assertNear(f32(peak - ground), f32(H * f32(rise)), f32(H * f32(0.1)));
  }
});

test("Howl of Terror makes a struck opponent deal 10 percent less for 180 frames; a shield stops it", () => {
  for (const behind of [false, true]) {
    const { world, owner, target } = pair(f32(H * f32(0.8)), behind ? -1 : 1);
    owner.facing = 1;
    for (let f = 1; f <= 26; f++) frame(world, f === 1 ? down : controls());
    assertEquals(target.status.damage, 5.0);
    assertEquals(target.status.condition, HeroStatusKind.terror);
    // The roar pushes away on both sides.
    assertGreaterThan(f32(f32(target.motion.x - owner.motion.x) * target.launch.knockbackX), 0.0);
    // The terrified Archer's jab deals 90 percent of its damage.
    for (let f = 0; f < 60; f++) frame(world);
    const before = owner.status.damage;
    target.motion.x = f32(owner.motion.x + f32(40.0 * (behind ? -1 : 1)));
    target.facing = behind ? 1 : -1;
    beginFighterAttack(world, 1, AttackStyle.jab, false);
    let dealt = 0.0;
    for (let f = 0; f < 20 && dealt === 0.0; f++) {
      frame(world);
      dealt = f32(owner.status.damage - before);
    }
    assertGreaterThan(dealt, 0.0);
    const control = pair(f32(H * f32(0.8)));
    control.target.motion.x = f32(control.owner.motion.x + 40.0);
    beginFighterAttack(control.world, 1, AttackStyle.jab, false);
    let full = 0.0;
    for (let f = 0; f < 20 && full === 0.0; f++) {
      frame(control.world);
      full = control.owner.status.damage;
    }
    assertNear(dealt, f32(full * f32(0.9)), f32(0.01));
    for (let f = 0; f < 120; f++) frame(world);
    assertEquals(target.status.condition, HeroStatusKind.none);
  }
  const shielded = pair(f32(H * f32(0.8)));
  shielded.target.shield.raised = true;
  for (let f = 1; f <= 26; f++) frame(shielded.world, f === 1 ? down : controls(), controls({ shield: true }));
  assertEquals(shielded.target.status.condition, HeroStatusKind.none);
});

test("rollback restores Pit Lord mid-arc, mid-charge and an opponent's Terror", () => {
  const { world, owner, target } = pair(f32(H * f32(0.8)));
  for (let f = 1; f <= 30; f++) frame(world, f === 1 ? down : controls());
  assertEquals(target.status.condition, HeroStatusKind.terror);
  frame(world, neutral);
  for (let f = 0; f < 26; f++) frame(world);
  const savedOwner = createFighter(Character.pitLord, 0.0, 1);
  const savedTarget = createFighter(Character.archer, 0.0, 1);
  copyFighterState(savedOwner, owner, 3);
  copyFighterState(savedTarget, target, 3);
  for (let f = 0; f < 12; f++) frame(world);
  const expectedOwner = createFighter(Character.pitLord, 0.0, 1);
  const expectedTarget = createFighter(Character.archer, 0.0, 1);
  copyFighterState(expectedOwner, owner, 3);
  copyFighterState(expectedTarget, target, 3);
  copyFighterState(owner, savedOwner, 3);
  copyFighterState(target, savedTarget, 3);
  for (let f = 0; f < 12; f++) frame(world);
  assertEquals(firstFighterDifference(expectedOwner, owner, 3, 3), undefined);
  assertEquals(firstFighterDifference(expectedTarget, target, 3, 3), undefined);
});
