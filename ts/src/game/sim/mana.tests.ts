// Mana's gain and spend rules (smashcraft:docs/design/mana.md), through the
// production contact, special and status functions.
import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, ContactKind, HeroStatusGroup, HeroStatusKind, SpecialAction } from "./codes";
import { collectDamageContact } from "./contacts";
import { type Fighter, createFighter } from "./fighter";
import { applyHeroStatus } from "./heroStatus";
import { refillMana } from "./heroSpecialRules";
import { ROSTER_MANA, originalSpecialCost, regenerateMana, spendMana } from "./mana";
import { MANA_BURN_STUN } from "./projectiles";
import { startFighterSpecial } from "./specials";
import { contactBatch, controls, hitEffect, testWorld } from "./testWorld";
import type { Roster } from "./roster";

function pair(): { world: Roster; source: Fighter; target: Fighter } {
  const source = createFighter(Character.rifleman, 0.0, 1);
  const target = createFighter(Character.archer, 40.0, -1);
  source.mana.points = 50;
  target.mana.points = 50;
  return { world: testWorld(source, target), source, target };
}

/** One contact of `damage` from slot 0 to slot 1, resolved alone. */
function land(world: Roster, damage: number, kind: ContactKind, direct: boolean, shielded = false): void {
  contactBatch(world, () => collectDamageContact(world, 0, 1, hitEffect(damage, 0.0, 0.0, f32(0.8), f32(0.6)), 1, kind, direct, undefined, shielded));
}

function trickle(f: Fighter, frames: number): void {
  for (let frame = 0; frame < frames; frame++) regenerateMana(f);
}

test("mana trickles a point every 15 frames on the ground and every 40 in the air, with no wait after a spend", () => {
  const f = createFighter(Character.archer, 0.0, 1);
  f.motion.grounded = true;
  f.mana.points = 60;
  spendMana(f, 10);
  trickle(f, 14);
  assertEquals(f.mana.points, 50);
  trickle(f, 1);
  assertEquals(f.mana.points, 51);
  f.motion.grounded = false;
  trickle(f, 39);
  assertEquals(f.mana.points, 51);
  trickle(f, 1);
  assertEquals(f.mana.points, 52);
  f.mana.points = ROSTER_MANA.max;
  trickle(f, 60);
  assertEquals(f.mana.points, ROSTER_MANA.max);
});

test("no trickle while shielding, held, in hitstun, stunned or casting a special", () => {
  const blockers: ((f: Fighter) => void)[] = [
    f => { f.shield.raised = true; },
    f => { f.grab.grabbedFrames = 30; },
    f => { f.launch.hitstun = 30; },
    f => { f.status.condition = HeroStatusKind.stun; f.status.conditionFrames = 30; },
    f => { f.special.action = SpecialAction.archerHomingArrow; },
  ];
  for (const block of blockers) {
    const f = createFighter(Character.archer, 0.0, 1);
    f.motion.grounded = true;
    f.mana.points = 50;
    block(f);
    trickle(f, 60);
    assertEquals(f.mana.points, 50);
  }
});

test("a normal that lands earns its striker a point per percent, at most 12, and its target one per 2 percent, at most 6", () => {
  for (const [damage, dealt, taken] of [[7.0, 7, 3], [3.5, 3, 1], [20.0, 12, 6]] as const) {
    const { world, source, target } = pair();
    source.attack.style = AttackStyle.forwardTilt;
    land(world, damage, ContactKind.launch, true);
    assertEquals(source.mana.points, 50 + dealt);
    assertEquals(target.mana.points, 50 + taken);
  }
});

test("a throw earns as a normal does; a pummel earns nothing", () => {
  const thrown = pair();
  land(thrown.world, 7.0, ContactKind.throw, false);
  assertEquals(thrown.source.mana.points, 57);
  assertEquals(thrown.target.mana.points, 53);
  const pummeled = pair();
  land(pummeled.world, 3.0, ContactKind.pummel, true);
  assertEquals(pummeled.source.mana.points, 50);
  assertEquals(pummeled.target.mana.points, 50);
});

