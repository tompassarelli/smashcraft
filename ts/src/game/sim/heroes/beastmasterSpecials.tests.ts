import { mutableProjectile } from "../fighterProjectiles";
import { assertEquals, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { upSpecialRoute } from "../../match/recoveryEnvelope";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, SpecialAction } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { type Fighter, createFighter, placedObject } from "../fighter";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { CompanionMode } from "../heroSpecials";
import { advanceHeroStatus } from "../heroSpecialRules";
import { advancePlacedObjects } from "../placedObjects";
import { updateProjectiles } from "../projectiles";
import { type Controls, type Roster, createRoster } from "../roster";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { advanceFighter } from "../step";
import { controls } from "../testWorld";
import { clearSpecialOnStock } from "../transitions";
import { copyFighterState } from "../../replay/fighterState";
import { firstFighterDifference } from "../../replay/difference";
import { BEAR, HAWK, QUILL, STAMPEDE, WILD_AXES } from "./beastmasterSpecials";

const H = HERO_REFERENCE_HEIGHT;
const neutral = controls({ specialPressed: true });
const side = controls({ specialPressed: true, specialX: 1 });
const up = controls({ specialPressed: true, specialZ: 1 });
const down = controls({ specialPressed: true, specialZ: -1 });

function frame(world: Roster, first: Readonly<Controls> = controls(), second: Readonly<Controls> = controls()): void {
  const inputs = [first, second];
  for (let slot = 0; slot < 2; slot++) advanceFighter(world, slot, 0, inputs[slot] ?? controls(), slot === 0 ? -240.0 : 240.0);
  beginDamageContacts();
  for (let slot = 0; slot < 2; slot++) startFighterSpecial(world.fighters[slot]!, 0, 0, inputs[slot] ?? controls());
  resolveAttacks(world);
  advanceSpecials(world, 0, 0);
  updateProjectiles(world);
  finishDamageContacts(world);
  advancePlacedObjects(world);
  for (let slot = 0; slot < 2; slot++) {
    advanceHeroStatus(world.fighters[slot]!);
  }
}

function pair(gap = 1000.0, facing = 1): { world: Roster; owner: Fighter; target: Fighter } {
  const owner = createFighter(Character.beastmaster, f32(-gap * 0.5 * facing), facing);
  owner.mana.points = 100;
  const target = createFighter(Character.archer, f32(gap * 0.5 * facing), -facing);
  const world = createRoster(3, [owner, target]);
  for (let i = 0; i < 3; i++) frame(world);
  owner.mana.points = 100;
  return { world, owner, target };
}
function run(world: Roster, frames: number, press?: Readonly<Controls>): void {
  for (let f = 1; f <= frames; f++) frame(world, f === 1 && press !== undefined ? press : controls());
}
function withBear(gap = 1000.0, facing = 1) {
  const scene = pair(gap, facing);
  run(scene.world, 74, controls({ specialPressed: true, specialX: facing }));
  return scene;
}
function withPack() {
  const scene = withBear();
  run(scene.world, 40, down);
  run(scene.world, 30, up);
  return scene;
}

test("Beastmaster summons Bear on frame 24, Quilbeast on 18 and Hawk on 12 without replacing another animal [spec docs/design/beastmaster.md]", () => {
  const { world, owner } = pair();
  run(world, 23, side);
  assertEquals(owner.mana.points, 100);
  assertEquals(owner.placed.life, 0);
  frame(world);
  assertEquals(owner.placed.durability, 30.0);
  run(world, 20);
  assertEquals(owner.special.action, SpecialAction.none);
  run(world, 17, down);
  assertEquals(placedObject(owner, 1).life, 0);
  frame(world);
  assertEquals(placedObject(owner, 1).durability, 18.0);
  run(world, 14);
  run(world, 11, up);
  assertEquals(placedObject(owner, 2).life, 0);
  frame(world);
  assertEquals(placedObject(owner, 2).durability, 12.0);
  assertGreaterThan(owner.placed.life, 0);
  assertGreaterThan(placedObject(owner, 1).life, 0);
  assertGreaterThan(placedObject(owner, 2).z, owner.motion.z);
});

