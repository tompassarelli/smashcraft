// Shared hero-special and mana contracts, run through the production special,
// projectile, contact and regeneration functions with a test kit.
import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { resolveAttacks } from "./attacks";
import { Character, ProjectileKind, SpecialAction } from "./codes";
import { beginDamageContacts, finishDamageContacts } from "./contacts";
import { type Fighter, createFighter } from "./fighter";
import { heroRegion } from "./heroMoves";
import { HurtContact, fighterHurtParts, hurtPart, hurtPose, strikeHurtContact } from "./hurtboxes";
import { emptyCapsule, hurtCapsule, placeCapsule } from "../physics/contactGeometry";
import { advanceHeroStatus, regenerateMana } from "./heroSpecialRules";
import { type AuthoredSpecial, type FighterSpecials, ROSTER_MANA, frames } from "./heroSpecials";
import { HERO_ROSTER, SELECTABLE_CHARACTERS, isSelectableCharacter, nextSelectableCharacter, selectableCharactersOf } from "./heroes/registry";
import { updateProjectiles } from "./projectiles";
import { FROZEN_THRONE_STAGE, SOLID_DECK_TEST_STAGE, surfaceCount, surfaceLeft, surfacePass, surfaceRight, surfaceZ } from "./stage";
import { type Controls, type Roster, createRoster } from "./roster";
import { advanceSpecials, startFighterSpecial } from "./specials";
import { advanceFighter } from "./step";
import { controls } from "./testWorld";
import { copyFighterState } from "../replay/fighterState";
import { firstFighterDifference } from "../replay/difference";
import { createMatchState, selectCharacter } from "../match/rules";

const hit = (damage: number) => ({ damage, growth: 80.0, base: 20.0, launchX: f32(0.8), launchZ: f32(0.6), electric: false });

const NEUTRAL: AuthoredSpecial = {
  cost: 0, endFrame: 20,
  projectiles: [{ spawnFrame: 5, offsetX: 40.0, offsetZ: 60.0, velocityX: 12.0, velocityZ: 0.0, life: 40, radius: 15.0, effect: hit(6.0), reflectable: true, limit: 1 }],
};
const SIDE: AuthoredSpecial = {
  cost: 18, endFrame: 30,
  regions: [heroRegion(10, 12, { x1: 10.0, z1: 50.0, x2: 90.0, z2: 50.0, radius: 12.0 }, hit(10.0))],
};
const UP: AuthoredSpecial = { cost: 15, endFrame: 25, helpless: true, oncePerAirtime: true, motion: [{ ...frames(5, 20), velocityX: 0.0, velocityZ: 12.0 }] };
const UP_FREE: AuthoredSpecial = { ...UP, cost: 0, motion: [{ ...frames(5, 20), velocityX: 0.0, velocityZ: 8.0 }] };
const DOWN: AuthoredSpecial = { cost: 25, endFrame: 30, groundOnly: true, intangible: frames(5, 8), armor: { ...frames(10, 20), maxDamage: 6.0 } };

const KIT: FighterSpecials = { mana: ROSTER_MANA, neutral: { ground: NEUTRAL }, side: { ground: SIDE }, up: { ground: UP, free: UP_FREE }, down: { ground: DOWN } };

function hero(x: number, facing: number): Fighter {
  const f = createFighter(Character.blademaster, x, facing);
  f.tuning = { ...f.tuning, specials: KIT };
  f.mana.points = KIT.mana.max;
  f.mana.sinceSpend = KIT.mana.regenDelayFrames;
  return f;
}

/** One match-ordered frame for two fighters: motion, special starts, contacts, specials, projectiles, resources. */
function frame(world: Roster, first: Readonly<Controls> = controls(), second: Readonly<Controls> = controls()): void {
  const inputs = [first, second];
  for (let slot = 0; slot < 2; slot++) advanceFighter(world, slot, 0, inputs[slot] ?? controls(), slot === 0 ? -240.0 : 240.0);
  beginDamageContacts();
  for (let slot = 0; slot < 2; slot++) startFighterSpecial(world.fighters[slot]!, 0, 0, inputs[slot] ?? controls());
  resolveAttacks(world);
  advanceSpecials(world, 0, 0);
  updateProjectiles(world, 0, 0);
  finishDamageContacts(world);
  for (let slot = 0; slot < 2; slot++) {
    regenerateMana(world.fighters[slot]!);
    advanceHeroStatus(world.fighters[slot]!);
  }
}