test("a special's strike or projectile earns its striker nothing; its target still earns its share", () => {
  const strike = pair();
  strike.source.special.action = SpecialAction.riflemanBear;
  land(strike.world, 10.0, ContactKind.launch, true);
  assertEquals(strike.source.mana.points, 50);
  assertEquals(strike.target.mana.points, 55);
  const shot = pair();
  land(shot.world, 6.0, ContactKind.flinch, false);
  assertEquals(shot.source.mana.points, 50);
  assertEquals(shot.target.mana.points, 53);
});

test("a hit on a shield earns nobody mana", () => {
  const { world, source, target } = pair();
  source.attack.style = AttackStyle.forwardTilt;
  target.shield.raised = true;
  land(world, 9.0, ContactKind.launch, true, true);
  assertEquals(source.mana.points, 50);
  assertEquals(target.mana.points, 50);
});

test("an original fighter's special it cannot afford does not come out and counts one refusal; the up special is free", () => {
  const archer = createFighter(Character.archer, 0.0, 1);
  testWorld(archer, createFighter(Character.rifleman, 900.0, -1));
  archer.mana.points = 11;
  const homing = controls({ specialPressed: true, specialX: 1 });
  assertFalse(startFighterSpecial(archer, 0, 0, homing));
  assertEquals(archer.special.action, SpecialAction.none);
  assertEquals(archer.mana.points, 11);
  assertEquals(archer.visuals.manaDenied, 1);
  archer.mana.points = 12;
  assertTrue(startFighterSpecial(archer, 0, 0, homing));
  assertEquals(archer.special.action, SpecialAction.archerHomingArrow);
  assertEquals(archer.mana.points, 0);
  const rider = createFighter(Character.archer, 0.0, 1);
  testWorld(rider, createFighter(Character.rifleman, 900.0, -1));
  rider.mana.points = 0;
  assertTrue(startFighterSpecial(rider, 0, 0, controls({ specialPressed: true, specialZ: 1 })));
  assertEquals(rider.special.action, SpecialAction.archerRecovery);
  assertEquals(rider.visuals.manaDenied, 0);
});

test("Mana Burn's burn lands even on a fighter immune to its stun", () => {
  const f = createFighter(Character.archer, 0.0, 1);
  f.status.conditionImmunity[HeroStatusGroup.sleep] = 100;
  applyHeroStatus(f, MANA_BURN_STUN);
  assertEquals(f.mana.points, 75);
  assertEquals(f.status.condition, HeroStatusKind.none);
});

test("every fighter starts each stock with a full bar", () => {
  for (const character of [Character.archer, Character.rifleman, Character.demonHunter, Character.lich]) {
    const f = createFighter(character, 0.0, 1);
    assertEquals(f.mana.points, ROSTER_MANA.max);
    f.mana.points = 3;
    f.mana.progress = 40;
    refillMana(f);
    assertEquals(f.mana.points, ROSTER_MANA.max);
    assertEquals(f.mana.progress, 0);
  }
});

test("each original special pays its own cost: Illidan's Wing Ascent is free and Immolation costs 15", () => {
  assertEquals(originalSpecialCost(SpecialAction.archerArrow), 3);
  assertEquals(originalSpecialCost(SpecialAction.archerRecovery), 0);
  assertEquals(originalSpecialCost(SpecialAction.riflemanBear), 25);
  assertEquals(originalSpecialCost(SpecialAction.riflemanRecovery), 0);
  assertEquals(originalSpecialCost(SpecialAction.demonHunterManaBurn), 10);
  assertEquals(originalSpecialCost(SpecialAction.demonHunterFelRush), 12);
  assertEquals(originalSpecialCost(SpecialAction.demonHunterWingAscent), 0);
  assertEquals(originalSpecialCost(SpecialAction.demonHunterImmolate), 15);
});
