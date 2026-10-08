// Shadow Hunter's specials through the production special, projectile and
// contact path (smashcraft:docs/design/roster.md, "Shadow Hunter").
import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, HeroStatusGroup, HeroStatusKind, ProjectileKind, SpecialAction } from "../codes";
import { maskHeroStatusControls } from "../heroStatus";
import { canAttack } from "../conditions";
import { attackBuffer } from "../../input/attackBuffer";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { type Fighter, createFighter } from "../fighter";
import { advanceHeroStatus } from "../heroSpecialRules";
import { regenerateMana } from "../mana";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { advancePlacedObjects } from "../placedObjects";
import { updateProjectiles } from "../projectiles";
import { type Controls, type Roster, createRoster } from "../roster";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { advanceFighter } from "../step";
import { controls } from "../testWorld";
import { clearSpecialOnStock } from "../transitions";
import { copyFighterState } from "../../replay/fighterState";
import { firstFighterDifference } from "../../replay/difference";

function frame(world: Roster, first: Readonly<Controls> = controls(), second: Readonly<Controls> = controls()): void {
  const inputs = [first, second];
  for (let slot = 0; slot < 2; slot++) advanceFighter(world, slot, 0, inputs[slot] ?? controls(), slot === 0 ? -240.0 : 240.0);
  beginDamageContacts();
  for (let slot = 0; slot < 2; slot++) startFighterSpecial(world.fighters[slot]!, 0, 0, inputs[slot] ?? controls());
  resolveAttacks(world);
  advanceSpecials(world, 0, 0);
  updateProjectiles(world, 0, 0);
  advancePlacedObjects(world);
  finishDamageContacts(world);
  for (let slot = 0; slot < 2; slot++) {
    regenerateMana(world.fighters[slot]!);
    advanceHeroStatus(world.fighters[slot]!);
  }
}

function pair(gap: number, facing = 1): { world: Roster; owner: Fighter; target: Fighter } {
  const owner = createFighter(Character.shadowHunter, -gap * f32(0.5) * facing, facing);
  const target = createFighter(Character.archer, gap * f32(0.5) * facing, -facing);
  const world = createRoster(3, [owner, target]);
  for (let i = 0; i < 3; i++) frame(world);
  return { world, owner, target };
}

const neutral = controls({ specialPressed: true });
const up = controls({ specialPressed: true, specialZ: 1 });

const side = controls({ specialPressed: true, specialX: 1 });
const down = controls({ specialPressed: true, specialZ: -1 });
const near = (value: number, expected: number) => Math.abs(value - expected) <= f32(0.05);

test("Loa Vault vaults its listed 2.9H straight up by default, and its free form spends nothing for 2.0H [spec #189] [spec docs/design/roster.md]", () => {
  for (const [points, , drift, spent] of [[100, f32(2.9), 0.0, 15], [14, f32(2.0), 0.0, 0]] as const) {
    const { world, owner } = pair(900.0);
    owner.mana.points = points;
    const x0 = owner.motion.x;
    const z0 = owner.motion.z;
    let top = z0;
    frame(world, up);
    assertEquals(owner.mana.points, points - spent);
    for (let f = 2; f <= 30; f++) {
      frame(world);
      top = Math.max(top, owner.motion.z);
    }
    assertTrue(near((owner.motion.x - x0) / HERO_REFERENCE_HEIGHT, drift));
    assertTrue(owner.special.fall);
    frame(world, up);
    assertEquals(owner.special.action, SpecialAction.none);
  }
});

test("Spirit Glaive is free, leaves on frame 18, strikes once and frees the hunter after frame 40 [spec docs/design/roster.md]", () => {
  const { world, owner, target } = pair(300.0);
  frame(world, neutral);
  for (let f = 2; f <= 17; f++) frame(world);
  assertEquals(owner.projectiles.filter(p => p.life > 0).length, 0);
  frame(world);
  assertEquals(owner.projectiles.filter(p => p.life > 0 && p.kind === ProjectileKind.hero).length, 1);
  for (let f = 19; f <= 40; f++) frame(world);
  assertEquals(owner.special.action, SpecialAction.none);
  assertEquals(owner.mana.points, 100);
  assertEquals(target.status.damage, 6.0);
});