function pair(gap = 300.0): { world: Roster; owner: Fighter; target: Fighter } {
  const owner = hero(-gap * 0.5, 1);
  const target = createFighter(Character.archer, gap * 0.5, -1);
  const world = createRoster(3, [owner, target]);
  for (let i = 0; i < 3; i++) frame(world);
  return { world, owner, target };
}

const side = controls({ specialPressed: true, specialX: 1 });
const up = controls({ specialPressed: true, specialZ: 1 });
const down = controls({ specialPressed: true, specialZ: -1 });
const neutral = controls({ specialPressed: true });

test("a hero special spends its cost once on entry and the fighter acts again the frame after its end", () => {
  const { world, owner } = pair(600.0);
  frame(world, side);
  assertEquals(owner.special.action, SpecialAction.heroSide);
  assertEquals(owner.mana.points, 82);
  for (let f = 2; f <= 29; f++) frame(world, side);
  assertEquals(owner.special.action, SpecialAction.heroSide);
  assertEquals(owner.mana.points, 82);
  frame(world);
  assertEquals(owner.special.action, SpecialAction.none);
  frame(world, neutral);
  assertEquals(owner.special.action, SpecialAction.heroNeutral);
});

test("an unaffordable special starts nothing and counts one refusal per press", () => {
  const { world, owner } = pair(600.0);
  owner.mana.points = 10;
  frame(world, down);
  assertEquals(owner.special.action, SpecialAction.none);
  assertEquals(owner.mana.points, 10);
  assertEquals(owner.visuals.manaDenied, 1);
  frame(world);
  assertEquals(owner.visuals.manaDenied, 1);
  frame(world, side);
  assertEquals(owner.visuals.manaDenied, 2);
});

test("below the full cost the up special takes its free form and spends nothing", () => {
  const { world, owner } = pair(600.0);
  owner.mana.points = 14;
  frame(world, up);
  assertEquals(owner.special.action, SpecialAction.heroUp);
  assertEquals(owner.special.form, 2);
  assertEquals(owner.mana.points, 14);
  for (let f = 2; f <= 6; f++) frame(world);
  assertEquals(owner.motion.vz < 12.0, true);
  for (let f = 7; f <= 25; f++) frame(world);
  assertTrue(owner.special.fall);
  frame(world, up);
  assertEquals(owner.special.action, SpecialAction.none);
});

test("an up special is used once per airtime and landing restores it", () => {
  const { world, owner } = pair(600.0);
  frame(world, up);
  assertEquals(owner.mana.points, 85);
  for (let f = 2; f <= 25; f++) frame(world);
  assertFalse(owner.motion.grounded);
  assertTrue(owner.special.fall);
  owner.special.fall = false;
  frame(world, up);
  assertEquals(owner.special.action, SpecialAction.none);
  for (let f = 0; f < 240 && !owner.motion.grounded; f++) frame(world);
  assertTrue(owner.motion.grounded);
  assertEquals(owner.special.airtimeUses, 0);
});

test("mana waits 120 frames after a spend, then regenerates a point every 10 grounded actionable frames", () => {
  const { world, owner } = pair(600.0);
  frame(world, side);
  for (let f = 2; f <= 30; f++) frame(world);
  assertEquals(owner.mana.points, 82);
  for (let f = 31; f <= 120; f++) frame(world);
  assertEquals(owner.mana.points, 82);
  for (let f = 1; f <= 10; f++) frame(world);
  assertEquals(owner.mana.points, 83);
  for (let f = 1; f <= 60; f++) frame(world);
  assertEquals(owner.mana.points, 89);
  owner.shield.raised = true;
  const shielded = owner.mana.points;
  for (let f = 1; f <= 30; f++) frame(world, controls({ shield: true }));
  assertEquals(owner.mana.points, shielded);
});

test("a ground-only special fails in the air without spending", () => {
  const { world, owner } = pair(600.0);
  owner.motion.grounded = false;
  owner.motion.z = 200.0;
  frame(world, down);
  assertEquals(owner.special.action, SpecialAction.none);
  assertEquals(owner.mana.points, 100);
});

