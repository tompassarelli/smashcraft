// Lich's specials (#130) through the production special, projectile, contact and
// resource functions: Frost Nova and its burst, Chill, Death and Decay, the
// free recovery, Frost Armor and Dark Ritual.
import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, HeroStatusKind, ProjectileKind, SpecialAction } from "../codes";
import { CHILL } from "../chill";
import { inGrabContext } from "../conditions";
import { applyHeroStatus } from "../heroStatus";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { type Fighter, createFighter } from "../fighter";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { advanceHeroStatus } from "../heroSpecialRules";
import { regenerateMana } from "../mana";
import { fighterHurtParts } from "../hurtboxes";
import { updateProjectiles } from "../projectiles";
import { type Controls, type Roster, createRoster } from "../roster";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { advanceFighter } from "../step";
import { controls } from "../testWorld";
import { copyFighterState } from "../../replay/fighterState";
import { firstFighterDifference } from "../../replay/difference";

const H = HERO_REFERENCE_HEIGHT;

/** One match-ordered frame on `stage`: motion, special starts, contacts, specials, projectiles, resources. */
function frame(world: Roster, first: Readonly<Controls> = controls(), second: Readonly<Controls> = controls(), stage = 0): void {
  const inputs = [first, second];
  for (let slot = 0; slot < 2; slot++) advanceFighter(world, slot, stage, inputs[slot] ?? controls(), slot === 0 ? -240.0 : 240.0);
  beginDamageContacts();
  for (let slot = 0; slot < 2; slot++) startFighterSpecial(world.fighters[slot]!, stage, 0, inputs[slot] ?? controls());
  resolveAttacks(world);
  advanceSpecials(world, stage, 0, inputs);
  updateProjectiles(world);
  finishDamageContacts(world);
  for (let slot = 0; slot < 2; slot++) {
    regenerateMana(world.fighters[slot]!);
    advanceHeroStatus(world.fighters[slot]!);
  }
}

function lichPair(gap: number, opponent: Character = Character.archer): { world: Roster; lich: Fighter; target: Fighter } {
  const lich = createFighter(Character.lich, f32(-gap * 0.5), 1);
  const target = createFighter(opponent, f32(gap * 0.5), -1);
  const world = createRoster(3, [lich, target]);
  for (let i = 0; i < 3; i++) frame(world);
  return { world, lich, target };
}

const live = (f: Readonly<Fighter>) => f.projectiles.filter(p => p.life > 0 && p.kind === ProjectileKind.hero);
const neutral = controls({ specialPressed: true });
const sideForward = controls({ specialPressed: true, specialX: 1 });
const sideBack = controls({ specialPressed: true, specialX: -1 });
const up = controls({ specialPressed: true, specialZ: 1 });
const down = controls({ specialPressed: true, specialZ: -1 });

const shield = controls({ shield: true, shieldStrength: 1.0 });
const chilled = (f: Readonly<Fighter>) => f.status.condition === HeroStatusKind.chill;

test("Frost Nova costs 10, its slow orb leaves the hand on frame 18 and chills a body it reaches", () => {
  const { world, lich, target } = lichPair(400.0);
  frame(world, neutral);
  assertEquals(lich.special.action, SpecialAction.heroNeutral);
  assertEquals(lich.mana.points, 90);
  for (let f = 2; f <= 17; f++) frame(world);
  assertEquals(live(lich).length, 0);
  frame(world);
  assertEquals(live(lich).length, 1);
  assertNear(Math.abs(live(lich)[0]!.velocityX), f32(H * f32(0.09)), f32(0.01));
  for (let f = 19; f <= 80 && target.status.damage === 0.0; f++) frame(world);
  assertEquals(target.status.damage, 9.0);
  assertTrue(chilled(target));
  assertGreaterThan(target.status.conditionFrames, 73);
});

