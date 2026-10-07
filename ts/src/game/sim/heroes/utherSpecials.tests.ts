// Uther's four specials through the production special, contact, projectile
// and mana functions (smashcraft:docs/design/uther.md).
import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { copyFighterState } from "../../replay/fighterState";
import { firstFighterDifference } from "../../replay/difference";
import { captureImpactEventsBefore, createImpactEvents, finishImpactEventsAfter } from "../../presentation/impactEvents";
import { presentImpactSounds } from "../../presentation/hitPresentation";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, SpecialAction } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { type Fighter, createFighter } from "../fighter";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { advanceHeroStatus } from "../heroSpecialRules";
import { ordinaryHitlagFrames } from "../knockback";
import { regenerateMana } from "../mana";
import { updateProjectiles } from "../projectiles";
import { type Controls, type Roster, createRoster } from "../roster";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { advanceFighter } from "../step";
import { controls } from "../testWorld";
import { UTHER_SPECIALS } from "./utherSpecials";

/** One match-ordered frame; `strike` starts the second fighter's attack before contacts. */
function frame(world: Roster, first: Readonly<Controls> = controls(), strike?: AttackStyle, second: Readonly<Controls> = controls()): void {
  const inputs = [first, second];
  for (let slot = 0; slot < 2; slot++) advanceFighter(world, slot, 0, inputs[slot] ?? controls(), slot === 0 ? -240.0 : 240.0);
  beginDamageContacts();
  for (let slot = 0; slot < 2; slot++) startFighterSpecial(world.fighters[slot]!, 0, 0, inputs[slot] ?? controls());
  beginFighterAttack(world, 1, strike, false);
  resolveAttacks(world);
  advanceSpecials(world, 0, 0);
  updateProjectiles(world);
  finishDamageContacts(world);
  for (let slot = 0; slot < 2; slot++) {
    regenerateMana(world.fighters[slot]!);
    advanceHeroStatus(world.fighters[slot]!);
  }
}

function pair(gap: number, opponent: Character = Character.archer): { world: Roster; owner: Fighter; target: Fighter } {
  const owner = createFighter(Character.uther, f32(-gap * 0.5), 1);
  const target = createFighter(opponent, f32(gap * 0.5), -1);
  const world = createRoster(3, [owner, target]);
  for (let i = 0; i < 3; i++) frame(world);
  return { world, owner, target };
}

const H = HERO_REFERENCE_HEIGHT;
const neutral = controls({ specialPressed: true });
const side = controls({ specialPressed: true, specialX: 1 });
const up = controls({ specialPressed: true, specialZ: 1 });
const down = controls({ specialPressed: true, specialZ: -1 });


const near = (actual: number, expected: number, tolerance: number) => assertTrue(Math.abs(actual - expected) <= tolerance);

test("Uther's specials spend their listed mana once and end on their listed frames", () => {
  for (const [input, action, cost, end] of [
    [neutral, SpecialAction.heroNeutral, 10, 38],
    [side, SpecialAction.heroSide, 20, 69],
    [up, SpecialAction.heroUp, 15, 29],
    [down, SpecialAction.heroDown, 25, 36],
  ] as const) {
    const { world, owner } = pair(900.0);
    frame(world, input);
    assertEquals(owner.special.action, action);
    assertEquals(owner.mana.points, 100 - cost);
    for (let f = 2; f <= end; f++) {
      assertEquals(owner.special.action, action);
      frame(world);
    }
    assertEquals(owner.special.action, SpecialAction.none);
    assertEquals(owner.mana.points, 100 - cost);
  }
  assertEquals(UTHER_SPECIALS.up.free?.cost, 0);
});

test("Hammer of Justice bonks once, launches upward and holds both fighters three extra frames", () => {
  for (const facing of [-1, 1]) {
    const { world, owner, target } = pair(110.0);
    owner.facing = facing;
    owner.motion.x = -55.0 * facing;
    target.motion.x = 55.0 * facing;
    frame(world, neutral);
    for (let f = 2; f <= 13; f++) frame(world);
    assertEquals(target.status.damage, 0.0);
    for (let f = 14; f <= 16 && target.status.damage === 0.0; f++) frame(world);
    assertEquals(target.status.damage, 13.0);
    assertEquals(owner.launch.hitlag, ordinaryHitlagFrames(13.0) + 3);
    assertEquals(target.launch.hitlag, ordinaryHitlagFrames(13.0) + 3);
    assertGreaterThan(target.launch.knockbackZ, Math.abs(target.launch.knockbackX));
    for (let f = 0; f < 60; f++) frame(world);
    assertEquals(target.status.damage, 13.0);
    assertEquals(owner.projectiles.filter((p) => p.life > 0).length, 0);
  }
});