test("a hero projectile spawns on its frame, respects its limit and strikes once", () => {
  const { world, owner, target } = pair(300.0);
  frame(world, neutral);
  for (let f = 2; f <= 4; f++) frame(world);
  assertEquals(owner.projectiles.filter(p => p.life > 0).length, 0);
  frame(world);
  const flying = owner.projectiles.filter(p => p.life > 0 && p.kind === ProjectileKind.hero);
  assertEquals(flying.length, 1);
  for (let f = 6; f <= 20; f++) frame(world);
  frame(world, neutral);
  const recast = owner.special.action === SpecialAction.heroNeutral;
  assertEquals(recast, owner.projectiles.every(p => p.life <= 0));
  for (let f = 0; f < 40; f++) frame(world);
  assertEquals(target.status.damage, 6.0);
});

test("a hero strike path hits each target once per action", () => {
  const { world, owner, target } = pair(70.0);
  frame(world, side);
  for (let f = 2; f <= 12; f++) frame(world);
  assertEquals(target.status.damage, 10.0);
  for (let f = 13; f <= 30; f++) frame(world);
  assertEquals(target.status.damage, 10.0);
});

test("intangible and armor windows protect exactly their frames", () => {
  const { world, owner } = pair(600.0);
  frame(world, down);
  for (let f = 2; f <= 4; f++) frame(world);
  assertEquals(owner.status.invincible > 0, true);
  for (let f = 5; f <= 8; f++) frame(world);
  frame(world);
  assertEquals(owner.status.invincible, 0);
  assertEquals(owner.status.armorFrames > 0, true);
  assertEquals(owner.status.armorMaxDamage, 6.0);
});

test("replaying a hero special from a restored snapshot reproduces every fighter field", () => {
  const { world, owner, target } = pair(200.0);
  const savedOwner = createFighter(Character.blademaster, 0.0, 1);
  const savedTarget = createFighter(Character.archer, 0.0, 1);
  frame(world, neutral);
  frame(world);
  copyFighterState(savedOwner, owner, 3);
  copyFighterState(savedTarget, target, 3);
  const run = () => {
    frame(world, side);
    for (let f = 0; f < 50; f++) frame(world, f === 30 ? up : controls());
  };
  run();
  const endOwner = createFighter(Character.blademaster, 0.0, 1);
  const endTarget = createFighter(Character.archer, 0.0, 1);
  copyFighterState(endOwner, owner, 3);
  copyFighterState(endTarget, target, 3);
  assertGreaterThan(target.status.damage, 0.0);
  copyFighterState(owner, savedOwner, 3);
  copyFighterState(target, savedTarget, 3);
  run();
  assertEquals(firstFighterDifference(endOwner, owner, 3, 3), undefined);
  assertEquals(firstFighterDifference(endTarget, target, 3, 3), undefined);
});

test("incomplete heroes are registered but not selectable", () => {
  assertEquals(HERO_ROSTER.length, 7);
  assertEquals(SELECTABLE_CHARACTERS.join(","), HERO_ROSTER.filter(h => h.complete).reduce((list, h) => `${list},${h.character}`, "0,1,2"));
  for (const definition of HERO_ROSTER) {
    if (definition.complete) continue;
    assertFalse(isSelectableCharacter(definition.character));
    const game = createMatchState();
    selectCharacter(game, 0, definition.character);
    assertFalse(game.characterChoices[0] === definition.character);
  }
  const blademaster = HERO_ROSTER[0]!;
  assertEquals(selectableCharactersOf([{ ...blademaster, complete: true }]).join(","), "0,1,2,3");
  assertEquals(nextSelectableCharacter(Character.demonHunter, 1), SELECTABLE_CHARACTERS[3] ?? Character.archer);
});

test("a complete hero ships its four specials with a free up special", () => {
  for (const definition of HERO_ROSTER) {
    if (!definition.complete) continue;
    const specials = definition.specials;
    assertTrue(specials !== undefined);
    assertTrue(specials?.up.free !== undefined && specials.up.free.cost === 0);
  }
});