const glaives = (f: Readonly<Fighter>) => f.projectiles.filter(p => p.life > 0 && p.kind === ProjectileKind.hero);

test("Spirit Glaive turns back at age 22, is caught by Shadow Hunter, and only one flies at a time [spec docs/design/roster.md]", () => {
  const { world, owner } = pair(1200.0);
  frame(world, neutral);
  for (let f = 2; f <= 18; f++) frame(world);
  const glaive = glaives(owner)[0]!;
  assertGreaterThan(glaive.velocityX, 0.0);
  for (let f = 19; f <= 41; f++) frame(world);
  assertLessThan(glaive.velocityX, 0.0);
  assertEquals(owner.special.action, SpecialAction.none);
  frame(world, neutral);
  assertEquals(owner.special.action, SpecialAction.none);
  for (let f = 0; f < 40 && glaive.life > 0; f++) frame(world);
  assertEquals(glaive.life, 0);
  assertEquals(owner.status.damage, 0.0);
  frame(world, neutral);
  assertEquals(owner.special.action, SpecialAction.heroNeutral);
});

test("the returning Spirit Glaive strikes a fighter between it and Shadow Hunter for 5, knocking it toward him [spec docs/design/roster.md]", () => {
  const { world, owner, target } = pair(1200.0);
  frame(world, neutral);
  for (let f = 2; f <= 45; f++) frame(world);
  const glaive = glaives(owner)[0]!;
  assertLessThan(glaive.velocityX, 0.0);
  target.motion.x = f32(glaive.x - 50.0);
  for (let f = 0; f < 10 && target.status.damage === 0.0; f++) frame(world);
  assertEquals(target.status.damage, 5.0);
  assertLessThan(target.launch.knockbackX, 0.0);
});

test("Hex costs 25 and its orb leaves on frame 24 and strikes for 2 [spec docs/design/roster.md]", () => {
  const { world, owner, target } = pair(200.0);
  frame(world, down);
  assertEquals(owner.mana.points, 75);
  for (let f = 2; f <= 23; f++) frame(world);
  assertEquals(owner.projectiles.filter(p => p.life > 0).length, 0);
  for (let f = 24; f <= 53; f++) frame(world);
  assertEquals(target.status.damage, 2.0);
  assertEquals(owner.special.action, SpecialAction.none);
});

/** Casts Serpent Ward and runs to its appearance on frame 26. */
function placeWard(world: Roster): void {
  frame(world, side);
  for (let f = 2; f <= 26; f++) frame(world);
}

test("Serpent Ward is ground-only (an airborne side press throws Spirit Glaive), costs 20, stands 0.65H ahead from frame 26 and fires straight at ages 45, 85, 125, 165 and 205 [spec docs/design/roster.md]", () => {
  const { world, owner, target } = pair(300.0);
  owner.motion.grounded = false;
  owner.motion.z = 200.0;
  frame(world, side);
  assertEquals(owner.special.action, SpecialAction.heroNeutral);
  assertEquals(owner.placed.life, 0);
  assertEquals(owner.mana.points, 100);
  for (let f = 0; f < 240 && !owner.motion.grounded; f++) frame(world);
  for (let f = 0; f < 30; f++) frame(world);
  frame(world, side);
  for (let f = 2; f <= 25; f++) frame(world);
  assertEquals(owner.placed.life, 0);
  frame(world);
  assertEquals(owner.mana.points, 80);
  // The appearance frame is its age 1; it stands 240 frames.
  assertEquals(owner.placed.age, 1);
  assertEquals(owner.placed.life, 239);
  assertTrue(near((owner.placed.x - owner.motion.x) / HERO_REFERENCE_HEIGHT, f32(0.65)));
  const fired: number[] = [];
  let wasFlying = 0;
  for (let age = 2; age <= 240; age++) {
    frame(world);
    const flying = owner.projectiles.filter(p => p.life > 0 && p.kind === ProjectileKind.hero).length;
    if (flying > wasFlying) fired.push(owner.placed.age);
    wasFlying = flying;
    if (age === 239) assertGreaterThan(owner.placed.life, 0);
  }
  assertEquals(fired.join(","), "45,85,125,165,205");
  assertEquals(owner.placed.life, 0);
  assertGreaterThan(target.status.damage, 0.0);
});

