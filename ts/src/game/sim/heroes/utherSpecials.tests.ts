// Uther's four specials through the production special, contact, projectile
// and mana functions (smashcraft:docs/design/uther.md).
import { assertEquals, assertNear, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { copyFighterState } from "../../replay/fighterState";
import { firstFighterDifference } from "../../replay/difference";
import { fighterSpecialsCanonical } from "../../replay/canonical";
import { captureImpactEventsBefore, createImpactEvents, finishImpactEventsAfter } from "../../presentation/impactEvents";
import { presentImpactSounds } from "../../presentation/hitPresentation";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, HeroStatusKind, HeroStatusGroup, SpecialAction } from "../codes";
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
  advanceSpecials(world, 0, 0, inputs);
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

test("Uther's replay kit identity records the frame of Cleansing Hammer's dispel", () => {
  const changed = { ...UTHER_SPECIALS, neutral: { ...UTHER_SPECIALS.neutral, ground: { ...UTHER_SPECIALS.neutral.ground, cleanseFrame: 15 } } };
  assertTrue(fighterSpecialsCanonical(changed) !== fighterSpecialsCanonical(UTHER_SPECIALS));
});

test("Uther's specials spend their listed mana once and end on their listed frames", () => {
  for (const [input, action, cost, end] of [
    [neutral, SpecialAction.heroNeutral, 10, 38],
    [side, SpecialAction.heroSide, 25, 49],
    [up, SpecialAction.heroUp, 15, 29],
    [down, SpecialAction.heroDown, 20, 42],
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

test("Cleansing Hammer bonks once, launches upward and holds both fighters three extra frames", () => {
  for (const facing of [-1, 1]) {
    const { world, owner, target } = pair(110.0);
    owner.facing = facing;
    owner.motion.x = -55.0 * facing;
    target.motion.x = 55.0 * facing;
    frame(world, neutral);
    for (let f = 2; f <= 13; f++) frame(world);
    assertEquals(target.status.damage, 0.0);
    for (let f = 14; f <= 16 && target.status.damage === 0.0; f++) frame(world);
    assertEquals(target.status.damage, f32(13.0 * f32(0.85)));
    assertEquals(owner.launch.hitlag, ordinaryHitlagFrames(13.0) + 3);
    assertEquals(target.launch.hitlag, ordinaryHitlagFrames(13.0) + 3);
    assertGreaterThan(target.launch.knockbackZ, Math.abs(target.launch.knockbackX));
    for (let f = 0; f < 60; f++) frame(world);
    assertEquals(target.status.damage, f32(13.0 * f32(0.85)));
    assertEquals(owner.projectiles.filter((p) => p.life > 0).length, 0);
  }
});

test("Uther's balanced hammer normal keeps its original hitlag while dealing 85 percent damage", () => {
  const { world, owner, target } = pair(100.0);
  beginFighterAttack(world, 0, AttackStyle.forwardTilt, false);
  owner.attack.frame = 11;
  resolveAttacks(world);
  assertEquals(target.status.damage, f32(12.0 * f32(0.85)));
  assertEquals(owner.launch.hitlag, ordinaryHitlagFrames(12.0) + 3);
  assertEquals(target.launch.hitlag, ordinaryHitlagFrames(12.0) + 3);
});

test("Righteous Fury advances with the hammer, hits once up close, slows movement and cannot hit at range", () => {
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
  assertEquals(close.target.status.damage, f32(14.0 * f32(0.85)));
  assertEquals(close.target.status.condition, HeroStatusKind.chill);
  const ranged = pair(400.0);
  frame(ranged.world, side);
  for (let f = 2; f <= 65; f++) frame(ranged.world);
  assertEquals(ranged.target.status.damage, 0.0);
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

test("air Righteous Fury has no armor, spends its one airborne use and ends helpless", () => {
  const air = pair(900.0);
  air.owner.motion.grounded = false;
  air.owner.motion.z = 1200.0;
  frame(air.world, side);
  for (let f = 2; f <= 49; f++) {
    assertEquals(air.owner.status.armorFrames, 0);
    frame(air.world);
  }
  assertTrue(air.owner.special.fall);
  air.owner.special.fall = false;
  frame(air.world, side);
  assertEquals(air.owner.special.action, SpecialAction.none);
});

test("Ascension rises 2.9H with one hit, its free form 2.0H without one, both drifting 0.2H forward plus up to 1.6H steered into a helpless fall", () => {
  for (const [mana, rise, damage] of [[100, f32(2.9), 8.0], [14, f32(2.0), 0.0]] as const) {
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
    near(f32(owner.motion.x - x) / H, f32(0.2), f32(0.03));
    assertTrue(owner.special.fall);
    const steered = pair(900.0);
    steered.owner.mana.points = mana;
    const steerX = steered.owner.motion.x;
    frame(steered.world, up);
    for (let f = 2; f <= 30; f++) frame(steered.world, controls({ direction: -1 }));
    assertNear(f32(steered.owner.motion.x - steerX) / H, f32(-1.4), f32(0.03));
    const close = pair(40.0);
    close.owner.mana.points = mana;
    frame(close.world, up);
    for (let f = 2; f <= 30; f++) frame(close.world);
    assertEquals(close.target.status.damage, f32(damage * f32(0.85)));
  }
});


test("Cleansing Hammer removes poison and slow on f14, preserving hard control and immunity", () => {
  for (const kind of [HeroStatusKind.chill, HeroStatusKind.silence, HeroStatusKind.sleep, HeroStatusKind.stun, HeroStatusKind.carried]) {
    const { world, owner } = pair(900.0);
    frame(world, neutral);
    owner.status.condition = kind;
    owner.status.conditionFrames = 80;
    owner.status.conditionGroup = HeroStatusGroup.chill;
    owner.status.conditionImmunityFrames = 120;
    owner.status.poisonFrames = 90;
    owner.status.poisonEvery = 90;
    owner.status.poisonDamage = 1.0;
    for (let f = 2; f <= 13; f++) frame(world);
    assertGreaterThan(owner.status.poisonFrames, 0);
    frame(world);
    assertEquals(owner.status.poisonFrames, 0);
    assertEquals(owner.status.poisonEvery, 0);
    assertEquals(owner.status.poisonDamage, 0.0);
    assertEquals(owner.status.condition, kind === HeroStatusKind.chill ? HeroStatusKind.none : kind);
    if (kind === HeroStatusKind.chill) assertGreaterThan(owner.status.conditionImmunity[HeroStatusGroup.chill] ?? 0, 0);
  }
});

test("Righteous Fury's shield contact cannot apply its movement slow", () => {
  const { world, owner, target } = pair(110.0);
  target.shield.raised = true;
  for (let f = 1; f <= 25 && owner.launch.hitlag === 0; f++) frame(world, f === 1 ? side : controls(), undefined, controls({ shield: true, shieldStrength: 1.0 }));
  assertEquals(target.status.damage, 0.0);
  assertEquals(target.status.condition, HeroStatusKind.none);
  assertGreaterThan(owner.launch.hitlag, 0);
});

test("Consecration refuses in air, pulses only on grounded targets and has one fixed patch", () => {
  const air = pair(900.0);
  air.owner.motion.grounded = false;
  air.owner.motion.z = 400.0;
  frame(air.world, down);
  assertEquals(air.owner.special.action, SpecialAction.none);
  assertEquals(air.owner.mana.points, 100);
  const { world, owner, target } = pair(70.0);
  frame(world, down);
  for (let f = 2; f <= 15; f++) frame(world);
  assertEquals(target.status.damage, 0.0);
  frame(world);
  assertEquals(target.status.damage, f32(2.0 * f32(0.85)));
  const pool = owner.projectiles.find(p => p.life > 0);
  assertTrue(pool !== undefined);
  if (pool === undefined) return;
  const x = pool.x;
  assertEquals(pool.spec?.radius, 60.0);
  assertEquals(pool.spec?.pool?.growth, 0.0);
  assertFalse(pool.spec?.reflectable ?? true);
  for (let f = 0; f < 48; f++) {
    target.motion.x = x;
    target.motion.z = 1.0;
    target.motion.grounded = false;
    beginDamageContacts();
    updateProjectiles(world);
    finishDamageContacts(world);
  }
  assertEquals(target.status.damage, f32(2.0 * f32(0.85)));
  target.motion.z = 0.0;
  target.motion.grounded = true;
  target.status.invincible = 0;
  target.launch.hitlag = 0;
  target.launch.hitstun = 0;
  beginDamageContacts();
  updateProjectiles(world);
  finishDamageContacts(world);
  assertEquals(target.status.damage, f32(4.0 * f32(0.85)));
  assertEquals(pool.x, x);
  assertEquals(pool.spec?.radius, 60.0);
});

test("Consecration cannot be recast before its cooldown and gives no shield protection", () => {
  const { world, owner } = pair(900.0);
  frame(world, down);
  for (let f = 2; f <= 50; f++) frame(world);
  const mana = owner.mana.points;
  frame(world, down);
  assertEquals(owner.special.action, SpecialAction.none);
  assertEquals(owner.mana.points, mana);
  assertEquals(owner.projectiles.filter(p => p.life > 0).length, 1);
  assertEquals(owner.status.divineFrames, 0);
  assertEquals(owner.status.invincible, 0);
  for (let f = 51; f <= 155; f++) frame(world);
  assertEquals(owner.projectiles.filter(p => p.life > 0).length, 0);
  frame(world, down);
  assertEquals(owner.special.action, SpecialAction.heroDown);
});

test("replaying Uther's Consecration and Righteous Fury restores every fighter field", () => {
  const { world, owner, target } = pair(70.0);
  frame(world, down);
  const savedOwner = createFighter(Character.uther, 0.0, 1);
  const savedTarget = createFighter(Character.archer, 0.0, -1);
  copyFighterState(savedOwner, owner, 3);
  copyFighterState(savedTarget, target, 3);
  const run = () => { for (let f = 2; f <= 130; f++) frame(world, f === 50 ? side : controls()); };
  run();
  const endOwner = createFighter(Character.uther, 0.0, 1);
  const endTarget = createFighter(Character.archer, 0.0, -1);
  copyFighterState(endOwner, owner, 3);
  copyFighterState(endTarget, target, 3);
  assertGreaterThan(target.status.damage, 0.0);
  assertLessThan(owner.mana.points, 100);
  copyFighterState(owner, savedOwner, 3);
  copyFighterState(target, savedTarget, 3);
  run();
  assertEquals(firstFighterDifference(endOwner, owner, 3, 3), undefined);
  assertEquals(firstFighterDifference(endTarget, target, 3, 3), undefined);
});