test("a second Frost Nova press stops the orb on its frame 4 and bursts it 6 frames later, chilling what it catches", () => {
  const { world, lich, target } = lichPair(1200.0);
  frame(world, neutral);
  for (let f = 2; f <= 45; f++) frame(world);
  const orb = live(lich)[0]!;
  frame(world, neutral);
  assertEquals(lich.special.action, SpecialAction.heroNeutral);
  assertEquals(lich.mana.points, 90);
  for (let f = 2; f <= 4; f++) frame(world);
  const x = orb.x;
  frame(world);
  assertEquals(orb.x, x);
  // Something that jumped the orb sits above it, inside the burst's radius.
  target.motion.x = x;
  target.motion.z = f32(lich.motion.z + f32(H * f32(0.5)));
  target.motion.grounded = false;
  target.motion.surface = undefined;
  target.motion.vz = 0.0;
  let burstFrame = 0;
  for (let f = 1; f <= 8 && target.status.damage === 0.0; f++) {
    frame(world);
    burstFrame = f;
  }
  assertEquals(target.status.damage, 10.0);
  // The loop starts on the gesture's frame 6: the burst strikes on frame 10, 6 frames after the stop.
  assertEquals(burstFrame, 5);
  assertTrue(chilled(target));
});

test("Chill lowers run and air drift speed, stops at a shield and cannot chain inside its immunity", () => {
  const travel = (chill: boolean, airborne: boolean) => {
    const { world, target } = lichPair(1200.0);
    if (chill) applyHeroStatus(target, CHILL);
    if (airborne) {
      target.motion.grounded = false;
      target.motion.surface = undefined;
      target.motion.z = 400.0;
    }
    const x = target.motion.x;
    for (let f = 0; f < 30; f++) frame(world, controls(), controls({ direction: -1 }));
    return f32(x - target.motion.x);
  };
  assertLessThan(travel(true, false), f32(travel(false, false) * f32(0.7)));
  assertLessThan(travel(true, true), f32(travel(false, true) * f32(0.7)));
  const guarded = lichPair(300.0);
  frame(guarded.world, neutral, shield);
  for (let f = 2; f <= 60; f++) frame(guarded.world, controls(), shield);
  assertEquals(guarded.target.status.damage, 0.0);
  assertFalse(chilled(guarded.target));
  const { target } = lichPair(300.0);
  applyHeroStatus(target, CHILL);
  for (let f = 0; f < 75; f++) advanceHeroStatus(target);
  assertFalse(chilled(target));
  applyHeroStatus(target, CHILL);
  assertFalse(chilled(target));
});

test("Death and Decay costs 25 and strikes a fighter standing in it on frame 30 and again from frame 70", () => {
  const ahead = f32(H * f32(1.5));
  const { world, lich, target } = lichPair(ahead);
  frame(world, sideForward);
  assertEquals(lich.mana.points, 75);
  for (let f = 2; f <= 8; f++) frame(world);
  assertEquals(live(lich).length, 2);
  assertNear(live(lich)[0]!.x, f32(lich.motion.x + ahead), 1.0);
  for (let f = 9; f <= 29; f++) frame(world);
  assertEquals(target.status.damage, 0.0);
  frame(world);
  assertEquals(target.status.damage, 5.0);
  // Back in the field after the pop-up, it is struck again once the second strike is live.
  for (let f = 31; f <= 69; f++) frame(world);
  assertEquals(target.status.damage, 5.0);
  target.motion.x = f32(lich.motion.x + ahead);
  for (let f = 70; f <= 72; f++) frame(world);
  assertEquals(target.status.damage, 14.0);
  for (let f = 73; f <= 100; f++) frame(world);
  assertEquals(live(lich).length, 0);
});

test("a shield spends one Death and Decay strike, and pressing toward Lich's back places it 0.9H ahead", () => {
  const { world, lich, target } = lichPair(f32(H * f32(1.5)));
  frame(world, sideForward, shield);
  for (let f = 2; f <= 31; f++) frame(world, controls(), shield);
  assertEquals(target.status.damage, 0.0);
  assertEquals(live(lich).length, 1);
  const near = lichPair(1200.0);
  frame(near.world, sideBack);
  assertEquals(near.lich.facing, 1);
  for (let f = 2; f <= 8; f++) frame(near.world);
  assertNear(live(near.lich)[0]!.x, f32(near.lich.motion.x + f32(H * f32(0.9))), 1.0);
});