test("Beastmaster's Bear follows, Quilbeast holds its firing position, and Hawk follows above independently [spec docs/design/beastmaster.md]", () => {
  const { world, owner } = withPack();
  const quilX = placedObject(owner, 1).x;
  owner.motion.x = f32(owner.motion.x + 200.0);
  frame(world);
  assertEquals(placedObject(owner, 1).x, quilX);
  run(world, 100);
  assertNear(f32(owner.motion.x - owner.placed.x), BEAR.followBehind, 1.0);
  assertNear(f32(placedObject(owner, 2).z - owner.motion.z), HAWK.followHeight ?? 0.0, 1.0);
});

test("Beastmaster Stampede commands Bear and sends two thunder lizards; Bear bites once in both facings [spec docs/design/beastmaster.md]", () => {
  for (const facing of [1, -1]) {
    const { world, owner, target } = withBear(f32(H * f32(1.4)), facing);
    owner.placed.x = f32(target.motion.x - f32(facing * f32(H * f32(0.9))));
    frame(world, controls({ specialPressed: true, specialX: facing }));
    run(world, 3);
    assertEquals(owner.placed.mode, CompanionMode.lunge);
    let lizards = 0;
    let serials = 0;
    for (let f = 0; f < 55; f++) {
      frame(world);
      for (const p of owner.projectiles) if (p.life > 0 && (p.spec === STAMPEDE[0] || p.spec === STAMPEDE[1])) serials |= p.spec === STAMPEDE[0] ? 1 : 2;
      if ((owner.placed.bitten & 2) !== 0) lizards++;
    }
    assertEquals(serials, 3);
    assertGreaterThan(lizards, 0);
    assertGreaterThan(target.status.damage, 11.0);
    assertEquals(owner.placed.mode, CompanionMode.follow);
  }
});

test("striking Beastmaster's lunging animal stuns it and each animal can be destroyed separately [spec docs/design/beastmaster.md]", () => {
  const { world, owner, target } = withPack();
  const quil = placedObject(owner, 1);
  owner.placed.x = -600.0;
  quil.x = 0.0;
  quil.durability = 1.0;
  target.motion.x = 45.0;
  target.facing = -1;
  beginFighterAttack(world, 1, AttackStyle.jab, false);
  run(world, 12);
  assertEquals(quil.life, 0);
  assertGreaterThan(owner.placed.life, 0);
  assertGreaterThan(placedObject(owner, 2).life, 0);
  owner.placed.x = f32(target.motion.x - 45.0);
  owner.placed.mode = CompanionMode.lunge;
  owner.placed.modeFrame = 0;
  target.attack.cooldown = 0;
  beginFighterAttack(world, 1, AttackStyle.jab, false);
  let stunned = false;
  for (let f = 0; f < 12; f++) { frame(world); if (owner.placed.mode === CompanionMode.stunned) stunned = true; }
  assertTrue(stunned);
});

test("Beastmaster Quilbeast fires from its own location, then a command gives three separated quills [spec docs/design/beastmaster.md]", () => {
  const { world, owner } = pair();
  run(world, 40, down);
  const quil = placedObject(owner, 1);
  assertTrue(owner.projectiles.some(p => p.life > 0 && p.spec === QUILL));
  run(world, 30);
  owner.motion.x = f32(owner.motion.x - 80.0);
  const before = owner.mana.points;
  frame(world, down);
  assertEquals(owner.mana.points, before);
  let shots = 0;
  for (let f = 0; f < 48; f++) {
    frame(world);
    for (const p of owner.projectiles) if (p.spec === QUILL && p.life === QUILL.life - 1) {
      assertNear(p.x, f32(f32(quil.x + QUILL.offsetX) + QUILL.velocityX), 1.0);
      shots++;
    }
  }
  assertEquals(shots, 3);
  for (let index = 0; index < owner.projectiles.length; index++) mutableProjectile(owner, index).life = 0;
  quil.mode = CompanionMode.stunned;
  quil.modeFrame = 0;
  quil.age = 107;
  frame(world);
  assertEquals(owner.projectiles.filter(p => p.life > 0).length, 0);
});

