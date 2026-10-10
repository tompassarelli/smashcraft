import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, SpecialAction } from "./codes";
import { createFighter } from "./fighter";
import { advanceSpecials, startFighterSpecial } from "./specials";
import { updateProjectiles } from "./projectiles";
import { controls, testWorld } from "./testWorld";
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