test("Holy Radiance advances with the hammer, hits once up close and sends weaker light beyond it", () => {
  const far = pair(900.0);
  const start = far.owner.motion.x;
  frame(far.world, side);
  for (let f = 2; f <= 50; f++) {
    frame(far.world);
    assertEquals(far.owner.status.armorFrames > 0, f >= 14 && f <= 17);
  }
  near(f32(far.owner.motion.x - start) / H, f32(0.75), f32(0.02));
  const close = pair(100.0);
  frame(close.world, side);
  for (let f = 2; f <= 75; f++) frame(close.world);
  assertEquals(close.target.status.damage, 14.0);
  const ranged = pair(400.0);
  frame(ranged.world, side);
  for (let f = 2; f <= 65; f++) frame(ranged.world);
  assertEquals(ranged.target.status.damage, 6.0);
});

test("Uther's hammer makes one loud heavy bash and holds a shield contact three extra frames", () => {
  const sound = pair(110.0);
  const events = createImpactEvents();
  const played: string[] = [];
  for (let f = 1; f <= 65; f++) {
    captureImpactEventsBefore(events, sound.target);
    frame(sound.world, f === 1 ? neutral : controls());
    finishImpactEventsAfter(events, sound.target, sound.world);
    presentImpactSounds(events, (path, _x, _z, volume, _pitch, file) => {
      if (events.hit && file) played.push(`${path}:${volume}`);
    });
  }
  assertEquals(played.length, 1);
  assertTrue((played[0] ?? "").includes("WoodHeavyBashFlesh"));
  assertTrue((played[0] ?? "").endsWith(":127"));
  const shield = pair(110.0);
  shield.target.shield.raised = true;
  for (let f = 1; f <= 20 && shield.owner.launch.hitlag === 0; f++) {
    frame(shield.world, f === 1 ? neutral : controls(), undefined, controls({ shield: true, shieldStrength: 1.0 }));
  }
  assertEquals(shield.target.status.damage, 0.0);
  assertEquals(shield.owner.launch.hitlag, ordinaryHitlagFrames(13.0) + 3);
  assertEquals(shield.target.launch.hitlag, ordinaryHitlagFrames(13.0) + 3);
});

test("air Holy Radiance has no armor, spends its one airborne use and ends helpless", () => {
  const air = pair(900.0);
  air.owner.motion.grounded = false;
  air.owner.motion.z = 1200.0;
  frame(air.world, side);
  for (let f = 2; f <= 69; f++) {
    assertEquals(air.owner.status.armorFrames, 0);
    frame(air.world);
  }
  assertTrue(air.owner.special.fall);
  air.owner.special.fall = false;
  frame(air.world, side);
  assertEquals(air.owner.special.action, SpecialAction.none);
});

test("Ascension rises 1.9H with one hit, its free form 1.3H without one, both drifting 0.45H into a helpless fall", () => {
  for (const [mana, rise, damage] of [[100, f32(1.9), 8.0], [14, f32(1.3), 0.0]] as const) {
    const { world, owner } = pair(900.0);
    owner.mana.points = mana;
    const x = owner.motion.x;
    const z = owner.motion.z;
    frame(world, up);
    assertEquals(owner.mana.points, mana === 100 ? 85 : 14);
    let top = z;
    for (let f = 2; f <= 30; f++) {
      frame(world);
      top = Math.max(top, owner.motion.z);
    }
    near(f32(top - z) / H, rise, f32(0.03));
    near(f32(owner.motion.x - x) / H, f32(0.45), f32(0.03));
    assertTrue(owner.special.fall);
    const close = pair(40.0);
    close.owner.mana.points = mana;
    frame(close.world, up);
    for (let f = 2; f <= 30; f++) frame(close.world);
    assertEquals(close.target.status.damage, damage);
  }
});