test("Beastmaster Hawk Dive leaves its perch and launches a target upward in both facings [spec docs/design/beastmaster.md]", () => {
  for (const facing of [1, -1]) {
    const { world, owner, target } = pair(1000.0, facing);
    run(world, 30, up);
    const hawk = placedObject(owner, 2);
    target.motion.x = f32(hawk.x + f32(facing * H));
    const high = hawk.z;
    frame(world, controls({ specialPressed: true, specialZ: 1, specialX: 0, direction: facing }));
    run(world, 12);
    assertLessThan(hawk.z, high);
    let rise = 0.0;
    for (let f = 0; f < 30; f++) { frame(world); rise = Math.max(rise, target.launch.knockbackZ); }
    assertEquals(target.status.damage, 5.399999618530273);
    assertGreaterThan(rise, 0.0);
  }
});

test("Beastmaster Wild Axes are free, throw twice and return toward the moving owner [spec #335]", () => {
  const { world, owner, target } = pair();
  frame(world, neutral);
  assertEquals(owner.mana.points, 100);
  run(world, 19);
  assertEquals(owner.projectiles.filter(p => p.life > 0 && (p.spec === WILD_AXES[0] || p.spec === WILD_AXES[1])).length, 2);
  run(world, 20);
  owner.motion.x = -550.0;
  target.motion.x = -200.0;
  let returning = false;
  let pulled = false;
  for (let f = 0; f < 30; f++) {
    frame(world);
    if (owner.projectiles.some(p => p.life > 0 && p.velocityX < 0.0)) returning = true;
    if (target.launch.knockbackX < 0.0) pulled = true;
  }
  assertTrue(returning);
  assertGreaterThan(target.status.damage, 0.0);
  assertTrue(pulled);
});

test("Beastmaster Hawk Lift rises 380–520 and reaches 600–900, its free route at least 240 on each axis; Hawk survives the helpless fall [spec #335]", () => {
  for (const mana of [100, 10]) {
    const route = upSpecialRoute(Character.beastmaster, mana);
    assertTrue(route.rise >= 380.0 && route.rise <= 520.0);
    assertTrue(route.reach >= 600.0 && route.reach <= 900.0);
    const { world, owner } = pair();
    owner.motion.grounded = false;
    owner.motion.surface = undefined;
    owner.motion.z = 100.0;
    owner.motion.vz = 0.0;
    owner.mana.points = mana;
    frame(world, up);
    assertEquals(owner.mana.points, mana);
    for (let f = 2; f <= 33; f++) frame(world);
    assertTrue(owner.special.fall);
    assertEquals(owner.jump.remaining, 0);
    assertGreaterThan(placedObject(owner, 2).life, 0);
    frame(world, up);
    assertEquals(owner.special.action, SpecialAction.none);
  }
});

test("Beastmaster's hitstun cancels every companion command and a stock clears the whole pack [spec docs/design/beastmaster.md]", () => {
  const { world, owner, target } = withPack();
  for (let animal = 0; animal < 3; animal++) { placedObject(owner, animal).mode = CompanionMode.lunge; placedObject(owner, animal).modeFrame = 0; }
  owner.launch.hitstun = 40;
  const damage = target.status.damage;
  run(world, 30);
  for (let animal = 0; animal < 3; animal++) assertEquals(placedObject(owner, animal).mode, CompanionMode.follow);
  assertEquals(target.status.damage, damage);
  clearSpecialOnStock(owner);
  for (let animal = 0; animal < 3; animal++) assertEquals(placedObject(owner, animal).life, 0);
});

test("rollback restores Beastmaster's three separate companion positions and commands [invariant]", () => {
  const { world, owner, target } = withPack();
  frame(world, down);
  run(world, 8);
  const savedOwner = createFighter(Character.beastmaster, 0.0, 1);
  const savedTarget = createFighter(Character.archer, 0.0, 1);
  copyFighterState(savedOwner, owner, 3);
  copyFighterState(savedTarget, target, 3);
  run(world, 55);
  const expectedOwner = createFighter(Character.beastmaster, 0.0, 1);
  const expectedTarget = createFighter(Character.archer, 0.0, 1);
  copyFighterState(expectedOwner, owner, 3);
  copyFighterState(expectedTarget, target, 3);
  copyFighterState(owner, savedOwner, 3);
  copyFighterState(target, savedTarget, 3);
  run(world, 55);
  assertEquals(firstFighterDifference(expectedOwner, owner, 3, 3), undefined);
  assertEquals(firstFighterDifference(expectedTarget, target, 3, 3), undefined);
});