test("a stopsAtBody dash special ends short of an exposed body and a raised shield, and an unmarked one carries through", () => {
  const dash = (stopsAtBody: boolean): AuthoredSpecial => ({ cost: 0, endFrame: 20, motion: [{ ...frames(2, 16), velocityX: 20.0, velocityZ: 0.0, stopsAtBody }] });
  for (const facing of [-1, 1]) {
    for (const [stops, shielded] of [[true, false], [true, true], [false, false]] as const) {
      const owner = hero(0.0, facing);
      owner.tuning = { ...owner.tuning, specials: { ...KIT, side: { ground: dash(stops) } } };
      const target = createFighter(Character.archer, f32(200.0 * facing), -facing);
      const world = createRoster(3, [owner, target]);
      for (let i = 0; i < 3; i++) frame(world);
      const press = controls({ specialPressed: true, specialX: facing });
      const guard = controls({ shield: shielded, shieldTriggerActive: shielded });
      frame(world, press, guard);
      for (let f = 2; f <= 20; f++) frame(world, controls(), guard);
      assertEquals(target.shield.raised, shielded);
      const gap = f32(f32(target.motion.x - owner.motion.x) * facing);
      if (stops) {
        assertGreaterThan(gap, 0.0);
        assertTrue(gap >= 47.5);
      } else {
        assertTrue(gap < 48.0);
      }
    }
  }
});


test("a hero special's hurt poses replace the body on their frames only", () => {
  const { world, owner, target } = pair(600.0);
  const reach = hurtPart(0.0, 40.0, 140.0, 40.0, 12.0);
  const posed: AuthoredSpecial = { ...SIDE, hurt: [hurtPose(5, 8, [hurtCapsule(Character.blademaster), reach])] };
  owner.tuning = { ...owner.tuning, specials: { ...KIT, side: { ground: posed } } };
  frame(world, side);
  for (let f = 2; f <= 4; f++) frame(world);
  assertEquals(fighterHurtParts(owner).length, 1);
  frame(world);
  assertEquals(owner.special.frame, 5);
  assertEquals(fighterHurtParts(owner).length, 2);
  const strike = placeCapsule(emptyCapsule(), { x1: 0.0, z1: 40.0, x2: 0.0, z2: 40.0, radius: 5.0 }, f32(owner.motion.x + 130.0), owner.motion.z, 1);
  assertEquals(strikeHurtContact(strike, owner), HurtContact.hit);
  for (let f = 6; f <= 9; f++) frame(world);
  assertEquals(fighterHurtParts(owner).length, 1);
  assertEquals(strikeHurtContact(strike, owner), HurtContact.none);
  void target;
});

test("hero projectiles end on walls, undersides and solid deck tops, and pass through pass decks", () => {
  const owner = hero(-100.0, 1);
  const target = createFighter(Character.archer, 2000.0, -1);
  const world = createRoster(3, [owner, target]);
  const launch = (x: number, z: number, velocityX: number, velocityZ: number) => {
    const projectile = owner.projectiles[0]!;
    Object.assign(projectile, { life: 30, kind: ProjectileKind.hero, spec: NEUTRAL.projectiles![0], x, z, velocityX, velocityZ, direction: 1 });
    return projectile;
  };
  const down = launch(0.0, 20.0, 0.0, -30.0);
  updateProjectiles(world, 0, 0);
  assertEquals(down.life, 0);
  const wall = launch(700.0, -60.0, -40.0, 0.0);
  updateProjectiles(world, 0, 0);
  updateProjectiles(world, 0, 0);
  assertEquals(wall.life, 28);
  updateProjectiles(world, 0, 0);
  assertEquals(wall.life, 0);
  const level = launch(-500.0, 60.0, 30.0, 0.0);
  for (let f = 0; f < 10; f++) updateProjectiles(world, 0, 0);
  assertEquals(level.life, 20);
  let passDecks = 0;
  for (const [stage, pass] of [[FROZEN_THRONE_STAGE, true], [SOLID_DECK_TEST_STAGE, false]] as const) {
    for (let deck = 1; deck < surfaceCount(stage); deck++) {
      assertEquals(surfacePass(stage, deck), pass);
      passDecks++;
      const top = surfaceZ(stage, deck, 0);
      const through = launch(f32(f32(surfaceLeft(stage, deck, 0) + surfaceRight(stage, deck, 0)) * 0.5), f32(top + 10.0), 0.0, -20.0);
      updateProjectiles(world, stage, 0);
      assertEquals(through.life, pass ? 29 : 0);
      through.life = 0;
    }
  }
  assertEquals(passDecks, 5);
});