test("two intentional forward smashes clear a ward, each striking it once [spec docs/design/roster.md]", () => {
  const { world, owner, target } = pair(400.0);
  placeWard(world);
  target.motion.x = f32(owner.placed.x + 70.0);
  target.facing = -1;
  let strikes = 0;
  for (let attack = 0; attack < 2 && owner.placed.life > 0; attack++) {
    beginFighterAttack(world, 1, AttackStyle.forwardSmash, false);
    for (let f = 0; f < 60; f++) {
      const before = owner.placed.durability;
      frame(world);
      if (owner.placed.durability < before) strikes++;
    }
  }
  assertEquals(owner.placed.life, 0);
  assertTrue(strikes >= 1 && strikes <= 2);
});

test("recasting with a ward standing recalls it for free once the same cast completes [spec docs/design/roster.md]", () => {
  const { world, owner } = pair(600.0);
  placeWard(world);
  for (let f = 27; f <= 60; f++) frame(world);
  const mana = owner.mana.points;
  frame(world, side);
  assertEquals(owner.special.action, SpecialAction.heroSide);
  assertEquals(owner.mana.points, mana);
  for (let f = 2; f <= 51; f++) frame(world);
  assertGreaterThan(owner.placed.life, 0);
  frame(world);
  assertEquals(owner.placed.life, 0);
  frame(world, side);
  assertEquals(owner.mana.points, mana - 20);
});

test("a lost stock removes the ward [spec docs/design/roster.md]", () => {
  const { world, owner } = pair(600.0);
  placeWard(world);
  clearSpecialOnStock(owner);
  assertEquals(owner.placed.life, 0);
});

