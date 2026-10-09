import { assertEquals, assertGreaterThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, SpecialAction } from "./codes";
import { createFighter, placedObject, type Fighter } from "./fighter";
import { mutableProjectile } from "./fighterProjectiles";
import { runningHeroSpecial } from "./heroSpecialRules";
import { CompanionMode, SpecialForm, SpecialSlot, specialKit } from "./heroSpecials";
import { advancePlacedObjects } from "./placedObjects";
import { heroProjectileRadius, updateProjectiles } from "./projectiles";
import { type Roster } from "./roster";
import { advanceSpecials, startFighterSpecial } from "./specials";
import { advanceFighter } from "./step";
import { controls, testWorld } from "./testWorld";
import { THRALL_SPECIALS } from "./heroes/thrallSpecials";

function scene(character: Character) {
  const owner = createFighter(character, 0.0, 1);
  const target = createFighter(Character.rifleman, 1000.0, -1);
  const world = testWorld(owner, target);
  owner.motion.grounded = true;
  owner.mana.points = 100;
  return { owner, target, world };
}

function cast(owner: Fighter, world: Roster, slot: number, ex: boolean): void {
  const input = controls({ specialPressed: true, specialX: slot === SpecialSlot.side ? 1 : 0,
    specialZ: slot === SpecialSlot.up ? 1 : slot === SpecialSlot.down ? -1 : 0, shield: ex });
  assertTrue(startFighterSpecial(owner, 0, 0, input, world));
  assertEquals(owner.special.ex, ex);
}

function timeline(world: Roster, frames: number): void {
  for (let frame = 0; frame < frames; frame++) advanceSpecials(world, 0, frame);
}

test("command heroes' projectile EX casts and air forms deal 25% more through body contacts [spec #329]", () => {
  const cases = [
    [Character.beastmaster, SpecialSlot.neutral, false],
    [Character.beastmaster, SpecialSlot.side, false],
    [Character.lichKing, SpecialSlot.neutral, false],
    [Character.lichKing, SpecialSlot.neutral, true],
    [Character.lichKing, SpecialSlot.side, false],
    [Character.lichKing, SpecialSlot.side, true],
    [Character.thrall, SpecialSlot.neutral, false],
    [Character.thrall, SpecialSlot.side, true],
    [Character.jaina, SpecialSlot.neutral, true],
    [Character.jaina, SpecialSlot.side, false],
  ] as const;
  for (const [character, slot, air] of cases) {
    const damage: number[] = [];
    for (const ex of [false, true]) {
      const { owner, target, world } = scene(character);
      owner.motion.grounded = !air;
      owner.motion.z = air ? 200.0 : 0.0;
      if (character === Character.beastmaster && slot === SpecialSlot.side) {
        cast(owner, world, slot, false);
        timeline(world, 70);
        owner.attack.cooldown = 0;
        owner.special.lockFrames = 0;
      }
      cast(owner, world, slot, ex);
      const move = runningHeroSpecial(owner);
      const spec = move?.projectiles?.[0];
      assertTrue(spec !== undefined);
      if (spec === undefined) continue;
      timeline(world, spec.spawnFrame);
      const index = owner.projectiles.findIndex(projectile => projectile.life > 0 && projectile.spec === spec);
      assertTrue(index >= 0);
      const projectile = mutableProjectile(owner, index);
      projectile.life = spec.life - (spec.activeFrom ?? 0);
      target.motion.x = f32(projectile.x + projectile.velocityX);
      target.motion.z = f32(f32(projectile.z + projectile.velocityZ) - 45.0);
      target.motion.grounded = false;
      updateProjectiles(world);
      assertGreaterThan(target.status.damage, 0.0);
      damage.push(target.status.damage);
    }
    assertNear(damage[1] ?? 0.0, f32((damage[0] ?? 0.0) * 1.25), f32(0.0001));
  }
});

test("EX Bear, Quilbeast, Hawk and Water Elemental keep stronger placements after the cast ends [spec #329]", () => {
  for (const [character, slot, animal] of [
    [Character.beastmaster, SpecialSlot.side, 0],
    [Character.beastmaster, SpecialSlot.down, 1],
    [Character.beastmaster, SpecialSlot.up, 2],
    [Character.jaina, SpecialSlot.down, 0],
  ] as const) {
    const { owner, target, world } = scene(character);
    const basePlacement = owner.tuning.specials === undefined ? undefined : specialKit(owner.tuning.specials, slot).ground.placement;
    assertTrue(basePlacement !== undefined);
    cast(owner, world, slot, true);
    const move = runningHeroSpecial(owner);
    const placement = move?.placement;
    assertTrue(placement !== undefined);
    if (placement === undefined) continue;
    timeline(world, move?.endFrame ?? 0);
    assertEquals(owner.special.action, SpecialAction.none);
    const placed = placedObject(owner, animal);
    assertEquals(placed.durability, f32((basePlacement?.durability ?? 0.0) * 1.25));
    assertEquals(placed.spec, placement);
    owner.special.ex = false;
    if (placement.shot !== undefined) {
      placed.age = (placement.fireAges[0] ?? 1) - 1;
      advancePlacedObjects(world);
      const shot = placement.shot;
      const projectile = owner.projectiles.find(projectile => projectile.life > 0 && projectile.spec === shot);
      assertTrue(projectile !== undefined);
      if (projectile === undefined) continue;
      target.motion.x = f32(projectile.x + projectile.velocityX);
      target.motion.z = f32(f32(projectile.z + projectile.velocityZ) - 45.0);
      updateProjectiles(world);
      const baseShot = basePlacement?.shot;
      assertTrue(baseShot !== undefined);
      assertEquals(target.status.damage, f32((baseShot?.effect.damage ?? 0.0) * 1.25));
    } else if (animal === 0) {
      const partner = placement.companion;
      assertTrue(partner !== undefined);
      if (partner === undefined) continue;
      placed.mode = CompanionMode.lunge;
      placed.modeFrame = partner.lungeStartup;
      placed.direction = 1;
      target.motion.x = f32(placed.x + f32(partner.lungeTravel / partner.lungeActive));
      timeline(world, 1);
      assertEquals(target.status.damage, f32((basePlacement?.companion?.biteEffect.damage ?? 0.0) * 1.25));
    }
  }
});