test("interrupting Lich before Death and Decay's first strike removes the field", () => {
  const { world, lich, target } = lichPair(70.0, Character.lich);
  frame(world, sideForward);
  for (let f = 2; f <= 10; f++) frame(world);
  assertEquals(live(lich).length, 2);
  beginFighterAttack(world, 1, AttackStyle.forwardTilt, false);
  for (let f = 0; f < 12; f++) frame(world);
  assertGreaterThan(lich.status.damage, 0.0);
  assertEquals(live(lich).length, 0);
  assertEquals(target.status.damage, 0.0);
});

test("Death and Decay is not placed through solid stage geometry", () => {
  const placedFrom = (z: number): number => {
    const { world, lich } = lichPair(1600.0);
    // Below the main deck's top, off its left wall, facing the deck.
    lich.motion.x = -680.0;
    lich.motion.z = z;
    lich.motion.grounded = false;
    lich.motion.surface = undefined;
    frame(world, sideForward);
    for (let f = 2; f <= 8; f++) frame(world);
    return live(lich).length;
  };
  assertEquals(placedFrom(-90.0), 0);
  assertEquals(placedFrom(160.0), 2);
});

/** Lich with a formed Frost Armor shell, the opponent 70 away facing him. */
function armoredLich(): { world: Roster; lich: Fighter; target: Fighter } {
  const pair = lichPair(70.0, Character.lich);
  pair.lich.facing = 1;
  pair.target.facing = -1;
  frame(pair.world, down);
  for (let f = 2; f <= 45; f++) frame(pair.world);
  return pair;
}

test("Frost Armor costs 20, its shell lasts 240 frames, takes one small hit's reaction and chills the striker", () => {
  const { world, lich, target } = armoredLich();
  assertEquals(lich.mana.points, 80);
  assertGreaterThan(lich.status.armorFrames, 0);
  // A 3% Bone Knuckle: damage applies, the reaction does not, the shell is spent and the striker chilled.
  beginFighterAttack(world, 1, AttackStyle.jab, false);
  for (let f = 0; f < 8; f++) frame(world);
  assertEquals(lich.status.damage, 3.0);
  assertEquals(lich.launch.hitstun, 0);
  assertEquals(lich.status.armorFrames, 0);
  assertTrue(chilled(target));
  const lasting = lichPair(600.0);
  frame(lasting.world, down);
  for (let f = 2; f <= 22 + 238; f++) frame(lasting.world);
  assertGreaterThan(lasting.lich.status.armorFrames, 0);
  frame(lasting.world);
  frame(lasting.world);
  assertEquals(lasting.lich.status.armorFrames, 0);
});

test("a grab ignores Frost Armor and leaves the shell", () => {
  const { world, lich } = armoredLich();
  beginFighterAttack(world, 1, AttackStyle.grab, false);
  for (let f = 0; f < 14; f++) frame(world);
  assertTrue(inGrabContext(lich));
});

test("Dark Ritual: down special while the shell holds shatters it on frame 6 into a 5% burst and restores 30 mana", () => {
  const { world, lich, target } = armoredLich();
  lich.mana.points = 50;
  frame(world, down);
  assertEquals(lich.special.action, SpecialAction.heroDown);
  assertEquals(lich.mana.points, 50);
  for (let f = 2; f <= 5; f++) frame(world);
  assertGreaterThan(lich.status.armorFrames, 0);
  frame(world);
  assertEquals(lich.status.armorFrames, 0);
  assertEquals(lich.mana.points, 80);
  for (let f = 7; f <= 9; f++) frame(world);
  assertEquals(target.status.damage, 5.0);
  // The burst's hitlag holds the ritual a few frames.
  for (let f = 10; f <= 40; f++) frame(world);
  assertEquals(lich.special.action, SpecialAction.none);
  // Without a shell, down special casts Frost Armor again.
  const before = lich.mana.points;
  frame(world, down);
  assertEquals(lich.mana.points, before - 20);
});