test("replaying a ward from a restored snapshot reproduces every fighter field [invariant]", () => {
  const { world, owner, target } = pair(400.0);
  placeWard(world);
  const savedOwner = createFighter(Character.shadowHunter, 0.0, 1);
  const savedTarget = createFighter(Character.archer, 0.0, 1);
  copyFighterState(savedOwner, owner, 3);
  copyFighterState(savedTarget, target, 3);
  const run = () => {
    for (let f = 0; f < 140; f++) frame(world, f === 10 ? neutral : controls());
  };
  run();
  const endOwner = createFighter(Character.shadowHunter, 0.0, 1);
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

/** Hexes the target with an orb from 200 away. */
function hexed(): { world: Roster; owner: Fighter; target: Fighter } {
  const p = pair(200.0);
  frame(p.world, down);
  for (let f = 2; f <= 53 && p.target.status.condition === HeroStatusKind.none; f++) frame(p.world);
  assertEquals(p.target.status.condition, HeroStatusKind.hex);
  return p;
}

/** Frames until the hex ends, with the masking and mashing a match applies to the target's input `mash(frame)`. */
function framesHexed(world: Roster, target: Fighter, mash: (frame: number) => Readonly<Controls>): number {
  const commands = attackBuffer(0);
  for (let f = 1; f <= 200; f++) {
    const input = { ...mash(f) };
    maskHeroStatusControls(target, input, commands);
    frame(world, controls(), input);
    if (target.status.condition !== HeroStatusKind.hex) return f;
  }
  return 200;
}

test("Hex stops attacks, grabs and neutral, side and down specials for 50 frames; up special, jump and shield stay [spec docs/design/roster.md]", () => {
  const { world, target } = hexed();
  const commands = attackBuffer(0);
  for (const [press, kept] of [[neutral, false], [side, false], [down, false], [up, true]] as const) {
    const input = { ...press };
    maskHeroStatusControls(target, input, commands);
    assertEquals(input.specialPressed, kept);
  }
  const attack = { ...controls({ attackRequested: true, attackPressed: true, jumpPressed: true, shield: true }) };
  maskHeroStatusControls(target, attack, commands);
  assertFalse(attack.attackRequested);
  assertFalse(attack.attackPressed);
  assertTrue(attack.jumpPressed && attack.shield);
  const fresh = hexed();
  // The frame that applied it already counted one of its 50.
  assertEquals(framesHexed(fresh.world, fresh.target, () => controls()), 49);
  assertEquals(fresh.target.status.conditionImmunity[HeroStatusGroup.silence], 240);
});

test("a hexed fighter mashes out sooner but never before frame 36, and immunity stops a second Hex [spec docs/design/roster.md]", () => {
  const { world, owner, target } = hexed();
  const woke = framesHexed(world, target, (f) => controls({ grabMashPressed: floorMod(f, 2) === 0, direction: floorMod(f, 4) < 2 ? 1 : -1 }));
  assertLessThan(woke, 46);
  assertGreaterThan(woke, 33);
  owner.mana.points = 100;
  target.motion.x = f32(owner.motion.x + f32(owner.facing * 150.0));
  frame(world, down);
  for (let f = 2; f <= 53; f++) frame(world);
  assertEquals(target.status.condition, HeroStatusKind.none);
});

test("a shielded Hex orb applies no Hex [spec docs/design/roster.md]", () => {
  const { world, owner, target } = pair(200.0);
  frame(world, down, controls({ shield: true }));
  for (let f = 2; f <= 53; f++) frame(world, controls(), controls({ shield: true }));
  assertTrue(owner.projectiles.every(p => p.life <= 0));
  assertEquals(target.status.condition, HeroStatusKind.none);
});

test("Loa Vault's startup aim sends it 2.9H level back toward the stage when the stick is held there [spec #189] [spec docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    const { world, owner } = pair(1200.0, facing);
    owner.motion.grounded = false;
    owner.motion.surface = undefined;
    owner.motion.z = 600.0;
    const startX = owner.motion.x;
    frame(world, controls({ specialPressed: true, specialZ: 1, verticalDirection: 1 }));
    assertEquals(owner.special.action, SpecialAction.heroUp);
    const startZ = owner.motion.z;
    for (let f = 2; f <= 26; f++) frame(world, controls({ direction: f <= 8 ? -facing : 0 }));
    assertGreaterThan(f32(f32(startX - owner.motion.x) * facing), 0.0);
    assertTrue(Math.abs(f32(owner.motion.z - startZ)) <= 1.0);
  }
});

test("Shadow Hunter cashes a Hex: a point-blank or spaced Hex leaves him time to walk in and thrust before a fast-mashing target wakes (#105, #133) [spec docs/design/roster.md]", () => {
  for (const gap of [90.0, 200.0]) {
    const { world, owner, target } = pair(gap);
    const commands = attackBuffer(0);
    // The target mashes as fast as the rule rewards: a press every other frame and a new stick direction.
    const mash = (f: number) => controls({ grabMashPressed: floorMod(f, 2) === 0, direction: floorMod(f, 4) < 2 ? 1 : -1 });
    frame(world, down);
    let f = 1;
    for (; f <= 53 && target.status.condition !== HeroStatusKind.hex; f++) frame(world);
    assertEquals(target.status.condition, HeroStatusKind.hex);
    const before = target.status.damage;
    let cashed = false;
    for (let n = 1; n <= 60 && !cashed && target.status.condition === HeroStatusKind.hex; n++) {
      const reach = Math.abs(f32(target.motion.x - owner.motion.x)) <= 130.0;
      const free = owner.special.action === SpecialAction.none && canAttack(owner);
      if (free && reach && owner.attack.style === undefined) beginFighterAttack(world, 0, AttackStyle.forwardTilt, false);
      const input = { ...mash(n) };
      maskHeroStatusControls(target, input, commands);
      frame(world, free && !reach ? controls({ direction: owner.facing }) : controls(), input);
      cashed = target.status.damage > before;
    }
    assertTrue(cashed);
  }
});
