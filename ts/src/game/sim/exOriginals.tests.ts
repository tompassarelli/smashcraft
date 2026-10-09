import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, HeroStatusKind, SpecialAction } from "./codes";
import { createFighter } from "./fighter";
import { advanceSpecials, demonHunterJumpOrGlideCancel, felRushRegion, flameCrashRegion, immolationRegion, startFighterSpecial } from "./specials";
import { updateProjectiles } from "./projectiles";
import { FREEZE_TRAP_FREEZE_FRAMES, advanceBear, advanceFreezeTraps } from "./summons";
import { contactBatch, controls, testWorld } from "./testWorld";
import { copyFighterState, sameFighterState } from "../replay/fighterState";
import { firstFighterDifference } from "../replay/difference";
import { canonicalState } from "../replay/canonical";
import { createReplaySnapshot } from "../replay/snapshot";
import { fighterAt } from "./roster";
import { mutableProjectile } from "./fighterProjectiles";
import { clearSpecialOnStock, clearOwnedFreezeTrap } from "./transitions";

function cast(character: Character, x: number, z: number, ex: boolean, air = false) {
  const owner = createFighter(character, 0.0, 1);
  const target = createFighter(Character.rifleman, 900.0, -1);
  const world = testWorld(owner, target);
  owner.motion.grounded = !air;
  owner.motion.surface = air ? undefined : 0;
  owner.motion.z = air ? 300.0 : 0.0;
  assertTrue(startFighterSpecial(owner, 0, 0, controls({ specialPressed: true, specialX: x, specialZ: z }), world));

  owner.special.ex = ex;
  const tick = (frames: number) => { for (let frame = 0; frame < frames; frame++) advanceSpecials(world, 0, frame); };
  return { owner, target, world, tick };
}

test("ground/air blaster EX retain 25% damage after the cast [spec docs/design/mana.md]", () => {
  for (const row of [{ character: Character.rifleman, side: 0, air: false, shot: 9 }, { character: Character.rifleman, side: 0, air: true, shot: 14 }]) {
    const damages: number[] = [];
    for (const ex of [false, true]) {
      const d = cast(row.character, row.side, 0, ex, row.air);
      d.tick(row.shot);
      const projectile = d.owner.projectiles.find(p => p.life > 0);
      assertTrue(projectile !== undefined);
      if (projectile === undefined) continue;
      d.owner.special.action = SpecialAction.none;
      d.owner.special.ex = false;
      d.target.motion.x = f32(projectile.x + projectile.velocityX);
      d.target.motion.z = f32(projectile.z - 45.0);
      updateProjectiles(d.world);
      damages.push(d.target.status.damage);
    }
    assertGreaterThan(damages[0] ?? 0, 0);
    assertEquals(damages[1], f32((damages[0] ?? 0) * 1.25));
  }
});

test("Rifleman EX bear retains 25% strike damage independently of the caster [spec docs/design/mana.md]", () => {
    const damage: number[] = [];
    for (const ex of [false, true]) {
      const d = cast(Character.rifleman, 1, 0, ex);
      d.tick(24);
      d.owner.special.action = SpecialAction.none;
      d.owner.special.ex = false;
        const bear = d.owner.bear;
        bear.swipeCooldown = 0;
        d.target.motion.x = f32(bear.x + bear.velocityX);
        d.target.motion.z = bear.z;
        contactBatch(d.world, () => advanceBear(d.world, 0, 0, 25));
      damage.push(d.target.status.damage);
    }
    assertGreaterThan(damage[0] ?? 0, 0);
    assertEquals(damage[1], f32((damage[0] ?? 0) * 1.25));
});

test("EX both recoil shots and Wing Ascent scale motion 25% and preserve their ending [spec docs/design/mana.md]", () => {
  for (const character of [Character.rifleman, Character.demonHunter]) {
    const plain = cast(character, 0, 1, false);
    const ex = cast(character, 0, 1, true);
    const launch = character === Character.rifleman ? 4 : 3;
    plain.tick(launch);
    ex.tick(launch);
    assertEquals(ex.owner.special.duration, plain.owner.special.duration);
    assertEquals(ex.owner.motion.vz, f32(plain.owner.motion.vz * 1.25));
    if (character === Character.rifleman) {
      for (const d of [plain, ex]) {
        d.tick(7);
        assertTrue(startFighterSpecial(d.owner, 0, 12, controls({ specialPressed: true, specialX: 1 }), d.world));
      }
      assertEquals(ex.owner.motion.vx, f32(plain.owner.motion.vx * 1.25));
      assertTrue(ex.owner.special.ex);
    }
    plain.tick(45);
    ex.tick(45);
    assertEquals(ex.owner.special.action, SpecialAction.none);
    assertEquals(ex.owner.special.fall, plain.owner.special.fall);
  }
});

test("EX trap places on frame 22, ends on 38 and freezes from 50 units after the cast [spec docs/design/mana.md]", () => {
  for (const ex of [false, true]) {
    const d = cast(Character.rifleman, 0, -1, ex);
    d.tick(21);
    assertEquals(d.owner.freezeTrap.life, 0);
    d.tick(1);
    assertTrue(d.owner.freezeTrap.life > 0);
    d.tick(15);
    assertEquals(d.owner.special.action, SpecialAction.riflemanTrap);
    d.tick(1);
    assertEquals(d.owner.special.action, SpecialAction.none);
    d.owner.special.ex = false;
    d.owner.freezeTrap.arming = 0;
    d.target.motion.grounded = true;
    d.target.motion.surface = 0;
    d.target.motion.x = 50.0;
    advanceFreezeTraps(d.world);
    assertEquals(d.target.status.frozenFrames, ex ? FREEZE_TRAP_FREEZE_FRAMES : 0);
  }
});

