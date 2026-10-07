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

test("Pit Lord's specials spend their design costs once and end on their design frames", () => {
  assertTrue(PIT_LORD_HERO.specials !== undefined);
  for (const [press, cost, end] of [[neutral, 12, 46], [side, 22, 64], [down, 20, 60]] as const) {
    const { world, owner } = pair(1000.0);
    assertEquals(actionLength(world, owner, press), end);
    assertEquals(owner.mana.points, 100 - cost);
  }
  const { world, owner } = pair(1000.0);
  frame(world, up);
  assertEquals(owner.special.action, SpecialAction.heroUp);
  assertEquals(owner.mana.points, 85);
});

test("Rain of Fire falls through the chosen lane in both facings and each meteor hits once", () => {
  for (const facing of [1, -1]) {
    const { world, owner, target } = pair(f32(H * f32(1.8)), facing);
    frame(world, down);
    for (let f = 2; f <= 25; f++) frame(world);
    const meteor = owner.projectiles.find(p => p.life > 0 && p.kind === ProjectileKind.hero);
    assertTrue(meteor !== undefined);
    if (meteor === undefined) return;
    assertEquals(target.status.damage, 0.0);
    assertGreaterThan(meteor.z, target.motion.z + H);
    assertEquals(meteor.velocityX, 0.0);
    assertLessThan(meteor.velocityZ, 0.0);
    for (let f = 0; f < 24 && target.status.damage === 0.0; f++) frame(world);
    assertEquals(target.status.damage, 5.0);
    assertEquals(meteor.life, 0);
    assertGreaterThan(target.launch.knockbackX * facing, 0.0);
  }
});

test("Rain of Fire releases three separate waves and leaves the space under the caster safe", () => {
  const { world, owner, target } = pair(0.0);
  const seen: number[] = [];
  for (let f = 1; f <= 60; f++) {
    frame(world, f === 1 ? down : controls());
    for (const p of owner.projectiles) if (p.life === 23) seen.push(f);
  }
  assertEquals(seen.join(","), "25,31,37");
  assertEquals(target.status.damage, 0.0);
});

test("Rain of Fire is shieldable and interrupting the caster cancels the remaining waves", () => {
  const { world, owner, target } = pair(f32(H * f32(1.8)));
  for (let f = 1; f <= 60; f++) frame(world, f === 1 ? down : controls(), controls({ shield: true, diStickValid: true, diStickZ: 1.0 }));
  assertEquals(target.status.damage, 0.0);
  assertLessThan(target.shield.energy, 60.0);
  const interrupted = pair(1000.0);
  for (let f = 1; f <= 25; f++) frame(interrupted.world, f === 1 ? down : controls());
  interrupted.owner.special.action = SpecialAction.none;
  interrupted.owner.special.frame = 0;
  let laterWaves = 0;
  for (let f = 26; f <= 60; f++) {
    frame(interrupted.world);
    for (const p of interrupted.owner.projectiles) if (p.life === 23) laterWaves++;
  }
  assertEquals(laterWaves, 0);
  assertEquals(owner.mana.points, 80);
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

test("Howl of Terror pushes both sides once with no hidden status; a shield stops it", () => {
  for (const behind of [false, true]) {
    const { world, owner, target } = pair(f32(H * f32(0.8)), behind ? -1 : 1);
    owner.facing = 1;
    for (let f = 1; f <= 18; f++) frame(world, f === 1 ? neutral : controls());
    assertEquals(target.status.damage, 7.0);
    assertEquals(target.status.condition, HeroStatusKind.none);
    // The roar pushes away on both sides.
    assertGreaterThan(f32(f32(target.motion.x - owner.motion.x) * target.launch.knockbackX), 0.0);
  }
  const shielded = pair(f32(H * f32(0.8)));
  shielded.target.shield.raised = true;
  for (let f = 1; f <= 18; f++) frame(shielded.world, f === 1 ? neutral : controls(), controls({ shield: true }));
  assertEquals(shielded.target.status.condition, HeroStatusKind.none);
  assertEquals(shielded.target.status.damage, 0.0);
});

test("rollback restores Pit Lord's falling fire and repeats the same contact", () => {
  const { world, owner, target } = pair(f32(H * f32(1.8)));
  for (let f = 1; f <= 30; f++) frame(world, f === 1 ? down : controls());
  assertTrue(owner.projectiles.some(p => p.life > 0));
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
