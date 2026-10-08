import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, ProjectileKind, SpecialAction } from "./codes";
import { createFighter } from "./fighter";
import { advanceHeroSpecial, runningHeroSpecial } from "./heroSpecialRules";
import { SpecialSlot } from "./heroSpecials";
import { advancePlacedObjects } from "./placedObjects";
import { heroProjectileRadius, projectileDamage } from "./projectiles";
import { advanceSpecials, startFighterSpecial } from "./specials";
import { advanceFighter } from "./step";
import { controls, testWorld } from "./testWorld";
import { cancelSpecialState } from "./transitions";
import { mutableProjectile } from "./fighterProjectiles";

const heroes = [Character.forsakenPaladin, Character.dreadlord, Character.shadowHunter, Character.pitLord] as const;

function cast(character: Character, slot: SpecialSlot, ex: boolean, air = false) {
  const owner = createFighter(character, 0.0, 1);
  const target = createFighter(Character.rifleman, 900.0, -1);
  const world = testWorld(owner, target);
  owner.mana.points = 100;
  owner.motion.grounded = !air;
  if (air) { owner.motion.surface = undefined; owner.motion.z = 1000.0; }
  const input = controls({ specialPressed: true, shield: ex, specialX: slot === SpecialSlot.side ? 1 : 0,
    specialZ: slot === SpecialSlot.up ? 1 : slot === SpecialSlot.down ? -1 : 0 });
  assertTrue(startFighterSpecial(owner, 0, 0, input, world));
  assertEquals(owner.special.ex, ex);
  return { owner, target, world };
}

function projectile(character: Character, slot: SpecialSlot, ex: boolean, air = false, index = 0) {
  const state = cast(character, slot, ex, air);
  const spec = runningHeroSpecial(state.owner)?.projectiles?.[index];
  if (spec === undefined) throw new Error("cast has no projectile");
  state.owner.special.frame = spec.spawnFrame;
  advanceHeroSpecial(state.owner);
  const shotIndex = state.owner.projectiles.findIndex(p => p.life > 0 && p.kind === ProjectileKind.hero);
  assertTrue(shotIndex >= 0);
  const shot = mutableProjectile(state.owner, shotIndex);
  cancelSpecialState(state.owner);
  return { ...state, shot, spec };
}

test("Paladin hammer and Fury and Pit Lord charge deal 25% more in ground and air contacts with the same launch [spec docs/design/mana.md]", () => {
  for (const [character, slot, frame, x, baseDamage, bodyScale] of [[Character.forsakenPaladin, SpecialSlot.neutral, 14, 80.0, 13.0, f32(0.8)],
    [Character.forsakenPaladin, SpecialSlot.side, 15, 80.0, 14.0, f32(0.8)], [Character.pitLord, SpecialSlot.side, 19, 60.0, 15.0, 1.0]] as const) {
    for (const air of [false, true]) {
      const normal = cast(character, slot, false, air);
      const ex = cast(character, slot, true, air);
      for (const state of [normal, ex]) {
        state.target.motion.x = x;
        state.target.motion.z = state.owner.motion.z;
        state.owner.special.frame = frame;
        advanceSpecials(state.world, 0, 0);
        assertGreaterThan(state.target.status.damage, 0.0);
      }
      assertEquals(normal.target.status.damage, f32(baseDamage * bodyScale));
      assertEquals(ex.target.status.damage, f32(f32(baseDamage * 1.25) * bodyScale));
      assertEquals(runningHeroSpecial(ex.owner)?.regions?.[0]?.hit.effect.growth, runningHeroSpecial(normal.owner)?.regions?.[0]?.hit.effect.growth);
      assertEquals(runningHeroSpecial(ex.owner)?.regions?.[0]?.hit.effect.base, runningHeroSpecial(normal.owner)?.regions?.[0]?.hit.effect.base);
      assertEquals(ex.owner.special.duration, normal.owner.special.duration);
    }
  }
});

test("Vampiric Pounce's ground and air bites deal 25% more and retain their four point heal [spec docs/design/mana.md]", () => {
  for (const air of [false, true]) {
    const normal = cast(Character.dreadlord, SpecialSlot.side, false, air);
    const ex = cast(Character.dreadlord, SpecialSlot.side, true, air);
    for (const state of [normal, ex]) {
      state.owner.status.damage = 30.0;
      state.target.motion.x = 40.0;
      state.target.motion.z = state.owner.motion.z;
      state.owner.special.frame = 16;
      advanceSpecials(state.world, 0, 0);
      assertEquals(state.owner.grab.target, 1);
      state.owner.special.frame = 32;
      advanceSpecials(state.world, 0, 0);
      assertGreaterThan(state.target.status.damage, 0.0);
      assertEquals(state.owner.status.damage, 26.0);
    }
    assertEquals(ex.target.status.damage, f32(normal.target.status.damage * 1.25));
  }
});

test("Spirit Glaive's outward and return damage and all Rain of Fire waves retain EX after the cast ends [spec docs/design/mana.md]", () => {
  for (const air of [false, true]) {
    const normal = projectile(Character.shadowHunter, SpecialSlot.neutral, false, air);
    const ex = projectile(Character.shadowHunter, SpecialSlot.neutral, true, air);
    assertEquals(projectileDamage(ex.shot), 7.5);
    assertEquals(projectileDamage(normal.shot), 6.0);
    normal.shot.life = 48;
    ex.shot.life = 48;
    assertEquals(projectileDamage(ex.shot), 6.25);
    assertEquals(projectileDamage(normal.shot), 5.0);
    for (let wave = 0; wave < 3; wave++) {
      const base = projectile(Character.pitLord, SpecialSlot.down, false, air, wave);
      const upgraded = projectile(Character.pitLord, SpecialSlot.down, true, air, wave);
      assertEquals(projectileDamage(base.shot), 5.0);
      assertEquals(projectileDamage(upgraded.shot), 6.25);
      assertEquals(upgraded.shot.life, base.shot.life);
    }
  }
});