test("EX Mana Burn keeps 25% greater orb reach after the cast without increasing damage [spec docs/design/mana.md]", () => {
  for (const ex of [false, true]) for (const position of [{ x: 47.0, z: 40.0 }, { x: 74.0, z: 0.0 }]) {
    const d = cast(Character.demonHunter, 0, 0, ex);
    d.tick(16);
    d.owner.special.action = SpecialAction.none;
    d.owner.special.ex = false;
    d.target.motion.x = position.x;
    d.target.motion.z = position.z;
    updateProjectiles(d.world);
    assertEquals(d.target.status.damage, ex ? 5.0 : 0.0);
    assertEquals(d.target.status.condition === HeroStatusKind.stun, ex);
  }
});

test("EX Fel Rush and ground/air Chaos Strike deal 25% greater damage through their real branch [spec docs/design/mana.md]", () => {
  for (const branch of [false, true]) for (const air of [false, true]) {
    const ordinary = felRushRegion(branch ? air ? 3 : 2 : 0, branch ? 5 : 6);
    const upgraded = felRushRegion(branch ? air ? 3 : 2 : 0, branch ? 5 : 6, true);
    assertEquals(upgraded.effect.base, ordinary.effect.base);
    assertEquals(upgraded.effect.growth, ordinary.effect.growth);
    const damage: number[] = [];
    for (const ex of [false, true]) {
      const d = cast(Character.demonHunter, 1, 0, ex, air);
      if (branch) {
        d.tick(9);
        demonHunterJumpOrGlideCancel(d.owner, controls({ attackPressed: true }));
        assertTrue(d.owner.special.form !== 0);
      }
      d.target.motion.x = 50.0;
      d.target.motion.z = d.owner.motion.z;
      d.tick(branch ? 5 : 6);
      damage.push(d.target.status.damage);
      assertEquals(d.owner.special.ex, ex);
    }
    assertEquals(damage[0], ordinary.effect.damage);
    assertEquals(damage[1], f32((damage[0] ?? 0) * 1.25));
  }
});

test("EX Immolation and Flame Crash plunge/burst scale damage while keeping launch data [spec docs/design/mana.md]", () => {
  for (const form of [0, 1, 2]) {
    const ordinary = form === 0 ? immolationRegion(true) : flameCrashRegion(form, form === 1 ? 5 : 1);
    const upgraded = form === 0 ? immolationRegion(true, true) : flameCrashRegion(form, form === 1 ? 5 : 1, true);
    assertEquals(upgraded.effect.base, ordinary.effect.base);
    assertEquals(upgraded.effect.growth, ordinary.effect.growth);
    const damage: number[] = [];
    for (const ex of [false, true]) {
      const d = cast(Character.demonHunter, 0, -1, ex, form !== 0);
      if (form === 2) { d.owner.motion.grounded = true; d.owner.motion.surface = 0; }
      d.target.motion.x = 30.0;
      d.target.motion.z = form === 1 ? 220.0 : d.owner.motion.z;
      d.tick(form === 0 ? 4 : form === 1 ? 5 : 1);
      damage.push(d.target.status.damage);
    }
    assertEquals(damage[0], ordinary.effect.damage);
    assertEquals(damage[1], f32((damage[0] ?? 0) * 1.25));
  }
});

test("EX projectile, summon and trap snapshots stay independent and differences include upgrade flags [invariant]", () => {
  const d = cast(Character.demonHunter, 0, 0, true);
  d.tick(16);
  d.owner.bear.exDamage = true;
  d.owner.freezeTrap.exReach = true;
  const saved = createFighter(Character.demonHunter, 0.0, 1);
  copyFighterState(saved, d.owner, 3);
  assertTrue(sameFighterState(saved, d.owner));
  assertEquals(firstFighterDifference(saved, d.owner, 3, 3), undefined);
  const canonical = (f: Readonly<typeof saved>) => {
    const snapshot = createReplaySnapshot();
    copyFighterState(fighterAt(snapshot.world, 0), f, 3);
    return canonicalState(snapshot);
  };
  const before = canonical(saved);
  updateProjectiles(d.world);
  assertEquals(canonical(saved), before);
  for (const kind of ["bear", "trap", "projectile"] as const) {
    const changed = createFighter(Character.demonHunter, 0.0, 1);
    copyFighterState(changed, saved, 3);
    if (kind === "bear") changed.bear.exDamage = false;
    else if (kind === "trap") changed.freezeTrap.exReach = false;
    else mutableProjectile(changed, 0).exReach = false;
    assertFalse(sameFighterState(changed, saved));
    assertTrue(firstFighterDifference(changed, saved, 3, 3) !== undefined);
    assertTrue(canonical(changed) !== before);
  }
  const restored = createFighter(Character.demonHunter, 0.0, 1);
  copyFighterState(restored, saved, 3);
  const restoredTarget = createFighter(Character.rifleman, 900.0, -1);
  const replayed = testWorld(restored, restoredTarget);
  updateProjectiles(replayed);
  assertTrue(sameFighterState(restored, d.owner));
  clearSpecialOnStock(saved);
  clearOwnedFreezeTrap(saved);
  assertFalse(saved.bear.exDamage);
  assertFalse(saved.freezeTrap.exReach);
  assertFalse(saved.projectiles.some(p => p.exReach));
});