test("Frost Nova and Death and Decay casts extend Lich's hittable casting arm only while casting", () => {
  const { world, lich } = lichPair(1200.0);
  frame(world, neutral);
  for (let f = 2; f <= 13; f++) frame(world);
  assertEquals(fighterHurtParts(lich).length, 1);
  frame(world);
  assertEquals(fighterHurtParts(lich).length, 2);
  for (let f = 15; f <= 25; f++) frame(world);
  assertEquals(fighterHurtParts(lich).length, 1);
  for (let f = 26; f <= 120; f++) frame(world);
  frame(world, sideForward);
  for (let f = 2; f <= 5; f++) frame(world);
  assertEquals(fighterHurtParts(lich).length, 2);
});

test("Spectral Ascent rises 2.9H and steers at most 1.0H; the zero-mana form rises 2.1H and steers 0.7H for free", () => {
  const ascend = (mana: number, stick: number) => {
    const { world, lich } = lichPair(600.0);
    lich.mana.points = mana;
    const steer = controls({ direction: stick });
    frame(world, up);
    for (let f = 2; f <= 9; f++) frame(world);
    const x = lich.motion.x;
    const z = lich.motion.z;
    // Velocity set on frame N moves the fighter on frame N + 1.
    for (let f = 10; f <= 35; f++) frame(world, steer);
    return { rise: f32(lich.motion.z - z), drift: f32(lich.motion.x - x), mana: lich.mana.points, helpless: lich.special.fall };
  };
  const full = ascend(100, 0);
  assertNear(full.rise, f32(H * f32(2.9)), 2.0);
  assertEquals(full.mana, 85);
  assertTrue(full.helpless);
  assertLessThan(Math.abs(full.drift), 1.0);
  const steered = ascend(100, -1);
  assertNear(steered.drift, f32(-H * f32(1.0)), 2.0);
  const free = ascend(10, 0);
  assertEquals(free.mana, 10);
  assertNear(free.rise, f32(H * f32(2.1)), 2.0);
  assertTrue(free.helpless);
  assertNear(ascend(10, -1).drift, f32(-H * f32(0.7)), 2.0);
});

test("replaying Lich's nova, armor and ascent from a restored snapshot reproduces both fighters", () => {
  const { world, lich, target } = lichPair(f32(H * f32(1.5)));
  const savedLich = createFighter(Character.lich, 0.0, 1);
  const savedTarget = createFighter(Character.archer, 0.0, 1);
  copyFighterState(savedLich, lich, 3);
  copyFighterState(savedTarget, target, 3);
  const run = () => {
    frame(world, sideForward);
    for (let f = 2; f <= 60; f++) frame(world);
    frame(world, down);
    for (let f = 2; f <= 50; f++) frame(world);
    frame(world, up);
    for (let f = 2; f <= 40; f++) frame(world, controls({ direction: 1 }));
  };
  run();
  assertGreaterThan(target.status.damage, 0.0);
  assertGreaterThan(lich.status.armorFrames, 0);
  const endLich = createFighter(Character.lich, 0.0, 1);
  const endTarget = createFighter(Character.archer, 0.0, 1);
  copyFighterState(endLich, lich, 3);
  copyFighterState(endTarget, target, 3);
  copyFighterState(lich, savedLich, 3);
  copyFighterState(target, savedTarget, 3);
  run();
  assertEquals(firstFighterDifference(endLich, lich, 3, 3), undefined);
  assertEquals(firstFighterDifference(endTarget, target, 3, 3), undefined);
});

test("an Archer inside forward-tilt range challenges Frost Nova's startup and no orb is thrown", () => {
  const { world, lich } = lichPair(90.0);
  frame(world, neutral);
  for (let f = 2; f <= 6; f++) frame(world);
  beginFighterAttack(world, 1, AttackStyle.jab, false);
  for (let f = 7; f <= 25; f++) frame(world);
  assertGreaterThan(lich.status.damage, 0.0);
  assertEquals(lich.special.action, SpecialAction.none);
  assertEquals(live(lich).length, 0);
});