test("Carrion Swarm Sleep Hex and Consecration spawn with 25% more reach and unchanged damage and status [spec docs/design/mana.md]", () => {
  for (const [character, slot, airborne] of [[Character.dreadlord, SpecialSlot.neutral, true],
    [Character.dreadlord, SpecialSlot.down, true], [Character.shadowHunter, SpecialSlot.down, true],
    [Character.forsakenPaladin, SpecialSlot.down, false]] as const) {
    for (const air of airborne ? [false, true] : [false]) {
      const normal = projectile(character, slot, false, air);
      const ex = projectile(character, slot, true, air);
      assertEquals(heroProjectileRadius(ex.shot, ex.spec), f32(heroProjectileRadius(normal.shot, normal.spec) * 1.25));
      assertEquals(projectileDamage(ex.shot), projectileDamage(normal.shot));
      assertEquals(ex.spec.status?.frames, normal.spec.status?.frames);
      assertEquals(ex.spec.status?.airFrames, normal.spec.status?.airFrames);
      assertEquals(ex.spec.status?.immunityFrames, normal.spec.status?.immunityFrames);
      assertEquals(ex.spec.pool?.every, normal.spec.pool?.every);
      assertEquals(ex.shot.life, normal.shot.life);
    }
  }
});

test("Howl reaches bodies beyond the normal roar in both directions and ground and air forms [spec docs/design/mana.md]", () => {
  for (const air of [false, true]) for (const facing of [-1, 1]) {
    const normal = cast(Character.pitLord, SpecialSlot.neutral, false, air);
    const ex = cast(Character.pitLord, SpecialSlot.neutral, true, air);
    const move = runningHeroSpecial(normal.owner);
    const region = move?.regions?.[0]?.hit;
    if (region === undefined) throw new Error("Howl has no region");
    const gap = f32(region.maxX + 25.0);
    for (const state of [normal, ex]) {
      state.target.motion.x = f32(gap * facing);
      state.target.motion.z = state.owner.motion.z;
      state.owner.special.frame = 15;
      advanceSpecials(state.world, 0, 0);
    }
    assertEquals(normal.target.status.damage, 0.0);
    assertEquals(ex.target.status.damage, 7.0);
  }
});

test("all four EX recoveries rise and steer 25% farther with the same duration and helpless ending [spec docs/design/mana.md]", () => {
  for (const character of heroes) for (const direction of [-1, 1]) {
    const normal = cast(character, SpecialSlot.up, false, true);
    const ex = cast(character, SpecialSlot.up, true, true);
    const last = normal.owner.special.duration;
    let normalX = 0.0;
    let normalZ = 0.0;
    let exX = 0.0;
    let exZ = 0.0;
    for (let frame = 1; frame <= last; frame++) {
      for (const state of [normal, ex]) {
        state.owner.special.frame = frame;
        advanceHeroSpecial(state.owner, 0, controls({ direction }));
      }
      if (frame >= 8) {
        normalX = f32(normalX + normal.owner.motion.vx); normalZ = f32(normalZ + normal.owner.motion.vz);
        exX = f32(exX + ex.owner.motion.vx); exZ = f32(exZ + ex.owner.motion.vz);
      }
    }
    assertTrue(Math.abs(f32(exX - f32(normalX * 1.25))) < f32(0.001));
    assertTrue(Math.abs(f32(exZ - f32(normalZ * 1.25))) < f32(0.001));
    assertGreaterThan(exZ, normalZ);
    assertEquals(ex.owner.special.duration, normal.owner.special.duration);
    assertEquals(ex.owner.special.action, SpecialAction.none);
    assertTrue(ex.owner.special.fall && normal.owner.special.fall);
  }
});

test("Serpent Ward keeps stronger shots after the cast ends and EX recall protects four entry frames [spec docs/design/mana.md]", () => {
  const normal = cast(Character.shadowHunter, SpecialSlot.side, false);
  const ex = cast(Character.shadowHunter, SpecialSlot.side, true);
  for (const state of [normal, ex]) {
    state.owner.special.frame = 26;
    advanceHeroSpecial(state.owner);
    cancelSpecialState(state.owner);
    for (let age = 1; age <= 52; age++) {
      advanceFighter(state.world, 0, 0, controls(), 0.0);
      advancePlacedObjects(state.world);
    }
  }
  const normalShot = normal.owner.projectiles.find(p => p.life > 0);
  const exShot = ex.owner.projectiles.find(p => p.life > 0);
  if (normalShot === undefined || exShot === undefined) throw new Error("ward did not fire");
  assertEquals(projectileDamage(normalShot), 7.0);
  assertEquals(projectileDamage(exShot), 8.75);
  assertEquals(ex.owner.placed.durability, normal.owner.placed.durability);
  for (const state of [normal, ex]) {
    state.owner.mana.points = 100;
    assertTrue(startFighterSpecial(state.owner, 0, 0, controls({ specialPressed: true, specialX: 1, shield: state === ex }), state.world));
  }
  assertEquals(normal.owner.status.invincible, 0);
  assertGreaterThan(ex.owner.status.invincible, 0);
  for (let frame = 1; frame <= 6; frame++) {
    advanceFighter(ex.world, 0, 0, controls(), 0.0);
    ex.owner.special.frame = frame;
    advanceHeroSpecial(ex.owner);
    assertEquals(ex.owner.status.invincible > 0, frame <= 4);
  }
  assertEquals(ex.owner.special.duration, normal.owner.special.duration);
});