test("EX Hawk Dive, Quill Volley and Water Elemental recall protect their first four entry frames [spec #329]", () => {
  for (const [character, slot] of [[Character.beastmaster, SpecialSlot.up], [Character.beastmaster, SpecialSlot.down], [Character.jaina, SpecialSlot.down]] as const) {
    const { owner, world } = scene(character);
    cast(owner, world, slot, false);
    timeline(world, 70);
    owner.attack.cooldown = 0;
    owner.special.lockFrames = 0;
    owner.mana.points = 100;
    cast(owner, world, slot, true);
    assertEquals(owner.special.form, SpecialForm.recall);
    const protection: boolean[] = [];
    for (let frame = 0; frame <= 4; frame++) {
      advanceFighter(world, 0, 0, controls(), 0.0);
      protection.push(owner.status.invincible > 0);
      advanceSpecials(world, 0, frame);
    }
    assertEquals(protection.slice(0, 4).filter(protectedFrame => protectedFrame).length, 4);
    assertEquals(protection[4], false);
  }
});

test("command heroes' EX recovery motion rises and steers 25% farther with the same timeline [spec #329]", () => {
  for (const character of [Character.beastmaster, Character.lichKing, Character.thrall, Character.jaina]) {
    const travel: number[][] = [];
    for (const ex of [false, true]) {
      const { owner, world } = scene(character);
      owner.motion.grounded = false;
      owner.motion.z = 1000.0;
      cast(owner, world, SpecialSlot.up, ex);
      const move = runningHeroSpecial(owner);
      let x = 0.0;
      let z = 0.0;
      for (let frame = 1; frame <= (move?.endFrame ?? 0); frame++) {
        advanceSpecials(world, 0, frame, [controls({ direction: 1 })]);
        if (move?.motion?.some(segment => frame >= segment.first && frame <= segment.last)) {
          x = f32(x + owner.motion.vx);
          z = f32(z + owner.motion.vz);
        }
      }
      assertTrue(owner.special.fall);
      travel.push([x, z, move?.endFrame ?? 0]);
    }
    assertNear(travel[1]?.[0] ?? 0.0, f32((travel[0]?.[0] ?? 0.0) * 1.25), f32(0.001));
    assertNear(travel[1]?.[1] ?? 0.0, f32((travel[0]?.[1] ?? 0.0) * 1.25), f32(0.001));
    assertEquals(travel[1]?.[2], travel[0]?.[2]);
  }
});

test("EX Defile grows its radius and cap together while keeping its pulse interval [spec #329]", () => {
  const radii: number[][] = [];
  for (const ex of [false, true]) {
    const { owner, target, world } = scene(Character.lichKing);
    cast(owner, world, SpecialSlot.down, ex);
    const spec = runningHeroSpecial(owner)?.projectiles?.[0];
    assertTrue(spec !== undefined);
    if (spec === undefined) continue;
    timeline(world, spec.spawnFrame);
    const index = owner.projectiles.findIndex(projectile => projectile.life > 0 && projectile.spec === spec);
    const projectile = mutableProjectile(owner, index);
    const initial = heroProjectileRadius(projectile, spec);
    target.motion.x = projectile.x;
    projectile.life = spec.life - (spec.activeFrom ?? 0);
    updateProjectiles(world);
    assertEquals(target.status.damage, spec.effect.damage);
    const firstGrowth = f32(heroProjectileRadius(projectile, spec) - initial);
    projectile.poolHits = 100;
    radii.push([initial, firstGrowth, heroProjectileRadius(projectile, spec), spec.pool?.every ?? 0]);
  }
  for (const component of [0, 1, 2]) assertNear(radii[1]?.[component] ?? 0.0, f32((radii[0]?.[component] ?? 0.0) * 1.25), f32(0.001));
  assertEquals(radii[1]?.[3], radii[0]?.[3]);
});

test("EX Earthquake reaches outside the ordinary strike on both sides [spec #329]", () => {
  for (const side of [-1, 1]) {
    const damage: number[] = [];
    for (const ex of [false, true]) {
      const { owner, target, world } = scene(Character.thrall);
      target.motion.x = f32(side * 180.0);
      cast(owner, world, SpecialSlot.down, ex);
      timeline(world, 21);
      damage.push(target.status.damage);
    }
    assertEquals(damage[0], 0.0);
    assertEquals(damage[1], THRALL_SPECIALS.down.ground.regions?.[0]?.hit.effect.damage);
  }
});
