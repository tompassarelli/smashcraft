import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { upSpecialRoute } from "../../match/recoveryEnvelope";
import { resolveAttacks } from "../attacks";
import { Character, SpecialAction } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { type Fighter, createFighter, placedObject } from "../fighter";
import { advanceHeroStatus } from "../heroSpecialRules";
import { advancePlacedObjects } from "../placedObjects";
import { updateProjectiles } from "../projectiles";
import { type Controls, type Roster, createRoster } from "../roster";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { advanceFighter } from "../step";
import { controls } from "../testWorld";
import { copyFighterState } from "../../replay/fighterState";
import { firstFighterDifference } from "../../replay/difference";

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
  const target = createFighter(Character.rifleman, f32(gap * 0.5 * facing), -facing);
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

test("rollback restores Beastmaster's three separate companion positions and commands [invariant]", () => {
  const { world, owner, target } = withPack();
  frame(world, down);
  run(world, 8);
  const savedOwner = createFighter(Character.beastmaster, 0.0, 1);
  const savedTarget = createFighter(Character.rifleman, 0.0, 1);
  copyFighterState(savedOwner, owner, 3);
  copyFighterState(savedTarget, target, 3);
  run(world, 55);
  const expectedOwner = createFighter(Character.beastmaster, 0.0, 1);
  const expectedTarget = createFighter(Character.rifleman, 0.0, 1);
  copyFighterState(expectedOwner, owner, 3);
  copyFighterState(expectedTarget, target, 3);
  copyFighterState(owner, savedOwner, 3);
  copyFighterState(target, savedTarget, 3);
  run(world, 55);
  assertEquals(firstFighterDifference(expectedOwner, owner, 3, 3), undefined);
  assertEquals(firstFighterDifference(expectedTarget, target, 3, 3), undefined);
});