test("Divine Shield fails in the air without spending, and only a strike on f6-9 raises it", () => {
  const air = pair(900.0);
  air.owner.motion.grounded = false;
  air.owner.motion.z = 400.0;
  frame(air.world, down);
  assertEquals(air.owner.special.action, SpecialAction.none);
  assertEquals(air.owner.mana.points, 100);
  // A second Uther's jab (active on its frames 5-6) pressed on the guard's frame `press`.
  for (let press = 2; press <= 8; press++) {
    const { world, owner } = pair(60.0, Character.uther);
    owner.status.damage = 20.0;
    frame(world, down);
    let raised = false;
    for (let f = 2; f <= 40; f++) {
      frame(world, controls(), f === press ? AttackStyle.jab : undefined);
      raised ||= owner.status.divineFrames > 0;
    }
    assertEquals(raised, press <= 5);
    assertEquals(owner.status.guardHealed, 0.0);
    // Guarded, the whole jab passes through the shield; pressed later it lands.
    assertEquals(owner.status.damage, press <= 5 ? 20.0 : 24.0);
  }
});

/** Uther 60 from another Uther, his Divine Shield raised by a jab pressed on guard frame 3; returns at guard frame 12. */
function shielded() {
  const p = pair(60.0, Character.uther);
  frame(p.world, down);
  for (let f = 2; f <= 12; f++) frame(p.world, controls(), f === 3 ? AttackStyle.jab : undefined);
  assertGreaterThan(p.owner.status.divineFrames, 30);
  return p;
}

test("Divine Shield lets a later strike pass for 45 frames, then ends", () => {
  const { world, owner } = shielded();
  for (let f = 13; f <= 36; f++) frame(world);
  frame(world, controls(), AttackStyle.forwardTilt);
  for (let f = 0; f < 14; f++) frame(world);
  assertEquals(owner.status.damage, 0.0);
  for (let f = 0; f < 30; f++) frame(world);
  assertEquals(owner.status.divineFrames, 0);
  frame(world, controls(), AttackStyle.jab);
  for (let f = 0; f < 10; f++) frame(world);
  assertGreaterThan(owner.status.damage, 0.0);
});

test("Uther's own attack ends Divine Shield, and a grab still catches him inside it", () => {
  const attacking = shielded();
  for (let f = 13; f <= 40; f++) frame(attacking.world);
  assertGreaterThan(attacking.owner.status.divineFrames, 0);
  beginFighterAttack(attacking.world, 0, AttackStyle.jab, false);
  assertEquals(attacking.owner.attack.style, AttackStyle.jab);
  assertEquals(attacking.owner.status.divineFrames, 0);
  assertEquals(attacking.owner.status.invincible, 0);
  const grabbed = shielded();
  for (let f = 13; f <= 36; f++) frame(grabbed.world);
  frame(grabbed.world, controls(), AttackStyle.grab);
  for (let f = 0; f < 12; f++) frame(grabbed.world);
  assertEquals(grabbed.target.grab.target, 0);
  assertEquals(grabbed.owner.grab.owner, 1);
});

test("a grab beats Divine Shield's guard once its intangible frames end", () => {
  const { world, owner, target } = pair(60.0, Character.uther);
  frame(world, down);
  for (let f = 2; f <= 12; f++) frame(world, controls(), f === 4 ? AttackStyle.grab : undefined);
  assertEquals(target.grab.target, 0);
  assertEquals(owner.grab.owner, 1);
  assertEquals(owner.special.action, SpecialAction.none);
  assertEquals(owner.status.divineFrames, 0);
});

test("replaying Uther's guard and Radiance from a restored snapshot reproduces every fighter field", () => {
  const { world, owner, target } = pair(60.0, Character.uther);
  owner.status.damage = 20.0;
  const savedOwner = createFighter(Character.uther, 0.0, 1);
  const savedTarget = createFighter(Character.uther, 0.0, 1);
  frame(world, down);
  copyFighterState(savedOwner, owner, 3);
  copyFighterState(savedTarget, target, 3);
  const run = () => {
    for (let f = 2; f <= 40; f++) frame(world, f === 38 ? side : controls(), f === 3 ? AttackStyle.jab : undefined);
    for (let f = 0; f < 50; f++) frame(world);
  };
  run();
  const endOwner = createFighter(Character.uther, 0.0, 1);
  const endTarget = createFighter(Character.uther, 0.0, 1);
  copyFighterState(endOwner, owner, 3);
  copyFighterState(endTarget, target, 3);
  assertEquals(owner.status.damage, 20.0);
  assertLessThan(owner.mana.points, 100);
  copyFighterState(owner, savedOwner, 3);
  copyFighterState(target, savedTarget, 3);
  assertFalse(owner.special.guarded);
  run();
  assertEquals(firstFighterDifference(endOwner, owner, 3, 3), undefined);
  assertEquals(firstFighterDifference(endTarget, target, 3, 3), undefined);
});
